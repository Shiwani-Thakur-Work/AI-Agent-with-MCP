require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Priority list — smaller/faster models first to stay within free-tier 8k TPM.
const PREFERRED_MODELS = [
    'llama-3.1-8b-instant',
    'llama3-8b-8192',
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama3-70b-8192',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
];

/** Queries the live Groq /models endpoint and returns the best available model. */
async function resolveBestModel() {
    if (process.env.GROQ_MODEL) {
        console.log('[LLM] Using pinned model from env: ' + process.env.GROQ_MODEL);
        return process.env.GROQ_MODEL;
    }
    try {
        const page = await groq.models.list();
        const activeIds = new Set((page.data || []).map(function(m) { return m.id; }));
        for (var i = 0; i < PREFERRED_MODELS.length; i++) {
            if (activeIds.has(PREFERRED_MODELS[i])) {
                console.log('[LLM] Auto-selected model: ' + PREFERRED_MODELS[i]);
                return PREFERRED_MODELS[i];
            }
        }
        var first = (page.data || [])[0] && (page.data || [])[0].id;
        if (first) {
            console.warn('[LLM] No preferred model available. Falling back to: ' + first);
            return first;
        }
    } catch (err) {
        console.warn('[LLM] Could not fetch model list:', err.message);
    }
    return 'llama-3.1-8b-instant';
}

/**
 * Parse the x-ratelimit-reset-tokens header (e.g. '37.5s', '1m20s') into ms.
 * Returns 0 if the header is missing or unparseable.
 */
function parseResetMs(headers) {
    try {
        var raw = headers && headers.get && headers.get('x-ratelimit-reset-tokens');
        if (!raw) return 0;
        var total = 0;
        var mMatch = raw.match(/(\d+)m/);
        var sMatch = raw.match(/([\d.]+)s/);
        if (mMatch) total += parseInt(mMatch[1], 10) * 60000;
        if (sMatch) total += parseFloat(sMatch[1]) * 1000;
        return total;
    } catch (e) {
        return 0;
    }
}

/**
 * Processes reviews and generates a structured Pulse report.
 * @param {Array} reviews - Normalized reviews from ingestion
 * @returns {Promise<Object>} { report, emailDraft, themes, meta }
 */
async function generatePulseContent(reviews) {
    console.log('[LLM] Processing ' + reviews.length + ' reviews via Groq...');

    var model = await resolveBestModel();

    // ── Aggressive token budget ────────────────────────────────────────────
    // Free tier: 8 000 TPM.  Target: ~2 000 prompt + 1 200 output = 3 200 total.
    // This leaves headroom even when tokens from a prior request haven't reset yet.
    var MAX_REVIEWS    = 40;   // ~40 reviews × 30 tok avg = 1 200 tok
    var MAX_REVIEW_LEN = 120;  // chars, ~30 tokens each
    var MAX_OUT_TOKENS = 1200;

    var reviewsToProcess = reviews.slice(0, MAX_REVIEWS);
    var today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    var reviewsText = reviewsToProcess.map(function(r) {
        var text = (r.text || '').slice(0, MAX_REVIEW_LEN);
        return '[' + r.rating + 'star] ' + text;
    }).join('\n');

    // Compact prompt — NO JSON schema example (saves ~400 tokens).
    // Field names are described inline so the model knows exactly what to produce.
    var prompt = [
        'Analyse these ' + reviewsToProcess.length + ' app reviews (date: ' + today + ').',
        'Return ONLY a raw JSON object with these exact keys:',
        '  meta: { totalReviews(int), weeksAnalysed(12), generatedAt(ISO), sentimentBreakdown:{positive,neutral,negative as ints summing to 100} }',
        '  themes: array of exactly 3 objects: { id(one of ads/playback/discovery/ui/offline/performance/content/pricing/support), title(<=5 words), icon(emoji), description(2 sentences), percentage(int), quotes:[2 verbatim strings, strip PII], actionItem(string) }',
        '  report: string, 150-word executive summary',
        '  emailDraft: string starting with Subject:, 80 words, signed Best\\nShiwani\\nProduct Manager, includes [REPORT_URL]',
        'No markdown. No code fences. No extra text. Just the JSON.',
        '',
        'REVIEWS:',
        reviewsText
    ].join('\n');

    var MAX_RETRIES = 3;
    var lastError;

    for (var attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            var response = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are a product analyst. Respond with a single raw JSON object only.' },
                    { role: 'user',   content: prompt }
                ],
                model: model,
                response_format: { type: 'json_object' },
                max_tokens: MAX_OUT_TOKENS,
                temperature: 0.3
            });

            var resultText = response.choices[0] && response.choices[0].message && response.choices[0].message.content;
            if (!resultText) throw new Error('Empty response from Groq');

            var parsed = JSON.parse(resultText);
            console.log('[LLM] Success (model: ' + model + ').');
            return {
                report:     parsed.report     || '',
                emailDraft: parsed.emailDraft || '',
                themes:     parsed.themes     || [],
                meta:       parsed.meta       || {}
            };

        } catch (error) {
            lastError = error;
            var code   = error && error.error && error.error.error && error.error.error.code;
            var failedGen = error && error.error && error.error.error && error.error.error.failed_generation;

            var isRateLimit    = error.status === 429;
            var isModelGone    = error.status === 404 || code === 'model_decommissioned';
            // failed_generation==='' means the model ran out of output tokens (token exhaustion),
            // not a bad prompt. Treat it like a rate-limit: wait for the TPM window to reset.
            var isTokenExhaust = code === 'json_validate_failed' && failedGen === '';
            var isJsonError    = code === 'json_validate_failed' && failedGen !== '';

            if (isModelGone) {
                console.error('[LLM] Model ' + model + ' not found. Set GROQ_MODEL secret to override.');
                throw error;
            }

            if (attempt < MAX_RETRIES) {
                var waitMs;
                if (isTokenExhaust || isRateLimit) {
                    // Read the exact reset time from the response header, add a 5s buffer.
                    var resetMs = parseResetMs(error.headers);
                    waitMs = resetMs > 0 ? resetMs + 5000 : 65000;
                    console.warn('[LLM] Token quota exhausted on attempt ' + attempt + '. Waiting ' + Math.ceil(waitMs / 1000) + 's for TPM window reset...');
                } else if (isJsonError) {
                    waitMs = 5000;
                    console.warn('[LLM] JSON validation error on attempt ' + attempt + '. Retrying in 5s...');
                } else {
                    waitMs = 10000;
                    console.warn('[LLM] Unexpected error on attempt ' + attempt + '. Retrying in 10s...');
                }
                await new Promise(function(res) { setTimeout(res, waitMs); });
                continue;
            }

            console.error('[LLM] All attempts failed:', error.message || error);
            throw error;
        }
    }

    throw lastError;
}

module.exports = { generatePulseContent };

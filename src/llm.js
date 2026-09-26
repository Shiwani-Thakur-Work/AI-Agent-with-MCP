require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Priority list: smaller/faster models first to stay within free-tier 8k TPM.
// Includes both meta-llama/ prefix (current) and legacy bare IDs for compatibility.
// openai/gpt-oss-* models excluded — they are reasoning models incompatible with json_object mode.
const PREFERRED_MODELS = [
    'meta-llama/llama-3.1-8b-instant',
    'meta-llama/llama-3.3-70b-versatile',
    'meta-llama/llama-3.1-70b-versatile',
    'meta-llama/llama3-70b-8192',
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama3-70b-8192',
    'llama3-8b-8192',
];

// Prefixes for models known to be incompatible with response_format:json_object.
const EXCLUDED_PREFIXES = ['openai/gpt-oss', 'qwen'];

function isExcluded(id) {
    return EXCLUDED_PREFIXES.some(function(p) { return id.indexOf(p) === 0; });
}

/** Queries the live Groq /models endpoint and returns the best available model. */
async function resolveBestModel() {
    if (process.env.GROQ_MODEL) {
        console.log('[LLM] Using pinned model from env: ' + process.env.GROQ_MODEL);
        return process.env.GROQ_MODEL;
    }
    try {
        var page = await groq.models.list();
        var activeIds = new Set((page.data || []).map(function(m) { return m.id; }));
        console.log('[LLM] Available models: ' + Array.from(activeIds).join(', '));
        for (var i = 0; i < PREFERRED_MODELS.length; i++) {
            if (activeIds.has(PREFERRED_MODELS[i])) {
                console.log('[LLM] Auto-selected model: ' + PREFERRED_MODELS[i]);
                return PREFERRED_MODELS[i];
            }
        }
        // No preferred model found — pick first non-excluded model
        var compatible = (page.data || []).filter(function(m) { return !isExcluded(m.id); });
        if (compatible.length > 0) {
            console.warn('[LLM] No preferred model found. Falling back to: ' + compatible[0].id);
            return compatible[0].id;
        }
    } catch (err) {
        console.warn('[LLM] Could not fetch model list:', err.message);
    }
    return 'meta-llama/llama-3.1-8b-instant';
}

/**
 * Parse x-ratelimit-reset-tokens header (e.g. '37.5s', '1m20s') into milliseconds.
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
    } catch (e) { return 0; }
}

/**
 * Processes reviews and generates a structured Pulse report.
 * @param {Array} reviews - Normalized reviews from ingestion
 * @returns {Promise<Object>} { report, emailDraft, themes, meta }
 */
async function generatePulseContent(reviews) {
    console.log('[LLM] Processing ' + reviews.length + ' reviews via Groq...');

    var model = await resolveBestModel();

    // Free tier: 8 000 TPM. Target: ~2 000 prompt + 1 200 output = 3 200 total.
    var MAX_REVIEWS    = 40;
    var MAX_REVIEW_LEN = 120;
    var MAX_OUT_TOKENS = 1200;

    var reviewsToProcess = reviews.slice(0, MAX_REVIEWS);
    var today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    var reviewsText = reviewsToProcess.map(function(r) {
        var text = (r.text || '').slice(0, MAX_REVIEW_LEN);
        return '[' + r.rating + 'star] ' + text;
    }).join('\n');

    var prompt = [
        'Analyse these ' + reviewsToProcess.length + ' app reviews (date: ' + today + ').',
        'Return ONLY a raw JSON object with these exact keys:',
        '  meta: { totalReviews(int), weeksAnalysed(12), generatedAt(ISO), sentimentBreakdown:{positive,neutral,negative as ints summing to 100} }',
        '  themes: array of exactly 3 objects: { id(one of ads/playback/discovery/ui/offline/performance/content/pricing/support), title(<=5 words), icon(emoji), description(2 sentences), percentage(int), quotes:[2 verbatim strings no PII], actionItem(string) }',
        '  report: string, 150-word executive summary',
        '  emailDraft: string starting with Subject:, ~80 words, signed Best\\nShiwani\\nProduct Manager, includes [REPORT_URL]',
        'No markdown. No code fences. Only the JSON object.',
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
            var errObj     = error && error.error && error.error.error;
            var code       = errObj && errObj.code;
            var failedGen  = errObj && errObj.failed_generation;

            var isRateLimit    = error.status === 429;
            var isModelGone    = error.status === 404 || code === 'model_decommissioned';
            // failed_generation==='' with json_validate_failed = token-budget exhaustion,
            // NOT a prompt problem. Wait for the TPM window to reset.
            var isTokenExhaust = code === 'json_validate_failed' && failedGen === '';
            var isJsonError    = code === 'json_validate_failed' && failedGen !== '';

            if (isModelGone) {
                console.error('[LLM] Model gone: ' + model + '. Set GROQ_MODEL secret to override.');
                throw error;
            }

            if (attempt < MAX_RETRIES) {
                var waitMs;
                if (isTokenExhaust || isRateLimit) {
                    var resetMs = parseResetMs(error.headers);
                    waitMs = resetMs > 0 ? resetMs + 5000 : 65000;
                    console.warn('[LLM] Token quota exhausted on attempt ' + attempt + '. Waiting ' + Math.ceil(waitMs / 1000) + 's...');
                } else if (isJsonError) {
                    waitMs = 5000;
                    console.warn('[LLM] JSON validation error on attempt ' + attempt + '. Retrying in 5s...');
                } else {
                    waitMs = 10000;
                    console.warn('[LLM] Error on attempt ' + attempt + '. Retrying in 10s...');
                }
                await new Promise(function(res) { setTimeout(res, waitMs); });
                continue;
            }

            console.error('[LLM] All attempts exhausted:', error.message || error);
            throw error;
        }
    }
    throw lastError;
}

module.exports = { generatePulseContent };

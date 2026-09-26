require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Priority-ordered list of preferred models (best quality first).
// The first one found active on the account will be used.
const PREFERRED_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama3-70b-8192',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'llama-3.1-8b-instant',
    'llama3-8b-8192',
];

/**
 * Fetches the live model list from Groq and returns the best available model ID.
 * Falls back gracefully if the models endpoint is unavailable.
 */
async function resolveBestModel() {
    // If the user pinned a model via env var, always honour it.
    if (process.env.GROQ_MODEL) {
        console.log(`[LLM] Using pinned model from env: ${process.env.GROQ_MODEL}`);
        return process.env.GROQ_MODEL;
    }

    try {
        const modelsPage = await groq.models.list();
        const activeIds = new Set((modelsPage.data || []).map(m => m.id));

        for (const candidate of PREFERRED_MODELS) {
            if (activeIds.has(candidate)) {
                console.log(`[LLM] Auto-selected model: ${candidate}`);
                return candidate;
            }
        }

        // None of our preferred models are available — use whatever is first
        const firstAvailable = (modelsPage.data || [])[0]?.id;
        if (firstAvailable) {
            console.warn(`[LLM] No preferred model found. Falling back to: ${firstAvailable}`);
            return firstAvailable;
        }
    } catch (err) {
        console.warn('[LLM] Could not fetch model list, using hardcoded fallback:', err.message);
    }

    // Hard fallback if even the models endpoint fails
    return 'llama-3.3-70b-versatile';
}

/**
 * Processes reviews and generates a rich, structured Pulse report.
 * @param {Array} reviews - Normalized reviews from ingestion
 * @returns {Promise<Object>} { report, emailDraft, themes, meta }
 */
async function generatePulseContent(reviews) {
    console.log(`[LLM] Processing ${reviews.length} reviews via Groq...`);

    const model = await resolveBestModel();

    // Token budget management.
    // Groq free tier: ~8 000 TPM. Budget: prompt ~3 200 tok + output 2 800 tok.
    const MAX_REVIEWS    = 80;
    const MAX_REVIEW_LEN = 200;
    const MAX_OUT_TOKENS = 2800;

    const reviewsToProcess = reviews.slice(0, MAX_REVIEWS);

    const today = new Date().toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });

    const reviewsText = reviewsToProcess
        .map(r => {
            const text = (r.text || '').slice(0, MAX_REVIEW_LEN);
            return `[${r.rating}★] ${text}`;
        })
        .join('\n');

    const themeIds = 'ads, playback, discovery, ui, offline, performance, content, pricing, support';
    const jsonStructure = JSON.stringify({
        meta: {
            totalReviews: '<number>',
            weeksAnalysed: 12,
            generatedAt: '<ISO date string>',
            sentimentBreakdown: { positive: '<0-100>', neutral: '<0-100>', negative: '<0-100>' }
        },
        themes: [{
            id: '<one of: ' + themeIds + '>',
            title: '<short title>',
            icon: '<one relevant emoji>',
            description: '<2-sentence description>',
            percentage: '<integer>',
            quotes: ['<quote 1>', '<quote 2>'],
            actionItem: '<specific action>'
        }],
        report: '<200-250 word executive summary>',
        emailDraft: '<email text starting with Subject: on first line>'
    }, null, 2);

    const buildPrompt = (reviewsText, today) => [
        'You are a senior product analyst. Analyse the following user reviews and produce a structured feedback pulse report.',
        '',
        'Todays date: ' + today,
        '',
        'ANALYSIS REQUIREMENTS:',
        '1. Identify exactly 3 dominant themes. Each must be supported by multiple reviews.',
        '2. For each theme: short title (max 5 words), 2-sentence description, 2 verbatim user quotes (strip PII), percentage of negative reviews mentioning it (roughly 80-90 percent total), one actionable product recommendation, one id from: ' + themeIds + '.',
        '3. Sentiment breakdown summing to 100: positive percent, neutral percent, negative percent.',
        '4. Executive summary (200-250 words): overall state, each theme, next steps, sentiment direction. Strip all PII.',
        '5. Email to product team (100-150 words): addressed to Team, names the 3 themes, includes [REPORT_URL], signed Best,\\nShiwani\\nProduct Manager.',
        '',
        'RESPOND IN RAW JSON ONLY - no markdown, no code fences, no extra text:',
        jsonStructure,
        '',
        'REVIEWS:',
        reviewsText
    ].join('\n');

    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const prompt = buildPrompt(reviewsText, today);
            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert product analyst. Output raw, valid JSON only - no markdown, no code fences, no extra text before or after the JSON object.'
                    },
                    { role: 'user', content: prompt }
                ],
                model,
                response_format: { type: 'json_object' },
                max_tokens: MAX_OUT_TOKENS,
                temperature: 0.3
            });

            const resultText = response.choices[0]?.message?.content;
            if (!resultText) throw new Error('Empty response received from Groq');

            const parsed = JSON.parse(resultText);

            console.log(`[LLM] Successfully generated rich Pulse report (model: ${model}).`);
            return {
                report:     parsed.report     || '',
                emailDraft: parsed.emailDraft || '',
                themes:     parsed.themes     || [],
                meta:       parsed.meta       || {}
            };

        } catch (error) {
            lastError = error;

            const isRateLimit      = error?.status === 429;
            const isJsonValidation = error?.error?.error?.code === 'json_validate_failed';
            const isModelGone      = error?.status === 404 || error?.error?.error?.code === 'model_decommissioned';

            if (isModelGone) {
                // Model disappeared mid-run — this should never happen after resolveBestModel(),
                // but if it does, bail immediately (no retry) so the error is visible.
                console.error(`[LLM] Model ${model} not found. Set GROQ_MODEL in your secrets to override.`);
                throw error;
            }

            if ((isRateLimit || isJsonValidation) && attempt < MAX_RETRIES) {
                const waitMs = Math.pow(2, attempt) * 15000; // 30s, then 60s
                console.warn(
                    `[LLM] Attempt ${attempt}/${MAX_RETRIES} failed` +
                    ` (${isRateLimit ? 'rate-limit' : 'JSON validation'}).` +
                    ` Retrying in ${waitMs / 1000}s...`
                );
                await new Promise(res => setTimeout(res, waitMs));
                continue;
            }

            console.error('[LLM] Error communicating with Groq:', error);
            throw error;
        }
    }

    throw lastError;
}

module.exports = { generatePulseContent };

require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Processes reviews and generates a rich, structured Pulse report.
 * @param {Array} reviews - Normalized reviews from ingestion
 * @returns {Promise<Object>} { report, emailDraft, themes, meta }
 */
async function generatePulseContent(reviews) {
    console.log(`[LLM] Processing ${reviews.length} reviews via Groq...`);

    // Token budget management:
    // Groq free tier: ~8 000 TPM.  Budget: prompt ~3 200 tok + output 2 800 tok.
    const MAX_REVIEWS    = 80;   // reduced from 150
    const MAX_REVIEW_LEN = 200;  // chars per review
    const MAX_OUT_TOKENS = 2800; // reduced from 4000

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

    // Build prompt using string concatenation to keep special chars safe
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

    const buildPrompt = (reviewsText, today) => {
        return [
            'You are a senior product analyst. Analyse the following user reviews and produce a structured feedback pulse report.',
            '',
            'Todays date: ' + today,
            '',
            'ANALYSIS REQUIREMENTS:',
            '1. Identify exactly 3 dominant themes. Each must be supported by multiple reviews.',
            '2. For each theme:',
            '   - Short title (max 5 words)',
            '   - 2-sentence description of the pattern',
            '   - 2 verbatim user quotes (strip PII)',
            '   - Percentage of negative reviews mentioning this theme (realistic; roughly 80-90 percent total across all themes)',
            '   - One specific, actionable product recommendation',
            '   - One id from: ' + themeIds,
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
    };

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
                model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
                response_format: { type: 'json_object' },
                max_tokens: MAX_OUT_TOKENS,
                temperature: 0.3
            });

            const resultText = response.choices[0]?.message?.content;
            if (!resultText) throw new Error('Empty response received from Groq');

            const parsed = JSON.parse(resultText);

            console.log('[LLM] Successfully generated rich Pulse report.');
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

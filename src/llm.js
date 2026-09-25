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

    // Cap at 150 reviews to stay well within TPM limits while maximising signal
    const MAX_REVIEWS = 150;
    const reviewsToProcess = reviews.slice(0, MAX_REVIEWS);

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const reviewsText = reviewsToProcess
        .map(r => `[${r.rating}★] ${r.text}`)
        .join('\n');

    const prompt = `
You are a senior product analyst at a leading tech company.
Analyse the following ${reviewsToProcess.length} real user reviews and produce a comprehensive, structured feedback pulse report.

Today's date: ${today}

ANALYSIS REQUIREMENTS:
1. Identify exactly 3 dominant themes from the reviews. Each theme must be genuinely supported by multiple reviews.
2. For each theme:
   - Give it a short, clear title (max 5 words)
   - Write a 2–3 sentence description of the pattern
   - Pick 2 verbatim, unedited user quotes as evidence (strip any personal names/emails)
   - Estimate what % of negative reviews mention this theme (be realistic, they should sum to roughly 80–90% across themes)
   - Suggest one specific, actionable product recommendation for the PM team
   - Assign one of these IDs: ads, playback, discovery, ui, offline, performance, content, pricing, support
3. Calculate overall sentiment:
   - positive: % of reviews that are clearly satisfied (3–5 stars with positive language)
   - neutral: % of mixed or neutral reviews
   - negative: % of clearly dissatisfied reviews (1–2 stars or harsh criticism)
4. Write a professional EXECUTIVE SUMMARY (300–400 words) covering:
   - Opening sentence summarising overall state
   - Each theme with context and supporting quotes
   - Concrete next steps section
   - Closing with overall sentiment direction
   Strip all PII (names, emails, phone numbers).
5. Write a professional EMAIL to the product team (150–200 words) that:
   - Is addressed to "Team"
   - References the attached pulse report
   - Highlights the 3 themes by name
   - Includes this placeholder exactly: [REPORT_URL]
   - Is signed: "Best,\\nShiwani\\nProduct Manager"

RESPOND IN RAW JSON ONLY — no markdown, no code fences. Use this exact structure:
{
  "meta": {
    "totalReviews": <number>,
    "weeksAnalysed": 12,
    "generatedAt": "<ISO date string>",
    "sentimentBreakdown": { "positive": <0-100>, "neutral": <0-100>, "negative": <0-100> }
  },
  "themes": [
    {
      "id": "<one of: ads|playback|discovery|ui|offline|performance|content|pricing|support>",
      "title": "<short title>",
      "icon": "<one relevant emoji>",
      "description": "<2-3 sentence description>",
      "percentage": <integer, % of negative reviews>,
      "quotes": ["<verbatim quote 1>", "<verbatim quote 2>"],
      "actionItem": "<specific action recommendation>"
    }
  ],
  "report": "<full 300-400 word executive summary as plain text with \\n for line breaks>",
  "emailDraft": "<full email text starting with Subject: on the first line>"
}

REVIEWS:
${reviewsText}
`;

    try {
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert product analyst. Always output raw, valid JSON with no markdown or code fences.'
                },
                { role: 'user', content: prompt }
            ],
            model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
            response_format: { type: 'json_object' },
            max_tokens: 4000,
            temperature: 0.4
        });

        const resultText = response.choices[0]?.message?.content;
        const parsed = JSON.parse(resultText);

        console.log('[LLM] Successfully generated rich Pulse report.');
        return {
            report:      parsed.report      || '',
            emailDraft:  parsed.emailDraft  || '',
            themes:      parsed.themes      || [],
            meta:        parsed.meta        || {}
        };
    } catch (error) {
        console.error('[LLM] Error communicating with Groq:', error);
        throw error;
    }
}

module.exports = { generatePulseContent };

require('dotenv').config();
const { fetchAndNormalizeReviews } = require('./src/ingestion');
const { generatePulseContent } = require('./src/llm');
const { createMCPClient } = require('./src/mcp-client');

/**
 * Main Orchestrator for the Weekly Mobile-Store Feedback Pulse.
 * Ingestion → LLM Analysis → Google Docs (MCP) → Gmail Draft (MCP)
 */
async function main() {
    console.log('--- Starting Weekly Pulse Orchestrator ---');
    try {
        // Step 1: Ingestion
        console.log('\n[Step 1] Fetching reviews from App Store and Play Store...');
        const { playStoreReviews, appStoreReviews } = await fetchAndNormalizeReviews();
        const reviews = [...playStoreReviews, ...appStoreReviews];
        
        if (reviews.length === 0) {
            console.log('No recent reviews found. Exiting pipeline.');
            return;
        }

        // Step 2 & 3: LLM Processing
        console.log('\n[Step 2 & 3] Processing reviews using Groq LLM...');
        const { report, emailDraft, themes, meta } = await generatePulseContent(reviews);
        
        // Save full structured draft (themes + meta) so the dashboard API can serve it
        const fs   = require('fs');
        const path = require('path');
        const draftPath = path.join(__dirname, 'data', 'pulse_draft.json');
        const weekStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const draft = {
            id:           `run-${Date.now()}`,
            week:         `Week of ${weekStr}`,
            date:         new Date().toISOString().split('T')[0],
            totalReviews: reviews.length,
            playStore:    playStoreReviews.length,
            appStore:     appStoreReviews.length,
            sentiment:    meta.sentimentBreakdown || { positive: 0, neutral: 0, negative: 0 },
            themes:       themes || [],
            report,
            emailDraft,
            docUrl:       null  // filled in after MCP step
        };

        fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));
        console.log(`\n[Info] Saved structured draft to ${draftPath}`);

        console.log('\n========================================');
        console.log('=== GENERATED PULSE REPORT ===');
        console.log('========================================\n');
        console.log(report);
        console.log('\n========================================');
        console.log('=== GENERATED EMAIL DRAFT ===');
        console.log('========================================\n');
        console.log(emailDraft);
        console.log('\n========================================');

        // Step 4 + 5: MCP (Google Docs + Gmail) — non-fatal if MCP server is unavailable
        try {
            console.log('\n[Step 4] Calling Google Docs MCP to append the report...');
            const documentId = process.env.PULSE_DOC_ID;
            let docUrl = null;

            const mcpClient = await createMCPClient({ 
                serverUrl: process.env.MCP_SERVER_URL || 'http://localhost:3000/sse' 
            });

            if (documentId) {
                try {
                    const timestamp = new Date().toUTCString();
                    await mcpClient.callTool({
                        name: 'google_docs_append_content',
                        arguments: {
                            documentId,
                            content: `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nWeekly Pulse Report — ${timestamp}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${report}`
                        }
                    });
                    docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
                    draft.docUrl = docUrl;
                    fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));
                    console.log(`[MCP Docs] Appended. Doc URL: ${docUrl}`);
                } catch (err) {
                    console.warn('[MCP Docs] Could not append to Google Doc:', err.message);
                }
            }

            // Step 5: Gmail Draft
            console.log('\n[Step 5] Calling Gmail MCP to draft email...');
            const finalEmail = emailDraft.replace('[REPORT_URL]', docUrl || 'URL pending');
            draft.emailDraft = finalEmail;
            fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));

            try {
                const lines   = finalEmail.split('\n');
                const subject = lines[0].replace('Subject:', '').trim();
                const body    = lines.slice(2).join('\n').trim();
                await mcpClient.callTool({
                    name: 'gmail_create_draft',
                    arguments: { to: [process.env.RECEIVER_EMAIL || 'shiwanithakur5498@gmail.com'], subject, body }
                });
                console.log('[MCP Gmail] Draft created successfully.');
            } catch (err) {
                console.warn('[MCP Gmail] Could not create Gmail draft:', err.message);
            }
        } catch (mcpErr) {
            console.warn('\n[Warning] MCP Server unavailable — skipping Docs/Gmail steps. Draft saved locally.');
            console.warn('  Start the MCP Server with: npm run start (in the MCP Server folder)');
        }

        console.log('\n--- Weekly Pulse Pipeline Completed ---');
    } catch (error) {
        console.error('\n[Error] Pipeline failed:', error);
        process.exit(1);
    }
}

if (require.main === module) { main(); }
module.exports = { main };

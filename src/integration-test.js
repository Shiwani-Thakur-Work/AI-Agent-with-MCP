require('dotenv').config();
const { createMCPClient } = require('./mcp-client');

async function runIntegrationTest() {
    console.log("--- Starting MCP Integration Test ---");

    const serverUrl = process.env.MCP_SERVER_URL || "https://mcp-server-production-4457.up.railway.app/sse";
    const documentId = process.env.TEST_GOOGLE_DOC_ID; 

    if (!documentId) {
        console.warn("\n[Warning] TEST_GOOGLE_DOC_ID is not set in .env.");
        console.warn("Please create a dummy Google Doc, and set TEST_GOOGLE_DOC_ID in your .env file to test the docs integration.\n");
    }

    try {
        const client = await createMCPClient({ serverUrl });

        console.log("\n[Test 1] Listing Tools:");
        const tools = await client.listTools();
        console.log("Available tools:", tools.tools.map(t => t.name).join(', '));

        if (documentId) {
            console.log(`\n[Test 2] Appending to Google Doc (${documentId})...`);
            const docResult = await client.callTool({
                name: "google_docs_append_content",
                arguments: {
                    documentId,
                    content: `\n\n--- Dummy Content Appended at ${new Date().toISOString()} ---\nIntegration Test Successful!`
                }
            });
            console.log("Docs result:", JSON.stringify(docResult, null, 2));
        } else {
            console.log("\n[Test 2] Skipping Google Doc append test (TEST_GOOGLE_DOC_ID not provided).");
        }

        console.log("\n[Test 3] Creating a Gmail Draft...");
        const draftResult = await client.callTool({
            name: "gmail_create_draft",
            arguments: {
                to: ["test@example.com"],
                subject: "Dummy Email from MCP Integration Test",
                body: "This is a dummy email created by the Weekly Pulse Agent integration test."
            }
        });
        console.log("Gmail result:", JSON.stringify(draftResult, null, 2));

        console.log("\n--- Integration Test Completed Successfully ---");
        
        // Disconnect if necessary, or just exit
        process.exit(0);

    } catch (error) {
        console.error("\n[Error] Integration test failed:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    runIntegrationTest();
}

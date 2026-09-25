import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function main() {
  const transport = new SSEClientTransport(new URL("https://mcp-server-production-4457.up.railway.app/sse"));
  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  console.log("Connected to MCP server");

  const tools = await client.listTools();
  console.log("Tools available:", JSON.stringify(tools, null, 2));

  // If there are tools, try to see their details
  process.exit(0);
}

main().catch(console.error);

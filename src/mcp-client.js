const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

/**
 * Initializes and connects to the external Google Docs & Gmail MCP Server.
 * If serverUrl is provided, it connects via SSE. 
 * Otherwise, it connects via Stdio using serverCommand and serverArgs.
 * 
 * @param {Object} options
 * @param {string} [options.serverUrl] - URL for SSE connection (e.g. 'https://mcp-server-production-4457.up.railway.app/sse')
 * @param {string} [options.serverCommand] - The command to start the MCP server (e.g. 'node')
 * @param {string[]} [options.serverArgs] - The arguments for the command (e.g. ['path/to/server/index.js'])
 * @returns {Promise<Client>} The connected MCP Client
 */
async function createMCPClient(options = {}) {
    let transport;
    
    if (options.serverUrl) {
        console.log(`[MCP] Connecting to server via SSE: ${options.serverUrl}`);
        transport = new SSEClientTransport(new URL(options.serverUrl));
    } else if (options.serverCommand) {
        console.log(`[MCP] Connecting to server via Stdio: ${options.serverCommand} ${options.serverArgs.join(' ')}`);
        transport = new StdioClientTransport({
            command: options.serverCommand,
            args: options.serverArgs || []
        });
    } else {
        throw new Error("Either serverUrl or serverCommand must be provided to createMCPClient.");
    }

    const client = new Client({
        name: "weekly-pulse-agent",
        version: "1.0.0"
    }, {
        capabilities: {}
    });

    try {
        await client.connect(transport);
        console.log('[MCP] Successfully connected to the MCP Server!');
        return client;
    } catch (error) {
        console.error('[MCP] Failed to connect to the MCP Server:', error);
        throw error;
    }
}

module.exports = {
    createMCPClient
};

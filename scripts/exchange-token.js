require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('c:/Users/shiwa/OneDrive/Desktop/MCP Server/node_modules/googleapis');

const codeArg = process.argv[2];
if (!codeArg) {
    console.error('Usage: node scripts/exchange-token.js "<AUTHORIZATION_CODE_OR_CALLBACK_URL>"');
    process.exit(1);
}

// Extract code if user pasted the entire redirected URL or query string
let cleanCode = codeArg.trim();
if (cleanCode.includes('code=')) {
    const match = cleanCode.match(/(?:[?&]|^)code=([^&]+)/);
    if (match) cleanCode = decodeURIComponent(match[1]);
}

const envContent = fs.readFileSync('c:/Users/shiwa/OneDrive/Desktop/MCP Server/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v) env[k.trim()] = v.join('=').trim();
});

const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
);

async function run() {
    try {
        console.log('Exchanging authorization code with Google...');
        const { tokens } = await oauth2Client.getToken(cleanCode);
        console.log('Successfully retrieved new tokens!');

        const tokenPath = 'c:/Users/shiwa/OneDrive/Desktop/MCP Server/tokens/google-token.json';
        fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
        console.log(`Saved new token to: ${tokenPath}`);

        if (tokens.refresh_token) {
            console.log('\n======================================================');
            console.log('NEW GOOGLE_REFRESH_TOKEN (Copy this into Railway Environment Variables):');
            console.log(tokens.refresh_token);
            console.log('======================================================\n');
        } else {
            console.log('Note: Google returned an access token without a new refresh token.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Failed to exchange token:', err.response?.data || err.message);
        process.exit(1);
    }
}

run();

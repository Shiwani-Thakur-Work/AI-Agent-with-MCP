/**
 * Dashboard API Server
 * Serves pulse_draft.json and triggers the pipeline on demand.
 * Run: node server.js  (keep running alongside the dashboard)
 */
require('dotenv').config();
const http = require('http');
const { execFile } = require('child_process');
const fs   = require('fs');
const path = require('path');

const PORT       = process.env.API_PORT || 3001;
const DRAFT_PATH = path.join(__dirname, 'data', 'pulse_draft.json');
const HISTORY_PATH = path.join(__dirname, 'data', 'history.json');

// ── CORS headers ──────────────────────────────────────────────────────────────
function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Load / save history ───────────────────────────────────────────────────────
function loadHistory() {
    try {
        return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    } catch {
        return [];
    }
}

function saveHistory(history) {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

// ── Pipeline state ────────────────────────────────────────────────────────────
let pipelineRunning = false;
let lastStatus      = null;   // { success, message, timestamp }

function runPipeline() {
    return new Promise((resolve) => {
        if (pipelineRunning) {
            resolve({ success: false, message: 'Pipeline is already running.' });
            return;
        }
        pipelineRunning = true;
        console.log('[API] Starting pipeline…');

        execFile('node', ['index.js'], { cwd: __dirname, timeout: 180_000 }, (err, stdout, stderr) => {
            pipelineRunning = false;
            if (err) {
                console.error('[API] Pipeline error:', err.message);
                lastStatus = { success: false, message: err.message, timestamp: new Date().toISOString() };
                resolve(lastStatus);
                return;
            }

            // Archive the fresh draft into history
            try {
                const fresh = JSON.parse(fs.readFileSync(DRAFT_PATH, 'utf8'));
                const history = loadHistory();
                // Avoid duplicate IDs
                if (!history.find(h => h.id === fresh.id)) {
                    history.unshift(fresh);
                    if (history.length > 12) history.pop(); // keep last 12 runs
                    saveHistory(history);
                }
                lastStatus = { success: true, message: 'Pipeline completed successfully.', timestamp: new Date().toISOString() };
            } catch (e) {
                lastStatus = { success: true, message: 'Pipeline done, but could not archive history.', timestamp: new Date().toISOString() };
            }

            console.log('[API] Pipeline finished successfully.');
            resolve(lastStatus);
        });
    });
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    setCORS(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204); res.end(); return;
    }

    const url = req.url.split('?')[0];

    // GET /api/pulse — latest draft
    if (req.method === 'GET' && url === '/api/pulse') {
        try {
            const data = fs.readFileSync(DRAFT_PATH, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No pulse data found. Run the pipeline first.' }));
        }
        return;
    }

    // GET /api/history — all archived runs
    if (req.method === 'GET' && url === '/api/history') {
        const history = loadHistory();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(history));
        return;
    }

    // GET /api/status — pipeline status
    if (req.method === 'GET' && url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ running: pipelineRunning, last: lastStatus }));
        return;
    }

    // POST /api/run — trigger pipeline
    if (req.method === 'POST' && url === '/api/run') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Pipeline started.', running: true }));
        // Run async (don't await — respond immediately)
        runPipeline();
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`\n🚀 Pulse API server running on http://localhost:${PORT}`);
    console.log(`   GET  /api/pulse   — latest report`);
    console.log(`   GET  /api/history — all runs`);
    console.log(`   GET  /api/status  — pipeline status`);
    console.log(`   POST /api/run     — trigger pipeline\n`);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;
const DRAFT_PATH = path.join(__dirname, 'data', 'pulse_draft.json');
const HISTORY_PATH = path.join(__dirname, 'data', 'history.json');

app.use(cors());
app.use(express.json());

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
let lastStatus = null;

function runPipeline() {
    return new Promise((resolve) => {
        if (pipelineRunning) {
            resolve({ success: false, message: 'Pipeline is already running.' });
            return;
        }
        pipelineRunning = true;
        console.log('[API] Starting pipeline…');
        console.log('[API] Does server have GROQ_API_KEY?', !!process.env.GROQ_API_KEY);
        console.log('[API] Environment keys available:', Object.keys(process.env).join(', '));

        execFile('node', ['index.js'], { cwd: __dirname, env: process.env, timeout: 180_000 }, (err, stdout, stderr) => {
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

// ── API Routes ───────────────────────────────────────────────────────────────
app.get('/api/pulse', (req, res) => {
    try {
        const data = fs.readFileSync(DRAFT_PATH, 'utf8');
        res.json(JSON.parse(data));
    } catch {
        res.status(404).json({ error: 'No pulse data found. Run the pipeline first.' });
    }
});

app.get('/api/history', (req, res) => {
    const history = loadHistory();
    res.json(history);
});

app.get('/api/status', (req, res) => {
    res.json({ running: pipelineRunning, last: lastStatus });
});

app.post('/api/run', (req, res) => {
    res.json({ message: 'Pipeline started.', running: true });
    // Run async (don't await — respond immediately)
    runPipeline();
});

// ── Serve React Frontend ───────────────────────────────────────────────────────
// Serve static files from dashboard/dist
const buildPath = path.join(__dirname, 'dashboard', 'dist');
app.use(express.static(buildPath));

// For any other route, send the index.html so React Router (or SPA) works
app.use((req, res) => {
    if (fs.existsSync(path.join(buildPath, 'index.html'))) {
        res.sendFile(path.join(buildPath, 'index.html'));
    } else {
        res.status(404).send('Dashboard not built yet. Run "npm run build" in the dashboard directory.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Pulse API & Dashboard server running on port ${PORT}`);
    console.log(`   GET  /api/pulse   — latest report`);
    console.log(`   GET  /api/history — all runs`);
    console.log(`   GET  /api/status  — pipeline status`);
    console.log(`   POST /api/run     — trigger pipeline\n`);
});

# Weekly Pulse AI Agent — Complete Project Guide

> **Who this is for:** Anyone wanting to understand, teach, or demo this project — whether in an interview, a team walkthrough, or a portfolio presentation.

---

## What Does This Project Actually Do?

Imagine you're a Product Manager at a company with a mobile app. Every week, hundreds of users leave reviews on the App Store and Play Store. Reading all of them manually would take hours — and you'd still miss patterns.

This project solves that. It's an **automated weekly pipeline** that:

1. Pulls all recent reviews from both stores
2. Sends them to an AI (Groq LLM) for analysis
3. Extracts the top recurring themes with real user quotes
4. Writes a structured report straight into a Google Doc
5. Drafts a team email in Gmail — ready to send
6. Shows everything on a live web dashboard

The whole thing runs automatically every Monday morning.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WEEKLY PULSE PIPELINE                       │
│                        (index.js)                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌─────────────┐  ┌──────────────┐  ┌───────────────┐
   │  Play Store │  │  App Store   │  │  (future data │
   │  Scraper    │  │  Scraper     │  │   sources)    │
   └──────┬──────┘  └──────┬───────┘  └───────────────┘
          └────────────────┘
                    │
                    ▼
          ┌──────────────────┐
          │  src/ingestion.js│  ← Combines + deduplicates reviews
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │   src/llm.js     │  ← Sends reviews to Groq LLM
          │  (Groq API)      │     Gets themes, quotes, actions
          └────────┬─────────┘
                   │
           ┌───────┴────────┐
           │                │
           ▼                ▼
   ┌──────────────┐  ┌───────────────┐
   │  Google Docs │  │  Gmail Draft  │
   │  (via MCP)   │  │  (via MCP)    │
   └──────────────┘  └───────────────┘
           │
           ▼
   ┌───────────────────┐
   │  React Dashboard  │  ← Visual layer for PMs
   │  (localhost:5173) │
   └───────────────────┘
```

---

## The MCP Server — The "Bridge" to Google

The most interesting part of this project is how it talks to Google Docs and Gmail without using raw Google APIs directly.

### What is MCP?

**MCP (Model Context Protocol)** is an open standard by Anthropic. Think of it as a universal plug that lets an AI agent call external tools — like Google Docs, databases, or web browsers — through a standard interface.

```
┌──────────────────────────────────────────────┐
│              MCP Architecture                │
│                                              │
│   AI Agent (index.js)                        │
│       │                                      │
│       │  calls tool: "google_docs_append"    │
│       ▼                                      │
│   MCP Client (src/mcp-client.js)             │
│       │                                      │
│       │  speaks MCP protocol                 │
│       ▼                                      │
│   MCP Server (separate project)              │
│       │                                      │
│       │  translates MCP calls to real APIs   │
│       ▼                                      │
│   Google Docs API / Gmail API                │
└──────────────────────────────────────────────┘
```

### Two Ways to Connect

**Option A — Local (stdio):** The agent starts the MCP Server as a child process and talks to it through standard input/output. Fast, works offline.

**Option B — Remote (SSE):** The agent connects to the MCP Server deployed on Railway over HTTP Server-Sent Events. This is needed for GitHub Actions (CI/CD).

---

## File-by-File Breakdown

```
AI Agent with MCP/
│
├── index.js                  ← Main pipeline orchestrator. Run this.
│
├── .env                      ← Your secrets (never commit this!)
├── .env.example              ← Template showing required env vars
│
├── src/
│   ├── ingestion.js          ← Fetches reviews from both stores
│   ├── llm.js                ← Sends reviews to Groq, gets report
│   └── mcp-client.js         ← Connects to MCP Server (stdio or SSE)
│
├── data/
│   └── pulse_draft.json      ← LLM output cached here before publishing
│
├── dashboard/                ← React web dashboard (Vite + React 18)
│   ├── src/
│   │   ├── App.jsx           ← Root component, manages state
│   │   ├── data/mockData.js  ← Historical pulse data
│   │   └── components/
│   │       ├── Header.jsx         ← Sticky nav + Run Pipeline button
│   │       ├── MetricsGrid.jsx    ← 4 KPI cards at the top
│   │       ├── ThemesGrid.jsx     ← 3 theme cards with quotes
│   │       ├── TrendChart.jsx     ← Week-over-week bar chart
│   │       └── ReportPanel.jsx    ← Report + Email panels + History
│   └── vite.config.js
│
├── docs/
│   ├── implementation-plan.md ← Phase-by-phase build log
│   └── PROJECT_GUIDE.md       ← You are here
│
└── .github/
    └── workflows/
        └── weekly-pulse.yml   ← Runs pipeline every Monday at 9 AM UTC
```

---

## Data Flow — Step by Step

### Step 1: Ingestion

```
google-play-scraper          app-store-scraper
      │                            │
      ▼                            ▼
 Play Store reviews          App Store reviews
 (com.spotify.music)         (com.spotify.client)
      │                            │
      └──────────┬─────────────────┘
                 ▼
         Merged review array
         (filtered: last 12 weeks)
         e.g. 120 Play + 79 App = 199 reviews
```

### Step 2: LLM Processing

The reviews are joined into one big text block and sent to Groq with a structured prompt:

```
Prompt structure:
─────────────────────────────────────
You are a product analyst. Here are 199 app reviews:

[review 1]
[review 2]
...
[review 199]

TASK:
1. Identify top 3 recurring themes
2. For each theme:
   - Write a 2-sentence description
   - Include a real verbatim quote as evidence
   - Suggest one concrete action item
3. Write a <250-word executive pulse report
4. Draft a professional email signed "Shiwani, Product Manager"

OUTPUT FORMAT: JSON with keys: report, emailDraft
─────────────────────────────────────
```

### Step 3: Publishing via MCP

```javascript
// Connect to MCP Server
const client = await createMCPClient({ serverUrl: "http://localhost:3000/sse" });

// Append report to Google Doc
await client.callTool("google_docs_append_content", {
  documentId: process.env.PULSE_DOC_ID,
  content: report
});

// Create Gmail draft
await client.callTool("gmail_create_draft", {
  to: "shiwanithakur5498@gmail.com",
  subject: "Weekly Mobile-Store Feedback Pulse",
  body: emailBody
});
```

---

## The Dashboard

The React dashboard gives a visual home to the pipeline output. It reads from the mock data (which mirrors the `pulse_draft.json` structure) and renders:

```
┌──────────────────────────────────────────────────────┐
│  📊 Pulse Dashboard        ● Live   ⚡ Run Pipeline  │ ← Header
├──────────────────────────────────────────────────────┤
│  Viewing — Week of Sep 22 – 28, 2026                 │
├────────────┬────────────┬────────────┬───────────────┤
│ 💬 Reviews │ 😊 Sentiment│ 🔥 Top Issue│ 🧩 Themes    │ ← Metrics
│    199     │    38%+    │ Ads & Prem │     3        │
├────────────┴────────────┴────────────┴───────────────┤
│  🧠 Key Themes                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ 📢 Ads (45%) │ │ 🔧 Bugs (30%)│ │ 🎯 Disc(18%) │ │ ← Themes
│  │ user quotes  │ │ user quotes  │ │ user quotes  │ │
│  │ 💡 action    │ │ 💡 action    │ │ 💡 action    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
├─────────────────────────────┬────────────────────────┤
│  📈 Theme Trends (3 weeks)  │  🕐 Pulse History      │ ← Trends
├─────────────────────────────┴────────────────────────┤
│  📄 Report              │  ✉️ Email Draft             │ ← Output
└──────────────────────────────────────────────────────┘
```

---

## Environment Variables Explained

| Variable | Where it comes from | What it does |
|---|---|---|
| `GROQ_API_KEY` | console.groq.com | Authenticates calls to the Groq LLM API |
| `PULSE_DOC_ID` | Your Google Doc URL | The specific document to append reports into |
| `RECEIVER_EMAIL` | You | Gmail draft recipient |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | OAuth app identity for the MCP Server |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | OAuth app secret |
| `GOOGLE_REDIRECT_URI` | Google Cloud Console | Must match your OAuth app settings |

---

## The Two Projects — How They Relate

```
Desktop/
├── MCP Server/               ← The "toolbox" (Google API wrapper)
│   ├── src/server/mcp-server.ts
│   ├── build/server/mcp-server.js  ← Compiled version
│   └── tokens/               ← OAuth tokens (Google login state)
│
└── AI Agent with MCP/        ← The "brain" (pipeline + dashboard)
    ├── index.js
    ├── src/mcp-client.js     ← Connects to MCP Server
    └── dashboard/            ← React UI
```

The **AI Agent** never talks to Google APIs directly. It asks the **MCP Server** to do that. This separation of concerns means:
- You can swap in a different MCP Server (e.g. one that talks to Notion or Slack) without changing the AI Agent code
- The MCP Server can be shared across multiple AI projects

---

## GitHub Actions — Automation

The workflow in `.github/workflows/weekly-pulse.yml` runs automatically:

```
Every Monday @ 9:00 AM UTC
         │
         ▼
GitHub spins up an Ubuntu runner
         │
         ▼
Checks out your code
         │
         ▼
Sets env vars from GitHub Secrets
         │
         ▼
Runs: node index.js
         │
         ▼
Report → Google Docs
Email draft → Gmail
```

To set up the secrets in your GitHub repo:
> Settings → Secrets and variables → Actions → New repository secret

---

## Common Interview Questions

### "Why MCP instead of calling Google APIs directly?"

The Anthropic MCP standard means tools are reusable and composable. Any MCP client (Claude Desktop, your custom agent, another team's agent) can use the same MCP Server. It also gives you a clean boundary between the AI logic and the integration layer — easier to test, easier to swap.

### "Why Groq instead of OpenAI?"

Groq runs LLaMA 3 models on custom hardware (LPUs) that are significantly faster than GPU-based inference. For weekly pipelines that need to process 200+ reviews quickly, Groq is both faster and cheaper.

### "How does authentication to Google work?"

The MCP Server does a one-time OAuth 2.0 flow (run `npm run auth` in the MCP Server project). Google returns a refresh token that gets saved to `tokens/`. The server uses that refresh token to get a new access token on each request — no re-login needed.

### "What happens if the pipeline fails halfway?"

The pipeline saves the LLM output to `data/pulse_draft.json` after Step 3. If the MCP Server call fails, you can manually re-run just Steps 4–5 without re-fetching reviews or calling Groq again.

### "How would you scale this to 10 apps?"

Parameterise the app IDs in `.env` as a comma-separated list, loop through them in `ingestion.js`, and run parallel pipelines (one per app). The MCP Server and dashboard would need multi-tenant support (separate docs per app).

---

## Tech Stack Summary

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 20 | Async-first, huge scraper ecosystem |
| Reviews | google-play-scraper, app-store-scraper | Maintained npm packages, no auth needed |
| LLM | Groq API (LLaMA 3.3 70B) | Fast, cheap, high quality |
| Tool protocol | Anthropic MCP SDK | Standard for AI agent tool use |
| Google integration | MCP Server (TypeScript) | Encapsulates OAuth, reusable |
| Scheduling | GitHub Actions | Free, version-controlled, cron support |
| Dashboard | React 18 + Vite 5 | Fast dev experience, no extra overhead |
| Styling | Vanilla CSS | Full control, no library overhead |
| Fonts | Inter + JetBrains Mono | Clean and readable |

---

## Running Everything Locally

```bash
# 1. Start the MCP Server (in MCP Server project)
cd "MCP Server"
npm run start
# → Server running on http://localhost:3000

# 2. In a new terminal, run the pipeline
cd "AI Agent with MCP"
node index.js
# → Reviews fetched, LLM called, Docs updated, Gmail drafted

# 3. Open the dashboard
cd dashboard
npm run dev
# → Open http://localhost:5173
```

---

*Built by Shiwani, Product Manager · Powered by Groq LLM + MCP + Google Workspace*

# 🗂️ Implementation Plan — Weekly Pulse AI Agent

> **Last Updated:** Sep 25, 2026

---

## Project Overview

An end-to-end AI automation pipeline that:
1. Scrapes Spotify mobile app reviews from Google Play Store & Apple App Store
2. Runs them through Groq LLM to extract themes, user quotes, and action items
3. Writes the report into Google Docs using the MCP Server
4. Drafts an email notification via Gmail using the MCP Server
5. Displays everything on a beautiful React dashboard

---

## Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Project Setup & Environment | ✅ Done |
| 2 | Data Ingestion (Play Store + App Store) | ✅ Done |
| 3 | LLM Analysis with Groq | ✅ Done |
| 4 | MCP Client Integration (Google Docs) | ✅ Done |
| 5 | Gmail Draft via MCP | ✅ Done |
| 6 | GitHub Actions Weekly Scheduler | ✅ Done |
| 7 | React Dashboard (Phase 7) | ✅ Done |

---

## Phase 1 — Environment Setup ✅

- Node.js project at `c:\Users\shiwa\OneDrive\Desktop\AI Agent with MCP`
- `.env` file configured with:
  - `GROQ_API_KEY` — Groq LLM API key
  - `PULSE_DOC_ID` — Google Doc ID to append reports into
  - `RECEIVER_EMAIL` — shiwanithakur5498@gmail.com
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — copied from MCP Server project for local stdio usage

---

## Phase 2 — Data Ingestion ✅

**File:** `src/ingestion.js`

- Fetches up to 200 reviews from **Google Play Store** (`com.spotify.music`) using `google-play-scraper`
- Fetches up to 200 reviews from **Apple App Store** (`com.spotify.client`) using `app-store-scraper`
- Filters reviews from the **last 12 weeks**
- Returns a combined, deduplicated array of review objects

---

## Phase 3 — LLM Analysis ✅

**File:** `src/llm.js`

- Sends all reviews to **Groq LLM** (`llama-3.3-70b-versatile` model)
- Prompt instructs Groq to:
  - Identify top 3–5 themes
  - Pull real user quotes as evidence
  - Suggest actionable product recommendations
  - Draft a professional email signed **"Shiwani, Product Manager"**
- Output is saved to `data/pulse_draft.json`

---

## Phase 4 — Google Docs via MCP ✅

**File:** `src/mcp-client.js`

- Connects to the **MCP Server** (local or Railway) using the MCP SDK
- **Local mode (current):** Spawns `node build/server/mcp-server.js` from the MCP Server project via **stdio transport**
- **Production mode:** Connects to `https://mcp-server-production-4457.up.railway.app/sse` via **SSE transport**
- Calls `google_docs_append_content` tool with the generated report text
- Returns the Google Doc URL on success

> **Note on permissions:** The MCP Server uses Google OAuth (not a service account). Make sure the token in `MCP Server/tokens/` is valid and has Docs write permissions.

---

## Phase 5 — Gmail Draft via MCP ✅

**File:** `index.js` (Steps 5–6)

- Calls `gmail_create_draft` MCP tool with:
  - `to`: `shiwanithakur5498@gmail.com`
  - `subject`: Weekly Pulse subject line from LLM
  - `body`: Email body including link to the Google Doc
- Draft appears in Gmail Drafts — ready to review and send

---

## Phase 6 — GitHub Actions Scheduler ✅

**File:** `.github/workflows/weekly-pulse.yml`

- Runs every **Monday at 9:00 AM UTC** (`cron: '0 9 * * 1'`)
- Can also be triggered manually via **workflow_dispatch**
- Requires these GitHub Secrets set in the repo:
  - `GROQ_API_KEY`
  - `PULSE_DOC_ID`
  - `RECEIVER_EMAIL`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
  - `GOOGLE_REFRESH_TOKEN` (for headless auth in CI)

> **Caveat:** The local MCP server stdio approach won't work in GitHub Actions. For full CI automation, the Railway MCP Server (or a headless OAuth token refresh flow) is needed.

---

## Phase 7 — React Dashboard ✅

**Location:** `dashboard/` subfolder (Vite + React 18)

**Features built:**
- **Sticky header** with logo, Live badge, and ⚡ Run Pipeline button (with loading state)
- **4 Metric cards** — Total Reviews, Sentiment Split (positive/neutral/negative bar), Top Issue, Themes Found
- **Key Themes grid** — 3 cards with colored accent bars, rank badge, user quotes, and action items
- **Theme Trends chart** — horizontal bar chart showing how each theme's % changes week over week
- **Pulse History panel** — clickable list of previous weeks; clicking a row re-renders all sections with that week's data
- **Generated Report panel** — raw report text with "Copy" and "Open in Docs ↗" buttons
- **Email Draft panel** — styled email preview with To, Subject, Body and a Google Docs deep-link
- **Footer** — credits Shiwani, Product Manager

**Tech stack:** React 18, Vite 5, Vanilla CSS (Inter + JetBrains Mono fonts), no external UI library

**To start the dashboard:**
```bash
cd dashboard
npm run dev
# open http://localhost:5173
```

---

## Remaining / Future Work

| Item | Priority | Notes |
|------|----------|-------|
| Richer LLM report (more detail, 500+ words) | High | ✅ Done (max_tokens increased, structured JSON added) |
| Connect "Run Pipeline" button to backend | Medium | ✅ Done (Express API server built) |
| Multi-app support (beyond Spotify) | Low | ✅ Done (PLAY_STORE_APP_IDS / APP_STORE_APP_IDS arrays in `.env`) |
| GitHub Actions headless OAuth token | Low | ✅ Done (Actions `.yml` updated with all tokens) |
| Fix Railway MCP server (500 error) | Medium | Requires Railway dashboard access (set env vars and check logs) |

# 🤖 AI Agent with MCP — Weekly Mobile-Store Feedback Pulse

> An end-to-end AI automation pipeline that scrapes app reviews, generates a structured weekly insight report using Groq LLM, and delivers it to Google Docs + Gmail — fully automated via GitHub Actions.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Environment Variables](#-environment-variables)
- [Running Locally](#-running-locally)
- [Dashboard](#-dashboard)
- [Scheduling (GitHub Actions)](#-scheduling-github-actions)
- [Project Structure](#-project-structure)
- [Outputs](#-outputs)

---

## 🎯 Overview

Each week, this pipeline automatically:

1. **Scrapes** up to 200 reviews from the Google Play Store & Apple App Store
2. **Analyzes** them via Groq LLM — extracting top themes, real user quotes, and action items
3. **Writes** the structured report directly into a Google Doc via MCP
4. **Drafts** a professional email summary in Gmail via MCP
5. **Displays** all results on a live React dashboard

---

## 🏗️ Architecture

```
App Store Reviews ─┐
                   ├──► Data Ingestion ──► Groq LLM Analysis ──► Report + Email Draft
Play Store Reviews─┘         │                                          │
                             ▼                                          ▼
                      data/pulse_draft.json               Google Docs (via MCP)
                                                          Gmail Draft (via MCP)
                                                          React Dashboard (live)
```

---

## 🛠️ Tech Stack

| Layer              | Technology                                      |
|--------------------|-------------------------------------------------|
| **Runtime**        | Node.js (CommonJS)                              |
| **LLM**            | Groq SDK — `llama-3.3-70b-versatile`            |
| **MCP Client**     | `@modelcontextprotocol/sdk`                     |
| **Scrapers**       | `google-play-scraper`, `app-store-scraper`      |
| **API Server**     | Express.js (for dashboard ↔ pipeline bridge)    |
| **Dashboard**      | React 18 + Vite 5 + Vanilla CSS                 |
| **Scheduler**      | GitHub Actions (`cron: '0 9 * * 1'`)            |

---

## ✅ Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- A valid **Groq API Key** — [console.groq.com](https://console.groq.com)
- A **Google Doc ID** for the target pulse document
- Access to the **MCP Server** (local or hosted on Railway)
- A Gmail account authenticated with the MCP Server

---

## 🔐 Environment Variables

Create a `.env` file in the project root with the following keys:

```env
# ── LLM ──────────────────────────────────────────────────
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# ── Google Docs Output ────────────────────────────────────
PULSE_DOC_ID=your_google_doc_id_here

# ── Email Delivery ────────────────────────────────────────
RECEIVER_EMAIL=your_email@gmail.com

# ── MCP Server ────────────────────────────────────────────
MCP_SERVER_URL=https://mcp-server-production-4457.up.railway.app/sse

# ── Google OAuth (for local MCP stdio mode) ───────────────
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
GOOGLE_REFRESH_TOKEN=your_refresh_token

# ── Multi-App Support (optional) ─────────────────────────
PLAY_STORE_APP_IDS=com.spotify.music
APP_STORE_APP_IDS=com.spotify.client
```

> **Tip:** Never commit `.env` to version control. It is already listed in `.gitignore`.

---

## 🚀 Running Locally

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Pipeline

```bash
node index.js
```

This will:
- Scrape reviews from both stores
- Run LLM analysis
- Append the report to your Google Doc
- Create an email draft in Gmail
- Save results to `data/pulse_draft.json`

### 3. Start the API Server (for Dashboard)

```bash
npm start
# Starts Express on http://localhost:3001
```

---

## 📊 Dashboard

The React dashboard provides a live visual interface for the pipeline output.

```bash
cd dashboard
npm install
npm run dev
# Opens at http://localhost:5173
```

**Dashboard panels include:**
- 📈 Metric cards — Total Reviews, Sentiment Split, Top Issue, Themes Found
- 🗂️ Key Themes grid — with colored accents, user quotes, and action items
- 📉 Theme Trends chart — week-over-week horizontal bar chart
- 📜 Pulse History — click any week to re-render all panels with historical data
- 📄 Generated Report — raw text with Copy and Open in Docs buttons
- ✉️ Email Draft — preview with To, Subject, and Body

---

## ⏰ Scheduling (GitHub Actions)

The workflow is defined in [`.github/workflows/weekly-pulse.yml`](.github/workflows/weekly-pulse.yml) and runs automatically **every Monday at 9:00 AM UTC**.

### Setup Steps

1. Push this repository to GitHub
2. Go to **Settings → Secrets and variables → Actions**
3. Add the following **Repository Secrets**:

| Secret Name            | Description                              |
|------------------------|------------------------------------------|
| `GROQ_API_KEY`         | Your Groq API key                        |
| `PULSE_DOC_ID`         | Target Google Doc ID                     |
| `RECEIVER_EMAIL`       | Email address for the draft              |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                   |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret               |
| `GOOGLE_REDIRECT_URI`  | OAuth redirect URI                       |
| `GOOGLE_REFRESH_TOKEN` | Refresh token for headless CI auth       |
| `MCP_SERVER_URL`       | Railway MCP server SSE endpoint          |

> **Note:** Manual runs are also supported via the **workflow_dispatch** trigger in the GitHub Actions UI.

---

## 📁 Project Structure

```
AI Agent with MCP/
├── .github/
│   └── workflows/
│       └── weekly-pulse.yml     # GitHub Actions scheduler
├── dashboard/                   # React + Vite frontend
│   ├── src/
│   └── vite.config.js
├── data/
│   └── pulse_draft.json         # Latest pipeline output (local)
├── docs/                        # Project documentation
│   ├── implementation-plan.md
│   ├── architecture.md
│   ├── context.md
│   └── edge-case.md
├── src/
│   ├── ingestion.js             # Review scraping logic
│   ├── llm.js                   # Groq LLM analysis
│   └── mcp-client.js            # MCP server integration
├── index.js                     # Main pipeline orchestrator
├── server.js                    # Express API server
├── .env                         # Local secrets (not committed)
└── package.json
```

---

## 📤 Outputs

| Output             | Location                                                |
|--------------------|---------------------------------------------------------|
| **Local JSON**     | `data/pulse_draft.json` — raw report + email draft      |
| **Google Doc**     | Appended to the doc defined by `PULSE_DOC_ID`           |
| **Gmail Draft**    | Draft created in the authenticated Gmail account        |
| **Dashboard**      | Live at `http://localhost:5173` when running locally    |

---

*Built by **Shiwani, Product Manager** · Powered by Groq LLM + MCP + GitHub Actions*

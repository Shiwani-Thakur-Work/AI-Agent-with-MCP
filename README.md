# AI Agent with MCP: Weekly Mobile-Store Feedback Pulse

This project is an automated AI agent that pulls mobile app reviews (App Store and Play Store), processes them using Groq LLMs into a Weekly Pulse report, and automatically appends the report to a Google Doc and drafts an email using Model Context Protocol (MCP).

## How to Run Manually

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables. Ensure `.env` has:
   ```env
   GROQ_API_KEY=your_key
   GROQ_MODEL=openai/gpt-oss-120b
   PULSE_DOC_ID=your_google_doc_id
   RECEIVER_EMAIL=your_email@gmail.com
   MCP_SERVER_URL=https://mcp-server-production-4457.up.railway.app/sse
   ```

3. Run the orchestrator:
   ```bash
   node index.js
   ```

## Where to Find Outputs
- **Local Logs**: The raw generated report and email draft are saved to `data/pulse_draft.json`.
- **Google Docs**: The report is appended to the Google Doc defined by `PULSE_DOC_ID` in your `.env`.
- **Gmail**: The email is drafted in the Gmail account authenticated with the MCP Server.

## How the Cron Job is Configured (Scheduling)
We use **GitHub Actions** to automate this pipeline. 
The workflow is defined in `.github/workflows/weekly-pulse.yml` and is scheduled to run every Monday at 9:00 AM UTC.

To enable it:
1. Push this repository to GitHub.
2. Go to your repository settings -> **Secrets and variables** -> **Actions**.
3. Add all the variables from your `.env` as repository secrets.

# Edge Cases and Corner Scenarios

This document outlines potential edge cases and corner scenarios for the Weekly Mobile-Store Feedback Pulse pipeline, along with proposed handling strategies.

---

## 1. Data Ingestion & Source Anomalies

### 1.1 No Reviews in the Timeframe
- **Scenario:** The target app receives zero reviews in the past 8–12 weeks.
- **Handling Strategy:** The pipeline should gracefully detect the empty dataset. Instead of throwing an error or hallucinating content, it should output a predefined "No Data" pulse: *"No new reviews were published in the specified timeframe."* The email draft should reflect this status.

### 1.2 Rate Limiting and API Outages
- **Scenario:** The public App Store or Play Store endpoints throttle requests, or an endpoint goes down.
- **Handling Strategy:** Implement exponential backoff for retries. If the fetch fails entirely after maximum retries, the orchestrator should abort the pulse generation and draft an error alert email to the maintainer via the Gmail MCP.

### 1.3 Non-English Reviews
- **Scenario:** Reviews are submitted in various languages, diluting theme accuracy.
- **Handling Strategy:** (Decision point) Either filter out non-English reviews during ingestion or prompt the LLM to translate them internally before clustering.

### 1.4 Extremely Long Reviews
- **Scenario:** A user submits an unusually long review that eats up token limits.
- **Handling Strategy:** Truncate individual reviews at a reasonable character limit (e.g., 1000 characters) before feeding them into the LLM context to prevent token overflow.

---

## 2. LLM Processing & Content Generation

### 2.1 Hallucinated Quotes
- **Scenario:** The LLM rewrites, paraphrases, or invents a user quote instead of using a verbatim snippet.
- **Handling Strategy:** Use strict system prompt instructions emphasizing verbatim extraction. Optionally, implement a post-generation validation step that checks if the extracted quote string exists as a substring within the raw review data.

### 2.2 PII Leakage in Reviews
- **Scenario:** A user includes sensitive data (e.g., "My email is test@test.com" or "Call me at 555-1234").
- **Handling Strategy:** Use a two-pass approach. Pass 1: Anonymize or redact common PII patterns using regex (emails, phone numbers) before LLM ingestion. Pass 2: Explicitly prompt the LLM to strip any remaining identifiable information when selecting quotes.

### 2.3 Exceeding the Word Count Constraint
- **Scenario:** The generated pulse is verbose and exceeds the strict ≤ 250 words limit.
- **Handling Strategy:** Implement a programmatic length check on the LLM output. If it exceeds 250 words, either truncate non-critical sections (like truncating a quote) or re-prompt the LLM with a strict directive to shorten the specific text.

### 2.4 Lack of Actionable Feedback
- **Scenario:** All reviews are highly positive (e.g., "Great app! Love it.") leaving no clear problems to derive "3 action ideas" from.
- **Handling Strategy:** Instruct the LLM that if no negative issues exist, the "action ideas" should focus on growth/engagement (e.g., "Prompt positive reviewers to share the app," "Highlight feature X in marketing since users love it").

---

## 3. MCP Integration & Delivery

### 3.1 MCP Server Unavailability
- **Scenario:** The local environment or container hosting the Google Docs or Gmail MCP server is unresponsive.
- **Handling Strategy:** Wrap MCP tool calls in `try/catch` blocks. Log the failure locally and attempt a retry. If it consistently fails, save the generated markdown pulse locally to disk as a fallback so the week's data isn't lost.

### 3.2 Document Creation Failure
- **Scenario:** The Google Docs MCP fails to create the document due to folder permission issues or quota limits.
- **Handling Strategy:** The pipeline should still attempt to execute the Gmail MCP step, pasting the raw markdown text directly into the email body instead of a Doc link.

### 3.3 Invalid Email Recipient
- **Scenario:** The configured alias or self-email address is invalid or bounced.
- **Handling Strategy:** Validate the email format via regex during the initialization phase (Phase 1) before the pipeline runs, ensuring it won't fail at the final delivery step.

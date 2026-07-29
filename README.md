# SikaHwe Backend

Privacy-conscious Gemini proxy for the SikaHwe iOS budgeting app. It protects the
Gemini API key, validates structured AI responses, applies rate limits, and does
not store financial data.

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Add your Gemini API key to `.env`.
4. Run `npm install`.
5. Run `npm run dev`.

## Render

Create a Node Web Service from this repository.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/health`

Add the variables from `.env.example` in the Render dashboard. Never commit the
real `GEMINI_API_KEY`.

Render supplies `PORT` automatically. The service binds to `0.0.0.0`.

## API

- `GET /health`
- `POST /v1/ai/statistics-insights`
- `POST /v1/ai/categorize`
- `POST /v1/ai/parse-transaction`

Every AI response is returned as:

```json
{
  "success": true,
  "data": {}
}
```

Request bodies are excluded from application logs. The service has no database
and does not retain budgets, transaction messages, statistics, or model output.

## Production hardening

The initial service rate-limits by IP and SikaHwe installation identifier.
Before a broad public release, add Apple App Attest verification so only genuine
installations can use the proxy.

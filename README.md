# stock-screener

Uses live stock quotes from Finnhub through the serverless `/api/stock` proxy.

## Environment variables

Set this in Vercel (or locally in `.env`):

- `FINNHUB_KEY` — your Finnhub API key

The key is only read server-side in `/api/stock.js` and is never exposed to the browser.

## Local development

```bash
npm ci
npm run dev
```

Then open the app and it will request live quotes via:

- `/api/stock?symbol=AAPL`

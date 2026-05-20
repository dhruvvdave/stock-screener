# stock-screener

Minimal stock lookup app powered by Finnhub.

## Setup

Create a `.env` file (or configure in Vercel) with:

- `FINNHUB_KEY=your_finnhub_api_key`

The key is only read server-side by `/api/stock`.

## Run locally

```bash
npm ci
npm run dev
```

Then open the app, type a ticker (for example `AAPL`), and submit.

## Behavior

- The UI is intentionally minimal: one ticker input and submit button.
- Nothing is displayed until a ticker is searched.
- Quotes are fetched live from Finnhub through `/api/stock`.
- Invalid symbols and API errors are shown as inline error messages.

## API response used by the UI

`GET /api/stock?symbol=AAPL`

Returns:

- `symbol`
- `price`
- `change`
- `changePercent`
- `open`
- `high`
- `low`
- `previousClose`
- `timestamp`

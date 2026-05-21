# Tickerly

Terminal-styled stock screener with universal ticker lookup, watchlist alerts, portfolio tracking, and earnings awareness.

## Setup

Create a `.env` file (or configure in Vercel) with:

- `FINNHUB_KEY=your_finnhub_api_key`

The key is only read server-side by API routes (`/api/stock`, `/api/search`, and optional profile/analyst/sentiment helpers).

## Run locally

```bash
npm ci
npm run dev
```

## Features

- Universal ticker input with autofill suggestions while typing.
- Expanded stock detail view with company profile, sector, description, stats, logo, and chart ranges (`1mo/3mo/6mo/1y`).
- Persistent watchlist and per-ticker price alerts stored in `localStorage`.
- Browser notification alerts when price thresholds are crossed.
- Persistent portfolio tracker (shares + average cost) with value, P/L, and allocation columns.
- Upcoming earnings list for watchlist + portfolio tickers, sorted by date.
- Keyboard controls:
  - `j` / `k` move through the list
  - `Enter` opens stock detail
  - `Esc` returns to list
  - `s` stars/unstars current ticker
- Sortable list columns (ticker, price, change, market cap).

## Build and lint

```bash
npm run build
npm run lint
```

> Note: this repository currently has pre-existing lint errors outside this feature work.

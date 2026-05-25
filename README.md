# Markr

I've been interested in investing for a while now — stocks, markets, the whole thing. I wanted something I could actually use myself when researching positions, not just a tutorial project. Everything I found was either too bloated, behind a paywall, or just slow. So I built Markr.

It's a keyboard-driven stock screener. Type a ticker, hit Enter, get live price data, charts, analyst consensus, technicals, news. No account, no friction.

## Why I built it this way

The terminal aesthetic isn't decoration — it's how I actually want to use a screener. `j`/`k` to move through the list, `Enter` to open, `s` to star. I wanted it to feel fast.

The data layer was the annoying part. Yahoo Finance's unofficial API behaves differently between `query1` and `query2` hosts, Finnhub rate-limits on the free tier, and TSX-listed stocks need different symbol formats for basically every provider (`.TO` for Yahoo, `TSX:` prefix for Finnhub, no prefix for TradingView). The `api/candle.js` fallback chain (Finnhub → Yahoo → Stooq → Twelve Data) came out of debugging sessions, not planning.

## What it does

- Universal ticker search with autofill (Finnhub search API)
- Live quotes refreshing every 45 seconds
- Expanded detail view: company profile, sector, description, logo
- Price chart via TradingView embed (actual live chart, not just a sparkline)
- Technical indicators computed from price history: RSI(14), MACD, Bollinger Bands, MA50/200
- Analyst consensus pulled from Finnhub (buy/hold/sell breakdown, price targets)
- Financial health metrics from Yahoo Finance quoteSummary
- Recent news (Yahoo Finance → Finnhub fallback)
- Persistent watchlist with price alerts and browser notifications
- Portfolio tracker: shares, avg cost, value, P&L, allocation
- Upcoming earnings dates for watchlist/portfolio tickers
- AI analysis via OpenAI (you bring your own key, stored locally)
- USD/CAD currency toggle with live exchange rates

## Setup

You need a Finnhub API key (free tier works). Create a `.env` file:

```
FINNHUB_KEY=your_key_here
```

Optional keys for richer data:
- `FMP_KEY` — Financial Modeling Prep (income statements, ROIC, quarterly earnings history)
- `AV_KEY` — Alpha Vantage (additional valuation metrics)
- `TWELVE_DATA_KEY` — Twelve Data (chart fallback)

## Running locally

```bash
npm ci
npm run dev
```

The `/api/*` routes are Vercel serverless functions. For local dev, use the Vercel CLI:

```bash
npx vercel dev
```

## Known issues / TODO

- The hardcoded `YAHOO_SYMBOLS` map in `api.js` is a maintenance problem — needs dynamic exchange-aware resolution
- Pre-existing lint errors (noted in original README, haven't touched them yet)
- TSX-V stocks are hit or miss depending on which data source picks them up

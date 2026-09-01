# AgroPrice NG

Nigeria food-price intelligence — explore historical staple prices across Nigerian
markets, analyze national trends, and forecast where prices are headed using live
inflation, exchange-rate and financing data. Every number is traceable to its
open data source.

Built with **Next.js 14 (App Router) · TypeScript · recharts · Radix UI**.

## Features

- **Landing page** (`/`) — what the app does, how the prediction works, and the
  open data sources behind it.
- **Dashboard** (`/dashboard`) — search and filter historical price observations
  by commodity, state, market, month and year; newest-first, paginated
  (10 per page).
- **Analytics** (`/analytics`) — national average price trend over the last
  24 available months.
- **Predict** (`/predict`) — project next-month prices for any commodity from its
  own history plus live macro conditions. Shows predicted price (with unit),
  the model assumptions, and the historical + forecast chart.

## The prediction model

For a chosen commodity, `lib/predict.ts` computes:

```
Pₖ = P₀ × (1 + r)ᵏ
r  = min(6%, 0.5·g + 0.5·(i + 0.5·f + 0.3·c))
```

Where:

| Symbol | Meaning |
| ------ | ------- |
| `P₀`   | Base price — average of the last 3 observed months for the commodity |
| `g`    | The commodity's own month-over-month growth rate over the last 12 monthly points |
| `i`    | Nigeria's monthly inflation (annual rate converted to monthly) |
| `f`    | Monthly naira depreciation vs USD (annual FX change converted to monthly) |
| `c`    | Monthly cost of capital (lending rate converted to monthly; overridable on the page) |

The forecast always spans from the commodity's **last observed month through the
current month plus the chosen horizon** (3/6/12/24 months). Commodities whose WFP
history ends before today (e.g. Maize) are bridged to the current year using their
own trend blended with live macro conditions — the page notes when this happens.

## Data sources (all free, no API keys)

| Source | Used for | Details |
| ------ | -------- | ------- |
| **WFP Price Database via HDX** | Historical staple food prices across Nigerian markets | The observation dataset behind Explore + Analytics |
| **World Bank Open Data API** | Macro inputs to the forecast | Three Nigeria (NGA) indicators: `FP.CPI.TOTL.ZG` (inflation), `PA.NUS.FCRF` (official FX), `FR.INR.LEND` (lending rate) |
| **open.er-api.com** | Current FX | Free daily USD → NGN spot rate, cached for 6h |

Server-side routes in `app/api/` fetch these with timeouts, retries and an
in-memory TTL cache:
- `GET /api/prices` — observations (optionally `?source=wfp_hdx`)
- `GET /api/macro` — inflation / FX / lending series + current FX
- `GET /api/commodities` and `GET /api/states` — filter option lists

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # run the production build
```

> **Note:** do not run `npm run build` while `next dev` is running — both share
> `.next` and the build corrupts the dev server's cache (all routes 500 until
> `.next` is deleted and the dev server restarted).

### Fetch / refresh the price dataset

The dashboard reads normalized WFP/HDX data. To re-fetch a sample:

```bash
python scripts/fetch_wfp_hdx.py --limit 100
```

Output is written to `data/wfp_nigeria_normalized.csv` with the fields:
`commodity`, `state`, `market`, `price_naira`, `unit`, `observation_date`, and
`source`. Missing values remain missing; the script does not interpolate. The
fetcher first asks the HDX CKAN API for the current CSV resource and falls back
to the known public resource URL if metadata lookup is unavailable.

## Project structure

```
app/
  page.tsx            # landing page
  dashboard/page.tsx  # data table (filters + pagination)
  analytics/page.tsx  # price trend chart
  predict/page.tsx    # forecast (table + model + chart)
  api/prices|macro|commodities|states   # server routes
components/
  AppShell.tsx        # topbar + hamburger + sidebar shell
  Sidebar.tsx         # fixed sidebar / mobile drawer
  FilterSelect.tsx    # Radix-based "All …" filter select
  ui/select.tsx       # shadcn-style Select (Radix + hand-written CSS)
lib/
  prices.ts           # price observations
  macro.ts            # World Bank + FX fetching (retry + cache)
  predict.ts          # forecast model
scripts/fetch_wfp_hdx.py   # dataset fetcher
```

## License / disclaimer

Research dashboard — forecasts are illustrative model outputs, **not financial
advice**. Prices are in naira and retain their original units.

# Refunds Dashboard

Vite + React + TypeScript dashboard that reads `data/Refunds.xlsx` (fintech SaaS orders and
refunds) and renders revenue/refund statistics: KPI cards, a refund-reason pie chart, refund-rate
and refunded-value bar charts, a monthly gross-vs-refunded trend, and a per-product table.

The workbook is read server-side by a small Vite middleware (`refundsApiPlugin.ts`) and served
from `GET /api/orders`.

Requires Node 22 (`nvm use`).

```sh
npm install
npm run dev
```

Each main graph renders only when its flag is enabled in `../feature-flags-admin`. The dashboard
subscribes to that backend's `/api/flags/stream` server-sent events, so toggling a flag in the
admin page shows or hides the graph immediately — no reload. The dev server proxies `/api/flags`
to `http://127.0.0.1:8000` (override with `FLAGS_API_URL`); if the backend is not running, every
graph is shown.

To regenerate the sample workbook:

```sh
npm run generate-data
```

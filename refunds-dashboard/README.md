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

To regenerate the sample workbook:

```sh
npm run generate-data
```

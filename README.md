# PanAssets — Financial Series Assets

A personal finance PWA (React + TypeScript + Vite) backed by Cloudflare Workers + D1. Tracks bank/investment account balances, FX conversions, Dime stock trades, FCD (foreign-currency / gold), and monthly salary allocation.

## Stack

- **React 19** + **Vite 7** + **TypeScript**
- **Cloudflare Worker + D1** (`worker/index.ts`, `migrations/`) — SQLite backend behind `/api/query`
- **Tailwind CSS 3** + **shadcn/radix-ui** components
- **recharts** / **chart.js** for charts, **tesseract.js** for receipt OCR
- **vite-plugin-pwa** for installable PWA (iOS/Android)

## Setup

```bash
npm install
npm run build
npm run dev:api   # Worker + static assets on :8787, using the remote D1 database
```

The D1 binding (`PANTAGON_PERSONAL`) is declared in `wrangler.jsonc`. Schema: `migrations/`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (default port 5173) |
| `npm run build` | Type-check + production build |
| `npm run dev:api` | Run the Worker locally against remote D1 |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run lint` | Run ESLint |

## Supabase tables

All app tables use the `pantagon_financial_*` prefix:

| Table | Purpose |
|---|---|
| `pantagon_financial_transactions` | Bank/account IN/OUT ledger |
| `pantagon_financial_fx` | Currency conversion records |
| `pantagon_financial_stock_trades` | Dime broker stock trades |
| `pantagon_financial_fcd` | Foreign-currency deposit / gold |
| `pantagon_financial_salary_logs` | Monthly salary allocation history |
| `pantagon_financial_accounts` | Account catalog (names, icons, ordering) for UI dropdowns |

> **Note:** Row Level Security is currently disabled on these tables. The app uses the public anon key client-side with no auth layer — anyone with the key can read/write. Add Supabase Auth + RLS policies before exposing this publicly.

## Project structure

```
src/
  pages/        Route pages (Dashboard, Transactions, FX, DimeStock, FCD, SalaryAllocation, …)
  components/
    ui/         shadcn/radix primitives
    fcd/        FCD-specific inputs/buttons
  api/fcd/      FCD data access + calculations
  lib/          Shared utils, account catalog hook
  supabaseClient.ts
```

# PanAssets — Financial Series Assets

A personal finance PWA (React + TypeScript + Vite) backed by Supabase. Tracks bank/investment account balances, FX conversions, Dime stock trades, FCD (foreign-currency / gold), and monthly salary allocation.

## Stack

- **React 19** + **Vite 7** + **TypeScript**
- **Supabase** (`@supabase/supabase-js`) — Postgres backend
- **Tailwind CSS 3** + **shadcn/radix-ui** components
- **recharts** / **chart.js** for charts, **tesseract.js** for receipt OCR
- **vite-plugin-pwa** for installable PWA (iOS/Android)

## Setup

```bash
npm install
cp .env.example .env   # then fill in your Supabase credentials
npm run dev
```

### Environment variables

Create `.env` (not committed) with:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (default port 5173) |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build |
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

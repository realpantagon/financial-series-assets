
export interface FinancialTransaction {
  id: number;
  account_name: string;
  type: 'IN' | 'OUT';
  amount: number;
  date: string; // ISO date string YYYY-MM-DD
  note: string | null;
  tag: string | null;
  created_at?: string;
}

export interface FinancialFX {
  id: number;
  foreign_amount: number;
  thb_amount: number;
  exchange_rate: number;
  transaction_at: string;
  from_currency: string;
  to_currency: string;
  created_at?: string;
}

export interface SalaryAllocationRow {
  account_name: string;
  amount: number;
}

export interface PantagonSalaryLog {
  id: number;
  month: string; // YYYY-MM
  total_amount: number;
  allocations: SalaryAllocationRow[];
  date: string; // ISO date string YYYY-MM-DD
  created_at?: string;
}

export interface DimeTransaction {
  id: number;                // bigint from dime_trades
  order_no: string | null;
  trade_date: string;        // date YYYY-MM-DD
  side: 'BUY' | 'SELL';
  symbol: string;
  market: string | null;
  qty: number;               // shares
  price: number;             // price per share
  currency: string | null;
  gross_usd: number | null;  // qty * price
  fee_usd: number | null;    // total fees
  wht_usd: number | null;
  net_usd: number | null;    // cash received (SELL) or total spent (BUY)
  gross_thb: number | null;
  fee_thb: number | null;
  wht_thb: number | null;
  net_thb: number | null;
  source: string | null;
  created_at?: string | null;
}


export interface PantagonAsset {
  id: number;
  account_name: string;
  type: 'IN' | 'OUT';
  amount: number;
  date: string; // ISO date string YYYY-MM-DD
  note: string | null;
  tag: string | null;
  created_at?: string;
}

export interface PantagonUSD {
  id: number;
  foreign_amount: number;
  thb_amount: number;
  exchange_rate: number;
  transaction_at: string;
  from_currency: string;
  to_currency: string;
  created_at?: string;
}

export interface DimeTransaction {
  id: string; // uuid
  side: 'BUY' | 'SELL' | 'INIT';
  transaction_date: string; // ISO timestamp
  symbol: string | null;
  shares: number | null;
  total_amount: number;
  executed_price: number;
  commission: number | null;
  vat: number | null;
  fee: number | null;
  created_at?: string | null;
  input_amount_usd: number | null;  // For BUY: the USD amount input
  input_shares: number | null;      // For SELL: the shares input
  stock_amount: number | null;
  sec_fee: number | null;
  taf_fee: number | null;
  currency: string | null;
}

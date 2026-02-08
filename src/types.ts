
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
  type?: 'USD' | 'FCD' | 'SAVE';
  created_at?: string;
}

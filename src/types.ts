
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

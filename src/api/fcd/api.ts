import { supabase } from '../../supabaseClient';
import type { DimeTransaction } from '../../types';
import type { FCDEntry, FCDTxType, NewFCDEntry } from './types';

export async function fetchFCDEntries(): Promise<FCDEntry[]> {
  const { data, error } = await supabase
    .from('pantagon_financial_fcd')
    .select('*')
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map(e => ({ ...e, origin: 'manual' as const }));
}

// Map a Dime gold transaction into a virtual FCD cash-flow entry.
// Returns null for rows with no cash movement.
function goldToFCDEntry(tx: DimeTransaction): FCDEntry | null {
  let tx_type: FCDTxType;
  let status: 'IN' | 'OUT';
  if (tx.side === 'BUY') {
    tx_type = 'GOLD_BUY';
    status = 'OUT';
  } else if (tx.side === 'SELL') {
    tx_type = 'GOLD_SELL';
    status = 'IN';
  } else {
    return null;
  }

  return {
    id: -tx.id,                 // negative id: never collides with manual rows; stable React key
    tx_type,
    status,
    date: tx.trade_date,
    usd: Number(tx.net_usd ?? 0),
    thb: null,
    rate: null,
    note: null,
    origin: 'dime',
    symbol: tx.symbol,
    qty: Number(tx.qty),
    qty_unit: tx.qty_unit ?? null,
  };
}

// Gold trades from the pipeline (MTS/YLG), as virtual USD cash flows.
// Read from the dedicated dime_gold table (all channels: DIMEFCD + DIMESAVE).
export async function fetchDimeCashFlows(): Promise<FCDEntry[]> {
  const { data, error } = await supabase
    .from('dime_gold')
    .select('id,trade_date,side,symbol,qty,qty_unit,net_usd');

  if (error) throw error;
  return ((data as DimeTransaction[]) || [])
    .map(goldToFCDEntry)
    .filter((e): e is FCDEntry => e !== null);
}

// FCD ledger, newest first. Gold is now entered manually in pantagon_financial_fcd
// (same table as FX / interest / transfer), so we no longer read the dime_gold
// table. fetchDimeCashFlows() is kept for reference / re-enabling later.
export async function fetchAllFCDEntries(): Promise<FCDEntry[]> {
  const manual = await fetchFCDEntries();
  return manual.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function addFCDEntry(entry: NewFCDEntry): Promise<FCDEntry> {
  const { data, error } = await supabase
    .from('pantagon_financial_fcd')
    .insert([entry])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateFCDEntry(id: number, entry: Partial<NewFCDEntry>): Promise<FCDEntry> {
  const { data, error } = await supabase
    .from('pantagon_financial_fcd')
    .update(entry)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteFCDEntry(id: number): Promise<void> {
  const { error } = await supabase
    .from('pantagon_financial_fcd')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

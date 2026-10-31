import { useEffect, useState } from 'react';
import { db } from '../db';
// 96px WebP icons (each < 4KB) — Vite inlines them into the bundle, so they
// render instantly instead of fetching the full-size originals from /public.
import scbIcon from '@/assets/accounts/scb.webp';
import dimeIcon from '@/assets/accounts/dime.webp';
import kbankIcon from '@/assets/accounts/kbank.webp';
import ttbIcon from '@/assets/accounts/ttb.webp';
import ssoIcon from '@/assets/accounts/sso.webp';

export interface FinancialAccount {
    id: number;
    name: string;
    display_order: number;
    icon_url: string | null;
    is_active: boolean;
    created_at?: string;
}

/**
 * Resolve an account icon from its name. Single source of truth shared across
 * Dashboard / AccountDetails / Transactions. Transactions store account names as
 * text (not FK-linked), so we match by substring — this mirrors the icon_url
 * values seeded in pantagon_financial_accounts.
 */
export function getAccountIcon(accountName: string | null | undefined): string | undefined {
    if (!accountName) return undefined;
    const lower = accountName.toLowerCase();
    if (lower.includes('scb')) return scbIcon;
    if (lower.includes('dime')) return dimeIcon;
    if (lower.includes('kbank') || lower.includes('make')) return kbankIcon;
    if (lower.includes('ttb')) return ttbIcon;
    if (lower.includes('sso')) return ssoIcon;
    return undefined;
}

export async function fetchAccounts(opts: { onlyActive?: boolean } = { onlyActive: true }): Promise<FinancialAccount[]> {
    let query = db
        .from('pantagon_financial_accounts')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

    if (opts.onlyActive) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as FinancialAccount[];
}

export function useAccounts(opts: { onlyActive?: boolean } = { onlyActive: true }) {
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchAccounts(opts)
            .then(data => { if (!cancelled) setAccounts(data); })
            .catch(err => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opts.onlyActive]);

    return { accounts, loading, error };
}

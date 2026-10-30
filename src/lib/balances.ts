import { useEffect, useState } from 'react';
import { db } from '../db';

interface Tx { account_name: string; type: 'IN' | 'OUT'; amount: number }

/** Net balance (IN minus OUT) and transaction count per account, derived from the ledger. */
export function useBalances() {
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        db.from('pantagon_financial_transactions')
            .select('*')
            .then(({ data }: { data: Tx[] | null }) => {
                if (cancelled) return;
                const b: Record<string, number> = {};
                const c: Record<string, number> = {};
                (data || []).forEach(t => {
                    const signed = t.type === 'IN' ? Number(t.amount) : -Number(t.amount);
                    b[t.account_name] = (b[t.account_name] || 0) + signed;
                    c[t.account_name] = (c[t.account_name] || 0) + 1;
                });
                setBalances(b);
                setCounts(c);
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    return { balances, counts, loading };
}

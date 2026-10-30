import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { db } from '../db';
import type { FinancialTransaction } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, fmtTHB } from '@/lib/utils';
import { Avatar, EmptyState, Group, Money, SectionLabel } from '@/components/ios';
import { TxRow } from '@/components/TxRow';
import { Plus } from 'lucide-react';

export default function AccountDetails() {
    const { accountName = '' } = useParams<{ accountName: string }>();
    const navigate = useNavigate();
    const [txs, setTxs] = useState<FinancialTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        db.from('pantagon_financial_transactions')
            .select('*')
            .eq('account_name', accountName)
            .order('date', { ascending: false })
            .order('id', { ascending: false })
            .then(({ data, error }: { data: FinancialTransaction[] | null; error: { message: string } | null }) => {
                if (error) toast.error('Could not load transactions', { description: error.message });
                else setTxs(data || []);
                setLoading(false);
            });
    }, [accountName]);

    const summary = useMemo(() => {
        let totalIn = 0, totalOut = 0;
        txs.forEach(t => { if (t.type === 'IN') totalIn += Number(t.amount); else totalOut += Number(t.amount); });
        return { total: totalIn - totalOut, in: totalIn, out: totalOut };
    }, [txs]);

    if (loading) {
        return (
            <div className="flex flex-col gap-3">
                <Skeleton className="h-36 rounded-3xl" />
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <section className="rounded-3xl bg-card px-5 pt-5 pb-4">
                <div className="flex items-center gap-3">
                    <Avatar name={accountName} size={44} />
                    <div className="min-w-0">
                        <p className="truncate text-[17px] font-semibold">{accountName}</p>
                        <p className="text-[13px] text-muted-foreground">Balance</p>
                    </div>
                </div>
                <Money value={summary.total} size="md" className={cn('mt-3', summary.total < 0 && 'text-rose-500')} />
                <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 gap-3">
                    <div>
                        <p className="text-[12px] text-muted-foreground">Total in</p>
                        <p className="text-[17px] font-semibold tabular-nums text-emerald-500">{fmtTHB(summary.in)}</p>
                    </div>
                    <div>
                        <p className="text-[12px] text-muted-foreground">Total out</p>
                        <p className="text-[17px] font-semibold tabular-nums text-rose-500">{fmtTHB(summary.out)}</p>
                    </div>
                </div>
            </section>

            <SectionLabel
                right={
                    <button
                        onClick={() => navigate('/add', { state: { accountName } })}
                        className="press h-8 flex items-center gap-1 text-[15px] font-medium text-primary"
                    >
                        <Plus className="size-4" /> Add
                    </button>
                }
            >
                {txs.length} transactions
            </SectionLabel>

            {txs.length === 0 ? (
                <EmptyState title="No transactions" body="Add one to start this account’s history." />
            ) : (
                <Group>{txs.map(tx => <TxRow key={tx.id} tx={tx} showAccount={false} />)}</Group>
            )}
        </div>
    );
}

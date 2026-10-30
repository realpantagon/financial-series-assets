import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { db } from '../db';
import type { FinancialTransaction } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EmptyState, Group } from '@/components/ios';
import { TxRow } from '@/components/TxRow';

const PAGE_SIZE = 40;
type Filter = 'ALL' | 'IN' | 'OUT';

export default function Transactions() {
    const [all, setAll] = useState<FinancialTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('ALL');
    const [shown, setShown] = useState(PAGE_SIZE);

    useEffect(() => {
        db.from('pantagon_financial_transactions')
            .select('*')
            .order('date', { ascending: false })
            .order('id', { ascending: false })
            .then(({ data, error }: { data: FinancialTransaction[] | null; error: { message: string } | null }) => {
                if (error) toast.error('Could not load transactions', { description: error.message });
                else setAll(data || []);
                setLoading(false);
            });
    }, []);

    const filtered = useMemo(() => (filter === 'ALL' ? all : all.filter(t => t.type === filter)), [all, filter]);
    const visible = filtered.slice(0, shown);

    const chip = (value: Filter, label: string) => (
        <button
            key={value}
            onClick={() => { setFilter(value); setShown(PAGE_SIZE); }}
            className={cn(
                'press h-9 px-4 rounded-full text-[15px] font-medium whitespace-nowrap',
                filter === value ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
            )}
        >
            {label}
        </button>
    );

    if (loading) {
        return <div className="flex flex-col gap-2">{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="scroll-x flex gap-2 -mx-4 px-4">
                {chip('ALL', 'All')}{chip('IN', 'Income')}{chip('OUT', 'Expense')}
            </div>

            {visible.length === 0 ? (
                <EmptyState title="Nothing here yet" body="Transactions you add will show up in this list." />
            ) : (
                <Group>{visible.map(tx => <TxRow key={tx.id} tx={tx} />)}</Group>
            )}

            {visible.length < filtered.length && (
                <button
                    onClick={() => setShown(s => s + PAGE_SIZE)}
                    className="press h-12 rounded-2xl bg-card text-[17px] text-primary font-medium"
                >
                    Show more ({filtered.length - visible.length} left)
                </button>
            )}
        </div>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { db } from '../db';
import type { FinancialTransaction } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, fmtTHB } from '@/lib/utils';
import { useAccounts } from '@/lib/accounts';
import { Avatar, EmptyState, Group, Money, SectionLabel } from '@/components/ios';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Banknote, ArrowRightLeft, Plus } from 'lucide-react';

const monthKey = (d: string) => d.slice(0, 7);

export default function Dashboard() {
    const navigate = useNavigate();
    const { accounts: catalog } = useAccounts();
    const [txs, setTxs] = useState<FinancialTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        db.from('pantagon_financial_transactions')
            .select('*')
            .order('date', { ascending: false })
            .then(({ data, error }: { data: FinancialTransaction[] | null; error: { message: string } | null }) => {
                if (error) toast.error('Could not load transactions', { description: error.message });
                else setTxs(data || []);
                setLoading(false);
            });
    }, []);

    const { total, accounts, monthIn, monthOut } = useMemo(() => {
        const map: Record<string, { balance: number; count: number }> = {};
        const thisMonth = new Date().toISOString().slice(0, 7);
        let total = 0, monthIn = 0, monthOut = 0;
        txs.forEach(t => {
            const amt = Number(t.amount);
            const signed = t.type === 'IN' ? amt : -amt;
            total += signed;
            const a = (map[t.account_name || 'Unassigned'] ??= { balance: 0, count: 0 });
            a.balance += signed;
            a.count += 1;
            if (monthKey(t.date) === thisMonth && t.tag !== 'Transfer') {
                if (t.type === 'IN') monthIn += amt; else monthOut += amt;
            }
        });
        const orderOf = (n: string) => catalog.find(c => c.name === n)?.display_order ?? 9999;
        const accounts = Object.entries(map)
            .map(([name, v]) => ({ name, ...v }))
            .sort((a, b) => orderOf(a.name) - orderOf(b.name) || b.balance - a.balance);
        return { total, accounts, monthIn, monthOut };
    }, [txs, catalog]);

    if (loading) {
        return (
            <div className="flex flex-col gap-3">
                <Skeleton className="h-40 w-full rounded-3xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
        );
    }

    const actions = [
        { label: 'Add', icon: Plus, to: '/add' },
        { label: 'Transfer', icon: ArrowRightLeft, to: '/transfer' },
        { label: 'Salary', icon: Banknote, to: '/salary' },
    ];

    return (
        <div className="flex flex-col">
            {/* Net worth */}
            <section className="rounded-3xl bg-card px-5 pt-5 pb-4">
                <p className="text-[13px] font-medium text-muted-foreground">Net worth</p>
                <Money value={total} className={cn('mt-2', total < 0 && 'text-rose-500')} />
                <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                            <ArrowDownLeft className="size-4 text-emerald-500" /> In this month
                        </p>
                        <p className="mt-1 text-[22px] font-semibold tabular-nums text-emerald-500">{fmtTHB(monthIn, { decimals: 0 })}</p>
                    </div>
                    <div>
                        <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                            <ArrowUpRight className="size-4 text-rose-500" /> Out this month
                        </p>
                        <p className="mt-1 text-[22px] font-semibold tabular-nums text-rose-500">{fmtTHB(monthOut, { decimals: 0 })}</p>
                    </div>
                </div>
            </section>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3 mt-3">
                {actions.map(({ label, icon: Icon, to }) => (
                    <button
                        key={to}
                        onClick={() => navigate(to)}
                        className="press h-[76px] rounded-2xl bg-card flex flex-col items-center justify-center gap-1.5 text-[15px] font-medium"
                    >
                        <Icon className="size-6 text-primary" strokeWidth={1.9} />
                        {label}
                    </button>
                ))}
            </div>

            <SectionLabel right={<span className="text-[13px] text-muted-foreground">{accounts.length} accounts</span>}>
                Accounts
            </SectionLabel>

            {accounts.length === 0 ? (
                <EmptyState title="No accounts yet" body="Add your first transaction to start tracking." />
            ) : (
                <Group>
                    {accounts.map(acc => (
                        <button
                            key={acc.name}
                            onClick={() => navigate(`/account/${encodeURIComponent(acc.name)}`)}
                            className="press w-full flex items-center gap-3 px-4 min-h-[64px] text-left"
                        >
                            <Avatar name={acc.name} size={40} />
                            <span className="flex-1 min-w-0">
                                <span className="block truncate text-[17px] font-medium">{acc.name}</span>
                                <span className="block text-[13px] text-muted-foreground">{acc.count} transactions</span>
                            </span>
                            <span className={cn('text-[17px] font-semibold tabular-nums', acc.balance < 0 && 'text-rose-500')}>
                                {fmtTHB(acc.balance)}
                            </span>
                            <ChevronRight className="size-4 text-muted-foreground/60 shrink-0" />
                        </button>
                    ))}
                </Group>
            )}
        </div>
    );
}

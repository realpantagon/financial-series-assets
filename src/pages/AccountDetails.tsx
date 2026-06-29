import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { FinancialTransaction } from '../types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getAccountIcon } from '@/lib/accounts';
import { ArrowLeft, Plus, ArrowDownLeft, ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';

export default function AccountDetails() {
    const { accountName } = useParams<{ accountName: string }>();
    const navigate = useNavigate();
    const [assets, setAssets] = useState<FinancialTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAccountAssets = useCallback(async (name: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pantagon_financial_transactions')
            .select('*')
            .eq('account_name', name)
            .order('date', { ascending: false })
            .order('id', { ascending: false });

        if (error) toast.error('Failed to load transactions', { description: error.message });
        else setAssets(data || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (accountName) fetchAccountAssets(accountName);
    }, [accountName, fetchAccountAssets]);

    const summary = useMemo(() => {
        let total = 0, totalIn = 0, totalOut = 0;
        assets.forEach(item => {
            const amount = Number(item.amount);
            if (item.type === 'IN') { total += amount; totalIn += amount; }
            else { total -= amount; totalOut += amount; }
        });
        return { total, in: totalIn, out: totalOut };
    }, [assets]);

    const formatCurrency = (value: number) =>
        value.toLocaleString('en-US', { style: 'currency', currency: 'THB' });

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-4 pt-4 pb-20">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <Skeleton className="h-6 w-40" />
                </div>
                <Skeleton className="h-28 w-full rounded-2xl" />
                <div className="flex flex-col gap-2">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
            </div>
        );
    }

    const icon = accountName ? getAccountIcon(accountName) : undefined;

    return (
        <div className="flex flex-col gap-4 pb-24 pt-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate('/')}
                    className="size-9 rounded-full shrink-0"
                >
                    <ArrowLeft className="size-4" />
                </Button>

                {icon && (
                    <div className="size-9 rounded-full overflow-hidden border border-border/50 bg-muted flex-shrink-0">
                        <img src={icon} alt={accountName} className="w-full h-full object-cover" />
                    </div>
                )}

                <h2 className="text-lg font-bold text-foreground leading-snug truncate">{accountName}</h2>
            </div>

            {/* Balance Card */}
            <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-card to-blue-500/5 p-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 to-transparent pointer-events-none" />
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 relative">
                    Total Balance
                </p>
                <p className="font-mono font-bold text-3xl text-foreground tracking-tight relative">{formatCurrency(summary.total)}</p>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border/20 relative">
                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <TrendingUp className="size-3 text-emerald-400" />
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total In</span>
                        </div>
                        <p className="text-base font-mono font-semibold text-emerald-400">{formatCurrency(summary.in)}</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <TrendingDown className="size-3 text-rose-400" />
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Out</span>
                        </div>
                        <p className="text-base font-mono font-semibold text-rose-400">{formatCurrency(summary.out)}</p>
                    </div>
                </div>
            </div>

            {/* Transactions */}
            <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {assets.length} Transactions
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate('/add', { state: { accountName } })}
                        className="h-7 text-xs gap-1"
                    >
                        <Plus className="size-3" />
                        Add
                    </Button>
                </div>

                {assets.length === 0 ? (
                    <div className="border border-dashed border-border/30 rounded-xl py-10 text-center text-muted-foreground text-sm">
                        No transactions for this account.
                    </div>
                ) : (
                    <div className="rounded-xl overflow-hidden border border-border/30 bg-card/60">
                        {assets.map((item, idx) => {
                            const isIn = item.type === 'IN';
                            return (
                                <div key={item.id}>
                                    <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                'size-9 rounded-full flex items-center justify-center flex-shrink-0 border',
                                                isIn
                                                    ? 'bg-emerald-500/10 border-emerald-500/20'
                                                    : 'bg-rose-500/10 border-rose-500/20'
                                            )}>
                                                {isIn
                                                    ? <ArrowDownLeft className="size-4 text-emerald-400" />
                                                    : <ArrowUpRight className="size-4 text-rose-400" />
                                                }
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-semibold text-foreground text-sm leading-snug line-clamp-1">
                                                    {item.tag || (isIn ? 'Income' : 'Expense')}
                                                </span>
                                                <span className="text-muted-foreground text-[11px] font-mono">
                                                    {formatDate(item.date)}
                                                    {item.note && ` · ${item.note}`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1 pl-2 shrink-0">
                                            <span className={cn(
                                                'font-mono font-bold text-sm',
                                                isIn ? 'text-emerald-400' : 'text-foreground'
                                            )}>
                                                {isIn ? '+' : '-'}{formatCurrency(Number(item.amount))}
                                            </span>
                                            <span className={cn(
                                                'text-[9px] font-bold px-1.5 py-0.5 rounded border',
                                                isIn
                                                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                                            )}>
                                                {isIn ? 'IN' : 'OUT'}
                                            </span>
                                        </div>
                                    </div>
                                    {idx < assets.length - 1 && <Separator className="mx-4 w-auto opacity-20" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

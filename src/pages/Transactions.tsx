import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { FinancialTransaction } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getAccountIcon } from '@/lib/accounts';
import { ArrowDownLeft, ArrowUpRight, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

export default function Transactions() {
    const [assets, setAssets] = useState<FinancialTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const fetchAllAssets = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pantagon_financial_transactions')
            .select('*')
            .order('date', { ascending: false })
            .order('id', { ascending: false });
        if (error) toast.error('Failed to load transactions', { description: error.message });
        else setAssets(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAllAssets(); }, [fetchAllAssets]);

    const formatCurrency = (value: number) =>
        value.toLocaleString('en-US', { style: 'currency', currency: 'THB' });

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
    };

    const totalPages = Math.max(1, Math.ceil(assets.length / PAGE_SIZE));
    const paged = assets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const goTo = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

    const pageWindow = () => {
        const radius = 2;
        let start = Math.max(1, page - radius);
        let end = Math.min(totalPages, page + radius);
        if (end - start < 4) {
            if (start === 1) end = Math.min(totalPages, start + 4);
            else start = Math.max(1, end - 4);
        }
        const pages: number[] = [];
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-0 pt-4 pb-20">
                {[1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="px-3 py-3 border-b border-border/15 flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full shrink-0" />
                        <div className="flex-1 flex flex-col gap-1.5">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-2.5 w-16" />
                        </div>
                        <Skeleton className="h-3 w-14" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 pb-24 pt-4">
            {/* Stats bar */}
            <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">
                    {assets.length} TRANSACTIONS
                </span>
                {totalPages > 1 && (
                    <span className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">
                        {page} / {totalPages}
                    </span>
                )}
            </div>

            {/* List */}
            <div className="rounded-xl border border-border/20 bg-gray-100/70 dark:bg-[oklch(0.11_0.014_255/0.7)] overflow-hidden">
                {paged.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground/30 text-[10px] tracking-wider">
                        NO TRANSACTIONS FOUND
                    </div>
                ) : (
                    paged.map((item, idx) => {
                        const icon = getAccountIcon(item.account_name);
                        const isIn = item.type === 'IN';

                        return (
                            <div
                                key={item.id}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/1 transition-colors',
                                    idx < paged.length - 1 && 'border-b border-border/15'
                                )}
                            >
                                {/* Icon */}
                                <div className={cn(
                                    'size-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center border',
                                    icon ? 'border-border/20 bg-black/20' : isIn ? 'border-emerald-500/15 bg-emerald-500/8' : 'border-rose-500/15 bg-rose-500/8'
                                )}>
                                    {icon ? (
                                        <>
                                            <img src={icon} alt={item.account_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                                            <Wallet className="size-3.5 text-muted-foreground/40 hidden" />
                                        </>
                                    ) : isIn ? (
                                        <ArrowDownLeft className="size-3.5 text-emerald-400" />
                                    ) : (
                                        <ArrowUpRight className="size-3.5 text-rose-400" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                    <span className="font-bold text-foreground text-sm truncate leading-snug">
                                        {item.tag || item.account_name}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-mono text-muted-foreground/40">{formatDate(item.date)}</span>
                                        <span className="text-muted-foreground/20 text-[9px]">·</span>
                                        <span className="text-[9px] text-muted-foreground/30 truncate max-w-[80px]">{item.account_name}</span>
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="flex flex-col items-end gap-0.5 shrink-0 pl-2">
                                    <span className={cn(
                                        'font-mono font-black text-sm',
                                        isIn ? 'text-emerald-400' : 'text-foreground/80'
                                    )}>
                                        {isIn ? '+' : '-'}{formatCurrency(Number(item.amount))}
                                    </span>
                                    <span className={cn(
                                        'text-[8px] font-bold px-1 py-0.5 rounded border tracking-wider',
                                        isIn
                                            ? 'text-emerald-400/70 bg-emerald-500/8 border-emerald-500/15'
                                            : 'text-rose-400/70 bg-rose-500/8 border-rose-500/15'
                                    )}>
                                        {isIn ? 'IN' : 'OUT'}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => goTo(page - 1)}
                        disabled={page === 1}
                        className="size-7 text-muted-foreground/50 hover:text-foreground"
                    >
                        <ChevronLeft className="size-3.5" />
                    </Button>

                    {pageWindow().map(p => (
                        <Button
                            key={p}
                            variant={p === page ? 'default' : 'ghost'}
                            size="icon"
                            onClick={() => goTo(p)}
                            className={cn(
                                'size-7 text-[10px] font-mono font-bold',
                                p === page
                                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/15 shadow-none'
                                    : 'text-muted-foreground/40 hover:text-foreground'
                            )}
                        >
                            {p}
                        </Button>
                    ))}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => goTo(page + 1)}
                        disabled={page === totalPages}
                        className="size-7 text-muted-foreground/50 hover:text-foreground"
                    >
                        <ChevronRight className="size-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}

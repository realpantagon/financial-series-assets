import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { PantagonAsset } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

export default function Transactions() {
    const [assets, setAssets] = useState<PantagonAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    useEffect(() => { fetchAllAssets(); }, []);

    const fetchAllAssets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pantagon_assets')
            .select('*')
            .order('date', { ascending: false })
            .order('id', { ascending: false });
        if (!error) setAssets(data || []);
        setLoading(false);
    };

    const formatCurrency = (value: number) =>
        value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
    };

    const getAccountIcon = (accountName: string): string | undefined => {
        if (!accountName) return undefined;
        const lower = accountName.toLowerCase();
        if (lower.includes('scb')) return '/scb.jpg';
        if (lower.includes('dime')) return '/Dime.png';
        if (lower.includes('kbank') || lower.includes('make')) return '/kbank.png';
        if (lower.includes('ttb')) return '/ttb.png';
        if (lower.includes('sso')) return '/SSO.jpg';
        return undefined;
    };

    const totalPages = Math.max(1, Math.ceil(assets.length / PAGE_SIZE));
    const paged = assets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const goTo = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

    // Page window: show up to 5 page buttons
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
                    <div key={i} className="px-4 py-3.5 border-b border-border/20 flex items-center gap-3">
                        <Skeleton className="size-9 rounded-full shrink-0" />
                        <div className="flex-1 flex flex-col gap-1.5">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-2.5 w-20" />
                        </div>
                        <Skeleton className="h-3 w-16" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 pb-24 pt-4">
            {/* Stats bar */}
            <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-mono text-muted-foreground">
                    {assets.length} transactions
                </span>
                {totalPages > 1 && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                        page {page} / {totalPages}
                    </span>
                )}
            </div>

            {/* List */}
            <div className="rounded-xl border border-border/30 bg-card/60 overflow-hidden">
                {paged.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground text-sm">
                        No transactions found.
                    </div>
                ) : (
                    paged.map((item, idx) => {
                        const icon = getAccountIcon(item.account_name);
                        const isIn = item.type === 'IN';

                        return (
                            <div
                                key={item.id}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors',
                                    idx < paged.length - 1 && 'border-b border-border/20'
                                )}
                            >
                                {/* Icon */}
                                <div className={cn(
                                    'size-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center border',
                                    icon ? 'border-border/30 bg-muted/40' : isIn ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-rose-500/20 bg-rose-500/10'
                                )}>
                                    {icon ? (
                                        <>
                                            <img src={icon} alt={item.account_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                                            <Wallet className="size-4 text-muted-foreground hidden" />
                                        </>
                                    ) : isIn ? (
                                        <ArrowDownLeft className="size-4 text-emerald-400" />
                                    ) : (
                                        <ArrowUpRight className="size-4 text-rose-400" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                    <span className="font-semibold text-foreground text-sm truncate leading-snug">
                                        {item.tag || item.account_name}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-mono text-muted-foreground">{formatDate(item.date)}</span>
                                        <span className="text-muted-foreground/30 text-[10px]">·</span>
                                        <span className="text-[11px] text-muted-foreground truncate max-w-[90px]">{item.account_name}</span>
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
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
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => goTo(page - 1)}
                        disabled={page === 1}
                        className="size-8 text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="size-4" />
                    </Button>

                    {pageWindow().map(p => (
                        <Button
                            key={p}
                            variant={p === page ? 'default' : 'ghost'}
                            size="icon"
                            onClick={() => goTo(p)}
                            className={cn(
                                'size-8 text-xs font-mono',
                                p === page
                                    ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/25 shadow-none'
                                    : 'text-muted-foreground hover:text-foreground'
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
                        className="size-8 text-muted-foreground hover:text-foreground"
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { DimeTransaction } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, getErrorMessage } from '@/lib/utils';
import { ChevronLeft, TrendingUp, TrendingDown, Activity, Trash2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined, digits = 2): string {
    if (value == null) return '—';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4) });
}

function formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ─── SidePill ─────────────────────────────────────────────────────────────────

function SidePill({ side }: { side: string }) {
    return (
        <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border tracking-wider',
            side === 'BUY'  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' :
            side === 'SELL' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                              'bg-violet-500/10 text-violet-400 border-violet-500/25'
        )}>
            {side}
        </span>
    );
}

// ─── FeePill ──────────────────────────────────────────────────────────────────

function FeePill({ label, value }: { label: string; value: number | null | undefined }) {
    if (!value || value <= 0) return null;
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/6 text-amber-400/70 border border-amber-500/12">
            {label} {fmt(value, 4)}
        </span>
    );
}

// ─── Stat Block ──────────────────────────────────────────────────────────────

function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
    return (
        <div>
            <p className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-[0.14em] mb-0.5">{label}</p>
            <p className={cn('font-mono font-bold text-sm', className)}>{value}</p>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SymbolDetailPage() {
    const { symbol } = useParams<{ symbol: string }>();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<DimeTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pantagon_financial_stock_trades')
            .select('*')
            .order('transaction_date', { ascending: false });
        if (error) toast.error('Failed to load trades', { description: error.message });
        else setTransactions((data as DimeTransaction[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!symbol) return;
        fetchTransactions();
    }, [symbol, fetchTransactions]);

    const symTxs = useMemo(() =>
        [...transactions]
            .filter(t => (t.symbol || 'UNKNOWN') === symbol)
            .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
        [transactions, symbol]
    );

    const summary = useMemo(() => {
        let totalBuyAmount = 0, totalSellAmount = 0, totalShares = 0, totalStockAmount = 0, txCount = 0, totalSharesSold = 0;
        symTxs.filter(t => t.side === 'BUY' || t.side === 'INIT').forEach(tx => {
            txCount++;
            totalBuyAmount += tx.side === 'INIT' ? Number(tx.stock_amount ?? 0) : Number(tx.total_amount);
            totalShares += Number(tx.shares ?? 0);
            totalStockAmount += Number(tx.stock_amount ?? 0);
        });
        const avgBuyPrice = totalShares > 0 ? totalStockAmount / totalShares : 0;
        symTxs.filter(t => t.side === 'SELL').forEach(tx => {
            txCount++;
            const sharesSold = Number(tx.shares ?? 0);
            totalSharesSold += sharesSold;
            totalSellAmount += Number(tx.total_amount);
            totalShares -= sharesSold;
            totalStockAmount -= sharesSold * avgBuyPrice;
        });
        if (totalShares <= 0.000001) { totalShares = 0; totalStockAmount = 0; }
        else totalStockAmount = Math.max(0, totalStockAmount);
        return { totalBuyAmount, totalSellAmount, totalShares, avgBuyPrice, txCount, totalStockAmount, totalSharesSold };
    }, [symTxs]);

    const realized = summary.totalSellAmount > 0 ? summary.totalSellAmount - (summary.totalSharesSold * summary.avgBuyPrice) : 0;
    const plPositive = realized >= 0;

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('pantagon_financial_stock_trades').delete().eq('id', id);
            if (error) throw error;
            toast.success('Transaction deleted');
            setDeleteId(null);
            await fetchTransactions();
        } catch (err) { toast.error('Delete failed', { description: getErrorMessage(err) }); }
    };

    if (loading) return (
        <div className="flex flex-col gap-4 pt-4 pb-28">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-4 w-36 rounded mx-auto" />
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
    );

    if (!symbol || symTxs.length === 0) return (
        <div className="flex flex-col gap-4 pt-4 pb-28">
            <button
                onClick={() => navigate('/dime-stock')}
                className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors self-start tracking-wider"
            >
                <ChevronLeft className="size-3.5" />
                PORTFOLIO
            </button>
            <div className="flex flex-col items-center py-16 text-muted-foreground/40 text-sm">
                No data for {symbol}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-4 pt-4 pb-28">
            {/* Back */}
            <button
                onClick={() => navigate('/dime-stock')}
                className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-cyan-400 transition-colors self-start tracking-[0.1em]"
            >
                <ChevronLeft className="size-3.5" />
                PORTFOLIO
            </button>

            {/* Hero card */}
            <div className="rounded-xl border border-cyan-500/15 bg-gradient-to-br from-[oklch(0.13_0.02_250)] to-[oklch(0.09_0.03_230)] overflow-hidden relative">
                {/* Decorative bg icon */}
                <Activity className="absolute -right-4 -bottom-4 size-28 text-cyan-500/4" />

                {/* Top accent line */}
                <div className="h-px w-full bg-gradient-to-r from-cyan-500/60 via-cyan-400/20 to-transparent" />

                <div className="p-5 relative">
                    {/* Symbol + trades header */}
                    <div className="flex justify-between items-start mb-5">
                        <div>
                            <div className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-[0.16em] mb-1">Symbol</div>
                            <div className="font-mono font-black text-4xl text-foreground tracking-tighter leading-none">{symbol}</div>
                            <div className="text-[10px] text-muted-foreground/50 font-mono mt-1.5">
                                {summary.txCount} trade{summary.txCount !== 1 ? 's' : ''}
                            </div>
                        </div>
                        {realized !== 0 && (
                            <div className="text-right">
                                <div className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-[0.16em] mb-1">Net P&L</div>
                                <div className={cn('font-mono font-black text-2xl', plPositive ? 'text-emerald-400' : 'text-rose-400')}>
                                    {plPositive ? '+' : ''}{fmt(realized)}
                                </div>
                                {plPositive
                                    ? <TrendingUp className="size-3.5 text-emerald-400/60 ml-auto mt-0.5" />
                                    : <TrendingDown className="size-3.5 text-rose-400/60 ml-auto mt-0.5" />
                                }
                            </div>
                        )}
                    </div>

                    {/* Position value — big number */}
                    <div className="mb-5">
                        <div className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-0.5">Position Value</div>
                        <div className="font-mono font-black text-3xl text-cyan-300 tracking-tight">{fmt(summary.totalStockAmount)}</div>
                        {summary.totalShares > 0 && (
                            <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">
                                {summary.totalShares.toFixed(7)} sh held
                            </div>
                        )}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-start gap-6 pt-3 border-t border-border/20">
                        <Stat label="Avg Buy" value={fmt(summary.avgBuyPrice)} className="text-foreground/80" />
                        <Stat label="Invested" value={fmt(summary.totalBuyAmount)} className="text-foreground/60" />
                        {summary.totalSellAmount > 0 && (
                            <Stat label="Sold" value={fmt(summary.totalSellAmount)} className="text-emerald-400" />
                        )}
                    </div>
                </div>
            </div>

            {/* Timeline label */}
            <div className="flex items-center gap-2 px-1">
                <div className="h-px flex-1 bg-border/20" />
                <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em]">Transaction Timeline</span>
                <div className="h-px flex-1 bg-border/20" />
            </div>

            {/* Timeline */}
            <div className="relative">
                <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border/20" style={{ zIndex: 0 }} />
                <div className="flex flex-col gap-2.5">
                    {symTxs.map((tx) => {
                        const isIn = tx.side === 'BUY' || tx.side === 'INIT';
                        const dotColor =
                            tx.side === 'BUY'  ? 'bg-cyan-500 shadow-[0_0_6px_oklch(0.68_0.18_210/0.6)]' :
                            tx.side === 'SELL' ? 'bg-emerald-500 shadow-[0_0_6px_oklch(0.7_0.2_150/0.6)]' :
                                                 'bg-violet-500';
                        return (
                            <div key={tx.id} className="flex gap-3 relative" style={{ zIndex: 1 }}>
                                {/* Timeline dot */}
                                <div className={cn('size-[9px] rounded-full mt-3 shrink-0 ring-2 ring-background', dotColor)} />

                                <div className="flex-1 border border-border/25 rounded-lg bg-[oklch(0.12_0.015_255/0.6)] p-3 hover:border-border/50 transition-colors group">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <SidePill side={tx.side} />
                                            <span className="text-[10px] text-muted-foreground/60 font-mono">{formatDate(tx.transaction_date)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={cn('font-mono font-bold text-sm',
                                                isIn ? 'text-foreground' : 'text-emerald-400'
                                            )}>
                                                {tx.side === 'INIT' ? fmt(tx.stock_amount) : fmt(tx.total_amount)}
                                            </span>
                                            <button
                                                onClick={() => setDeleteId(tx.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-muted-foreground/40 hover:text-rose-400 transition-all"
                                            >
                                                <Trash2 className="size-3" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 text-[9px] font-mono text-muted-foreground/50">
                                        {tx.shares != null && <span>{Number(tx.shares).toFixed(7)} sh</span>}
                                        {tx.executed_price != null && <span>@ {fmt(tx.executed_price)}</span>}
                                        {tx.stock_amount != null && Number(tx.stock_amount) > 0 && tx.side !== 'INIT' && (
                                            <span className="text-cyan-400/50">stock {fmt(tx.stock_amount)}</span>
                                        )}
                                        <FeePill label="comm" value={tx.commission} />
                                        <FeePill label="VAT" value={tx.vat} />
                                        <FeePill label="SEC" value={tx.sec_fee} />
                                        <FeePill label="TAF" value={tx.taf_fee} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Delete confirm */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent className="bg-[oklch(0.12_0.018_255)] border-border/40">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-mono text-sm tracking-wide">Delete transaction?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border/30 text-xs h-9">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-rose-500/70 hover:bg-rose-500 text-white border-rose-500/20 text-xs h-9"
                            onClick={() => deleteId && handleDelete(deleteId)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

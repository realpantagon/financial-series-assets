import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { DimeTransaction } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    ChevronLeft, TrendingUp, TrendingDown, RefreshCw,
    Activity, ChevronRight,
} from 'lucide-react';
import { useDailyPrices } from '@/hooks/useDailyPrices';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number, d = 2): string {
    return v.toLocaleString('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 4),
    });
}

function fmtCompact(v: number): string {
    const abs = Math.abs(v);
    const sign = v >= 0 ? '+' : '-';
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
    return `${sign}$${abs.toFixed(0)}`;
}

function SignBadge({ v, suffix = '%', digits = 2 }: { v: number; suffix?: string; digits?: number }) {
    const pos = v >= 0;
    return (
        <span className={cn('text-[9px] font-mono font-bold px-1 py-px rounded',
            pos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
        )}>
            {pos ? '+' : ''}{v.toFixed(digits)}{suffix}
        </span>
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenPos {
    symbol: string;
    totalShares: number;
    avgBuyPrice: number;
    totalBuyAmount: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DimeStockPrices() {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<DimeTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTx = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('dime_trades')
            .select('id,trade_date,side,symbol,qty,gross_usd,fee_usd,net_usd')
            .order('trade_date', { ascending: true });
        setTransactions((data as DimeTransaction[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchTx(); }, [fetchTx]);

    // ── Compute open positions via average cost method ────────────────────────
    const openPositions = useMemo((): OpenPos[] => {
        const buyShares: Record<string, number> = {};
        const buyStockAmt: Record<string, number> = {};
        const buyTotalAmt: Record<string, number> = {};

        transactions.filter(t => t.side === 'BUY').forEach(tx => {
            const sym = tx.symbol;
            buyShares[sym]    = (buyShares[sym]    ?? 0) + Number(tx.qty);
            buyStockAmt[sym]  = (buyStockAmt[sym]  ?? 0) + Number(tx.gross_usd ?? 0);
            buyTotalAmt[sym]  = (buyTotalAmt[sym]  ?? 0) + Number(tx.gross_usd ?? 0) + Number(tx.fee_usd ?? 0);
        });

        const avgCost: Record<string, number> = {};
        Object.keys(buyShares).forEach(sym => {
            avgCost[sym] = buyShares[sym] > 0 ? buyStockAmt[sym] / buyShares[sym] : 0;
        });

        const remShares: Record<string, number> = { ...buyShares };
        transactions.filter(t => t.side === 'SELL').forEach(tx => {
            remShares[tx.symbol] = (remShares[tx.symbol] ?? 0) - Number(tx.qty);
        });

        return Object.keys(remShares)
            .filter(sym => remShares[sym] > 0.000001)
            .map(sym => ({
                symbol: sym,
                totalShares: remShares[sym],
                avgBuyPrice: avgCost[sym] ?? 0,
                totalBuyAmount: buyTotalAmt[sym] ?? 0,
            }))
            .sort((a, b) => b.totalBuyAmount - a.totalBuyAmount);
    }, [transactions]);

    const openSymbols = useMemo(() => openPositions.map(p => p.symbol), [openPositions]);

    const {
        prices, loading: priceLoading, progress,
        refresh: refreshPrices, isConfigured,
    } = useDailyPrices(openSymbols);

    // ── Portfolio-level metrics ───────────────────────────────────────────────
    const metrics = useMemo(() => {
        let marketValue = 0, prevCloseValue = 0, todayMove = 0;
        let unrealPL = 0, costBasis = 0, priced = 0;

        openPositions.forEach(p => {
            const q = prices[p.symbol];
            costBasis += p.avgBuyPrice * p.totalShares;
            if (!q) return;
            priced++;
            marketValue    += q.c  * p.totalShares;
            prevCloseValue += q.pc * p.totalShares;
            todayMove      += q.d  * p.totalShares;
            unrealPL       += (q.c - p.avgBuyPrice) * p.totalShares;
        });

        const todayPct   = prevCloseValue > 0 ? (todayMove  / prevCloseValue) * 100 : 0;
        const unrealPct  = costBasis      > 0 ? (unrealPL   / costBasis)      * 100 : 0;

        return { marketValue, todayMove, todayPct, unrealPL, unrealPct, priced, costBasis };
    }, [openPositions, prices]);

    // ── Rows sorted by market value ───────────────────────────────────────────
    const rows = useMemo(() => openPositions.map(p => {
        const q = prices[p.symbol];
        const mktVal   = q ? q.c * p.totalShares : null;
        const unrealPL = q ? (q.c - p.avgBuyPrice) * p.totalShares : null;
        const unrealPct = (q && p.avgBuyPrice > 0)
            ? ((q.c - p.avgBuyPrice) / p.avgBuyPrice) * 100 : null;
        return { ...p, q, mktVal, unrealPL, unrealPct };
    }).sort((a, b) => (b.mktVal ?? 0) - (a.mktVal ?? 0)), [openPositions, prices]);

    // ── Movers ────────────────────────────────────────────────────────────────
    const { gainers, losers } = useMemo(() => {
        const withQ = rows.filter(r => r.q);
        const byDay = [...withQ].sort((a, b) => b.q!.dp - a.q!.dp);
        return {
            gainers: byDay.slice(0, 3),
            losers:  byDay.slice(-3).reverse(),
        };
    }, [rows]);

    // ─────────────────────────────────────────────────────────────────────────

    if (loading) return (
        <div className="flex flex-col gap-4 pt-4 pb-28">
            <Skeleton className="h-6 w-20 rounded" />
            <Skeleton className="h-8 w-32 rounded" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-28 rounded" />
                <Skeleton className="h-28 rounded" />
            </div>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 rounded" />)}
        </div>
    );

    const hasPrices = metrics.priced > 0;

    return (
        <div className="flex flex-col gap-4 pt-4 pb-28">

            {/* Back */}
            <button
                onClick={() => navigate('/dime-stock')}
                className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-cyan-400 transition-colors self-start tracking-[0.1em]"
            >
                <ChevronLeft className="size-3.5" />
                STOCKS
            </button>

            {/* Title + refresh */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-black text-lg text-foreground tracking-tighter">Live Prices</h1>
                    <p className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">
                        {openPositions.length} open · {metrics.priced} priced
                    </p>
                </div>
                {isConfigured && (
                    <button
                        onClick={refreshPrices}
                        disabled={priceLoading}
                        className="flex items-center gap-1.5 px-3 h-9 border border-border/20 bg-black/20 hover:bg-white/5 text-muted-foreground/60 hover:text-foreground text-[10px] font-bold tracking-widest transition-all disabled:opacity-40"
                    >
                        <RefreshCw className={cn('size-3.5', priceLoading && 'animate-spin')} />
                        {priceLoading ? `${progress}%` : 'REFRESH'}
                    </button>
                )}
            </div>

            {/* Progress */}
            {priceLoading && (
                <div className="h-0.5 bg-border/10 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500/50 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
            )}

            {/* Not configured */}
            {!isConfigured && (
                <div className="border border-amber-500/20 bg-amber-500/5 rounded-lg px-4 py-3">
                    <p className="text-xs font-mono text-amber-400/80">Add VITE_FINNHUB_API_KEY to .env</p>
                    <p className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">Free key at finnhub.io → 60 req/min</p>
                </div>
            )}

            {/* Portfolio value hero */}
            {hasPrices && (
                <div className="rounded-xl border border-cyan-500/15 bg-gradient-to-br from-[oklch(0.12_0.02_250)] to-[oklch(0.09_0.015_240)] p-5 relative overflow-hidden">
                    <Activity className="absolute -right-3 -top-3 size-20 text-cyan-500/4" />
                    <div className="h-px w-full absolute top-0 left-0 bg-gradient-to-r from-cyan-500/50 via-cyan-400/15 to-transparent" />
                    <div className="relative">
                        <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-1">Portfolio Market Value</p>
                        <p className="font-mono font-black text-3xl text-cyan-300 tracking-tight">{fmt(metrics.marketValue)}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/35 mt-0.5">
                            cost basis {fmt(metrics.costBasis)}
                        </p>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3 pt-3 border-t border-border/15">
                            {/* Today's move */}
                            <div>
                                <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Today's Move</p>
                                <p className={cn('font-mono text-sm font-bold',
                                    metrics.todayMove >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                )}>
                                    {metrics.todayMove >= 0 ? '+' : ''}{fmt(metrics.todayMove)}
                                </p>
                                <p className={cn('text-[9px] font-mono',
                                    metrics.todayMove >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60'
                                )}>
                                    {metrics.todayPct >= 0 ? '+' : ''}{metrics.todayPct.toFixed(2)}%
                                </p>
                            </div>

                            {/* Unrealized P&L */}
                            <div>
                                <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Unrealized P&L</p>
                                <p className={cn('font-mono text-sm font-bold',
                                    metrics.unrealPL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                )}>
                                    {metrics.unrealPL >= 0 ? '+' : ''}{fmt(metrics.unrealPL)}
                                </p>
                                <p className={cn('text-[9px] font-mono',
                                    metrics.unrealPL >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60'
                                )}>
                                    {metrics.unrealPct >= 0 ? '+' : ''}{metrics.unrealPct.toFixed(2)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Movers */}
            {gainers.length >= 2 && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="border border-emerald-500/12 bg-emerald-500/4 p-3">
                        <div className="flex items-center gap-1.5 mb-2.5">
                            <TrendingUp className="size-3 text-emerald-400/60" />
                            <span className="text-[8px] font-bold text-emerald-400/60 uppercase tracking-[0.14em]">Top Gainers</span>
                        </div>
                        {gainers.map(r => (
                            <button key={r.symbol}
                                onClick={() => navigate(`/dime-stock/${r.symbol}`)}
                                className="w-full flex items-center justify-between py-1.5 hover:opacity-80 transition-opacity"
                            >
                                <span className="font-mono font-black text-[11px] text-foreground/80">{r.symbol}</span>
                                <span className="font-mono text-[10px] font-bold text-emerald-400">
                                    +{r.q!.dp.toFixed(2)}%
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="border border-rose-500/12 bg-rose-500/4 p-3">
                        <div className="flex items-center gap-1.5 mb-2.5">
                            <TrendingDown className="size-3 text-rose-400/60" />
                            <span className="text-[8px] font-bold text-rose-400/60 uppercase tracking-[0.14em]">Worst Today</span>
                        </div>
                        {losers.map(r => (
                            <button key={r.symbol}
                                onClick={() => navigate(`/dime-stock/${r.symbol}`)}
                                className="w-full flex items-center justify-between py-1.5 hover:opacity-80 transition-opacity"
                            >
                                <span className="font-mono font-black text-[11px] text-foreground/80">{r.symbol}</span>
                                <span className="font-mono text-[10px] font-bold text-rose-400">
                                    {r.q!.dp.toFixed(2)}%
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* All open positions list */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-border/20" />
                    <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.16em]">
                        Open Positions
                    </span>
                    <div className="h-px flex-1 bg-border/20" />
                </div>

                <div className="border border-border/20 bg-[oklch(0.10_0.013_255)] divide-y divide-border/[0.07]">
                    {rows.map((r, i) => {
                        const hasQ  = !!r.q;
                        const plPos = (r.unrealPL ?? 0) >= 0;
                        return (
                            <button key={r.symbol}
                                onClick={() => navigate(`/dime-stock/${r.symbol}`)}
                                className="w-full flex items-center gap-2.5 px-3 py-3 text-left active:bg-white/[0.04] hover:bg-white/[0.02] transition-colors"
                            >
                                {/* Rank */}
                                <span className="text-[8px] font-mono text-muted-foreground/20 w-4 shrink-0 text-right">
                                    {i + 1}
                                </span>

                                {/* Symbol + shares */}
                                <div className="w-[58px] shrink-0">
                                    <p className="font-mono font-black text-[11px] text-foreground truncate">{r.symbol}</p>
                                    <p className="text-[8px] font-mono text-muted-foreground/30 mt-px">
                                        {r.totalShares.toFixed(4)} sh
                                    </p>
                                </div>

                                {/* Price + daily % */}
                                <div className="flex-1 min-w-0">
                                    {hasQ ? (
                                        <>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="font-mono font-bold text-xs text-foreground/90">
                                                    ${r.q!.c.toFixed(2)}
                                                </span>
                                                <SignBadge v={r.q!.dp} />
                                            </div>
                                            <p className="text-[8px] font-mono text-muted-foreground/30 mt-0.5">
                                                avg ${r.avgBuyPrice.toFixed(2)}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-[9px] font-mono text-muted-foreground/25">—</p>
                                            <p className="text-[8px] font-mono text-muted-foreground/25 mt-0.5">
                                                avg ${r.avgBuyPrice.toFixed(2)}
                                            </p>
                                        </>
                                    )}
                                </div>

                                {/* Unrealized P&L */}
                                {hasQ && r.unrealPL !== null && r.unrealPct !== null ? (
                                    <div className="shrink-0 text-right">
                                        <p className={cn('font-mono font-bold text-[10px]',
                                            plPos ? 'text-emerald-400' : 'text-rose-400'
                                        )}>
                                            {fmtCompact(r.unrealPL)}
                                        </p>
                                        <p className={cn('text-[8px] font-mono',
                                            plPos ? 'text-emerald-400/60' : 'text-rose-400/60'
                                        )}>
                                            {r.unrealPct >= 0 ? '+' : ''}{r.unrealPct.toFixed(1)}%
                                        </p>
                                    </div>
                                ) : (
                                    <ChevronRight className="size-3.5 text-muted-foreground/15 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}

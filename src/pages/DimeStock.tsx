import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { DimeTransaction } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, getErrorMessage } from '@/lib/utils';
import {
    Plus, TrendingUp, TrendingDown, ChevronRight, ChevronDown,
    Inbox, Activity, Check, Filter, BarChart2, CalendarDays
} from 'lucide-react';
import DimeStockAnalytics from './DimeStockAnalytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined, digits = 2): string {
    if (value == null) return '—';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4) });
}

function formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

interface SymbolSummary {
    symbol: string;
    totalBuyAmount: number;
    totalSellAmount: number;
    totalShares: number;
    avgBuyPrice: number;
    txCount: number;
    latestDate: string;
    totalStockAmount: number;
    totalSharesSold: number;
    realizedPL: number;
    realizedPLPct: number;
    allocationPct: number;
}

type PortfolioSort = 'position' | 'pl' | 'pl_pct' | 'symbol' | 'trades' | 'invested';

// ─── SidePill ─────────────────────────────────────────────────────────────────

function SidePill({ side }: { side: string }) {
    return (
        <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border tracking-wider',
            side === 'BUY'  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' :
                              'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
        )}>
            {side}
        </span>
    );
}

function FeePill({ label, value }: { label: string; value: number | null | undefined }) {
    if (!value || value <= 0) return null;
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/6 text-amber-400/70 border border-amber-500/12">
            {label} {fmt(value, 4)}
        </span>
    );
}

// ─── Trade row ────────────────────────────────────────────────────────────────

function TradeRow({ tx }: { tx: DimeTransaction }) {
    const isBuy = tx.side === 'BUY';
    const displayAmount = isBuy
        ? (tx.gross_usd ?? 0) + (tx.fee_usd ?? 0)
        : (tx.net_usd ?? 0);

    return (
        <div className="flex items-start gap-2.5 px-3 py-2.5 border-b border-border/20 last:border-0">
            <div className={cn('w-0.5 self-stretch rounded-full shrink-0 mt-0.5',
                isBuy ? 'bg-cyan-500' : 'bg-emerald-500'
            )} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-sm text-foreground">{tx.symbol}</span>
                        <SidePill side={tx.side} />
                        <span className="text-[9px] text-muted-foreground/50 font-mono">{formatDate(tx.trade_date)}</span>
                    </div>
                    <span className={cn('font-mono font-bold text-sm shrink-0',
                        isBuy ? 'text-foreground' : 'text-emerald-400'
                    )}>
                        {fmt(displayAmount)}
                    </span>
                </div>
                <div className="flex flex-wrap gap-1">
                    <span className="text-[9px] font-mono text-muted-foreground/50">
                        {Number(tx.qty).toFixed(7)} sh @ {fmt(tx.price)}
                    </span>
                    <FeePill label="fee" value={tx.fee_usd} />
                    <FeePill label="wht" value={tx.wht_usd} />
                </div>
            </div>
        </div>
    );
}

// ─── Position Card ────────────────────────────────────────────────────────────

function PositionCard({ s, onClick }: { s: SymbolSummary; onClick: () => void }) {
    const hasSold = s.totalSellAmount > 0;
    const plPositive = s.realizedPL >= 0;
    const hasPosition = s.totalShares > 0;
    const isClosed = !hasPosition && hasSold;

    return (
        <button
            onClick={onClick}
            className="w-full text-left border border-border/25 rounded-xl bg-[oklch(0.12_0.015_255)] hover:border-cyan-500/20 hover:shadow-[0_0_20px_oklch(0.68_0.18_210/0.06)] transition-all duration-200 active:scale-[0.99] overflow-hidden group"
        >
            <div className={cn('h-px w-full', hasPosition
                ? 'bg-gradient-to-r from-cyan-500/50 to-transparent'
                : 'bg-gradient-to-r from-emerald-500/30 to-transparent'
            )} />

            <div className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono font-black text-lg text-foreground tracking-tighter">{s.symbol}</span>
                            <span className="text-[9px] text-muted-foreground/40 font-mono">{s.txCount}T</span>
                            {isClosed && (
                                <span className="text-[8px] px-1.5 py-0.5 font-bold tracking-widest border bg-muted/10 border-border/20 text-muted-foreground/40">
                                    CLOSED
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] text-muted-foreground/30 font-mono">{formatDate(s.latestDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {hasSold && (
                            <div className="text-right">
                                <div className={cn('flex items-center gap-1 text-xs font-mono font-bold justify-end',
                                    plPositive ? 'text-emerald-400' : 'text-rose-400'
                                )}>
                                    {plPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                                    {plPositive ? '+' : ''}{fmt(s.realizedPL)}
                                </div>
                                <div className={cn('text-[9px] font-mono mt-0.5',
                                    plPositive ? 'text-emerald-400/60' : 'text-rose-400/60'
                                )}>
                                    {plPositive ? '+' : ''}{s.realizedPLPct.toFixed(1)}%
                                </div>
                            </div>
                        )}
                        <ChevronRight className="size-3.5 text-muted-foreground/20 group-hover:text-cyan-400/40 transition-colors" />
                    </div>
                </div>

                {/* Position size */}
                {hasPosition && (
                    <div className="mb-3">
                        <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em] mb-0.5">Position</p>
                        <p className="font-mono font-black text-xl text-cyan-300 tracking-tight">{fmt(s.totalStockAmount)}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">{s.totalShares.toFixed(6)} sh</p>
                    </div>
                )}

                {/* Realized P&L box */}
                <div className={cn(
                    'mb-3 border px-3 py-2 rounded-lg',
                    hasSold
                        ? plPositive
                            ? 'bg-emerald-500/6 border-emerald-500/15'
                            : 'bg-rose-500/6 border-rose-500/15'
                        : 'bg-white/3 border-border/15'
                )}>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[8px] font-bold text-muted-foreground/35 uppercase tracking-[0.14em]">Realized P&L</p>
                        <div className="text-right">
                            <p className={cn(
                                'font-mono font-black text-sm',
                                !hasSold ? 'text-muted-foreground/35' : plPositive ? 'text-emerald-400' : 'text-rose-400'
                            )}>
                                {hasSold && plPositive ? '+' : ''}{fmt(hasSold ? s.realizedPL : 0)}
                            </p>
                            {hasSold && (
                                <p className={cn('text-[9px] font-mono', plPositive ? 'text-emerald-400/50' : 'text-rose-400/50')}>
                                    {plPositive ? '+' : ''}{s.realizedPLPct.toFixed(2)}%
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 pt-2.5 border-t border-border/15">
                    <div>
                        <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Avg Cost</p>
                        <p className="font-mono font-bold text-xs text-foreground/60">{fmt(s.avgBuyPrice)}</p>
                    </div>
                    {hasSold && (
                        <div>
                            <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Sold</p>
                            <p className="font-mono font-bold text-xs text-emerald-400/80">{fmt(s.totalSellAmount)}</p>
                        </div>
                    )}
                    <div className="ml-auto text-right">
                        <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Invested</p>
                        <p className="font-mono font-bold text-xs text-foreground/60">{fmt(s.totalBuyAmount)}</p>
                    </div>
                </div>

                {/* Portfolio allocation bar */}
                {s.allocationPct > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-border/10">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[8px] text-muted-foreground/25 uppercase tracking-[0.12em]">Portfolio allocation</p>
                            <p className="text-[9px] font-mono font-bold text-muted-foreground/40">{s.allocationPct.toFixed(1)}%</p>
                        </div>
                        <div className="h-0.5 bg-border/15 rounded-full overflow-hidden">
                            <div
                                className={cn('h-full rounded-full transition-all', hasPosition ? 'bg-cyan-500/50' : 'bg-emerald-500/30')}
                                style={{ width: `${Math.min(100, s.allocationPct)}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </button>
    );
}

// ─── Portfolio Map (mobile-first list + allocation strip) ────────────────────

function fmtCompact(v: number): string {
    const abs = Math.abs(v);
    const sign = v >= 0 ? '+' : '-';
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
    return `${sign}$${abs.toFixed(0)}`;
}

function PortfolioMap({ summaries, onSymbolClick }: {
    summaries: SymbolSummary[];
    onSymbolClick: (sym: string) => void;
}) {
    const sorted = [...summaries].sort((a, b) => b.totalBuyAmount - a.totalBuyAmount);
    if (sorted.length === 0) return null;

    const maxAlloc = sorted[0].allocationPct;

    return (
        <div className="flex flex-col gap-2">

            {/* Allocation strip — visual overview of the whole portfolio */}
            <div className="h-3 flex rounded-sm overflow-hidden bg-black/30 gap-px">
                {sorted.map(s => {
                    const hasSells = s.totalSellAmount > 0;
                    const plPos = s.realizedPL >= 0;
                    const hasPos = s.totalShares > 0;
                    const fill = hasSells
                        ? plPos ? 'bg-emerald-500/80' : 'bg-rose-500/80'
                        : hasPos ? 'bg-cyan-500/60' : 'bg-border/30';
                    return (
                        <button key={s.symbol}
                            onClick={() => onSymbolClick(s.symbol)}
                            title={`${s.symbol} ${s.allocationPct.toFixed(1)}%`}
                            className={cn('h-full shrink-0 hover:brightness-125 transition-all', fill)}
                            style={{ width: `${s.allocationPct}%` }}
                        />
                    );
                })}
            </div>

            {/* Sorted list */}
            <div className="border border-border/20 bg-[oklch(0.10_0.013_255)] divide-y divide-border/[0.07]">
                {sorted.map((s, i) => {
                    const hasSells = s.totalSellAmount > 0;
                    const plPos = s.realizedPL >= 0;
                    const hasPos = s.totalShares > 0;
                    const barW = `${(s.allocationPct / maxAlloc) * 100}%`;

                    const barBg = hasSells
                        ? plPos ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                        : hasPos ? 'bg-cyan-500/12' : 'bg-border/10';

                    const plColor = hasSells
                        ? plPos ? 'text-emerald-400' : 'text-rose-400'
                        : 'text-muted-foreground/30';

                    return (
                        <button key={s.symbol}
                            onClick={() => onSymbolClick(s.symbol)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-left active:bg-white/[0.04] hover:bg-white/[0.02] transition-colors">

                            {/* Rank */}
                            <span className="text-[8px] font-mono text-muted-foreground/20 w-4 shrink-0 text-right leading-none">{i + 1}</span>

                            {/* Symbol */}
                            <span className="font-mono font-black text-[11px] text-foreground w-[52px] shrink-0 truncate leading-none">{s.symbol}</span>

                            {/* Bar track */}
                            <div className="flex-1 relative h-[22px] bg-black/20 overflow-hidden">
                                <div className={cn('absolute inset-y-0 left-0', barBg)}
                                    style={{ width: barW }} />
                                <div className="absolute inset-0 flex items-center px-1.5">
                                    <span className={cn('text-[9px] font-mono font-bold leading-none', plColor)}>
                                        {hasSells
                                            ? `${plPos ? '+' : ''}${s.realizedPLPct.toFixed(1)}%`
                                            : hasPos ? 'holding' : 'closed'}
                                    </span>
                                </div>
                            </div>

                            {/* Right: P&L $ + alloc% */}
                            <div className="shrink-0 text-right w-16">
                                {hasSells && (
                                    <span className={cn('font-mono font-bold text-[10px] block leading-snug', plColor)}>
                                        {fmtCompact(s.realizedPL)}
                                    </span>
                                )}
                                <span className="text-[8px] font-mono text-muted-foreground/30 block leading-snug">
                                    {s.allocationPct.toFixed(1)}%
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap">
                {[
                    { color: 'bg-emerald-500/60', label: 'Profit' },
                    { color: 'bg-rose-500/60',    label: 'Loss' },
                    { color: 'bg-cyan-500/40',    label: 'Holding' },
                ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1.5 text-[8px] font-mono text-muted-foreground/40">
                        <span className={cn('size-2 rounded-sm shrink-0', color)} />
                        {label}
                    </span>
                ))}
                <span className="text-[8px] font-mono text-muted-foreground/25 ml-auto">bar width = % of portfolio</span>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DimeStock() {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<DimeTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('portfolio');
    const [symbolFilter, setSymbolFilter] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [portfolioSort, setPortfolioSort] = useState<PortfolioSort>('position');
    const [showMap, setShowMap] = useState(false);

    useEffect(() => {
        if (!filterOpen) return;
        const handler = () => setFilterOpen(false);
        setTimeout(() => document.addEventListener('click', handler), 0);
        return () => document.removeEventListener('click', handler);
    }, [filterOpen]);

    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('dime_trades')
                .select('*')
                .order('trade_date', { ascending: false });
            if (error) throw error;
            setTransactions((data as DimeTransaction[]) || []);
        } catch (err) { setError(getErrorMessage(err)); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const symbolSummaries: SymbolSummary[] = useMemo(() => {
        const map: Record<string, SymbolSummary> = {};
        const emptySummary = (symbol: string, latestDate: string): SymbolSummary => ({
            symbol,
            totalBuyAmount: 0,
            totalSellAmount: 0,
            totalShares: 0,
            avgBuyPrice: 0,
            txCount: 0,
            latestDate,
            totalStockAmount: 0,
            totalSharesSold: 0,
            realizedPL: 0,
            realizedPLPct: 0,
            allocationPct: 0,
        });

        transactions.filter(t => t.side === 'BUY').forEach((tx) => {
            const sym = tx.symbol || 'UNKNOWN';
            const summary = map[sym] ?? emptySummary(sym, tx.trade_date);

            summary.txCount++;
            if (tx.trade_date > summary.latestDate) summary.latestDate = tx.trade_date;
            summary.totalBuyAmount += Number(tx.gross_usd ?? 0) + Number(tx.fee_usd ?? 0);
            summary.totalShares += Number(tx.qty);
            summary.totalStockAmount += Number(tx.gross_usd ?? 0);

            map[sym] = summary;
        });

        Object.values(map).forEach((s) => { s.avgBuyPrice = s.totalShares > 0 ? s.totalStockAmount / s.totalShares : 0; });

        transactions.filter(t => t.side === 'SELL').forEach((tx) => {
            const sym = tx.symbol || 'UNKNOWN';
            const summary = map[sym] ?? emptySummary(sym, tx.trade_date);

            summary.txCount++;
            if (tx.trade_date > summary.latestDate) summary.latestDate = tx.trade_date;

            const sharesSold = Number(tx.qty);
            summary.totalSellAmount += Number(tx.net_usd ?? 0);
            summary.totalSharesSold += sharesSold;
            summary.totalShares -= sharesSold;
            summary.totalStockAmount -= sharesSold * summary.avgBuyPrice;

            map[sym] = summary;
        });

        const totalInvested = Object.values(map).reduce((s, x) => s + x.totalBuyAmount, 0);

        Object.values(map).forEach((s) => {
            s.realizedPL = s.totalSellAmount > 0 ? s.totalSellAmount - (s.totalSharesSold * s.avgBuyPrice) : 0;
            const costOfSold = s.totalSharesSold * s.avgBuyPrice;
            s.realizedPLPct = costOfSold > 0 ? (s.realizedPL / costOfSold) * 100 : 0;
            s.allocationPct = totalInvested > 0 ? (s.totalBuyAmount / totalInvested) * 100 : 0;
            if (s.totalShares <= 0.000001) { s.totalShares = 0; s.totalStockAmount = 0; }
            else s.totalStockAmount = Math.max(0, s.totalStockAmount);
        });

        return Object.values(map).sort((a, b) => {
            const positionCompare = b.totalStockAmount - a.totalStockAmount;
            return positionCompare !== 0 ? positionCompare : b.realizedPL - a.realizedPL;
        });
    }, [transactions]);

    const filteredSummaries = useMemo(() => {
        const base = symbolFilter ? symbolSummaries.filter(s => s.symbol === symbolFilter) : symbolSummaries;
        return [...base].sort((a, b) => {
            switch (portfolioSort) {
                case 'pl':       return b.realizedPL - a.realizedPL;
                case 'pl_pct':   return b.realizedPLPct - a.realizedPLPct;
                case 'symbol':   return a.symbol.localeCompare(b.symbol);
                case 'trades':   return b.txCount - a.txCount;
                case 'invested': return b.totalBuyAmount - a.totalBuyAmount;
                default:         return (b.totalStockAmount - a.totalStockAmount) || (b.realizedPL - a.realizedPL);
            }
        });
    }, [symbolSummaries, symbolFilter, portfolioSort]);

    const filteredTransactions = useMemo(() =>
        symbolFilter ? transactions.filter(t => t.symbol === symbolFilter) : transactions
    , [transactions, symbolFilter]);

    const overallBuy = useMemo(() =>
        transactions.filter(t => t.side === 'BUY').reduce((s, t) => s + Number(t.gross_usd ?? 0) + Number(t.fee_usd ?? 0), 0)
    , [transactions]);

    const overallSell = useMemo(() =>
        transactions.filter(t => t.side === 'SELL').reduce((s, t) => s + Number(t.net_usd ?? 0), 0)
    , [transactions]);

    const realizedProfit = useMemo(() =>
        symbolSummaries.reduce((total, s) => total + Math.max(s.realizedPL, 0), 0)
    , [symbolSummaries]);

    const realizedLoss = useMemo(() =>
        symbolSummaries.reduce((total, s) => total + Math.min(s.realizedPL, 0), 0)
    , [symbolSummaries]);

    const netPL = realizedProfit + realizedLoss;

    const plSymbols = useMemo(() =>
        symbolSummaries.filter(s => s.totalSellAmount > 0).length
    , [symbolSummaries]);

    if (loading) return (
        <div className="flex flex-col gap-4 pt-4 pb-28">
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="grid grid-cols-3 gap-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            <Skeleton className="h-9 w-full rounded-lg" />
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
    );

    if (error) return <div className="flex items-center justify-center min-h-[60vh] text-rose-400 text-xs font-mono">{error}</div>;

    return (
        <div className="flex flex-col gap-4 pb-28 pt-4">

            {/* ── Page header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-black text-lg text-foreground tracking-tighter">Dime Stocks</h1>
                    <span className="text-[9px] text-muted-foreground/40 font-mono tracking-wider">
                        {transactions.length} tx · {symbolSummaries.length} sym
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/dime-stock/yearly')}
                        className="flex items-center justify-center gap-1.5 bg-black/20 hover:bg-white/5 text-muted-foreground/60 hover:text-foreground border border-border/20 hover:border-border/40 px-3 h-9 rounded-none text-[10px] font-bold tracking-[0.1em] transition-all"
                    >
                        <CalendarDays className="size-3.5" />
                        YEARLY
                    </button>
                    <button
                        onClick={() => navigate('/dime-stock-add')}
                        className="flex items-center justify-center gap-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/25 hover:border-cyan-400/40 px-3 h-9 rounded-none text-[10px] font-bold tracking-[0.1em] transition-all"
                    >
                        <Plus className="size-3.5" />
                        ADD
                    </button>
                </div>
            </div>

            {/* ── Portfolio Hero ── */}
            <div className="rounded-xl border border-cyan-500/15 bg-gradient-to-br from-[oklch(0.12_0.02_250)] to-[oklch(0.09_0.015_240)] p-5 relative overflow-hidden">
                <Activity className="absolute -right-3 -top-3 size-20 text-cyan-500/4" />
                <div className="h-px w-full absolute top-0 left-0 bg-gradient-to-r from-cyan-500/50 via-cyan-400/15 to-transparent" />
                <div className="relative">
                    <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-1">Realized Net P&L</p>
                    <p className={cn('font-mono font-black text-3xl tracking-tight', netPL >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                        {netPL >= 0 ? '+' : ''}{fmt(netPL)}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3 pt-3 border-t border-border/15">
                        <div>
                            <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Profit</p>
                            <p className="font-mono text-xs font-bold text-emerald-400">+{fmt(realizedProfit)}</p>
                        </div>
                        <div>
                            <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Loss</p>
                            <p className="font-mono text-xs font-bold text-rose-400">{realizedLoss < 0 ? '-' : ''}{fmt(Math.abs(realizedLoss))}</p>
                        </div>
                        <div>
                            <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Sold</p>
                            <p className="font-mono text-xs font-bold text-emerald-400">{fmt(overallSell)}</p>
                        </div>
                        <div>
                            <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Invested</p>
                            <p className="font-mono text-xs font-bold text-foreground">{fmt(overallBuy)}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-[9px] font-mono text-muted-foreground/35 tracking-wider">
                        {plSymbols} symbols with realized P&L
                    </p>
                </div>
            </div>

            {/* ── Portfolio Map toggle ── */}
            <button
                onClick={() => setShowMap(v => !v)}
                className="w-full flex items-center gap-2 py-0.5 group"
            >
                <div className="flex-1 h-px bg-border/15" />
                <span className="flex items-center gap-1.5 text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.16em] group-hover:text-muted-foreground/60 transition-colors whitespace-nowrap">
                    <BarChart2 className="size-3" />
                    PORTFOLIO MAP
                    <ChevronDown className={cn('size-3 transition-transform', showMap && 'rotate-180')} />
                </span>
                <div className="flex-1 h-px bg-border/15" />
            </button>

            {showMap && (
                <PortfolioMap
                    summaries={symbolSummaries}
                    onSymbolClick={(sym) => navigate(`/dime-stock/${sym}`)}
                />
            )}

            {/* ── Filter & Tabs ── */}
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
                        <TabsList className="w-full grid grid-cols-3 h-9 bg-black/30 border border-border/20 p-0 rounded-none">
                            <TabsTrigger value="portfolio" className="text-[10px] tracking-wider font-bold h-full data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-300 data-[state=active]:shadow-none rounded-none border-r border-border/20">
                                PORTFOLIO
                            </TabsTrigger>
                            <TabsTrigger value="trades" className="text-[10px] tracking-wider font-bold h-full data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-300 data-[state=active]:shadow-none rounded-none border-r border-border/20">
                                TRADES
                            </TabsTrigger>
                            <TabsTrigger value="stats" className="text-[10px] tracking-wider font-bold h-full data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-300 data-[state=active]:shadow-none rounded-none">
                                STATS
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className={cn('relative', activeTab === 'stats' && 'invisible pointer-events-none')}>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setFilterOpen(!filterOpen); }}
                            className={cn(
                                "flex items-center gap-2 h-9 px-3 border transition-all rounded-none font-bold text-[10px] tracking-widest",
                                symbolFilter ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300" : "bg-black/30 border-border/20 text-muted-foreground"
                            )}
                        >
                            <Filter className="size-3" />
                            {symbolFilter || 'ALL'}
                            <ChevronDown className={cn("size-3 opacity-50", filterOpen && "rotate-180")} />
                        </button>

                        {filterOpen && (
                            <div className="absolute right-0 top-[calc(100%+4px)] w-48 z-50 bg-[oklch(0.12_0.02_250)] border border-border/30 shadow-2xl overflow-hidden max-h-60 flex flex-col">
                                <button
                                    onClick={() => setSymbolFilter('')}
                                    className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest text-muted-foreground hover:bg-white/5 border-b border-border/10 flex items-center gap-2"
                                >
                                    {!symbolFilter ? <Check className="size-3 text-cyan-400" /> : <div className="size-3" />}
                                    ALL STOCKS
                                </button>
                                <div className="overflow-y-auto">
                                    {symbolSummaries.map(s => (
                                        <button
                                            key={s.symbol}
                                            onClick={() => setSymbolFilter(s.symbol)}
                                            className="w-full px-3 py-2 text-left text-sm font-mono font-bold hover:bg-white/5 flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-2">
                                                {symbolFilter === s.symbol ? <Check className="size-3 text-cyan-400" /> : <div className="size-3" />}
                                                <span className={symbolFilter === s.symbol ? "text-cyan-300" : "text-foreground"}>{s.symbol}</span>
                                            </div>
                                            <span className="text-[10px] font-medium text-muted-foreground/50">{s.txCount} tx</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {activeTab === 'portfolio' && (
                    <div className="w-full flex flex-col gap-2">
                        {/* Sort chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.14em] mr-0.5">Sort</span>
                            {([
                                { key: 'position', label: 'POSITION' },
                                { key: 'pl',       label: 'P&L $' },
                                { key: 'pl_pct',   label: 'P&L %' },
                                { key: 'invested', label: 'INVESTED' },
                                { key: 'symbol',   label: 'A–Z' },
                                { key: 'trades',   label: 'TRADES' },
                            ] as { key: PortfolioSort; label: string }[]).map(({ key, label }) => (
                                <button key={key} onClick={() => setPortfolioSort(key)}
                                    className={cn(
                                        'px-2 py-1 text-[8px] font-bold tracking-widest border transition-all',
                                        portfolioSort === key
                                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                                            : 'bg-black/20 border-border/20 text-muted-foreground/40 hover:border-border/40 hover:text-muted-foreground/60'
                                    )}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {filteredSummaries.length === 0 ? (
                            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground/30 border border-dashed border-border/20 rounded-xl">
                                <Inbox className="size-8 opacity-30" />
                                <p className="text-[10px] tracking-wider">NO POSITIONS FOUND</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {filteredSummaries.map((s) => (
                                    <PositionCard
                                        key={s.symbol}
                                        s={s}
                                        onClick={() => navigate(`/dime-stock/${s.symbol}`)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'stats' && <DimeStockAnalytics transactions={transactions} />}

                {activeTab === 'trades' && (
                    <div className="w-full">
                        {filteredTransactions.length === 0 ? (
                            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground/30 border border-dashed border-border/20 rounded-xl">
                                <Inbox className="size-8 opacity-30" />
                                <p className="text-[10px] tracking-wider">NO TRADES FOUND</p>
                            </div>
                        ) : (
                            <div className="border border-border/20 rounded-none bg-[oklch(0.11_0.015_255/0.7)] overflow-hidden">
                                {[...filteredTransactions]
                                    .sort((a, b) => {
                                        const d = b.trade_date.localeCompare(a.trade_date);
                                        return d !== 0 ? d : (b.created_at ?? '').localeCompare(a.created_at ?? '');
                                    })
                                    .map(tx => <TradeRow key={tx.id} tx={tx} />)
                                }
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
}

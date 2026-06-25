import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DimeTransaction } from '../types';
import { cn } from '@/lib/utils';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as RCTip,
    ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import {
    TrendingDown, BarChart2, ChevronDown, ChevronRight,
    Trophy, Search, X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SymbolStat {
    symbol: string;
    realizedPL: number;
    realizedPLPct: number;
    holdingShares: number;
    totalBuyQty: number;
    soldShares: number;
    soldPct: number;
    totalBuyAmount: number;
    totalSellNet: number;
    totalFees: number;
    costBasisRemaining: number;
    avgBuyPrice: number;
    avgSellPrice: number;
    firstBuyDate: string;
    lastTradeDate: string;
    holdingDays: number;
    numTrades: number;
    isClosed: boolean;
    hasSells: boolean;
}

type StatusFilter = 'all' | 'open' | 'closed' | 'profit' | 'loss';
type SortKey = 'pl' | 'pl_pct' | 'invested' | 'trades' | 'symbol';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const d$ = (v: number | null | undefined, digits = 2) => {
    if (v == null) return '—';
    return Number(v).toLocaleString('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4),
    });
};
const pctFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtDate = (d: string) => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
const monthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo - 1] + ` '${y.slice(2)}`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function SC({ label, value, sub, cls }: { label: string; value: React.ReactNode; sub?: string; cls?: string }) {
    return (
        <div className="bg-[oklch(0.105_0.014_255)] border border-border/20 p-3">
            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em] mb-0.5">{label}</p>
            <p className={cn('font-mono font-black text-sm leading-snug', cls)}>{value}</p>
            {sub && <p className="text-[9px] font-mono text-muted-foreground/35 mt-0.5">{sub}</p>}
        </div>
    );
}

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle} className="w-full flex items-center justify-between py-2 px-0 group">
            <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.16em]">{title}</span>
            <ChevronDown className={cn('size-3.5 text-muted-foreground/30 transition-transform group-hover:text-muted-foreground/60', open && 'rotate-180')} />
        </button>
    );
}

function ChartTip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[oklch(0.13_0.018_255)] border border-border/30 px-2.5 py-2 text-[10px] font-mono shadow-xl">
            <p className="text-muted-foreground/60 mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: p.color ?? p.fill ?? '#94a3b8' }}>
                    {p.name}: {typeof p.value === 'number' ? d$(p.value) : p.value}
                </p>
            ))}
        </div>
    );
}

const PIE_COLORS = { profit: '#34d399', loss: '#f87171', open: '#22d3ee', closed: '#a78bfa', neutral: '#475569' };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DimeStockAnalytics({ transactions }: { transactions: DimeTransaction[] }) {
    const navigate = useNavigate();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortBy, setSortBy] = useState<SortKey>('pl');
    const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
    const [search, setSearch] = useState('');
    const [expandedSym, setExpandedSym] = useState<string | null>(null);
    const [showCharts, setShowCharts] = useState(false);
    const [showOverview, setShowOverview] = useState(true);
    const [showPerStock, setShowPerStock] = useState(true);
    const today = useMemo(() => new Date(), []);

    // ── Per-symbol stats ─────────────────────────────────────────────────────

    const symbolStats = useMemo<SymbolStat[]>(() => {
        const buyMap: Record<string, { qty: number; gross: number; fees: number; firstDate: string; count: number }> = {};
        const sellMap: Record<string, { qty: number; gross: number; net: number; fees: number; count: number }> = {};
        const lastDate: Record<string, string> = {};

        transactions.forEach(tx => {
            const sym = tx.symbol;
            const d = tx.trade_date;
            if (!lastDate[sym] || d > lastDate[sym]) lastDate[sym] = d;

            if (tx.side === 'BUY') {
                const b = buyMap[sym] ?? { qty: 0, gross: 0, fees: 0, firstDate: d, count: 0 };
                b.qty += Number(tx.qty);
                b.gross += Number(tx.gross_usd ?? 0);
                b.fees += Number(tx.fee_usd ?? 0) + Number(tx.wht_usd ?? 0);
                b.count++;
                if (d < b.firstDate) b.firstDate = d;
                buyMap[sym] = b;
            } else {
                const s = sellMap[sym] ?? { qty: 0, gross: 0, net: 0, fees: 0, count: 0 };
                s.qty += Number(tx.qty);
                s.gross += Number(tx.gross_usd ?? 0);
                s.net += Number(tx.net_usd ?? 0);
                s.fees += Number(tx.fee_usd ?? 0) + Number(tx.wht_usd ?? 0);
                s.count++;
                sellMap[sym] = s;
            }
        });

        const syms = new Set([...Object.keys(buyMap), ...Object.keys(sellMap)]);
        return Array.from(syms).map(sym => {
            const b = buyMap[sym] ?? { qty: 0, gross: 0, fees: 0, firstDate: '', count: 0 };
            const s = sellMap[sym] ?? { qty: 0, gross: 0, net: 0, fees: 0, count: 0 };

            const avgBuyPrice = b.qty > 0 ? b.gross / b.qty : 0;
            const avgSellPrice = s.qty > 0 ? s.gross / s.qty : 0;
            const costOfSold = s.qty * avgBuyPrice;
            const realizedPL = s.qty > 0 ? s.net - costOfSold : 0;
            const realizedPLPct = costOfSold > 0 ? (realizedPL / costOfSold) * 100 : 0;
            const holdingShares = Math.max(0, b.qty - s.qty);
            const costBasisRemaining = holdingShares * avgBuyPrice;
            const soldPct = b.qty > 0 ? (s.qty / b.qty) * 100 : 0;
            const totalBuyAmount = b.gross + b.fees;
            const totalFees = b.fees + s.fees;
            const isClosed = holdingShares < 0.000001;
            const firstDate = b.firstDate;
            const endDate = isClosed ? new Date(lastDate[sym]) : today;
            const holdingDays = firstDate
                ? Math.floor((endDate.getTime() - new Date(firstDate).getTime()) / 86400000)
                : 0;

            return {
                symbol: sym, realizedPL, realizedPLPct,
                holdingShares, totalBuyQty: b.qty, soldShares: s.qty, soldPct,
                totalBuyAmount, totalSellNet: s.net, totalFees,
                costBasisRemaining, avgBuyPrice, avgSellPrice,
                firstBuyDate: firstDate, lastTradeDate: lastDate[sym],
                holdingDays, numTrades: b.count + s.count,
                isClosed, hasSells: s.qty > 0,
            };
        });
    }, [transactions, today]);

    // ── Overall stats ────────────────────────────────────────────────────────

    const overall = useMemo(() => {
        const withSells = symbolStats.filter(s => s.hasSells);
        const profitable = withSells.filter(s => s.realizedPL > 0);
        const losing = withSells.filter(s => s.realizedPL < 0);
        const open = symbolStats.filter(s => !s.isClosed);
        const closed = symbolStats.filter(s => s.isClosed);

        const realizedPL = symbolStats.reduce((a, s) => a + s.realizedPL, 0);
        const realizedProfit = profitable.reduce((a, s) => a + s.realizedPL, 0);
        const realizedLoss = losing.reduce((a, s) => a + s.realizedPL, 0);
        const totalInvested = symbolStats.reduce((a, s) => a + s.totalBuyAmount, 0);
        const totalSold = symbolStats.reduce((a, s) => a + s.totalSellNet, 0);
        const totalFees = symbolStats.reduce((a, s) => a + s.totalFees, 0);
        const realizedPLPct = totalInvested > 0 ? (realizedPL / totalInvested) * 100 : 0;
        const feePct = totalInvested > 0 ? (totalFees / totalInvested) * 100 : 0;
        const winRate = withSells.length > 0 ? (profitable.length / withSells.length) * 100 : 0;
        const avgProfit = profitable.length > 0 ? realizedProfit / profitable.length : 0;
        const avgLoss = losing.length > 0 ? Math.abs(realizedLoss / losing.length) : 0;
        const best = [...profitable].sort((a, b) => b.realizedPL - a.realizedPL)[0];
        const worst = [...losing].sort((a, b) => a.realizedPL - b.realizedPL)[0];

        return {
            realizedPL, realizedProfit, realizedLoss, realizedPLPct,
            winRate, avgProfit, avgLoss, best, worst,
            totalInvested, totalSold, totalFees, feePct,
            profitCount: profitable.length,
            lossCount: losing.length,
            openCount: open.length,
            closedCount: closed.length,
        };
    }, [symbolStats]);

    // ── Monthly chart data ───────────────────────────────────────────────────

    const monthlyData = useMemo(() => {
        const avgBySymbol: Record<string, number> = {};
        symbolStats.forEach(s => { avgBySymbol[s.symbol] = s.avgBuyPrice; });

        const map: Record<string, { month: string; realized: number; buyAmt: number; sellNet: number; fees: number; count: number }> = {};

        transactions.forEach(tx => {
            const mo = tx.trade_date.slice(0, 7);
            if (!map[mo]) map[mo] = { month: mo, realized: 0, buyAmt: 0, sellNet: 0, fees: 0, count: 0 };
            map[mo].count++;
            map[mo].fees += Number(tx.fee_usd ?? 0) + Number(tx.wht_usd ?? 0);
            if (tx.side === 'BUY') {
                map[mo].buyAmt += Number(tx.gross_usd ?? 0) + Number(tx.fee_usd ?? 0);
            } else {
                const net = Number(tx.net_usd ?? 0);
                const cost = Number(tx.qty) * (avgBySymbol[tx.symbol] ?? 0);
                map[mo].sellNet += net;
                map[mo].realized += net - cost;
            }
        });

        const sorted = Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
        let cum = 0;
        return sorted.map(m => { cum += m.realized; return { ...m, label: monthLabel(m.month), cumulative: cum }; });
    }, [transactions, symbolStats]);

    const yearlyData = useMemo(() => {
        const map: Record<string, number> = {};
        monthlyData.forEach(m => {
            const y = m.month.slice(0, 4);
            map[y] = (map[y] ?? 0) + m.realized;
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([year, realized]) => ({ year, realized }));
    }, [monthlyData]);

    // ── Filtered + sorted per-symbol list ────────────────────────────────────

    const filtered = useMemo(() => {
        let list = symbolStats;
        if (search) list = list.filter(s => s.symbol.toLowerCase().includes(search.toLowerCase()));
        if (statusFilter === 'open') list = list.filter(s => !s.isClosed);
        else if (statusFilter === 'closed') list = list.filter(s => s.isClosed);
        else if (statusFilter === 'profit') list = list.filter(s => s.realizedPL > 0 && s.hasSells);
        else if (statusFilter === 'loss') list = list.filter(s => s.realizedPL < 0 && s.hasSells);

        list = [...list].sort((a, b) => {
            let diff = 0;
            if (sortBy === 'pl') diff = a.realizedPL - b.realizedPL;
            else if (sortBy === 'pl_pct') diff = a.realizedPLPct - b.realizedPLPct;
            else if (sortBy === 'invested') diff = a.totalBuyAmount - b.totalBuyAmount;
            else if (sortBy === 'trades') diff = a.numTrades - b.numTrades;
            else if (sortBy === 'symbol') diff = a.symbol.localeCompare(b.symbol);
            return sortDir === 'desc' ? -diff : diff;
        });
        return list;
    }, [symbolStats, statusFilter, sortBy, sortDir, search]);

    const topWinners = useMemo(() => [...symbolStats].filter(s => s.realizedPL > 0).sort((a, b) => b.realizedPL - a.realizedPL).slice(0, 6), [symbolStats]);
    const topLosers = useMemo(() => [...symbolStats].filter(s => s.realizedPL < 0).sort((a, b) => a.realizedPL - b.realizedPL).slice(0, 6), [symbolStats]);
    const maxWin = topWinners[0]?.realizedPL ?? 0;
    const maxLoss = Math.abs(topLosers[0]?.realizedPL ?? 0);

    const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
        { key: 'all', label: 'ALL' },
        { key: 'open', label: 'OPEN' },
        { key: 'closed', label: 'CLOSED' },
        { key: 'profit', label: 'PROFIT' },
        { key: 'loss', label: 'LOSS' },
    ];

    const SORTS: { key: SortKey; label: string }[] = [
        { key: 'pl', label: 'P&L' },
        { key: 'pl_pct', label: 'P&L %' },
        { key: 'invested', label: 'Invested' },
        { key: 'trades', label: 'Trades' },
        { key: 'symbol', label: 'Symbol' },
    ];

    const toggleSort = (k: SortKey) => {
        if (sortBy === k) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortBy(k); setSortDir('desc'); }
    };

    const AXIS_TICK = { fontSize: 9, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' };

    return (
        <div className="flex flex-col gap-0 pb-4">

            {/* ── Overview Stats ── */}
            <div className="border-b border-border/15 mb-0">
                <SectionHeader title="Overview" open={showOverview} onToggle={() => setShowOverview(v => !v)} />
            </div>

            {showOverview && (
                <div className="flex flex-col gap-3 pt-2 pb-4">
                    {/* Row 1: P&L */}
                    <div className="grid grid-cols-3 gap-2">
                        <SC label="Realized P&L" cls={overall.realizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                            value={<>{overall.realizedPL >= 0 ? '+' : ''}{d$(overall.realizedPL)}</>}
                            sub={pctFmt(overall.realizedPLPct)} />
                        <SC label="Profit" cls="text-emerald-400"
                            value={<>+{d$(overall.realizedProfit)}</>} />
                        <SC label="Loss" cls="text-rose-400"
                            value={<>{d$(overall.realizedLoss)}</>} />
                    </div>

                    {/* Row 2: Win stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <SC label="Win Rate" cls={overall.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}
                            value={`${overall.winRate.toFixed(0)}%`}
                            sub={`${overall.profitCount}W / ${overall.lossCount}L`} />
                        <SC label="Avg Profit" cls="text-emerald-400/80"
                            value={d$(overall.avgProfit)} sub="per sym" />
                        <SC label="Avg Loss" cls="text-rose-400/80"
                            value={d$(overall.avgLoss)} sub="per sym" />
                    </div>

                    {/* Row 3: Totals */}
                    <div className="grid grid-cols-2 gap-2">
                        <SC label="Total Invested" cls="text-foreground"
                            value={d$(overall.totalInvested)} />
                        <SC label="Total Sold" cls="text-cyan-300"
                            value={d$(overall.totalSold)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <SC label="Total Fees" cls="text-amber-400"
                            value={d$(overall.totalFees)}
                            sub={`${overall.feePct.toFixed(3)}% of invested`} />
                        <SC label="Fee % Invested"
                            value={`${overall.feePct.toFixed(3)}%`}
                            cls="text-amber-400/80" />
                    </div>

                    {/* Row 4: Best / Worst */}
                    {(overall.best || overall.worst) && (
                        <div className="grid grid-cols-2 gap-2">
                            {overall.best && (
                                <div className="bg-emerald-500/6 border border-emerald-500/20 p-3">
                                    <p className="text-[8px] font-bold text-emerald-400/60 uppercase tracking-[0.14em] flex items-center gap-1">
                                        <Trophy className="size-2.5" /> Best Winner
                                    </p>
                                    <p className="font-mono font-black text-sm text-emerald-400 mt-0.5">{overall.best.symbol}</p>
                                    <p className="font-mono text-xs text-emerald-400/70">+{d$(overall.best.realizedPL)}</p>
                                </div>
                            )}
                            {overall.worst && (
                                <div className="bg-rose-500/6 border border-rose-500/20 p-3">
                                    <p className="text-[8px] font-bold text-rose-400/60 uppercase tracking-[0.14em] flex items-center gap-1">
                                        <TrendingDown className="size-2.5" /> Worst Loser
                                    </p>
                                    <p className="font-mono font-black text-sm text-rose-400 mt-0.5">{overall.worst.symbol}</p>
                                    <p className="font-mono text-xs text-rose-400/70">{d$(overall.worst.realizedPL)}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Row 5: Symbol counts */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {[
                            { label: 'Profit', value: overall.profitCount, cls: 'text-emerald-400' },
                            { label: 'Loss', value: overall.lossCount, cls: 'text-rose-400' },
                            { label: 'Holding', value: overall.openCount, cls: 'text-cyan-300' },
                            { label: 'Closed', value: overall.closedCount, cls: 'text-muted-foreground/60' },
                        ].map(({ label, value, cls }) => (
                            <div key={label} className="bg-[oklch(0.105_0.014_255)] border border-border/20 p-2 text-center">
                                <p className={cn('font-mono font-black text-xl', cls)}>{value}</p>
                                <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Per Stock ── */}
            <div className="border-b border-border/15">
                <SectionHeader title="Per Stock" open={showPerStock} onToggle={() => setShowPerStock(v => !v)} />
            </div>

            {showPerStock && (
                <div className="flex flex-col gap-2 pt-2 pb-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search symbol…"
                            className="w-full h-8 pl-7 pr-8 text-xs font-mono bg-black/20 border border-border/25 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-cyan-500/30"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                <X className="size-3 text-muted-foreground/40" />
                            </button>
                        )}
                    </div>

                    {/* Status filter chips */}
                    <div className="flex gap-1.5 flex-wrap">
                        {STATUS_FILTERS.map(f => (
                            <button key={f.key} onClick={() => setStatusFilter(f.key)}
                                className={cn(
                                    'px-2.5 py-1 text-[9px] font-bold tracking-widest border transition-all',
                                    statusFilter === f.key
                                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                                        : 'bg-black/20 border-border/20 text-muted-foreground/50 hover:border-border/40'
                                )}>
                                {f.label}
                            </button>
                        ))}
                        <div className="ml-auto flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground/30">Sort:</span>
                            {SORTS.map(s => (
                                <button key={s.key} onClick={() => toggleSort(s.key)}
                                    className={cn(
                                        'px-2 py-1 text-[9px] font-bold border transition-all',
                                        sortBy === s.key
                                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                                            : 'bg-black/20 border-border/15 text-muted-foreground/40 hover:border-border/30'
                                    )}>
                                    {s.label}{sortBy === s.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-[9px] text-muted-foreground/30 font-mono">{filtered.length} symbols</p>

                    {/* Symbol rows */}
                    <div className="flex flex-col border border-border/20 bg-[oklch(0.105_0.014_255)]">
                        {filtered.length === 0 ? (
                            <div className="py-10 text-center text-[10px] text-muted-foreground/30 tracking-wider">NO SYMBOLS FOUND</div>
                        ) : filtered.map(s => {
                            const isExpanded = expandedSym === s.symbol;
                            const plPos = s.realizedPL >= 0;
                            return (
                                <div key={s.symbol} className="border-b border-border/15 last:border-0">
                                    <button
                                        onClick={() => { setExpandedSym(isExpanded ? null : s.symbol); navigate(`/dime-stock/${s.symbol}`); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02] text-left transition-colors"
                                    >
                                        {/* Symbol + status */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-sm text-foreground">{s.symbol}</span>
                                                <span className={cn(
                                                    'text-[8px] px-1.5 py-0.5 font-bold tracking-widest border',
                                                    s.isClosed
                                                        ? 'bg-muted/10 border-border/20 text-muted-foreground/50'
                                                        : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                                                )}>
                                                    {s.isClosed ? 'CLOSED' : 'OPEN'}
                                                </span>
                                            </div>
                                            <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">
                                                {s.numTrades}T · {fmtDate(s.firstBuyDate)}
                                                {!s.isClosed && ` · ${s.holdingDays}d`}
                                            </div>
                                        </div>

                                        {/* P&L */}
                                        <div className="text-right shrink-0">
                                            {s.hasSells ? (
                                                <>
                                                    <p className={cn('font-mono font-black text-sm', plPos ? 'text-emerald-400' : 'text-rose-400')}>
                                                        {plPos ? '+' : ''}{d$(s.realizedPL)}
                                                    </p>
                                                    <p className={cn('text-[9px] font-mono', plPos ? 'text-emerald-400/60' : 'text-rose-400/60')}>
                                                        {pctFmt(s.realizedPLPct)}
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-[9px] font-mono text-muted-foreground/30">No sells</p>
                                            )}
                                        </div>
                                        <ChevronRight className="size-3.5 text-muted-foreground/20 shrink-0" />
                                    </button>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div className="px-3 pb-3 border-t border-border/15 bg-black/10">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 text-[10px] font-mono">
                                                {[
                                                    ['Holding Shares', s.holdingShares > 0 ? s.holdingShares.toFixed(7) + ' sh' : '—'],
                                                    ['Cost Basis Remaining', d$(s.costBasisRemaining)],
                                                    ['Total Buy Amount', d$(s.totalBuyAmount)],
                                                    ['Total Sell (net)', d$(s.totalSellNet > 0 ? s.totalSellNet : undefined)],
                                                    ['Total Fees', d$(s.totalFees)],
                                                    ['Net Return', d$(s.realizedPL)],
                                                    ['Sold Shares', s.soldShares > 0 ? s.soldShares.toFixed(7) + ' sh' : '—'],
                                                    ['Sold %', s.soldPct > 0 ? s.soldPct.toFixed(1) + '%' : '—'],
                                                    ['Avg Buy Price', d$(s.avgBuyPrice)],
                                                    ['Avg Sell Price', s.hasSells ? d$(s.avgSellPrice) : '—'],
                                                    ['First Buy', fmtDate(s.firstBuyDate)],
                                                    ['Last Trade', fmtDate(s.lastTradeDate)],
                                                    ['Holding Days', s.holdingDays.toString()],
                                                    ['# Trades', s.numTrades.toString()],
                                                ].map(([label, value]) => (
                                                    <div key={label}>
                                                        <p className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em] mb-0.5">{label}</p>
                                                        <p className="text-foreground/80">{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Charts ── */}
            <div className="border-b border-border/15">
                <button onClick={() => setShowCharts(v => !v)}
                    className="w-full flex items-center justify-between py-2 group">
                    <span className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.16em]">
                        <BarChart2 className="size-3.5" />
                        Charts & Views
                    </span>
                    <ChevronDown className={cn('size-3.5 text-muted-foreground/30 transition-transform', showCharts && 'rotate-180')} />
                </button>
            </div>

            {showCharts && (
                <div className="flex flex-col gap-6 pt-4 pb-4">

                    {/* Monthly P&L */}
                    {monthlyData.length > 0 && (
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Monthly Realized P&L</p>
                            <ResponsiveContainer width="100%" height={160}>
                                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 8 }} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_TICK} tickFormatter={v => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`} />
                                    <RCTip content={<ChartTip />} />
                                    <ReferenceLine y={0} stroke="#334155" />
                                    <Bar dataKey="realized" name="P&L" radius={[2, 2, 0, 0]}>
                                        {monthlyData.map((m, i) => (
                                            <Cell key={i} fill={m.realized >= 0 ? '#34d399' : '#f87171'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Cumulative P&L */}
                    {monthlyData.length > 0 && (
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Cumulative Realized P&L</p>
                            <ResponsiveContainer width="100%" height={160}>
                                <LineChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 8 }} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_TICK} tickFormatter={v => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`} />
                                    <RCTip content={<ChartTip />} />
                                    <ReferenceLine y={0} stroke="#334155" />
                                    <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#22d3ee" strokeWidth={1.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Yearly P&L */}
                    {yearlyData.length > 1 && (
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Yearly Realized P&L</p>
                            <ResponsiveContainer width="100%" height={120}>
                                <BarChart data={yearlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="year" tick={AXIS_TICK} />
                                    <YAxis tick={AXIS_TICK} tickFormatter={v => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`} />
                                    <RCTip content={<ChartTip />} />
                                    <ReferenceLine y={0} stroke="#334155" />
                                    <Bar dataKey="realized" name="P&L" radius={[2, 2, 0, 0]}>
                                        {yearlyData.map((y, i) => (
                                            <Cell key={i} fill={y.realized >= 0 ? '#34d399' : '#f87171'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Buy vs Sell by Month */}
                    {monthlyData.length > 0 && (
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Buy vs Sell by Month</p>
                            <ResponsiveContainer width="100%" height={160}>
                                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 8 }} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_TICK} tickFormatter={v => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`} />
                                    <RCTip content={<ChartTip />} />
                                    <Bar dataKey="buyAmt" name="Buy" fill="#22d3ee" radius={[2, 2, 0, 0]} opacity={0.7} />
                                    <Bar dataKey="sellNet" name="Sell" fill="#a78bfa" radius={[2, 2, 0, 0]} opacity={0.7} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Fee by Month */}
                    {monthlyData.length > 0 && (
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Fee by Month</p>
                            <ResponsiveContainer width="100%" height={120}>
                                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 8 }} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_TICK} tickFormatter={v => `$${v.toFixed(2)}`} />
                                    <RCTip content={<ChartTip />} />
                                    <Bar dataKey="fees" name="Fees" fill="#fbbf24" radius={[2, 2, 0, 0]} opacity={0.8} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Trade Count by Month */}
                    {monthlyData.length > 0 && (
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Trade Count by Month</p>
                            <ResponsiveContainer width="100%" height={120}>
                                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 8 }} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_TICK} allowDecimals={false} />
                                    <RCTip content={<ChartTip />} />
                                    <Bar dataKey="count" name="Trades" fill="#64748b" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Top Winners / Losers */}
                    {(topWinners.length > 0 || topLosers.length > 0) && (
                        <div className="grid grid-cols-2 gap-3">
                            {topWinners.length > 0 && (
                                <div>
                                    <p className="text-[8px] font-bold text-emerald-400/50 uppercase tracking-[0.16em] mb-2">Top Winners</p>
                                    <div className="flex flex-col gap-1.5">
                                        {topWinners.map(s => (
                                            <div key={s.symbol}>
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-[10px] font-mono font-black text-foreground">{s.symbol}</span>
                                                    <span className="text-[9px] font-mono text-emerald-400">+{d$(s.realizedPL)}</span>
                                                </div>
                                                <div className="h-1 bg-border/15 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.realizedPL / maxWin) * 100}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {topLosers.length > 0 && (
                                <div>
                                    <p className="text-[8px] font-bold text-rose-400/50 uppercase tracking-[0.16em] mb-2">Top Losers</p>
                                    <div className="flex flex-col gap-1.5">
                                        {topLosers.map(s => (
                                            <div key={s.symbol}>
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-[10px] font-mono font-black text-foreground">{s.symbol}</span>
                                                    <span className="text-[9px] font-mono text-rose-400">{d$(s.realizedPL)}</span>
                                                </div>
                                                <div className="h-1 bg-border/15 rounded-full overflow-hidden">
                                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(Math.abs(s.realizedPL) / maxLoss) * 100}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Win/Loss + Open/Closed pies */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-2 text-center">Profit / Loss</p>
                            <ResponsiveContainer width="100%" height={120}>
                                <PieChart>
                                    <Pie data={[
                                        { name: 'Profit', value: overall.profitCount },
                                        { name: 'Loss', value: overall.lossCount },
                                    ]} cx="50%" cy="50%" outerRadius={45} dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={false}>
                                        <Cell fill={PIE_COLORS.profit} />
                                        <Cell fill={PIE_COLORS.loss} />
                                    </Pie>
                                    <RCTip content={({ active, payload }) => active && payload?.length
                                        ? <div className="bg-[oklch(0.13_0.018_255)] border border-border/30 px-2 py-1 text-[10px] font-mono">{payload[0].name}: {payload[0].value}</div>
                                        : null} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-2 text-center">Open / Closed</p>
                            <ResponsiveContainer width="100%" height={120}>
                                <PieChart>
                                    <Pie data={[
                                        { name: 'Open', value: overall.openCount },
                                        { name: 'Closed', value: overall.closedCount },
                                    ]} cx="50%" cy="50%" outerRadius={45} dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={false}>
                                        <Cell fill={PIE_COLORS.open} />
                                        <Cell fill={PIE_COLORS.closed} />
                                    </Pie>
                                    <RCTip content={({ active, payload }) => active && payload?.length
                                        ? <div className="bg-[oklch(0.13_0.018_255)] border border-border/30 px-2 py-1 text-[10px] font-mono">{payload[0].name}: {payload[0].value}</div>
                                        : null} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* P&L Distribution (histogram-style) */}
                    {symbolStats.filter(s => s.hasSells).length > 0 && (
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">P&L Distribution</p>
                            <ResponsiveContainer width="100%" height={120}>
                                <BarChart
                                    data={(() => {
                                        const vals = symbolStats.filter(s => s.hasSells).map(s => s.realizedPL).sort((a, b) => a - b);
                                        return vals.map((v, i) => ({ i, value: v, symbol: symbolStats.find(s => s.realizedPL === v)?.symbol ?? '' }));
                                    })()}
                                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                                >
                                    <XAxis dataKey="symbol" tick={{ ...AXIS_TICK, fontSize: 7 }} />
                                    <YAxis tick={AXIS_TICK} tickFormatter={v => `$${v.toFixed(0)}`} />
                                    <RCTip content={({ active, payload }) => active && payload?.length
                                        ? <div className="bg-[oklch(0.13_0.018_255)] border border-border/30 px-2 py-1 text-[10px] font-mono">
                                            <p className="text-muted-foreground/60">{payload[0].payload.symbol}</p>
                                            <p style={{ color: (payload[0].value as number) >= 0 ? '#34d399' : '#f87171' }}>{d$(payload[0].value as number)}</p>
                                          </div>
                                        : null} />
                                    <ReferenceLine y={0} stroke="#334155" />
                                    <Bar dataKey="value" name="P&L" radius={[2, 2, 0, 0]}>
                                        {symbolStats.filter(s => s.hasSells).map((s, i) => (
                                            <Cell key={i} fill={s.realizedPL >= 0 ? '#34d399' : '#f87171'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

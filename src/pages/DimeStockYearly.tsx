import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { DimeTransaction } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ChevronLeft, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import {
    BarChart, Bar, ComposedChart, Line, XAxis, YAxis,
    Tooltip as RCTip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { toast } from 'sonner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const d$ = (v: number | null | undefined, digits = 2) => {
    if (v == null) return '—';
    return Number(v).toLocaleString('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2),
    });
};
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const AXIS_TICK = { fontSize: 9, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' };

function ChartTip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-50 dark:bg-[oklch(0.13_0.018_255)] border border-border/30 px-2.5 py-2 text-[10px] font-mono shadow-xl">
            <p className="text-muted-foreground/60 mb-1">{label}</p>
            {payload.map((p: any, i: number) => p.value != null && (
                <p key={i} style={{ color: p.color ?? p.fill }}>
                    {p.name}: {typeof p.value === 'number' ? d$(p.value) : p.value}
                </p>
            ))}
        </div>
    );
}

function SC({ label, value, sub, cls }: { label: string; value: React.ReactNode; sub?: string; cls?: string }) {
    return (
        <div className="bg-gray-50 dark:bg-[oklch(0.105_0.014_255)] border border-border/20 p-3">
            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em] mb-0.5">{label}</p>
            <p className={cn('font-mono font-black text-sm leading-snug', cls)}>{value}</p>
            {sub && <p className="text-[9px] font-mono text-muted-foreground/35 mt-0.5">{sub}</p>}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DimeStockYearly() {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<DimeTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState<string | null>(null);

    useEffect(() => {
        supabase.from('dime_trades').select('*').eq('asset_class', 'STOCK').order('trade_date').then(({ data, error }) => {
            if (error) toast.error('Failed to load trades', { description: error.message });
            else {
                setTransactions((data as DimeTransaction[]) ?? []);
                // default to most recent year
                if (data && data.length > 0) {
                    const years = [...new Set((data as DimeTransaction[]).map(t => t.trade_date.slice(0, 4)))].sort();
                    setSelectedYear(years[years.length - 1]);
                }
            }
            setLoading(false);
        });
    }, []);

    // Global average buy price per symbol (all-time, average cost method)
    const avgBuyPrices = useMemo(() => {
        const map: Record<string, { qty: number; gross: number }> = {};
        transactions.filter(t => t.side === 'BUY').forEach(tx => {
            const m = map[tx.symbol] ?? { qty: 0, gross: 0 };
            m.qty += Number(tx.qty);
            m.gross += Number(tx.gross_usd ?? 0);
            map[tx.symbol] = m;
        });
        return Object.fromEntries(
            Object.entries(map).map(([s, { qty, gross }]) => [s, qty > 0 ? gross / qty : 0])
        );
    }, [transactions]);

    // ── Yearly aggregates ────────────────────────────────────────────────────

    const yearlyStats = useMemo(() => {
        type YearBucket = {
            invested: number; soldNet: number; realizedPL: number; fees: number;
            tradeCount: number; buyCount: number; sellCount: number;
            symbolsTraded: Set<string>;
            symbolPL: Record<string, number>;
        };
        const map: Record<string, YearBucket> = {};

        transactions.forEach(tx => {
            const year = tx.trade_date.slice(0, 4);
            const b = map[year] ?? {
                invested: 0, soldNet: 0, realizedPL: 0, fees: 0,
                tradeCount: 0, buyCount: 0, sellCount: 0,
                symbolsTraded: new Set<string>(), symbolPL: {},
            };
            b.tradeCount++;
            b.symbolsTraded.add(tx.symbol);
            b.fees += Number(tx.fee_usd ?? 0) + Number(tx.wht_usd ?? 0);

            if (tx.side === 'BUY') {
                b.invested += Number(tx.gross_usd ?? 0) + Number(tx.fee_usd ?? 0);
                b.buyCount++;
            } else {
                const net = Number(tx.net_usd ?? 0);
                const pl = net - Number(tx.qty) * (avgBuyPrices[tx.symbol] ?? 0);
                b.soldNet += net;
                b.realizedPL += pl;
                b.sellCount++;
                b.symbolPL[tx.symbol] = (b.symbolPL[tx.symbol] ?? 0) + pl;
            }
            map[year] = b;
        });

        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([year, d]) => {
                const plEntries = Object.entries(d.symbolPL);
                const profitable = plEntries.filter(([, v]) => v > 0);
                const losing = plEntries.filter(([, v]) => v < 0);
                const withSells = plEntries.length;
                return {
                    year,
                    invested: d.invested,
                    soldNet: d.soldNet,
                    realizedPL: d.realizedPL,
                    realizedPLPct: d.invested > 0 ? (d.realizedPL / d.invested) * 100 : 0,
                    fees: d.fees,
                    feePct: d.invested > 0 ? (d.fees / d.invested) * 100 : 0,
                    tradeCount: d.tradeCount,
                    buyCount: d.buyCount,
                    sellCount: d.sellCount,
                    symbolCount: d.symbolsTraded.size,
                    profitCount: profitable.length,
                    lossCount: losing.length,
                    winRate: withSells > 0 ? (profitable.length / withSells) * 100 : 0,
                    realizedProfit: profitable.reduce((s, [, v]) => s + v, 0),
                    realizedLoss: losing.reduce((s, [, v]) => s + v, 0),
                    topSymbols: plEntries.sort(([, a], [, b]) => b - a).slice(0, 6).map(([sym, pl]) => ({ sym, pl })),
                    bottomSymbols: plEntries.sort(([, a], [, b]) => a - b).slice(0, 4).map(([sym, pl]) => ({ sym, pl })),
                    uniqueSymbols: [...d.symbolsTraded],
                };
            });
    }, [transactions, avgBuyPrices]);

    // ── Monthly data for selected year ───────────────────────────────────────

    const monthlyData = useMemo(() => {
        if (!selectedYear) return [];
        const map: Record<string, { invested: number; soldNet: number; realizedPL: number; fees: number; tradeCount: number }> = {};

        transactions
            .filter(tx => tx.trade_date.startsWith(selectedYear))
            .forEach(tx => {
                const mo = tx.trade_date.slice(0, 7);
                const m = map[mo] ?? { invested: 0, soldNet: 0, realizedPL: 0, fees: 0, tradeCount: 0 };
                m.tradeCount++;
                m.fees += Number(tx.fee_usd ?? 0) + Number(tx.wht_usd ?? 0);
                if (tx.side === 'BUY') {
                    m.invested += Number(tx.gross_usd ?? 0) + Number(tx.fee_usd ?? 0);
                } else {
                    const net = Number(tx.net_usd ?? 0);
                    m.soldNet += net;
                    m.realizedPL += net - Number(tx.qty) * (avgBuyPrices[tx.symbol] ?? 0);
                }
                map[mo] = m;
            });

        let cumPL = 0;
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mo, d]) => {
                cumPL += d.realizedPL;
                return { ...d, month: mo, label: MONTHS[parseInt(mo.slice(5)) - 1], cumPL };
            });
    }, [transactions, selectedYear, avgBuyPrices]);

    // ── Symbol list for selected year ────────────────────────────────────────

    const yearSymbols = useMemo(() => {
        if (!selectedYear) return [];
        const year = yearlyStats.find(y => y.year === selectedYear);
        if (!year) return [];

        const symPL: Record<string, { pl: number; trades: number; sides: Set<string> }> = {};
        transactions
            .filter(tx => tx.trade_date.startsWith(selectedYear))
            .forEach(tx => {
                const s = symPL[tx.symbol] ?? { pl: 0, trades: 0, sides: new Set<string>() };
                s.trades++;
                s.sides.add(tx.side);
                if (tx.side === 'SELL') {
                    s.pl += Number(tx.net_usd ?? 0) - Number(tx.qty) * (avgBuyPrices[tx.symbol] ?? 0);
                }
                symPL[tx.symbol] = s;
            });

        return Object.entries(symPL)
            .map(([sym, d]) => ({
                sym,
                pl: d.pl,
                trades: d.trades,
                hasSells: d.sides.has('SELL'),
            }))
            .sort((a, b) => b.pl - a.pl);
    }, [transactions, selectedYear, yearlyStats, avgBuyPrices]);

    const years = yearlyStats.map(y => y.year);
    const selected = yearlyStats.find(y => y.year === selectedYear);

    if (loading) return (
        <div className="flex flex-col gap-4 pt-4 pb-28">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-44 w-full" />
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
    );

    return (
        <div className="flex flex-col gap-4 pt-4 pb-28">

            {/* Back */}
            <button onClick={() => navigate('/dime-stock')}
                className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-cyan-400 transition-colors self-start tracking-[0.1em]">
                <ChevronLeft className="size-3.5" />
                PORTFOLIO
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
                <Calendar className="size-5 text-cyan-400/60" />
                <div>
                    <h1 className="font-black text-lg text-foreground tracking-tighter">Yearly Breakdown</h1>
                    <p className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">
                        {years.length} years · {transactions.length} total trades
                    </p>
                </div>
            </div>

            {/* All-years P&L bar */}
            {yearlyStats.length > 0 && (
                <div className="border border-border/20 bg-gray-50 dark:bg-[oklch(0.105_0.014_255)] p-3">
                    <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Realized P&L by Year</p>
                    <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={yearlyStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <XAxis dataKey="year" tick={AXIS_TICK} />
                            <YAxis tick={AXIS_TICK} tickFormatter={v => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`} />
                            <RCTip content={<ChartTip />} />
                            <ReferenceLine y={0} stroke="#334155" />
                            <Bar dataKey="realizedPL" name="P&L" radius={[3, 3, 0, 0]} onClick={(d: any) => setSelectedYear(d.year)}>
                                {yearlyStats.map(y => (
                                    <Cell
                                        key={y.year}
                                        fill={y.realizedPL >= 0 ? '#34d399' : '#f87171'}
                                        opacity={selectedYear === y.year ? 1 : 0.55}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <p className="text-[8px] font-mono text-muted-foreground/25 mt-1 text-center">tap bar to select year</p>
                </div>
            )}

            {/* Year selector chips */}
            <div className="flex gap-2 flex-wrap">
                {years.map(y => {
                    const yd = yearlyStats.find(x => x.year === y)!;
                    return (
                        <button key={y} onClick={() => setSelectedYear(y)}
                            className={cn(
                                'flex flex-col items-center px-4 py-2 border transition-all',
                                selectedYear === y
                                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                                    : 'bg-black/20 border-border/20 text-muted-foreground/50 hover:border-border/40'
                            )}>
                            <span className="font-mono font-black text-base">{y}</span>
                            <span className={cn('text-[9px] font-mono font-bold',
                                yd.realizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            )}>
                                {yd.realizedPL >= 0 ? '+' : ''}{d$(yd.realizedPL, 0)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Selected year detail */}
            {selected && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="font-mono font-black text-2xl text-foreground">{selected.year}</h2>
                        <span className={cn('font-mono font-bold text-sm',
                            selected.realizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        )}>
                            {selected.realizedPL >= 0 ? '+' : ''}{d$(selected.realizedPL)}
                            <span className="text-[10px] ml-1 opacity-70">{pct(selected.realizedPLPct)}</span>
                        </span>
                        {selected.realizedPL >= 0
                            ? <TrendingUp className="size-4 text-emerald-400/60" />
                            : <TrendingDown className="size-4 text-rose-400/60" />
                        }
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-2">
                        <SC label="Total Invested" value={d$(selected.invested)} cls="text-foreground" />
                        <SC label="Total Sold" value={d$(selected.soldNet)} cls="text-cyan-300" />
                        <SC label="Realized Profit" value={`+${d$(selected.realizedProfit)}`} cls="text-emerald-400" />
                        <SC label="Realized Loss" value={d$(selected.realizedLoss)} cls="text-rose-400" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <SC label="Win Rate"
                            value={`${selected.winRate.toFixed(0)}%`}
                            sub={`${selected.profitCount}W / ${selected.lossCount}L`}
                            cls={selected.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'} />
                        <SC label="Total Fees"
                            value={d$(selected.fees)}
                            sub={`${selected.feePct.toFixed(2)}% of inv.`}
                            cls="text-amber-400" />
                        <SC label="Trades"
                            value={selected.tradeCount}
                            sub={`${selected.buyCount}B / ${selected.sellCount}S`}
                            cls="text-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <SC label="Symbols Traded" value={selected.symbolCount} cls="text-foreground" />
                        <SC label="P&L %" value={pct(selected.realizedPLPct)}
                            cls={selected.realizedPLPct >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
                    </div>

                    {/* Monthly P&L chart */}
                    {monthlyData.length > 0 && (
                        <div className="border border-border/20 bg-gray-50 dark:bg-[oklch(0.105_0.014_255)] p-3">
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Monthly P&L — {selected.year}</p>
                            <ResponsiveContainer width="100%" height={150}>
                                <ComposedChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={AXIS_TICK} />
                                    <YAxis tick={AXIS_TICK} tickFormatter={v => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`} />
                                    <RCTip content={<ChartTip />} />
                                    <ReferenceLine y={0} stroke="#334155" />
                                    <Bar dataKey="realizedPL" name="P&L" radius={[2, 2, 0, 0]}>
                                        {monthlyData.map((m, i) => (
                                            <Cell key={i} fill={m.realizedPL >= 0 ? '#34d399' : '#f87171'} />
                                        ))}
                                    </Bar>
                                    <Line type="monotone" dataKey="cumPL" name="Cumulative"
                                        stroke="#22d3ee" strokeWidth={1.5} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Buy vs Sell by month */}
                    {monthlyData.length > 0 && (
                        <div className="border border-border/20 bg-gray-50 dark:bg-[oklch(0.105_0.014_255)] p-3">
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Buy vs Sell — {selected.year}</p>
                            <ResponsiveContainer width="100%" height={130}>
                                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={AXIS_TICK} />
                                    <YAxis tick={AXIS_TICK} tickFormatter={v => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`} />
                                    <RCTip content={<ChartTip />} />
                                    <Bar dataKey="invested" name="Buy" fill="#22d3ee" opacity={0.7} radius={[2, 2, 0, 0]} />
                                    <Bar dataKey="soldNet" name="Sell" fill="#a78bfa" opacity={0.7} radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Fee by month */}
                    {monthlyData.length > 0 && (
                        <div className="border border-border/20 bg-gray-50 dark:bg-[oklch(0.105_0.014_255)] p-3">
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-3">Fees by Month — {selected.year}</p>
                            <ResponsiveContainer width="100%" height={100}>
                                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={AXIS_TICK} />
                                    <YAxis tick={AXIS_TICK} tickFormatter={v => `$${v.toFixed(1)}`} />
                                    <RCTip content={<ChartTip />} />
                                    <Bar dataKey="fees" name="Fees" fill="#fbbf24" opacity={0.8} radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Top / bottom symbols */}
                    {selected.topSymbols.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="border border-emerald-500/15 bg-emerald-500/5 p-3">
                                <p className="text-[8px] font-bold text-emerald-400/50 uppercase tracking-[0.14em] mb-2">Best {selected.year}</p>
                                <div className="flex flex-col gap-1.5">
                                    {selected.topSymbols.filter(s => s.pl > 0).slice(0, 4).map(s => {
                                        const maxPL = selected.topSymbols.filter(x => x.pl > 0)[0]?.pl ?? 1;
                                        return (
                                            <div key={s.sym}>
                                                <div className="flex justify-between mb-0.5">
                                                    <span className="font-mono font-black text-[10px] text-foreground/90">{s.sym}</span>
                                                    <span className="font-mono text-[9px] text-emerald-400">+{d$(s.pl, 0)}</span>
                                                </div>
                                                <div className="h-0.5 bg-border/15 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.pl / maxPL) * 100}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="border border-rose-500/15 bg-rose-500/5 p-3">
                                <p className="text-[8px] font-bold text-rose-400/50 uppercase tracking-[0.14em] mb-2">Worst {selected.year}</p>
                                <div className="flex flex-col gap-1.5">
                                    {selected.bottomSymbols.filter(s => s.pl < 0).slice(0, 4).map(s => {
                                        const maxLoss = Math.abs(selected.bottomSymbols.filter(x => x.pl < 0)[0]?.pl ?? 1);
                                        return (
                                            <div key={s.sym}>
                                                <div className="flex justify-between mb-0.5">
                                                    <span className="font-mono font-black text-[10px] text-foreground/90">{s.sym}</span>
                                                    <span className="font-mono text-[9px] text-rose-400">{d$(s.pl, 0)}</span>
                                                </div>
                                                <div className="h-0.5 bg-border/15 rounded-full overflow-hidden">
                                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(Math.abs(s.pl) / maxLoss) * 100}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All symbols for this year */}
                    {yearSymbols.length > 0 && (
                        <div>
                            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-2">
                                All Symbols — {selected.year} ({yearSymbols.length})
                            </p>
                            <div className="border border-border/20 bg-gray-50 dark:bg-[oklch(0.105_0.014_255)] divide-y divide-border/10">
                                {yearSymbols.map(s => (
                                    <button
                                        key={s.sym}
                                        onClick={() => navigate(`/dime-stock/${s.sym}`)}
                                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors text-left"
                                    >
                                        <div>
                                            <span className="font-mono font-black text-sm text-foreground">{s.sym}</span>
                                            <span className="ml-2 text-[9px] font-mono text-muted-foreground/40">{s.trades}T</span>
                                        </div>
                                        <div className="text-right">
                                            {s.hasSells ? (
                                                <span className={cn('font-mono font-bold text-sm', s.pl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                                    {s.pl >= 0 ? '+' : ''}{d$(s.pl, 0)}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-mono text-muted-foreground/30">buys only</span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Year comparison note */}
                    {yearlyStats.length > 1 && (
                        <div className="border border-border/15 bg-black/20 p-3">
                            <p className="text-[8px] font-bold text-muted-foreground/35 uppercase tracking-[0.14em] mb-2">Compare All Years</p>
                            <div className="flex flex-col gap-1.5">
                                {yearlyStats.map(y => (
                                    <button key={y.year} onClick={() => setSelectedYear(y.year)}
                                        className={cn('flex items-center justify-between py-1.5 px-2 transition-colors',
                                            y.year === selectedYear ? 'bg-cyan-500/10' : 'hover:bg-white/[0.03]'
                                        )}>
                                        <span className={cn('font-mono font-black text-sm', y.year === selectedYear ? 'text-cyan-300' : 'text-foreground/70')}>{y.year}</span>
                                        <div className="flex items-center gap-4 font-mono text-xs">
                                            <span className="text-muted-foreground/40">{y.tradeCount}T · {y.symbolCount}sym</span>
                                            <span className={y.realizedPL >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                                {y.realizedPL >= 0 ? '+' : ''}{d$(y.realizedPL, 0)}
                                            </span>
                                            <span className={cn('text-[10px]', y.realizedPLPct >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60')}>
                                                {pct(y.realizedPLPct)}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

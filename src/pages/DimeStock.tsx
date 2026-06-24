import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { DimeTransaction } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { cn, getErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import {
    Plus, TrendingUp, TrendingDown, ChevronRight, ChevronDown,
    Trash2, Inbox, Activity, Check, Filter
} from 'lucide-react';

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

function FeePill({ label, value }: { label: string; value: number | null | undefined }) {
    if (!value || value <= 0) return null;
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/6 text-amber-400/70 border border-amber-500/12">
            {label} {fmt(value, 4)}
        </span>
    );
}

// ─── Trade row ────────────────────────────────────────────────────────────────

function TradeRow({ tx, onDelete }: { tx: DimeTransaction; onDelete: (id: string) => void }) {
    const isIn = tx.side === 'BUY' || tx.side === 'INIT';
    return (
        <div className="group flex items-start gap-2.5 px-3 py-2.5 border-b border-border/20 last:border-0 hover:bg-white/1 transition-colors">
            {/* Side accent bar */}
            <div className={cn('w-0.5 self-stretch rounded-full shrink-0 mt-0.5',
                tx.side === 'BUY'  ? 'bg-cyan-500' :
                tx.side === 'SELL' ? 'bg-emerald-500' : 'bg-violet-500'
            )} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-sm text-foreground">{tx.symbol}</span>
                        <SidePill side={tx.side} />
                        <span className="text-[9px] text-muted-foreground/50 font-mono">{formatDate(tx.transaction_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn('font-mono font-bold text-sm',
                            isIn ? 'text-foreground' : 'text-emerald-400'
                        )}>
                            {tx.side === 'INIT' ? fmt(tx.stock_amount) : fmt(tx.total_amount)}
                        </span>
                        <button
                            onClick={() => onDelete(tx.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-muted-foreground/30 hover:text-rose-400 transition-all"
                        >
                            <Trash2 className="size-3" />
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1">
                    {tx.shares != null && (
                        <span className="text-[9px] font-mono text-muted-foreground/50">{Number(tx.shares).toFixed(7)} sh @ {fmt(tx.executed_price)}</span>
                    )}
                    <FeePill label="comm" value={tx.commission} />
                    <FeePill label="VAT" value={tx.vat} />
                    <FeePill label="SEC" value={tx.sec_fee} />
                    <FeePill label="TAF" value={tx.taf_fee} />
                </div>
            </div>
        </div>
    );
}

// ─── Position Card ────────────────────────────────────────────────────────────

function PositionCard({ s, onClick }: { s: SymbolSummary; onClick: () => void }) {
    const realized = s.totalSellAmount > 0 ? s.totalSellAmount - (s.totalSharesSold * s.avgBuyPrice) : 0;
    const hasSold = s.totalSellAmount > 0;
    const plPositive = realized >= 0;
    const hasPosition = s.totalShares > 0;

    return (
        <button
            onClick={onClick}
            className="w-full text-left border border-border/25 rounded-xl bg-[oklch(0.12_0.015_255)] hover:border-cyan-500/20 hover:shadow-[0_0_20px_oklch(0.68_0.18_210/0.06)] transition-all duration-200 active:scale-[0.99] overflow-hidden group"
        >
            {/* Top accent */}
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
                        </div>
                        <span className="text-[9px] text-muted-foreground/30 font-mono">{formatDate(s.latestDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {hasSold && (
                            <div className={cn('flex items-center gap-1 text-xs font-mono font-bold',
                                plPositive ? 'text-emerald-400' : 'text-rose-400'
                            )}>
                                {plPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                                {plPositive ? '+' : ''}{fmt(realized)}
                            </div>
                        )}
                        <ChevronRight className="size-3.5 text-muted-foreground/20 group-hover:text-cyan-400/40 transition-colors" />
                    </div>
                </div>

                {/* Position value */}
                <div className="mb-3">
                    <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em] mb-0.5">Position</p>
                    <p className="font-mono font-black text-xl text-cyan-300 tracking-tight">{fmt(s.totalStockAmount)}</p>
                    {s.totalShares > 0 && (
                        <p className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">{s.totalShares.toFixed(6)} sh</p>
                    )}
                </div>

                {/* Stats */}
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
                    <div className="ml-auto">
                        <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Invested</p>
                        <p className="font-mono font-bold text-xs text-foreground/60">{fmt(s.totalBuyAmount)}</p>
                    </div>
                </div>
            </div>
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DimeStock() {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<DimeTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('portfolio');
    const [symbolFilter, setSymbolFilter] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);

    // Close filter on click outside
    useEffect(() => {
        if (!filterOpen) return;
        const handler = () => setFilterOpen(false);
        setTimeout(() => document.addEventListener('click', handler), 0);
        return () => document.removeEventListener('click', handler);
    }, [filterOpen]);

    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('pantagon_financial_stock_trades').select('*').order('transaction_date', { ascending: false });
            if (error) throw error;
            setTransactions((data as DimeTransaction[]) || []);
        } catch (err) { setError(getErrorMessage(err)); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const symbolSummaries: SymbolSummary[] = useMemo(() => {
        const map: Record<string, SymbolSummary> = {};
        transactions.filter(t => t.side === 'BUY' || t.side === 'INIT').forEach((tx) => {
            const sym = tx.symbol || 'UNKNOWN';
            if (!map[sym]) map[sym] = { symbol: sym, totalBuyAmount: 0, totalSellAmount: 0, totalShares: 0, avgBuyPrice: 0, txCount: 0, latestDate: tx.transaction_date, totalStockAmount: 0, totalSharesSold: 0 };
            map[sym].txCount++;
            if (tx.transaction_date > map[sym].latestDate) map[sym].latestDate = tx.transaction_date;
            map[sym].totalBuyAmount += tx.side === 'INIT' ? Number(tx.stock_amount ?? 0) : Number(tx.total_amount);
            map[sym].totalShares += Number(tx.shares ?? 0);
            map[sym].totalStockAmount += Number(tx.stock_amount ?? 0);
        });
        Object.values(map).forEach((s) => { s.avgBuyPrice = s.totalShares > 0 ? s.totalStockAmount / s.totalShares : 0; });
        transactions.filter(t => t.side === 'SELL').forEach((tx) => {
            const sym = tx.symbol || 'UNKNOWN';
            if (!map[sym]) map[sym] = { symbol: sym, totalBuyAmount: 0, totalSellAmount: 0, totalShares: 0, avgBuyPrice: 0, txCount: 0, latestDate: tx.transaction_date, totalStockAmount: 0, totalSharesSold: 0 };
            map[sym].txCount++;
            if (tx.transaction_date > map[sym].latestDate) map[sym].latestDate = tx.transaction_date;
            const sharesSold = Number(tx.shares ?? 0);
            map[sym].totalSellAmount += Number(tx.total_amount);
            map[sym].totalSharesSold += sharesSold;
            map[sym].totalShares -= sharesSold;
            map[sym].totalStockAmount -= sharesSold * map[sym].avgBuyPrice;
        });
        Object.values(map).forEach((s) => {
            if (s.totalShares <= 0.000001) { s.totalShares = 0; s.totalStockAmount = 0; }
            else s.totalStockAmount = Math.max(0, s.totalStockAmount);
        });
        return Object.values(map).sort((a, b) => b.totalStockAmount - a.totalStockAmount);
    }, [transactions]);

    const filteredSummaries = useMemo(() => 
        symbolFilter ? symbolSummaries.filter(s => s.symbol === symbolFilter) : symbolSummaries
    , [symbolSummaries, symbolFilter]);

    const filteredTransactions = useMemo(() => 
        symbolFilter ? transactions.filter(t => t.symbol === symbolFilter) : transactions
    , [transactions, symbolFilter]);

    const overallBuy = useMemo(() =>
        transactions.filter(t => t.side === 'INIT').reduce((s, t) => s + Number(t.stock_amount ?? 0), 0) +
        transactions.filter(t => t.side === 'BUY').reduce((s, t) => s + Number(t.total_amount), 0)
    , [transactions]);
    const overallSell = useMemo(() => transactions.filter(t => t.side === 'SELL').reduce((s, t) => s + Number(t.total_amount), 0), [transactions]);
    const netPL = useMemo(() => symbolSummaries.reduce((total, s) => {
        if (s.totalSellAmount === 0) return total;
        const realized = s.totalSellAmount - (s.totalSharesSold * s.avgBuyPrice);
        return total + realized;
    }, 0), [symbolSummaries]);

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('pantagon_financial_stock_trades').delete().eq('id', id);
            if (error) throw error;
            setDeleteId(null);
            await fetchTransactions();
        } catch (err) { toast.error('Delete failed', { description: getErrorMessage(err) }); }
    };

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
                <button
                    onClick={() => navigate('/dime-stock-add')}
                    className="flex items-center justify-center gap-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/25 hover:border-cyan-400/40 px-3 h-9 rounded-none text-[10px] font-bold tracking-[0.1em] transition-all"
                >
                    <Plus className="size-3.5" />
                    ADD
                </button>
            </div>

            {/* ── Portfolio Hero ── */}
            <div className="rounded-xl border border-cyan-500/15 bg-gradient-to-br from-[oklch(0.12_0.02_250)] to-[oklch(0.09_0.015_240)] p-5 relative overflow-hidden">
                <Activity className="absolute -right-3 -top-3 size-20 text-cyan-500/4" />
                <div className="h-px w-full absolute top-0 left-0 bg-gradient-to-r from-cyan-500/50 via-cyan-400/15 to-transparent" />
                <div className="relative">
                    <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em] mb-1">Total Portfolio Value</p>
                    <p className="font-mono font-black text-3xl text-foreground tracking-tight">{fmt(overallBuy)}</p>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/15">
                        <div>
                            <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Sold</p>
                            <p className="font-mono text-xs font-bold text-emerald-400">{fmt(overallSell)}</p>
                        </div>
                        <div className="w-px h-5 bg-border/20" />
                        <div>
                            <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Net P&L</p>
                            <p className={cn('font-mono text-xs font-bold', netPL >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                {netPL >= 0 ? '+' : ''}{fmt(netPL)}
                            </p>
                        </div>
                        <div className="w-px h-5 bg-border/20" />
                        <div>
                            <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">Symbols</p>
                            <p className="font-mono text-xs font-bold text-foreground">{symbolSummaries.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Filter & Tabs ── */}
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
                        <TabsList className="w-full grid grid-cols-2 h-9 bg-black/30 border border-border/20 p-0 rounded-none">
                            <TabsTrigger value="portfolio" className="text-[10px] tracking-wider font-bold h-full data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-300 data-[state=active]:shadow-none rounded-none border-r border-border/20">
                                PORTFOLIO
                            </TabsTrigger>
                            <TabsTrigger value="trades" className="text-[10px] tracking-wider font-bold h-full data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-300 data-[state=active]:shadow-none rounded-none">
                                TRADES
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    
                    <div className="relative">
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

                {/* Portfolio tab content */}
                {activeTab === 'portfolio' && (
                    <div className="w-full">
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

                {/* Trades tab content */}
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
                                        const d = b.transaction_date.localeCompare(a.transaction_date);
                                        return d !== 0 ? d : (b.created_at ?? '').localeCompare(a.created_at ?? '');
                                    })
                                    .map(tx => <TradeRow key={tx.id} tx={tx} onDelete={(id) => setDeleteId(id)} />)
                                }
                            </div>
                        )}
                    </div>
                )}
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

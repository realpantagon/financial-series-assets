import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { DimeTransaction } from '../types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { cn } from '@/lib/utils';
import {
    Plus, X, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
    Trash2, Code2, Copy, Check, Upload, Loader2, Inbox, Activity,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Side = 'BUY' | 'SELL';

interface FormState {
    side: Side;
    transaction_date: string;
    symbol: string;
    executed_price: string;
    input_amount_usd: string;
    input_shares: string;
    commission: string;
    vat: string;
    fee: string;
    sec_fee: string;
    taf_fee: string;
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined, digits = 2): string {
    if (value == null) return '—';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4) });
}

function formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function todayISO(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

const AI_OCR_PROMPT = `You are a stock transaction data extraction assistant.

Look at the attached stock transaction image/slip and extract the data into JSON format exactly as shown below.

Rules:
- side: "BUY" if buying shares, "SELL" if selling shares
- symbol: stock ticker (e.g. "AAPL", "NVDA")
- transaction_date: ISO 8601 format (MUST be converted to Thai Time / UTC+7, e.g., "YYYY-MM-DDTHH:mm:ss+07:00")
- executed_price: price per share (number)
- For BUY: use "input_amount_usd" = total USD amount invested (number)
- For SELL: use "input_shares" = number of shares sold (number)
- commission, vat, fee, sec_fee, taf_fee: fee amounts as numbers (use null if not present)
- All fees should be positive numbers

BUY format:
{
  "side": "BUY", "symbol": "AAPL",
  "transaction_date": "2026-02-20T17:30:00+07:00",
  "executed_price": 220.50, "input_amount_usd": 1000.00,
  "commission": 0.99, "vat": 0.0065, "fee": null, "sec_fee": null, "taf_fee": null
}

SELL format:
{
  "side": "SELL", "symbol": "AAPL",
  "transaction_date": "2026-02-20T17:30:00+07:00",
  "executed_price": 220.50, "input_shares": 4.5351500,
  "commission": 0.99, "vat": 0.0065, "fee": null, "sec_fee": null, "taf_fee": null
}

If there are multiple transactions, return a JSON array. Return ONLY the JSON, no other text.`;

const INITIAL_FORM: FormState = {
    side: 'BUY', transaction_date: todayISO(), symbol: '', executed_price: '',
    input_amount_usd: '', input_shares: '', commission: '', vat: '', fee: '', sec_fee: '', taf_fee: '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidePill({ side }: { side: string }) {
    return (
        <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border',
            side === 'BUY'  ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' :
            side === 'SELL' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                              'bg-purple-500/10 text-purple-400 border-purple-500/25'
        )}>
            {side}
        </span>
    );
}

function FeePill({ label, value }: { label: string; value: number | null | undefined }) {
    if (!value || value <= 0) return null;
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/8 text-amber-400/80 border border-amber-500/15">
            {label} {fmt(value, 4)}
        </span>
    );
}

// ─── Transaction row in "all trades" view ─────────────────────────────────────

function TradeRow({ tx, onDelete }: { tx: DimeTransaction; onDelete: (id: string) => void }) {
    const isIn = tx.side === 'BUY' || tx.side === 'INIT';
    return (
        <div className="group flex items-start gap-3 px-3 py-3 border-b border-border/30 last:border-0 hover:bg-white/2 transition-colors">
            {/* side accent bar */}
            <div className={cn('w-0.5 self-stretch rounded-full shrink-0 mt-0.5',
                tx.side === 'BUY'  ? 'bg-blue-500' :
                tx.side === 'SELL' ? 'bg-emerald-500' : 'bg-purple-500'
            )} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-sm text-foreground">{tx.symbol}</span>
                        <SidePill side={tx.side} />
                        <span className="text-[10px] text-muted-foreground">{formatDate(tx.transaction_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('font-mono font-bold text-sm',
                            isIn ? 'text-foreground' : 'text-emerald-400'
                        )}>
                            {tx.side === 'INIT' ? fmt(tx.stock_amount) : fmt(tx.total_amount)}
                        </span>
                        <button
                            onClick={() => onDelete(tx.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 transition-all"
                        >
                            <Trash2 className="size-3" />
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1">
                    {tx.shares != null && (
                        <span className="text-[10px] font-mono text-muted-foreground">{Number(tx.shares).toFixed(7)} sh @ {fmt(tx.executed_price)}</span>
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

// ─── Symbol position card ─────────────────────────────────────────────────────

function PositionCard({ s, onClick }: { s: SymbolSummary; onClick: () => void }) {
    const realized = s.totalSellAmount > 0 ? s.totalSellAmount - s.totalBuyAmount : 0;
    const hasSold = s.totalSellAmount > 0;
    const plPositive = realized >= 0;

    return (
        <button
            onClick={onClick}
            className="w-full text-left border border-border/40 rounded-xl bg-card hover:border-primary/30 hover:shadow-[0_0_20px_oklch(0.62_0.22_258/0.08)] transition-all duration-200 active:scale-[0.99] overflow-hidden"
        >
            {/* Top accent line */}
            <div className={cn('h-px w-full', s.totalShares > 0 ? 'bg-gradient-to-r from-blue-500/60 to-transparent' : 'bg-gradient-to-r from-emerald-500/40 to-transparent')} />

            <div className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-lg text-foreground tracking-tight">{s.symbol}</span>
                            <span className="text-[10px] text-muted-foreground">{s.txCount} trade{s.txCount !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">{formatDate(s.latestDate)}</span>
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
                        <ChevronRight className="size-4 text-muted-foreground/30" />
                    </div>
                </div>

                {/* Main value */}
                <div className="mb-3">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Position Value</p>
                    <p className="font-mono font-bold text-xl text-blue-300">{fmt(s.totalStockAmount)}</p>
                    {s.totalShares > 0 && (
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{s.totalShares.toFixed(7)} sh held</p>
                    )}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 pt-2.5 border-t border-border/30 text-[10px]">
                    <div>
                        <p className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">Avg Cost</p>
                        <p className="font-mono font-semibold text-foreground/80">{fmt(s.avgBuyPrice)}</p>
                    </div>
                    {hasSold && (
                        <div>
                            <p className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">Sold</p>
                            <p className="font-mono font-semibold text-emerald-400">{fmt(s.totalSellAmount)}</p>
                        </div>
                    )}
                    <div className="ml-auto">
                        <p className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">Invested</p>
                        <p className="font-mono font-semibold text-foreground/80">{fmt(s.totalBuyAmount)}</p>
                    </div>
                </div>
            </div>
        </button>
    );
}

// ─── Symbol detail view ───────────────────────────────────────────────────────

function SymbolDetail({
    symbol,
    summary,
    transactions,
    onBack,
    onDelete,
}: {
    symbol: string;
    summary: SymbolSummary;
    transactions: DimeTransaction[];
    onBack: () => void;
    onDelete: (id: string) => void;
}) {
    const s = summary;
    const realized = s.totalSellAmount > 0 ? s.totalSellAmount - s.totalBuyAmount : 0;
    const plPositive = realized >= 0;

    const symTxs = [...transactions]
        .filter(t => (t.symbol || 'UNKNOWN') === symbol)
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

    return (
        <div className="flex flex-col gap-4">
            {/* Back */}
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors self-start"
            >
                <ChevronLeft className="size-4" />
                Portfolio
            </button>

            {/* Hero */}
            <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-card to-blue-500/5 p-5 relative overflow-hidden">
                <Activity className="absolute -right-4 -bottom-4 size-24 text-blue-500/5" />
                <div className="relative">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Symbol</div>
                            <div className="font-mono font-bold text-3xl text-foreground tracking-tight">{symbol}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">{s.txCount} trade{s.txCount !== 1 ? 's' : ''}</div>
                        </div>
                        {realized !== 0 && (
                            <div className="text-right">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Net P&L</div>
                                <div className={cn('font-mono font-bold text-xl', plPositive ? 'text-emerald-400' : 'text-rose-400')}>
                                    {plPositive ? '+' : ''}{fmt(realized)}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mb-4">
                        <div className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-0.5">Position Value</div>
                        <div className="font-mono font-bold text-4xl text-blue-300">{fmt(s.totalStockAmount)}</div>
                    </div>

                    <div className="flex gap-6 pt-3 border-t border-border/30 text-[11px]">
                        <div>
                            <p className="text-muted-foreground/50 uppercase tracking-wider mb-0.5">Shares</p>
                            <p className="font-mono font-semibold text-foreground">{s.totalShares.toFixed(7)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground/50 uppercase tracking-wider mb-0.5">Avg Buy</p>
                            <p className="font-mono font-semibold text-foreground">{fmt(s.avgBuyPrice)}</p>
                        </div>
                        {s.totalSellAmount > 0 && (
                            <div>
                                <p className="text-muted-foreground/50 uppercase tracking-wider mb-0.5">Sold</p>
                                <p className="font-mono font-semibold text-emerald-400">{fmt(s.totalSellAmount)}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Timeline label */}
            <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border/30" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Transaction Timeline</span>
                <div className="h-px flex-1 bg-border/30" />
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border/30" />

                <div className="flex flex-col gap-3">
                    {symTxs.map((tx) => {
                        const isIn = tx.side === 'BUY' || tx.side === 'INIT';
                        const dotColor = tx.side === 'BUY' ? 'bg-blue-500' : tx.side === 'SELL' ? 'bg-emerald-500' : 'bg-purple-500';
                        return (
                            <div key={tx.id} className="flex gap-3 relative">
                                {/* Timeline dot */}
                                <div className={cn('size-[10px] rounded-full mt-3 shrink-0 ring-2 ring-background', dotColor)} style={{ zIndex: 1 }} />

                                <div className="flex-1 border border-border/40 rounded-lg bg-card/60 p-3 hover:border-border/70 transition-colors group">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <SidePill side={tx.side} />
                                            <span className="text-[11px] text-muted-foreground">{formatDate(tx.transaction_date)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn('font-mono font-bold text-sm',
                                                isIn ? 'text-foreground' : 'text-emerald-400'
                                            )}>
                                                {tx.side === 'INIT' ? fmt(tx.stock_amount) : fmt(tx.total_amount)}
                                            </span>
                                            <button
                                                onClick={() => onDelete(tx.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 transition-all"
                                            >
                                                <Trash2 className="size-3" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 text-[10px] font-mono text-muted-foreground">
                                        {tx.shares != null && <span>{Number(tx.shares).toFixed(7)} sh</span>}
                                        {tx.executed_price != null && <span>@ {fmt(tx.executed_price)}</span>}
                                        {tx.stock_amount != null && Number(tx.stock_amount) > 0 && tx.side !== 'INIT' && (
                                            <span className="text-blue-400/70">stock {fmt(tx.stock_amount)}</span>
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
        </div>
    );
}

// ─── Add Trade Form ───────────────────────────────────────────────────────────

function AddTradeForm({
    form,
    setForm,
    onSave,
    saving,
    saveError,
}: {
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    onSave: () => void;
    saving: boolean;
    saveError: string | null;
}) {
    const [showJsonPanel, setShowJsonPanel] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [jsonSuccess, setJsonSuccess] = useState(false);
    const [batchPreview, setBatchPreview] = useState<any[] | null>(null);
    const [batchSaving, setBatchSaving] = useState(false);
    const [batchError, setBatchError] = useState<string | null>(null);
    const [copiedPrompt, setCopiedPrompt] = useState(false);

    const handleCopyPrompt = () => {
        const fallback = (text: string) => {
            const el = document.createElement('textarea');
            el.value = text;
            el.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(el);
            el.focus(); el.select();
            try { document.execCommand('copy'); setCopiedPrompt(true); setTimeout(() => setCopiedPrompt(false), 2000); } catch {}
            document.body.removeChild(el);
        };
        if (navigator.clipboard && window.isSecureContext)
            navigator.clipboard.writeText(AI_OCR_PROMPT).then(() => { setCopiedPrompt(true); setTimeout(() => setCopiedPrompt(false), 2000); }).catch(() => fallback(AI_OCR_PROMPT));
        else fallback(AI_OCR_PROMPT);
    };

    const applyJson = () => {
        setJsonError(null); setJsonSuccess(false); setBatchPreview(null); setBatchError(null);
        try {
            let raw = jsonInput.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            raw = raw.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
            const arrMatch = raw.match(/\[[\s\S]*\]/);
            const objMatch = raw.match(/\{[\s\S]*\}/);
            if (arrMatch) {
                const arr = JSON.parse(arrMatch[0]);
                if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
                arr.forEach((item: any, i: number) => {
                    if (!item.side || !item.symbol || !item.executed_price || !item.transaction_date)
                        throw new Error(`Item ${i + 1} missing required fields`);
                    if (item.side === 'BUY' && item.input_amount_usd == null) throw new Error(`Item ${i + 1}: BUY requires input_amount_usd`);
                    if (item.side === 'SELL' && item.input_shares == null) throw new Error(`Item ${i + 1}: SELL requires input_shares`);
                });
                setBatchPreview(arr);
                return;
            }
            if (objMatch) {
                const parsed = JSON.parse(objMatch[0]);
                const nf: FormState = { ...form };
                if (parsed.side === 'BUY' || parsed.side === 'SELL') nf.side = parsed.side;
                if (parsed.symbol) nf.symbol = String(parsed.symbol).toUpperCase().trim();
                if (parsed.transaction_date) {
                    const d = new Date(parsed.transaction_date);
                    if (!isNaN(d.getTime())) { d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); nf.transaction_date = d.toISOString().slice(0, 16); }
                }
                if (parsed.executed_price != null) nf.executed_price = String(Math.abs(Number(parsed.executed_price)));
                if (parsed.input_amount_usd != null) nf.input_amount_usd = String(parsed.input_amount_usd);
                if (parsed.input_shares != null) nf.input_shares = String(parsed.input_shares);
                const gf = (v: any) => (v == null || Number(v) === 0) ? '' : String(Math.abs(Number(v)));
                nf.commission = gf(parsed.commission); nf.vat = gf(parsed.vat);
                nf.fee = gf(parsed.fee); nf.sec_fee = gf(parsed.sec_fee); nf.taf_fee = gf(parsed.taf_fee);
                setForm(nf); setJsonSuccess(true); setJsonInput('');
                setTimeout(() => { setShowJsonPanel(false); setJsonSuccess(false); }, 1200);
                return;
            }
            throw new Error('No JSON found');
        } catch (e: any) { setJsonError(e.message || 'Could not parse JSON'); }
    };

    const buildPayload = (p: any) => {
        const execPrice = Number(p.executed_price);
        const commission = p.commission != null ? Math.abs(Number(p.commission)) : null;
        const vat = p.vat != null ? Math.abs(Number(p.vat)) : null;
        const fee = p.fee != null ? Math.abs(Number(p.fee)) : null;
        const sec_fee = p.sec_fee != null ? Math.abs(Number(p.sec_fee)) : null;
        const taf_fee = p.taf_fee != null ? Math.abs(Number(p.taf_fee)) : null;
        const totalFees = (commission ?? 0) + (vat ?? 0) + (fee ?? 0) + (sec_fee ?? 0) + (taf_fee ?? 0);
        let shares: number | null = null, total_amount: number, input_amount_usd: number | null = null, input_shares: number | null = null, stock_amount: number | null = null;
        if (p.side === 'BUY') {
            input_amount_usd = Number(p.input_amount_usd);
            stock_amount = input_amount_usd - totalFees;
            shares = stock_amount / execPrice;
            total_amount = input_amount_usd;
        } else {
            input_shares = Number(p.input_shares);
            shares = input_shares;
            stock_amount = input_shares * execPrice;
            total_amount = stock_amount - totalFees;
        }
        return { side: p.side, transaction_date: new Date(p.transaction_date).toISOString(), symbol: String(p.symbol).toUpperCase().trim(), shares, total_amount, executed_price: execPrice, commission, vat, fee: fee === 0 ? null : fee, sec_fee: sec_fee === 0 ? null : sec_fee, taf_fee: taf_fee === 0 ? null : taf_fee, input_amount_usd: p.side === 'BUY' ? input_amount_usd : null, input_shares: p.side === 'SELL' ? input_shares : null, stock_amount, currency: 'USD' };
    };

    const handleBatchSave = async () => {
        if (!batchPreview) return;
        setBatchError(null); setBatchSaving(true);
        try {
            const { error } = await supabase.from('dime_transactions').insert(batchPreview.map(buildPayload));
            if (error) throw error;
            toast.success(`${batchPreview.length} transactions imported`);
            setBatchPreview(null); setJsonInput(''); setShowJsonPanel(false);
        } catch (err: any) { setBatchError(err.message); }
        finally { setBatchSaving(false); }
    };

    const isBuy = form.side === 'BUY';

    return (
        <div className="border border-border/40 rounded-xl bg-card/80 backdrop-blur-sm p-4 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
                <div className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">New Trade</span>
            </div>

            {/* BUY / SELL toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-background/60 rounded-lg border border-border/30">
                {(['BUY', 'SELL'] as Side[]).map((s) => (
                    <button
                        key={s}
                        onClick={() => setForm(prev => ({ ...prev, side: s }))}
                        className={cn(
                            'py-2.5 rounded-md text-sm font-bold transition-all',
                            form.side === s
                                ? s === 'BUY'
                                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-[0_0_12px_oklch(0.62_0.22_258/0.15)]'
                                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_oklch(0.63_0.18_145/0.15)]'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/4'
                        )}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* AI OCR Panel */}
            <div className="border border-dashed border-amber-500/25 rounded-lg bg-amber-500/5 overflow-hidden">
                <button
                    type="button"
                    onClick={() => { setShowJsonPanel(!showJsonPanel); setJsonError(null); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/5 transition-colors"
                >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                        <Code2 className="size-3.5" />
                        AI OCR Fill
                    </span>
                    {showJsonPanel ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </button>

                {showJsonPanel && (
                    <div className="px-3 pb-3 flex flex-col gap-2.5">
                        <Button size="sm" onClick={handleCopyPrompt} className="bg-amber-500/90 hover:bg-amber-400 text-background text-xs font-bold h-8">
                            {copiedPrompt ? <><Check className="size-3.5" data-icon="inline-start" />Copied!</> : <><Copy className="size-3.5" data-icon="inline-start" />Copy AI Prompt</>}
                        </Button>
                        <textarea
                            value={jsonInput}
                            onChange={(e) => { setJsonInput(e.target.value); setJsonError(null); setBatchPreview(null); }}
                            placeholder="Paste JSON from AI here…"
                            rows={4}
                            autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                            className="w-full border border-amber-500/20 bg-background/60 rounded-lg px-3 py-2 text-xs text-foreground font-mono resize-none focus:outline-none focus:ring-1 focus:ring-amber-400/40"
                        />
                        {jsonError && <p className="text-[11px] text-rose-400 bg-rose-500/10 px-2.5 py-1.5 rounded-lg">{jsonError}</p>}
                        {jsonSuccess && !batchPreview && <p className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1"><Check className="size-3" /> Fields filled!</p>}
                        {batchPreview && (
                            <div className="flex flex-col gap-2">
                                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{batchPreview.length} transactions ready:</p>
                                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                                    {batchPreview.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between bg-card border border-border/30 rounded-lg px-2.5 py-1.5">
                                            <div className="flex items-center gap-2">
                                                <SidePill side={item.side} />
                                                <span className="text-xs font-mono font-bold">{String(item.symbol).toUpperCase()}</span>
                                                <span className="text-[10px] text-muted-foreground">{item.side === 'BUY' ? `$${Number(item.input_amount_usd).toFixed(2)}` : `${Number(item.input_shares)} sh`}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-muted-foreground">@${Number(item.executed_price).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                {batchError && <p className="text-[11px] text-rose-400 bg-rose-500/10 px-2.5 py-1.5 rounded-lg">{batchError}</p>}
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setBatchPreview(null)} className="flex-1 border-border/40">Cancel</Button>
                                    <Button size="sm" onClick={handleBatchSave} disabled={batchSaving} className="flex-1 bg-amber-500 hover:bg-amber-400 text-background">
                                        {batchSaving ? <><Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />Saving…</> : <><Upload className="size-3.5" data-icon="inline-start" />Import {batchPreview.length}</>}
                                    </Button>
                                </div>
                            </div>
                        )}
                        {!batchPreview && (
                            <Button size="sm" onClick={applyJson} disabled={!jsonInput.trim()} className="bg-amber-500/80 hover:bg-amber-500 text-background text-xs">
                                Apply JSON to Form
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Core fields */}
            <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Symbol *</label>
                    <Input value={form.symbol} onChange={(e) => setForm(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))} placeholder="AAPL" className="h-9 font-mono font-bold uppercase bg-background/60 border-border/40 focus-visible:border-primary/50" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date *</label>
                    <Input type="datetime-local" value={form.transaction_date} onChange={(e) => setForm(prev => ({ ...prev, transaction_date: e.target.value }))} className="h-9 text-xs bg-background/60 border-border/40 focus-visible:border-primary/50" />
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Executed Price *</label>
                <Input type="number" value={form.executed_price} onChange={(e) => setForm(prev => ({ ...prev, executed_price: e.target.value }))} placeholder="0.0000" step="0.0001" className="h-9 font-mono bg-background/60 border-border/40 focus-visible:border-primary/50" />
            </div>

            {isBuy ? (
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Total USD to Invest *</label>
                    <Input type="number" value={form.input_amount_usd} onChange={(e) => setForm(prev => ({ ...prev, input_amount_usd: e.target.value }))} placeholder="1000.00" step="0.01" className="h-9 font-mono bg-blue-500/5 border-blue-500/25 focus-visible:border-blue-400" />
                    {form.input_amount_usd && form.executed_price && (
                        <p className="text-[10px] font-mono text-blue-400/70 pl-1">≈ {(parseFloat(form.input_amount_usd) / parseFloat(form.executed_price)).toFixed(8)} sh</p>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Shares to Sell *</label>
                    <Input type="number" value={form.input_shares} onChange={(e) => setForm(prev => ({ ...prev, input_shares: e.target.value }))} placeholder="0.00000000" step="0.00000001" className="h-9 font-mono bg-emerald-500/5 border-emerald-500/25 focus-visible:border-emerald-400" />
                    {form.input_shares && form.executed_price && (
                        <p className="text-[10px] font-mono text-emerald-400/70 pl-1">≈ {fmt(parseFloat(form.input_shares) * parseFloat(form.executed_price))} gross</p>
                    )}
                </div>
            )}

            {/* Fees */}
            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fees (optional)</p>
                <div className="grid grid-cols-2 gap-2">
                    {([['commission', 'Commission'], ['vat', 'VAT'], ['fee', 'Fee'], ['sec_fee', 'SEC Fee'], ['taf_fee', 'TAF Fee']] as const).map(([key, label]) => (
                        <div key={key} className="flex flex-col gap-1">
                            <label className="text-[10px] text-muted-foreground/60">{label}</label>
                            <Input type="number" value={(form as any)[key]} onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))} placeholder="0.00" step="0.000001" className="h-8 text-xs font-mono bg-background/40 border-border/30" />
                        </div>
                    ))}
                </div>
            </div>

            {saveError && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">{saveError}</p>}

            <Button
                onClick={onSave}
                disabled={saving}
                className={cn(
                    'w-full h-11 font-bold text-sm',
                    isBuy
                        ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 hover:border-blue-400/50 shadow-none'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50 shadow-none'
                )}
            >
                {saving ? <><Loader2 className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : `Confirm ${form.side}`}
            </Button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DimeStock() {
    const [transactions, setTransactions] = useState<DimeTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('portfolio');

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('dime_transactions').select('*').order('transaction_date', { ascending: false });
            if (error) throw error;
            setTransactions((data as DimeTransaction[]) || []);
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTransactions(); }, []);

    const symbolSummaries: SymbolSummary[] = useMemo(() => {
        const map: Record<string, SymbolSummary> = {};
        transactions.filter(t => t.side === 'BUY' || t.side === 'INIT').forEach((tx) => {
            const sym = tx.symbol || 'UNKNOWN';
            if (!map[sym]) map[sym] = { symbol: sym, totalBuyAmount: 0, totalSellAmount: 0, totalShares: 0, avgBuyPrice: 0, txCount: 0, latestDate: tx.transaction_date, totalStockAmount: 0 };
            map[sym].txCount++;
            if (tx.transaction_date > map[sym].latestDate) map[sym].latestDate = tx.transaction_date;
            map[sym].totalBuyAmount += tx.side === 'INIT' ? Number(tx.stock_amount ?? 0) : Number(tx.total_amount);
            map[sym].totalShares += Number(tx.shares ?? 0);
            map[sym].totalStockAmount += Number(tx.stock_amount ?? 0);
        });
        Object.values(map).forEach((s) => { s.avgBuyPrice = s.totalShares > 0 ? s.totalStockAmount / s.totalShares : 0; });
        transactions.filter(t => t.side === 'SELL').forEach((tx) => {
            const sym = tx.symbol || 'UNKNOWN';
            if (!map[sym]) map[sym] = { symbol: sym, totalBuyAmount: 0, totalSellAmount: 0, totalShares: 0, avgBuyPrice: 0, txCount: 0, latestDate: tx.transaction_date, totalStockAmount: 0 };
            map[sym].txCount++;
            if (tx.transaction_date > map[sym].latestDate) map[sym].latestDate = tx.transaction_date;
            const sharesSold = Number(tx.shares ?? 0);
            map[sym].totalSellAmount += Number(tx.total_amount);
            map[sym].totalShares -= sharesSold;
            map[sym].totalStockAmount -= sharesSold * map[sym].avgBuyPrice;
        });
        Object.values(map).forEach((s) => {
            if (s.totalShares <= 0.000001) { s.totalShares = 0; s.totalStockAmount = 0; }
            else s.totalStockAmount = Math.max(0, s.totalStockAmount);
        });
        return Object.values(map).sort((a, b) => b.totalStockAmount - a.totalStockAmount);
    }, [transactions]);

    const overallBuy = useMemo(() =>
        transactions.filter(t => t.side === 'INIT').reduce((s, t) => s + Number(t.stock_amount ?? 0), 0) +
        transactions.filter(t => t.side === 'BUY').reduce((s, t) => s + Number(t.total_amount), 0)
    , [transactions]);
    const overallSell = useMemo(() => transactions.filter(t => t.side === 'SELL').reduce((s, t) => s + Number(t.total_amount), 0), [transactions]);
    const netPL = useMemo(() => symbolSummaries.reduce((total, s) => {
        if (s.totalSellAmount === 0) return total;
        const sellRatio = s.totalShares < 0 ? 1 : Math.abs(s.totalSellAmount) / (s.totalBuyAmount || 1);
        return total + s.totalSellAmount - s.totalBuyAmount * Math.min(sellRatio, 1);
    }, 0), [symbolSummaries]);

    const handleSave = async () => {
        setSaveError(null);
        if (!form.symbol.trim() || !form.executed_price || !form.transaction_date) { setSaveError('Symbol, date, and price are required.'); return; }
        if (form.side === 'BUY' && !form.input_amount_usd) { setSaveError('Input Amount is required for BUY.'); return; }
        if (form.side === 'SELL' && !form.input_shares) { setSaveError('Shares are required for SELL.'); return; }

        const execPrice = parseFloat(form.executed_price);
        const fees = { commission: form.commission ? parseFloat(form.commission) : null, vat: form.vat ? parseFloat(form.vat) : null, fee: form.fee ? parseFloat(form.fee) : null, sec_fee: form.sec_fee ? parseFloat(form.sec_fee) : null, taf_fee: form.taf_fee ? parseFloat(form.taf_fee) : null };
        const totalFees = Object.values(fees).reduce((s: number, v) => s + (v ?? 0), 0);
        let shares: number, total_amount: number, stock_amount: number;
        let input_amount_usd: number | null = null, input_shares: number | null = null;

        if (form.side === 'BUY') {
            input_amount_usd = parseFloat(form.input_amount_usd);
            stock_amount = input_amount_usd - totalFees;
            shares = stock_amount / execPrice;
            total_amount = input_amount_usd;
        } else {
            input_shares = parseFloat(form.input_shares);
            shares = input_shares;
            stock_amount = input_shares * execPrice;
            total_amount = stock_amount - totalFees;
        }

        try {
            setSaving(true);
            const { error } = await supabase.from('dime_transactions').insert([{
                side: form.side, transaction_date: new Date(form.transaction_date).toISOString(),
                symbol: form.symbol.toUpperCase().trim(), shares, total_amount, executed_price: execPrice,
                ...fees, input_amount_usd: form.side === 'BUY' ? input_amount_usd : null,
                input_shares: form.side === 'SELL' ? input_shares : null, stock_amount, currency: 'USD',
            }]);
            if (error) throw error;
            toast.success(`${form.side} trade recorded — ${form.symbol.toUpperCase()}`);
            setShowForm(false);
            setForm(INITIAL_FORM);
            await fetchTransactions();
        } catch (err: any) { setSaveError(err.message); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('dime_transactions').delete().eq('id', id);
            if (error) throw error;
            toast.success('Transaction deleted');
            setDeleteId(null);
            await fetchTransactions();
        } catch (err: any) { toast.error('Delete failed', { description: err.message }); }
    };

    const triggerDelete = (id: string) => setDeleteId(id);

    if (loading) return (
        <div className="flex flex-col gap-4 pt-4 pb-28">
            <Skeleton className="h-32 w-full rounded-xl" />
            <div className="grid grid-cols-3 gap-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            <Skeleton className="h-10 w-full rounded-lg" />
            {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
    );

    if (error) return <div className="flex items-center justify-center min-h-[60vh] text-rose-400 text-sm">{error}</div>;

    return (
        <div className="flex flex-col gap-4 pb-28 pt-3">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-foreground tracking-tight">Dime Stocks</h1>
                    <span className="text-[11px] text-muted-foreground font-mono">{transactions.length} transactions · {symbolSummaries.length} symbols</span>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowForm(!showForm); setSaveError(null); }}
                    className={cn(
                        'gap-1.5 border-border/40 text-xs font-semibold',
                        showForm ? 'bg-rose-500/10 text-rose-400 border-rose-500/25 hover:bg-rose-500/15' : 'bg-blue-500/10 text-blue-300 border-blue-500/25 hover:bg-blue-500/15'
                    )}
                >
                    {showForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
                    {showForm ? 'Cancel' : 'Add Trade'}
                </Button>
            </div>

            {/* ── Portfolio Hero ── */}
            <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-card via-card to-blue-500/5 p-5 relative overflow-hidden">
                <Activity className="absolute -right-3 -top-3 size-20 text-blue-500/5" />
                <div className="relative">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Total Portfolio Value</p>
                    <p className="font-mono font-bold text-3xl text-foreground tracking-tight">{fmt(overallBuy)}</p>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/20">
                        <div>
                            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Sold</p>
                            <p className="font-mono text-xs font-semibold text-emerald-400">{fmt(overallSell)}</p>
                        </div>
                        <div className="w-px h-6 bg-border/30" />
                        <div>
                            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Net P&L</p>
                            <p className={cn('font-mono text-xs font-semibold', netPL >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                {netPL >= 0 ? '+' : ''}{fmt(netPL)}
                            </p>
                        </div>
                        <div className="w-px h-6 bg-border/30" />
                        <div>
                            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Symbols</p>
                            <p className="font-mono text-xs font-semibold text-foreground">{symbolSummaries.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Add Form ── */}
            {showForm && (
                <AddTradeForm
                    form={form}
                    setForm={setForm}
                    onSave={handleSave}
                    saving={saving}
                    saveError={saveError}
                />
            )}

            {/* ── Tabs — FIX: add flex-col to override nova horizontal flex ── */}
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedSymbol(null); }} className="w-full flex-col gap-3">
                <TabsList className="w-full grid grid-cols-2 h-9">
                    <TabsTrigger value="portfolio" className="text-xs">
                        Portfolio ({symbolSummaries.length})
                    </TabsTrigger>
                    <TabsTrigger value="trades" className="text-xs">
                        All Trades ({transactions.length})
                    </TabsTrigger>
                </TabsList>

                {/* Portfolio Tab */}
                <TabsContent value="portfolio" className="w-full mt-0">
                    {symbolSummaries.length === 0 ? (
                        <div className="flex flex-col items-center py-14 gap-3 text-muted-foreground border border-dashed border-border/30 rounded-xl">
                            <Inbox className="size-10 opacity-20" />
                            <p className="text-sm">No positions yet</p>
                        </div>
                    ) : selectedSymbol ? (
                        <SymbolDetail
                            symbol={selectedSymbol}
                            summary={symbolSummaries.find(x => x.symbol === selectedSymbol)!}
                            transactions={transactions}
                            onBack={() => setSelectedSymbol(null)}
                            onDelete={triggerDelete}
                        />
                    ) : (
                        <div className="flex flex-col gap-2.5">
                            {symbolSummaries.map((s) => (
                                <PositionCard key={s.symbol} s={s} onClick={() => setSelectedSymbol(s.symbol)} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* All Trades Tab */}
                <TabsContent value="trades" className="w-full mt-0">
                    {transactions.length === 0 ? (
                        <div className="flex flex-col items-center py-14 gap-3 text-muted-foreground border border-dashed border-border/30 rounded-xl">
                            <Inbox className="size-10 opacity-20" />
                            <p className="text-sm">No trades recorded yet</p>
                        </div>
                    ) : (
                        <div className="border border-border/30 rounded-xl bg-card/60 overflow-hidden">
                            {[...transactions]
                                .sort((a, b) => {
                                    const d = b.transaction_date.localeCompare(a.transaction_date);
                                    return d !== 0 ? d : (b.created_at ?? '').localeCompare(a.created_at ?? '');
                                })
                                .map(tx => <TradeRow key={tx.id} tx={tx} onDelete={triggerDelete} />)
                            }
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Delete confirm */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent className="bg-card border-border/50">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border/40">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-rose-500/80 hover:bg-rose-500 text-white border-rose-500/30"
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

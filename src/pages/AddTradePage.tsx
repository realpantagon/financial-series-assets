import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Code2, ChevronLeft, ChevronRight, Copy, Check, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, getErrorMessage } from '@/lib/utils';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

function fmt(value: number | null | undefined, digits = 2): string {
    if (value == null) return '—';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4) });
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

// ─── Payload builder → dime_trades schema ────────────────────────────────────

function buildDimePayload(p: Record<string, unknown>) {
    const execPrice = Number(p.executed_price);
    const totalFees = ['commission', 'vat', 'fee', 'sec_fee', 'taf_fee']
        .reduce((s, k) => s + (p[k] != null ? Math.abs(Number(p[k])) : 0), 0);

    let qty: number, gross_usd: number, net_usd: number;

    if (p.side === 'BUY') {
        const inputAmount = Number(p.input_amount_usd);
        gross_usd = inputAmount - totalFees;   // pure stock value = qty * price
        qty = gross_usd / execPrice;
        net_usd = inputAmount;                 // total cash deployed
    } else {
        qty = Number(p.input_shares);
        gross_usd = qty * execPrice;
        net_usd = gross_usd - totalFees;       // cash received after fees
    }

    const tradeDate = new Date(p.transaction_date as string).toISOString().slice(0, 10);

    return {
        order_no: null,
        trade_date: tradeDate,
        side: p.side,
        symbol: String(p.symbol).toUpperCase().trim(),
        market: null,
        asset_class: 'STOCK',
        qty,
        qty_unit: 'SHARES',
        price: execPrice,
        currency: 'USD',
        gross_usd,
        fee_usd: totalFees > 0 ? totalFees : null,
        wht_usd: null,
        net_usd,
        gross_thb: null,
        fee_thb: null,
        wht_thb: null,
        net_thb: null,
        source: 'app',
    };
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AddTradePage() {
    const navigate = useNavigate();
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [showJsonPanel, setShowJsonPanel] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [jsonSuccess, setJsonSuccess] = useState(false);
    const [batchPreview, setBatchPreview] = useState<Record<string, unknown>[] | null>(null);
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
            try { document.execCommand('copy'); setCopiedPrompt(true); setTimeout(() => setCopiedPrompt(false), 2000); } catch { /* clipboard not available */ }
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
            raw = raw.replace(/[‘’‚‛′‵“”„‟″‶]/g, '"');
            const arrMatch = raw.match(/\[[\s\S]*\]/);
            const objMatch = raw.match(/\{[\s\S]*\}/);
            if (arrMatch) {
                const arr = JSON.parse(arrMatch[0]);
                if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
                arr.forEach((item: Record<string, unknown>, i: number) => {
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
                const gf = (v: unknown) => (v == null || Number(v) === 0) ? '' : String(Math.abs(Number(v)));
                nf.commission = gf(parsed.commission); nf.vat = gf(parsed.vat);
                nf.fee = gf(parsed.fee); nf.sec_fee = gf(parsed.sec_fee); nf.taf_fee = gf(parsed.taf_fee);
                setForm(nf); setJsonSuccess(true); setJsonInput('');
                setTimeout(() => { setShowJsonPanel(false); setJsonSuccess(false); }, 1200);
                return;
            }
            throw new Error('No JSON found');
        } catch (e) { setJsonError(getErrorMessage(e) || 'Could not parse JSON'); }
    };

    const handleBatchSave = async () => {
        if (!batchPreview) return;
        setBatchError(null); setBatchSaving(true);
        try {
            const { error } = await supabase.from('dime_trades').insert(batchPreview.map(buildDimePayload));
            if (error) throw error;
            toast.success(`${batchPreview.length} transactions imported`);
            navigate(-1);
        } catch (err) { setBatchError(getErrorMessage(err)); }
        finally { setBatchSaving(false); }
    };

    const handleSave = async () => {
        setSaveError(null);
        if (!form.symbol.trim() || !form.executed_price || !form.transaction_date) { setSaveError('Symbol, date, and price required.'); return; }
        if (form.side === 'BUY' && !form.input_amount_usd) { setSaveError('Input Amount required for BUY.'); return; }
        if (form.side === 'SELL' && !form.input_shares) { setSaveError('Shares required for SELL.'); return; }

        try {
            setSaving(true);
            const payload = buildDimePayload({
                side: form.side,
                transaction_date: form.transaction_date,
                symbol: form.symbol,
                executed_price: form.executed_price,
                input_amount_usd: form.input_amount_usd || null,
                input_shares: form.input_shares || null,
                commission: form.commission || null,
                vat: form.vat || null,
                fee: form.fee || null,
                sec_fee: form.sec_fee || null,
                taf_fee: form.taf_fee || null,
            });
            const { error } = await supabase.from('dime_trades').insert([payload]);
            if (error) throw error;
            toast.success(`${form.side} recorded — ${form.symbol.toUpperCase()}`);
            navigate(-1);
        } catch (err) { setSaveError(getErrorMessage(err)); }
        finally { setSaving(false); }
    };

    const isBuy = form.side === 'BUY';

    return (
        <div className="pt-4 pb-24">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-cyan-400 transition-colors mb-4 tracking-[0.1em]"
            >
                <ChevronLeft className="size-3.5" />
                BACK
            </button>

            <div className="border border-border/30 bg-card flex flex-col gap-0 overflow-visible">
                <div className="px-4 py-4 flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.16em]">New Trade</span>
                </div>

                <div className="flex flex-col gap-5 px-4 pb-0">
                    {/* BUY / SELL toggle */}
                    <div className="grid grid-cols-2 gap-0 border border-border/30">
                        {(['BUY', 'SELL'] as Side[]).map((s) => (
                            <button
                                key={s}
                                onClick={() => setForm(prev => ({ ...prev, side: s }))}
                                className={cn(
                                    'py-3 px-3 text-xs font-bold tracking-[0.1em] transition-all',
                                    form.side === s
                                        ? s === 'BUY'
                                            ? 'bg-cyan-500/12 text-cyan-300 border-r border-border/20 last:border-r-0'
                                            : 'bg-emerald-500/12 text-emerald-300 border-r border-border/20 last:border-r-0'
                                        : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/3 border-r border-border/20 last:border-r-0'
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* AI OCR Panel */}
                    <div className="border border-dashed border-amber-500/30 rounded-none bg-amber-500/5 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => { setShowJsonPanel(!showJsonPanel); setJsonError(null); }}
                            className="w-full flex items-center justify-between px-3 py-3 text-amber-500 hover:bg-amber-500/10 transition-colors"
                        >
                            <span className="flex items-center gap-2 text-[10px] font-bold tracking-[0.1em]">
                                <Code2 className="size-3.5" />
                                AI OCR FILL
                            </span>
                            {showJsonPanel ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </button>

                        {showJsonPanel && (
                            <div className="px-3 pb-3 flex flex-col gap-3 mt-1">
                                <Button size="sm" onClick={handleCopyPrompt} className="bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold h-9 tracking-[0.1em] rounded-none">
                                    {copiedPrompt ? <span className="flex items-center gap-2"><Check className="size-3.5" /> COPIED</span> : <span className="flex items-center gap-2"><Copy className="size-3.5" /> COPY AI PROMPT</span>}
                                </Button>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => { setJsonInput(e.target.value); setJsonError(null); setBatchPreview(null); }}
                                    placeholder="Paste JSON from AI here…"
                                    rows={5}
                                    autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                                    className="w-full border border-amber-500/30 bg-black/40 rounded-none px-3 py-3 text-sm text-foreground font-mono resize-none focus:outline-none focus:border-amber-400/60"
                                />
                                {jsonError && <p className="text-[10px] text-rose-400 bg-rose-500/10 px-3 py-2 border border-rose-500/20">{jsonError}</p>}
                                {jsonSuccess && !batchPreview && <p className="text-[10px] text-emerald-400 bg-emerald-500/10 px-3 py-2 border border-emerald-500/20 flex items-center gap-2"><Check className="size-3" /> Fields filled successfully!</p>}

                                {batchPreview && (
                                    <div className="flex flex-col gap-2 bg-black/20 p-2 border border-amber-500/20">
                                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{batchPreview.length} items ready:</p>
                                        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                                            {batchPreview.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between bg-black/40 border border-border/20 px-2 py-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <SidePill side={String(item.side)} />
                                                        <span className="text-sm font-mono font-black">{String(item.symbol).toUpperCase()}</span>
                                                        <span className="text-[10px] text-muted-foreground">{item.side === 'BUY' ? `$${Number(item.input_amount_usd).toFixed(2)}` : `${Number(item.input_shares)} sh`}</span>
                                                    </div>
                                                    <span className="text-[10px] font-mono font-bold text-foreground/70">@ ${Number(item.executed_price).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {batchError && <p className="text-[10px] text-rose-400 mt-1">{batchError}</p>}
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="outline" size="sm" onClick={() => setBatchPreview(null)} className="flex-1 border-border/30 text-[10px] tracking-wider font-bold h-9 bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 rounded-none">CANCEL</Button>
                                            <Button size="sm" onClick={handleBatchSave} disabled={batchSaving} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-[10px] tracking-wider font-bold h-9 rounded-none">
                                                {batchSaving ? <span className="flex items-center"><Loader2 className="size-3.5 animate-spin mr-1.5" /> SAVING…</span> : <span className="flex items-center"><Upload className="size-3.5 mr-1.5" /> IMPORT {batchPreview.length}</span>}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {!batchPreview && (
                                    <Button size="sm" onClick={applyJson} disabled={!jsonInput.trim()} className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-[10px] font-bold h-9 tracking-[0.1em] rounded-none border border-amber-500/30">
                                        APPLY JSON TO FORM
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Core fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Symbol *</label>
                            <Input
                                value={form.symbol}
                                onChange={(e) => setForm(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                                placeholder="AAPL"
                                className="h-10 font-mono font-black text-base uppercase rounded-none border-border/30 bg-black/20 focus-visible:border-cyan-500/40 focus-visible:ring-cyan-500/10"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Date *</label>
                            <Input
                                type="datetime-local"
                                value={form.transaction_date}
                                onChange={(e) => setForm(prev => ({ ...prev, transaction_date: e.target.value }))}
                                className="h-10 text-xs rounded-none border-border/30 bg-black/20 focus-visible:border-cyan-500/40"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Executed Price *</label>
                        <Input
                            type="number"
                            value={form.executed_price}
                            onChange={(e) => setForm(prev => ({ ...prev, executed_price: e.target.value }))}
                            placeholder="0.0000"
                            step="0.0001"
                            className="h-10 font-mono font-bold text-sm rounded-none border-border/30 bg-black/20 focus-visible:border-cyan-500/40"
                        />
                    </div>

                    {isBuy ? (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-cyan-400 uppercase tracking-[0.14em]">Total USD to Invest *</label>
                            <Input
                                type="number"
                                value={form.input_amount_usd}
                                onChange={(e) => setForm(prev => ({ ...prev, input_amount_usd: e.target.value }))}
                                placeholder="1000.00"
                                step="0.01"
                                className="h-11 font-mono font-bold text-base rounded-none border-cyan-500/30 bg-cyan-500/5 focus-visible:border-cyan-400/50"
                            />
                            {form.input_amount_usd && form.executed_price && (
                                <p className="text-[10px] font-mono font-bold text-cyan-400 mt-0.5">
                                    ≈ {(parseFloat(form.input_amount_usd) / parseFloat(form.executed_price)).toFixed(8)} sh
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-[0.14em]">Shares to Sell *</label>
                            <Input
                                type="number"
                                value={form.input_shares}
                                onChange={(e) => setForm(prev => ({ ...prev, input_shares: e.target.value }))}
                                placeholder="0.00000000"
                                step="0.00000001"
                                className="h-11 font-mono font-bold text-base rounded-none border-emerald-500/30 bg-emerald-500/5 focus-visible:border-emerald-400/50"
                            />
                            {form.input_shares && form.executed_price && (
                                <p className="text-[10px] font-mono font-bold text-emerald-400 mt-0.5">
                                    ≈ {fmt(parseFloat(form.input_shares) * parseFloat(form.executed_price))} gross
                                </p>
                            )}
                        </div>
                    )}

                    {/* Fees */}
                    <div className="pt-2 border-t border-border/20">
                        <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em] mb-3">Fees (optional)</p>
                        <div className="grid grid-cols-2 gap-3">
                            {([['commission', 'Commission'], ['vat', 'VAT'], ['fee', 'Fee'], ['sec_fee', 'SEC Fee'], ['taf_fee', 'TAF Fee']] as const).map(([key, label]) => (
                                <div key={key} className="flex flex-col gap-1.5">
                                    <label className="text-[9px] text-muted-foreground/70 uppercase tracking-widest">{label}</label>
                                    <Input
                                        type="number"
                                        value={form[key]}
                                        onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="0.00"
                                        step="0.000001"
                                        className="h-9 text-xs font-mono rounded-none border-border/20 bg-black/20"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer confirm */}
                <div className="mt-6 mb-0">
                    {saveError && (
                        <div className="bg-rose-500/10 border-t border-rose-500/20 px-4 py-3">
                            <p className="text-[10px] text-rose-400 font-bold">{saveError}</p>
                        </div>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={cn(
                            'w-full h-12 font-bold text-xs tracking-[0.16em] rounded-none border-t border-x-0 border-b-0 transition-all flex items-center justify-center',
                            isBuy
                                ? 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40 hover:border-cyan-400/60'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:border-emerald-400/60'
                        )}
                    >
                        {saving ? <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> SAVING…</span> : `+ CONFIRM ${form.side}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

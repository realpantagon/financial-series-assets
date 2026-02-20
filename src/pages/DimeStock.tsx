import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { DimeTransaction } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = 'BUY' | 'SELL';

interface FormState {
    side: Side;
    transaction_date: string;
    symbol: string;
    executed_price: string;
    // BUY only
    input_amount_usd: string;
    // SELL only
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
    totalStockAmount: number; // net stock_amount (buy stock - sell stock)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUSD(value: number | null | undefined): string {
    if (value == null) return '—';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatDate(dateString: string): string {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
}

// ─── JSON Templates ───────────────────────────────────────────────────────────

const JSON_TEMPLATE_BUY = {
    side: "BUY",
    symbol: "AAPL",
    transaction_date: "2026-02-20T10:30:00Z",
    executed_price: 220.50,
    input_amount_usd: 1000.00,
    commission: 0.99,
    vat: 0.0065,
    fee: null,
    sec_fee: null,
    taf_fee: null
};

const JSON_TEMPLATE_SELL = {
    side: "SELL",
    symbol: "AAPL",
    transaction_date: "2026-02-20T10:30:00Z",
    executed_price: 220.50,
    input_shares: 4.53515,
    commission: 0.99,
    vat: 0.0065,
    fee: null,
    sec_fee: null,
    taf_fee: null
};

const INITIAL_FORM: FormState = {
    side: 'BUY',
    transaction_date: todayISO(),
    symbol: '',
    executed_price: '',
    input_amount_usd: '',
    input_shares: '',
    commission: '',
    vat: '',
    fee: '',
    sec_fee: '',
    taf_fee: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DimeStock() {
    const [transactions, setTransactions] = useState<DimeTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // JSON auto-fill
    const [showJsonPanel, setShowJsonPanel] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [jsonSuccess, setJsonSuccess] = useState(false);
    const [batchPreview, setBatchPreview] = useState<any[] | null>(null);
    const [batchSaving, setBatchSaving] = useState(false);
    const [batchError, setBatchError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'transactions' | 'summary'>('summary');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('dime_transactions')
                .select('*')
                .order('transaction_date', { ascending: false });
            if (error) throw error;
            setTransactions((data as DimeTransaction[]) || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTransactions(); }, []);

    // ── Summary computation ────────────────────────────────────────────────────

    const symbolSummaries: SymbolSummary[] = useMemo(() => {
        const map: Record<string, SymbolSummary> = {};
        transactions.forEach((tx) => {
            const sym = tx.symbol || 'UNKNOWN';
            if (!map[sym]) {
                map[sym] = { symbol: sym, totalBuyAmount: 0, totalSellAmount: 0, totalShares: 0, avgBuyPrice: 0, txCount: 0, latestDate: tx.transaction_date, totalStockAmount: 0 };
            }
            map[sym].txCount++;
            if (tx.transaction_date > map[sym].latestDate) {
                map[sym].latestDate = tx.transaction_date;
            }

            if (tx.side === 'BUY') {
                map[sym].totalBuyAmount += Number(tx.total_amount);
                map[sym].totalShares += Number(tx.shares ?? 0);
                map[sym].totalStockAmount += Number(tx.stock_amount ?? 0);
            } else if (tx.side === 'INIT') {
                // INIT = initial portfolio position: use stock_amount as invested value
                const stockAmt = Number(tx.stock_amount ?? 0);
                map[sym].totalBuyAmount += stockAmt;
                map[sym].totalShares += Number(tx.shares ?? 0);
                map[sym].totalStockAmount += stockAmt;
            } else {
                // SELL
                map[sym].totalSellAmount += Number(tx.total_amount);
                map[sym].totalShares -= Number(tx.shares ?? 0);
                map[sym].totalStockAmount -= Number(tx.stock_amount ?? 0);
            }
        });
        // Compute avg buy price from BUY + INIT
        Object.values(map).forEach((s) => {
            const buys = transactions.filter((t) => t.symbol === s.symbol && (t.side === 'BUY' || t.side === 'INIT'));
            if (buys.length > 0) {
                s.avgBuyPrice = buys.reduce((acc, t) => acc + Number(t.executed_price), 0) / buys.length;
            }
        });
        // Sort by total stock amount (largest position first)
        return Object.values(map).sort((a, b) => b.totalStockAmount - a.totalStockAmount);
    }, [transactions]);

    // INIT: stock_amount = value; BUY: total_amount = cash spent
    const overallBuy = useMemo(() =>
        transactions.filter(t => t.side === 'INIT').reduce((s, t) => s + Number(t.stock_amount ?? 0), 0) +
        transactions.filter(t => t.side === 'BUY').reduce((s, t) => s + Number(t.total_amount), 0)
        , [transactions]);
    const overallSell = useMemo(() => transactions.filter(t => t.side === 'SELL').reduce((s, t) => s + Number(t.total_amount), 0), [transactions]);
    const netPL = useMemo(() => {
        // P&L = only realized gain/loss from actual SELL transactions
        // SELL proceeds minus cost of those sold shares (avg buy price × shares sold)
        return symbolSummaries.reduce((total, s) => {
            if (s.totalSellAmount === 0) return total;
            // Approximate: SELL total - proportional buy cost
            const sellRatio = s.totalShares < 0 ? 1 : (Math.abs(s.totalSellAmount) / (s.totalBuyAmount || 1));
            return total + s.totalSellAmount - (s.totalBuyAmount * Math.min(sellRatio, 1));
        }, 0);
    }, [symbolSummaries]);

    // ── Save transaction ───────────────────────────────────────────────────────

    const handleSave = async () => {
        setSaveError(null);
        if (!form.symbol.trim() || !form.executed_price || !form.transaction_date) {
            setSaveError('Symbol, date, and executed price are required.');
            return;
        }
        if (form.side === 'BUY' && !form.input_amount_usd) {
            setSaveError('Input Amount (USD) is required for BUY.');
            return;
        }
        if (form.side === 'SELL' && !form.input_shares) {
            setSaveError('Shares are required for SELL.');
            return;
        }

        const execPrice = parseFloat(form.executed_price);
        const commission = form.commission ? parseFloat(form.commission) : null;
        const vat = form.vat ? parseFloat(form.vat) : null;
        const fee = form.fee ? parseFloat(form.fee) : null;
        const sec_fee = form.sec_fee ? parseFloat(form.sec_fee) : null;
        const taf_fee = form.taf_fee ? parseFloat(form.taf_fee) : null;

        let shares: number | null = null;
        let total_amount: number;
        let input_amount_usd: number | null = null;
        let input_shares: number | null = null;

        if (form.side === 'BUY') {
            input_amount_usd = parseFloat(form.input_amount_usd);
            const totalFees = (commission ?? 0) + (vat ?? 0) + (fee ?? 0) + (sec_fee ?? 0) + (taf_fee ?? 0);
            // input_amount_usd is the TOTAL spend (fees already included)
            // stock_amount = money going to actual stock purchase (after fees deducted)
            const stockAmt = input_amount_usd - totalFees;
            shares = stockAmt / execPrice;
            total_amount = input_amount_usd; // total money out of pocket
        } else {
            input_shares = parseFloat(form.input_shares);
            shares = input_shares;
            const stockAmount = input_shares * execPrice;
            const totalFees = (commission ?? 0) + (vat ?? 0) + (fee ?? 0) + (sec_fee ?? 0) + (taf_fee ?? 0);
            total_amount = stockAmount - totalFees; // net proceeds after fees
        }

        const payload = {
            side: form.side,
            transaction_date: new Date(form.transaction_date).toISOString(),
            symbol: form.symbol.toUpperCase().trim(),
            shares,
            total_amount,
            executed_price: execPrice,
            commission,
            vat,
            fee,
            sec_fee,
            taf_fee,
            input_amount_usd: form.side === 'BUY' ? input_amount_usd : null,
            input_shares: form.side === 'SELL' ? input_shares : null,
            // stock_amount = actual stock purchase value (excluding fees)
            stock_amount: form.side === 'BUY'
                ? (input_amount_usd! - ((commission ?? 0) + (vat ?? 0) + (fee ?? 0) + (sec_fee ?? 0) + (taf_fee ?? 0)))
                : (shares! * execPrice),
            currency: 'USD',
        };

        try {
            setSaving(true);
            const { error } = await supabase.from('dime_transactions').insert([payload]);
            if (error) throw error;
            setShowForm(false);
            setForm(INITIAL_FORM);
            await fetchTransactions();
        } catch (err: any) {
            setSaveError(err.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('dime_transactions').delete().eq('id', id);
            if (error) throw error;
            setDeleteId(null);
            await fetchTransactions();
        } catch (err: any) {
            alert('Delete failed: ' + err.message);
        }
    };

    // ── Build DB payload (shared by single + batch save) ───────────────────────

    const buildPayload = (p: any) => {
        const execPrice = Number(p.executed_price);
        // Always store fees as positive (OCR may return negatives for SELL)
        const commission = p.commission != null ? Math.abs(Number(p.commission)) : null;
        const vat = p.vat != null ? Math.abs(Number(p.vat)) : null;
        const fee = p.fee != null ? Math.abs(Number(p.fee)) : null;
        const sec_fee = p.sec_fee != null ? Math.abs(Number(p.sec_fee)) : null;
        const taf_fee = p.taf_fee != null ? Math.abs(Number(p.taf_fee)) : null;
        const totalFees = (commission ?? 0) + (vat ?? 0) + (fee ?? 0) + (sec_fee ?? 0) + (taf_fee ?? 0);

        let shares: number | null = null;
        let total_amount: number;
        let input_amount_usd: number | null = null;
        let input_shares: number | null = null;
        let stock_amount: number | null = null;

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

        return {
            side: p.side,
            transaction_date: new Date(p.transaction_date).toISOString(),
            symbol: String(p.symbol).toUpperCase().trim(),
            shares,
            total_amount,
            executed_price: execPrice,
            commission,
            vat,
            fee: fee === 0 ? null : fee,
            sec_fee: sec_fee === 0 ? null : sec_fee,
            taf_fee: taf_fee === 0 ? null : taf_fee,
            input_amount_usd: p.side === 'BUY' ? input_amount_usd : null,
            input_shares: p.side === 'SELL' ? input_shares : null,
            stock_amount,
            currency: 'USD',
        };
    };

    // ── JSON Auto-fill ─────────────────────────────────────────────────────────

    const applyJson = () => {
        setJsonError(null);
        setJsonSuccess(false);
        setBatchPreview(null);
        setBatchError(null);
        try {
            let raw = jsonInput.trim();
            // Strip markdown fences
            raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

            // Try array first
            const arrMatch = raw.match(/\[[\s\S]*\]/);
            const objMatch = raw.match(/\{[\s\S]*\}/);

            if (arrMatch) {
                const arr = JSON.parse(arrMatch[0]);
                if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
                // Validate each item minimally
                arr.forEach((item: any, i: number) => {
                    if (!item.side || !item.symbol || !item.executed_price || !item.transaction_date)
                        throw new Error(`Item ${i + 1} missing required fields (side, symbol, executed_price, transaction_date)`);
                    if (item.side === 'BUY' && item.input_amount_usd == null)
                        throw new Error(`Item ${i + 1}: BUY requires input_amount_usd`);
                    if (item.side === 'SELL' && item.input_shares == null)
                        throw new Error(`Item ${i + 1}: SELL requires input_shares`);
                });
                setBatchPreview(arr);
                return;
            }

            if (objMatch) {
                const parsed = JSON.parse(objMatch[0]);
                const newForm: FormState = { ...form };
                if (parsed.side === 'BUY' || parsed.side === 'SELL') newForm.side = parsed.side;
                if (parsed.symbol) newForm.symbol = String(parsed.symbol).toUpperCase().trim();
                if (parsed.transaction_date) {
                    const d = new Date(parsed.transaction_date);
                    if (!isNaN(d.getTime())) newForm.transaction_date = d.toISOString().slice(0, 16);
                }
                if (parsed.executed_price != null) newForm.executed_price = String(Math.abs(Number(parsed.executed_price)));
                if (parsed.input_amount_usd != null) newForm.input_amount_usd = String(parsed.input_amount_usd);
                if (parsed.input_shares != null) newForm.input_shares = String(parsed.input_shares);
                if (parsed.commission != null) newForm.commission = String(Math.abs(Number(parsed.commission)));
                if (parsed.vat != null) newForm.vat = String(Math.abs(Number(parsed.vat)));
                if (parsed.fee != null) newForm.fee = String(Math.abs(Number(parsed.fee)));
                if (parsed.sec_fee != null) newForm.sec_fee = String(Math.abs(Number(parsed.sec_fee)));
                if (parsed.taf_fee != null) newForm.taf_fee = String(Math.abs(Number(parsed.taf_fee)));
                setForm(newForm);
                setJsonSuccess(true);
                setJsonInput('');
                setTimeout(() => { setShowJsonPanel(false); setJsonSuccess(false); }, 1200);
                return;
            }

            throw new Error('No JSON found');
        } catch (e: any) {
            setJsonError(e.message || 'Could not parse JSON — check the format.');
        }
    };

    // ── Batch Save ─────────────────────────────────────────────────────────────

    const handleBatchSave = async () => {
        if (!batchPreview) return;
        setBatchError(null);
        setBatchSaving(true);
        try {
            const payloads = batchPreview.map(buildPayload);
            const { error } = await supabase.from('dime_transactions').insert(payloads);
            if (error) throw error;
            setBatchPreview(null);
            setJsonInput('');
            setShowJsonPanel(false);
            setJsonSuccess(true);
            setTimeout(() => setJsonSuccess(false), 2000);
            await fetchTransactions();
        } catch (err: any) {
            setBatchError(err.message);
        } finally {
            setBatchSaving(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    if (loading) return (
        <div className="flex justify-center items-center min-h-[60vh] text-gray-400 text-sm gap-2">
            <i className="pi pi-spin pi-spinner" />
            Loading transactions...
        </div>
    );

    if (error) return (
        <div className="flex justify-center items-center min-h-[60vh] text-red-500 text-sm">{error}</div>
    );

    return (
        <div className="flex flex-col gap-4 pb-28 pt-2 px-1">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[#001f3f]">Dime Stocks</h1>
                    <span className="text-xs text-gray-400">{transactions.length} transactions</span>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setSaveError(null); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm
            ${showForm ? 'bg-gray-100 text-gray-600' : 'bg-[#001f3f] text-white hover:bg-[#002f5f]'}`}
                >
                    <i className={`pi ${showForm ? 'pi-times' : 'pi-plus'} text-xs`} />
                    {showForm ? 'Cancel' : 'Add Trade'}
                </button>
            </div>

            {/* Portfolio Value — full-width hero card */}
            <div className="bg-[#001f3f] rounded-2xl p-4 text-white flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-0.5">Total Invested in Stocks</p>
                    <p className="text-2xl font-bold">{formatUSD(overallBuy)}</p>
                    <p className="text-[10px] text-blue-400 mt-0.5">{symbolSummaries.length} symbol{symbolSummaries.length !== 1 ? 's' : ''} • {transactions.filter(t => t.side === 'INIT').length} init + {transactions.filter(t => t.side === 'BUY').length} buys</p>
                </div>
                <i className="pi pi-chart-line text-3xl text-blue-400 opacity-60" />
            </div>
            {/* ── Overview Cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">Total Bought</p>
                    <p className="text-sm font-bold text-blue-700">{formatUSD(overallBuy)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                    <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-0.5">Total Sold</p>
                    <p className="text-sm font-bold text-green-700">{formatUSD(overallSell)}</p>
                </div>
                <div className={`rounded-xl p-3 border ${netPL >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${netPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Net P&amp;L</p>
                    <p className={`text-sm font-bold ${netPL >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatUSD(netPL)}</p>
                </div>
            </div>

            {/* ── Add Form ────────────────────────────────────────────────────── */}
            {showForm && (
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                    <h2 className="font-bold text-[#001f3f] text-base">New Transaction</h2>

                    {/* Side Toggle */}
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                        {(['BUY', 'SELL'] as Side[]).map((s) => (
                            <button
                                key={s}
                                onClick={() => setForm({ ...form, side: s })}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${form.side === s
                                        ? s === 'BUY' ? 'bg-blue-600 text-white shadow-sm' : 'bg-green-600 text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-gray-200'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* ── JSON Auto-fill Panel ──────────────────────────────── */}
                    <div className="border border-dashed border-amber-300 rounded-xl bg-amber-50/60 overflow-hidden">
                        {/* Toggle header */}
                        <button
                            type="button"
                            onClick={() => { setShowJsonPanel(!showJsonPanel); setJsonError(null); setJsonSuccess(false); }}
                            className="w-full flex items-center justify-between px-3 py-2 text-amber-700 hover:bg-amber-100/50 transition-colors"
                        >
                            <span className="flex items-center gap-1.5 text-xs font-semibold">
                                <i className="pi pi-code text-[11px]" />
                                Fill from JSON (AI OCR)
                            </span>
                            <i className={`pi ${showJsonPanel ? 'pi-chevron-up' : 'pi-chevron-down'} text-[10px] text-amber-500`} />
                        </button>

                        {showJsonPanel && (
                            <div className="px-3 pb-3 flex flex-col gap-2">
                                {/* Template */}
                                <div className="relative">
                                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Template ({form.side})</p>
                                    <pre className="bg-white border border-amber-200 rounded-lg p-2 text-[10px] text-gray-600 leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                                        {JSON.stringify(
                                            form.side === 'BUY' ? JSON_TEMPLATE_BUY : JSON_TEMPLATE_SELL,
                                            null, 2
                                        )}
                                    </pre>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const tpl = form.side === 'BUY' ? JSON_TEMPLATE_BUY : JSON_TEMPLATE_SELL;
                                            navigator.clipboard.writeText(JSON.stringify(tpl, null, 2));
                                        }}
                                        className="absolute top-5 right-1 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded-md font-medium transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>

                                {/* Paste area */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                                        Paste OCR JSON here — single object OR array
                                    </label>
                                    <textarea
                                        value={jsonInput}
                                        onChange={(e) => { setJsonInput(e.target.value); setJsonError(null); setBatchPreview(null); setJsonSuccess(false); }}
                                        placeholder={`{ ... }  or  [ { ... }, { ... } ]`}
                                        rows={5}
                                        className="border border-amber-200 bg-white rounded-lg px-3 py-2 text-xs text-gray-700 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
                                    />
                                </div>

                                {jsonError && (
                                    <p className="text-[11px] text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">{jsonError}</p>
                                )}
                                {jsonSuccess && !batchPreview && (
                                    <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                                        <i className="pi pi-check-circle" /> Fields filled successfully!
                                    </p>
                                )}

                                {/* Batch preview */}
                                {batchPreview && (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                                            {batchPreview.length} transactions ready to import:
                                        </p>
                                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                                            {batchPreview.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg px-2.5 py-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.side === 'BUY' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                                            }`}>{item.side}</span>
                                                        <span className="text-xs font-bold text-[#001f3f]">{String(item.symbol).toUpperCase()}</span>
                                                        <span className="text-[10px] text-gray-400">
                                                            {item.side === 'BUY'
                                                                ? `$${Number(item.input_amount_usd).toFixed(2)}`
                                                                : `${Number(item.input_shares)} sh`}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400">@${Number(item.executed_price).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {batchError && (
                                            <p className="text-[11px] text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">{batchError}</p>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setBatchPreview(null)}
                                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleBatchSave}
                                                disabled={batchSaving}
                                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-sm disabled:opacity-50"
                                            >
                                                {batchSaving
                                                    ? <><i className="pi pi-spin pi-spinner mr-1" />Saving...</>
                                                    : <><i className="pi pi-cloud-upload mr-1" />Import All {batchPreview.length}</>}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!batchPreview && (
                                    <button
                                        type="button"
                                        onClick={applyJson}
                                        disabled={!jsonInput.trim()}
                                        className="w-full py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <i className="pi pi-bolt mr-1.5" />
                                        Apply JSON to Form
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Row: Symbol + Date */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Symbol *</label>
                            <input
                                type="text"
                                value={form.symbol}
                                onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                                placeholder="AAPL"
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-[#001f3f] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 uppercase"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date *</label>
                            <input
                                type="datetime-local"
                                value={form.transaction_date}
                                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#001f3f] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20"
                            />
                        </div>
                    </div>

                    {/* Executed Price */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Executed Price (USD) *</label>
                        <input
                            type="number"
                            value={form.executed_price}
                            onChange={(e) => setForm({ ...form, executed_price: e.target.value })}
                            placeholder="0.00"
                            step="0.0001"
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#001f3f] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20"
                        />
                    </div>

                    {/* BUY: input_amount_usd | SELL: input_shares */}
                    {form.side === 'BUY' ? (
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Input Amount USD *</label>
                            <input
                                type="number"
                                value={form.input_amount_usd}
                                onChange={(e) => setForm({ ...form, input_amount_usd: e.target.value })}
                                placeholder="1000.00"
                                step="0.000001"
                                className="border border-blue-200 bg-blue-50/50 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            {form.input_amount_usd && form.executed_price && (
                                <p className="text-[10px] text-blue-500 pl-1">
                                    ≈ {(parseFloat(form.input_amount_usd) / parseFloat(form.executed_price)).toFixed(8)} shares
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-green-500 uppercase tracking-wider">Shares to Sell *</label>
                            <input
                                type="number"
                                value={form.input_shares}
                                onChange={(e) => setForm({ ...form, input_shares: e.target.value })}
                                placeholder="0.00000000"
                                step="0.00000001"
                                className="border border-green-200 bg-green-50/50 rounded-lg px-3 py-2 text-sm text-green-900 focus:outline-none focus:ring-2 focus:ring-green-300"
                            />
                            {form.input_shares && form.executed_price && (
                                <p className="text-[10px] text-green-600 pl-1">
                                    ≈ {formatUSD(parseFloat(form.input_shares) * parseFloat(form.executed_price))} gross
                                </p>
                            )}
                        </div>
                    )}

                    {/* Fees */}
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Fees (optional)</p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { key: 'commission', label: 'Commission' },
                                { key: 'vat', label: 'VAT' },
                                { key: 'fee', label: 'Fee' },
                                { key: 'sec_fee', label: 'SEC Fee' },
                                { key: 'taf_fee', label: 'TAF Fee' },
                            ].map(({ key, label }) => (
                                <div key={key} className="flex flex-col gap-1">
                                    <label className="text-[10px] text-gray-400 font-medium">{label}</label>
                                    <input
                                        type="number"
                                        value={(form as any)[key]}
                                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                        placeholder="0.00"
                                        step="0.000001"
                                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {saveError && (
                        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm
              ${form.side === 'BUY' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {saving ? <><i className="pi pi-spin pi-spinner mr-2" />Saving...</> : `Confirm ${form.side}`}
                    </button>
                </div>
            )}

            {/* ── Tab Switcher ────────────────────────────────────────────────── */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                {(['transactions', 'summary'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all
              ${activeTab === tab ? 'bg-white text-[#001f3f] shadow-sm' : 'text-gray-500'}`}
                    >
                        {tab === 'transactions' ? `Transactions (${transactions.length})` : `By Symbol (${symbolSummaries.length})`}
                    </button>
                ))}
            </div>

            {/* ── Transactions Tab ────────────────────────────────────────────── */}
            {activeTab === 'transactions' && (
                <div className="flex flex-col gap-2">
                    {transactions.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <i className="pi pi-inbox text-3xl mb-2 opacity-40 block" />
                            <p className="text-sm">No stock transactions yet</p>
                            <p className="text-xs mt-1 opacity-60">Tap "Add Trade" to get started</p>
                        </div>
                    ) : (
                        transactions.map((tx) => (
                            <div
                                key={tx.id}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative"
                            >
                                {/* Side accent bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${tx.side === 'BUY' ? 'bg-blue-500' : 'bg-green-500'}`} />

                                <div className="pl-4 pr-3 pt-3 pb-3">
                                    {/* Top row */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-base font-bold text-[#001f3f]">{tx.symbol || '—'}</span>
                                            <span className="text-[10px] text-gray-400 ml-2">{formatDate(tx.transaction_date)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase
                        ${tx.side === 'BUY' ? 'bg-blue-50 text-blue-600' : tx.side === 'INIT' ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'}`}>
                                                {tx.side}
                                            </span>
                                            <button
                                                onClick={() => setDeleteId(tx.id)}
                                                className="text-gray-300 hover:text-red-400 transition-colors"
                                            >
                                                <i className="pi pi-trash text-xs" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Badge detail row */}
                                    <div className="flex justify-between items-end mt-2">
                                        <div className="flex flex-wrap gap-1">
                                            {tx.shares != null && (
                                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                    <i className="pi pi-chart-bar text-[8px]" />
                                                    {Number(tx.shares).toFixed(7)} sh
                                                </span>
                                            )}
                                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                @ {formatUSD(tx.executed_price)}
                                            </span>
                                            {tx.stock_amount != null && Number(tx.stock_amount) > 0 && (
                                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                    Stock {formatUSD(tx.stock_amount)}
                                                </span>
                                            )}
                                            {Number(tx.commission) > 0 && (
                                                <span className="inline-flex items-center bg-orange-50 text-orange-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">Fee {formatUSD(tx.commission)}</span>
                                            )}
                                            {Number(tx.vat) > 0 && (
                                                <span className="inline-flex items-center bg-orange-50 text-orange-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">VAT {formatUSD(tx.vat)}</span>
                                            )}
                                            {Number(tx.sec_fee) > 0 && (
                                                <span className="inline-flex items-center bg-orange-50 text-orange-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">SEC {formatUSD(tx.sec_fee)}</span>
                                            )}
                                            {Number(tx.taf_fee) > 0 && (
                                                <span className="inline-flex items-center bg-orange-50 text-orange-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">TAF {formatUSD(tx.taf_fee)}</span>
                                            )}
                                        </div>
                                        <span className="font-bold text-gray-900 text-base shrink-0 ml-2">{formatUSD(tx.total_amount)}</span>
                                    </div>
                                </div>

                                {/* Delete confirm */}
                                {deleteId === tx.id && (
                                    <div className="bg-red-50 border-t border-red-100 px-4 py-2.5 flex items-center justify-between">
                                        <span className="text-xs text-red-600 font-medium">Delete this transaction?</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 px-2 py-1 hover:bg-gray-100 rounded">Cancel</button>
                                            <button onClick={() => handleDelete(tx.id)} className="text-xs text-white bg-red-500 px-3 py-1 rounded-lg font-semibold">Confirm</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Summary Tab ─────────────────────────────────────────────────── */}
            {activeTab === 'summary' && (
                <div className="flex flex-col gap-2">
                    {symbolSummaries.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <i className="pi pi-chart-bar text-3xl mb-2 opacity-40 block" />
                            <p className="text-sm">No data to summarize</p>
                        </div>
                    ) : selectedSymbol ? (
                        /* ── Symbol Detail View ───────────────────────────── */
                        (() => {
                            const s = symbolSummaries.find(x => x.symbol === selectedSymbol)!;
                            const symTxs = transactions
                                .filter(t => (t.symbol || 'UNKNOWN') === selectedSymbol)
                                .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
                            const realized = s.totalSellAmount > 0 ? s.totalSellAmount - s.totalBuyAmount : 0;
                            return (
                                <div className="flex flex-col gap-3">
                                    {/* Back header */}
                                    <button
                                        onClick={() => setSelectedSymbol(null)}
                                        className="flex items-center gap-2 text-[#001f3f] text-sm font-semibold hover:opacity-70 transition-opacity self-start"
                                    >
                                        <i className="pi pi-arrow-left text-xs" />
                                        All Symbols
                                    </button>

                                    {/* Symbol header card — clean redesign */}
                                    <div className="bg-[#001f3f] rounded-2xl p-4 text-white">
                                        {/* Top row: symbol + P&L */}
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h2 className="text-2xl font-bold tracking-tight">{selectedSymbol}</h2>
                                                <p className="text-xs text-blue-300 mt-0.5">{s.txCount} trade{s.txCount !== 1 ? 's' : ''}</p>
                                            </div>
                                            {realized !== 0 && (
                                                <div className="text-right">
                                                    <p className="text-[10px] text-blue-400 uppercase tracking-wider">Net P&L</p>
                                                    <p className={`text-lg font-bold ${realized >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                                        {realized >= 0 ? '+' : ''}{formatUSD(realized)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Hero: stock value */}
                                        <div className="mt-3 mb-3">
                                            <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-0.5">Stock Amount</p>
                                            <p className="text-3xl font-bold">{formatUSD(s.totalBuyAmount)}</p>
                                        </div>

                                        {/* Key metrics row */}
                                        <div className="flex gap-4 text-[11px] border-t border-white/10 pt-3">
                                            <div>
                                                <p className="text-blue-400 mb-0.5">Shares</p>
                                                <p className="font-semibold">{s.totalShares.toFixed(7)}</p>
                                            </div>
                                            <div>
                                                <p className="text-blue-400 mb-0.5">Avg Buy</p>
                                                <p className="font-semibold">{formatUSD(s.avgBuyPrice)}</p>
                                            </div>
                                            {s.totalSellAmount > 0 && (
                                                <div>
                                                    <p className="text-blue-400 mb-0.5">Sold</p>
                                                    <p className="font-semibold text-emerald-300">{formatUSD(s.totalSellAmount)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Transaction list for symbol */}
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Transactions</p>
                                    {symTxs.map((tx) => (
                                        <div
                                            key={tx.id}
                                            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative"
                                        >
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${tx.side === 'BUY' ? 'bg-blue-500' : tx.side === 'INIT' ? 'bg-purple-400' : 'bg-emerald-500'
                                                }`} />
                                            <div className="pl-4 pr-3 pt-3 pb-3">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <div>
                                                        <span className="text-xs font-semibold text-gray-500">{formatDate(tx.transaction_date)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${tx.side === 'BUY' ? 'bg-blue-50 text-blue-600' : tx.side === 'INIT' ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'
                                                            }`}>{tx.side}</span>
                                                        <button
                                                            onClick={() => setDeleteId(tx.id)}
                                                            className="text-gray-300 hover:text-red-400 transition-colors"
                                                        >
                                                            <i className="pi pi-trash text-xs" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Badge detail row */}
                                                <div className="flex justify-between items-end mt-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {tx.shares != null && (
                                                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                                <i className="pi pi-chart-bar text-[8px]" />
                                                                {Number(tx.shares).toFixed(7)} sh
                                                            </span>
                                                        )}
                                                        <span className="inline-flex items-center bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                            @ {formatUSD(tx.executed_price)}
                                                        </span>
                                                        {tx.stock_amount != null && Number(tx.stock_amount) > 0 && (
                                                            <span className="inline-flex items-center bg-blue-50 text-blue-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                                Stock {formatUSD(tx.stock_amount)}
                                                            </span>
                                                        )}
                                                        {Number(tx.commission) > 0 && (
                                                            <span className="inline-flex items-center bg-orange-50 text-orange-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">Fee {formatUSD(tx.commission)}</span>
                                                        )}
                                                        {Number(tx.vat) > 0 && (
                                                            <span className="inline-flex items-center bg-orange-50 text-orange-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">VAT {formatUSD(tx.vat)}</span>
                                                        )}
                                                        {Number(tx.sec_fee) > 0 && (
                                                            <span className="inline-flex items-center bg-orange-50 text-orange-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">SEC {formatUSD(tx.sec_fee)}</span>
                                                        )}
                                                        {Number(tx.taf_fee) > 0 && (
                                                            <span className="inline-flex items-center bg-orange-50 text-orange-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">TAF {formatUSD(tx.taf_fee)}</span>
                                                        )}
                                                    </div>
                                                    {/* Amount: INIT shows stock_amount, others show total_amount */}
                                                    <span className="font-bold text-gray-900 shrink-0 ml-2">
                                                        {tx.side === 'INIT'
                                                            ? formatUSD(tx.stock_amount)
                                                            : formatUSD(tx.total_amount)}
                                                    </span>
                                                </div>
                                            </div>
                                            {deleteId === tx.id && (
                                                <div className="bg-red-50 border-t border-red-100 px-4 py-2.5 flex items-center justify-between">
                                                    <span className="text-xs text-red-600 font-medium">Delete this transaction?</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 px-2 py-1 hover:bg-gray-100 rounded">Cancel</button>
                                                        <button onClick={() => handleDelete(tx.id)} className="text-xs text-white bg-red-500 px-3 py-1 rounded-lg font-semibold">Confirm</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    ) : (
                        /* ── Symbol List ──────────────────────────────────── */
                        symbolSummaries.map((s) => {
                            const realized = s.totalSellAmount > 0 ? s.totalSellAmount - s.totalBuyAmount : 0;
                            return (
                                <button
                                    key={s.symbol}
                                    onClick={() => setSelectedSymbol(s.symbol)}
                                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left w-full hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.99]"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className="text-base font-bold text-[#001f3f]">{s.symbol}</span>
                                            <span className="text-[10px] text-gray-400 ml-2">{s.txCount} trade{s.txCount !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-bold ${realized >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {realized >= 0 ? '+' : ''}{formatUSD(realized)}
                                            </span>
                                            <i className="pi pi-chevron-right text-[10px] text-gray-300" />
                                        </div>
                                    </div>

                                    {/* Main stock amount */}
                                    <div className="bg-blue-50 rounded-xl p-3 mb-2">
                                        <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-0.5">Stock Amount</p>
                                        <p className="text-lg font-bold text-blue-700">{formatUSD(s.totalBuyAmount)}</p>
                                        {s.totalShares > 0 && (
                                            <p className="text-[10px] text-blue-400 mt-0.5">{s.totalShares.toFixed(7)} shares held</p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                                        <div className="bg-green-50 rounded-lg p-2">
                                            <p className="text-green-400 font-semibold mb-0.5">Sold</p>
                                            <p className="text-green-800 font-bold">{formatUSD(s.totalSellAmount)}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-2">
                                            <p className="text-gray-400 font-semibold mb-0.5">Avg Price</p>
                                            <p className="text-gray-800 font-bold">{formatUSD(s.avgBuyPrice)}</p>
                                        </div>
                                        <div className={`rounded-lg p-2 ${realized >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                            <p className={`font-semibold mb-0.5 ${realized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>P&amp;L</p>
                                            <p className={`font-bold ${realized >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{realized >= 0 ? '+' : ''}{formatUSD(realized)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-300 mt-1.5 pl-0.5">
                                        Latest: {formatDate(s.latestDate)}
                                    </p>

                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

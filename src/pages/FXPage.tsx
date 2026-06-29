import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { FinancialFX } from '../types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn, getErrorMessage } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, X, BarChart2, ArrowRight, Inbox, Loader2 } from 'lucide-react';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function FXPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<FinancialFX[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [form, setForm] = useState({
        transaction_at: new Date().toISOString().slice(0, 16),
        from_currency: '',
        to_currency: 'USD',
        thb_amount: '',
        foreign_amount: '',
        exchange_rate: ''
    });

    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedFromCurrency, setSelectedFromCurrency] = useState<string>('All');
    const [selectedToCurrency, setSelectedToCurrency] = useState<string>('All');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('pantagon_financial_fx')
                .select('*')
                .order('transaction_at', { ascending: false });

            if (error) throw error;
            setData(data || []);

            if (data && data.length > 0) {
                const latestDate = new Date(data[0].transaction_at);
                setSelectedYear(latestDate.getFullYear());
                setSelectedMonth(latestDate.getMonth());
            }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            let finalRate = Number(form.exchange_rate);
            const foreign = Number(form.foreign_amount);
            const thb = Number(form.thb_amount);

            if (!finalRate && foreign > 0 && thb > 0) finalRate = thb / foreign;

            const { error } = await supabase.from('pantagon_financial_fx').insert({
                transaction_at: new Date(form.transaction_at).toISOString(),
                from_currency: form.from_currency,
                to_currency: form.to_currency,
                thb_amount: thb,
                foreign_amount: foreign,
                exchange_rate: finalRate
            });

            if (error) throw error;
            toast.success('FX transaction saved');
            setShowForm(false);
            setForm({ transaction_at: new Date().toISOString().slice(0, 16), from_currency: 'THB', to_currency: 'USD', thb_amount: '', foreign_amount: '', exchange_rate: '' });
            fetchData();
        } catch (err) {
            toast.error('Failed to save', { description: getErrorMessage(err) });
        } finally {
            setFormLoading(false);
        }
    };

    const availableYears = useMemo(() => {
        const years = new Set(data.map(item => new Date(item.transaction_at).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [data]);

    const availableFromCurrencies = useMemo(() =>
        Array.from(new Set(data.map(item => item.from_currency))).sort(), [data]);

    const availableToCurrencies = useMemo(() =>
        Array.from(new Set(data.map(item => item.to_currency))).sort(), [data]);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const date = new Date(item.transaction_at);
            const matchYear = date.getFullYear() === selectedYear;
            const matchMonth = date.getMonth() === selectedMonth;
            const matchFrom = selectedFromCurrency === 'All' || item.from_currency === selectedFromCurrency;
            const matchTo = selectedToCurrency === 'All' || item.to_currency === selectedToCurrency;
            return matchYear && matchMonth && matchFrom && matchTo;
        });
    }, [data, selectedYear, selectedMonth, selectedFromCurrency, selectedToCurrency]);

    const handlePrevMonth = () => {
        if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(prev => prev - 1); }
        else setSelectedMonth(prev => prev - 1);
    };

    const handleNextMonth = () => {
        if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(prev => prev + 1); }
        else setSelectedMonth(prev => prev + 1);
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-4 pt-4 pb-24">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
        );
    }

    if (error) return (
        <div className="p-4 text-center text-destructive text-sm pt-20">Error: {error}</div>
    );

    return (
        <div className="flex flex-col gap-4 pb-24 pt-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="font-black text-lg text-foreground tracking-tighter">FX</h1>
                    <span className="text-[9px] text-muted-foreground/40 font-mono tracking-wider">{data.length} records</span>
                </div>
                <div className="flex gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/fx/analytics')}
                        className="gap-1.5 text-[10px] font-bold border-border/30 bg-transparent hover:bg-slate-100 dark:hover:bg-white/3 tracking-wider h-8 px-3"
                    >
                        <BarChart2 className="size-3" />
                        ANALYTICS
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setShowForm(!showForm)}
                        className={showForm
                            ? 'gap-1.5 text-[10px] font-bold border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15 shadow-none h-8 px-3 tracking-wider'
                            : 'gap-1.5 text-[10px] font-bold border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15 shadow-none h-8 px-3 tracking-wider'
                        }
                    >
                        {showForm ? <X className="size-3" /> : <Plus className="size-3" />}
                        {showForm ? 'CANCEL' : 'ADD FX'}
                    </Button>
                </div>
            </div>

            {/* Add Form */}
            {showForm && (
                <div className="rounded-xl border border-border/25 bg-card p-4 animate-in slide-in-from-top-2 duration-200">
                        <h2 className="text-[9px] uppercase tracking-[0.14em] font-bold text-muted-foreground/40 mb-3">ADD FOREIGN EXCHANGE</h2>
                        <form onSubmit={handleSave} className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">From Currency</label>
                                    <Select
                                        value={form.from_currency}
                                        onValueChange={(val) => setForm(prev => ({
                                            ...prev, from_currency: val,
                                            to_currency: prev.to_currency === val ? '' : prev.to_currency
                                        }))}
                                        required
                                    >
                                        <SelectTrigger className="h-9 text-sm font-semibold uppercase">
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['THB', 'USD', 'FCD', 'SAVE'].map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">To Currency</label>
                                    <Select
                                        value={form.to_currency}
                                        onValueChange={(val) => setForm({ ...form, to_currency: val })}
                                        required
                                    >
                                        <SelectTrigger className="h-9 text-sm font-semibold uppercase">
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['THB', 'USD', 'FCD', 'SAVE']
                                                .filter(c => c !== form.from_currency)
                                                .map(c => (
                                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">THB Amount</label>
                                    <Input type="number" step="0.01" value={form.thb_amount} onChange={(e) => setForm({ ...form, thb_amount: e.target.value })} placeholder="0.00" required className="h-9 text-sm font-semibold" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Foreign Amount</label>
                                    <Input type="number" step="0.000001" value={form.foreign_amount} onChange={(e) => setForm({ ...form, foreign_amount: e.target.value })} placeholder="0.00" required className="h-9 text-sm font-semibold" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rate (optional — auto-calculated)</label>
                                <Input type="number" step="0.000001" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} placeholder="Auto" className="h-9 text-sm font-semibold" />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date & Time</label>
                                <Input type="datetime-local" value={form.transaction_at} onChange={(e) => setForm({ ...form, transaction_at: e.target.value })} required className="h-9 text-sm" />
                            </div>

                            <Button type="submit" disabled={formLoading} className="w-full mt-1">
                                {formLoading ? <><Loader2 className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : 'Save FX Transaction'}
                            </Button>
                        </form>
                </div>
            )}

            {/* Month Selector */}
            {!showForm && (
                <>
                    <div className="flex items-center justify-between bg-card border border-border/20 rounded-xl p-2">
                        <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="size-9">
                            <ChevronLeft className="size-4" />
                        </Button>
                        <div className="text-center">
                            <div className="font-bold text-base text-foreground">{MONTHS[selectedMonth]}</div>
                            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                                <SelectTrigger className="h-5 border-0 p-0 text-xs text-muted-foreground font-medium shadow-none focus:ring-0 w-auto">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleNextMonth} className="size-9">
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-2 gap-2">
                        <Select value={selectedFromCurrency} onValueChange={setSelectedFromCurrency}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">From: All</SelectItem>
                                {availableFromCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={selectedToCurrency} onValueChange={setSelectedToCurrency}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">To: All</SelectItem>
                                {availableToCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Transaction List */}
                    {filteredData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground/30 gap-3 rounded-2xl border border-dashed border-border/20">
                            <Inbox className="size-8 opacity-30" />
                            <p className="text-[10px] tracking-wider">NO TRANSACTIONS FOR THIS PERIOD</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filteredData.map((item) => {
                                const isIn = item.to_currency === 'USD';
                                const isOut = item.from_currency === 'USD';
                                return (
                                    <div key={item.id} className="rounded-xl border border-border/20 bg-card overflow-hidden">
                                        <div className={cn(
                                            'w-full h-0.5',
                                            isIn ? 'bg-emerald-500/70' : isOut ? 'bg-rose-500/70' : 'bg-border/50'
                                        )} />
                                        <div className="p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="text-xs font-semibold text-muted-foreground">
                                                        {new Date(item.transaction_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-muted-foreground/60">
                                                        {new Date(item.transaction_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs">
                                                    <span className="font-mono font-semibold text-muted-foreground">{item.from_currency}</span>
                                                    <ArrowRight className="size-3 text-muted-foreground/40" />
                                                    <span className="font-mono font-semibold text-muted-foreground">{item.to_currency}</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-xl font-mono font-bold text-foreground">
                                                            {item.foreign_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                        <span className="text-xs font-semibold text-muted-foreground">{item.to_currency}</span>
                                                    </div>
                                                    <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                                        @ {item.exchange_rate.toFixed(4)}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-base font-mono font-bold text-foreground">
                                                        {item.thb_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground font-semibold">THB</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <p className="text-center text-[9px] font-mono text-muted-foreground/30 tracking-wider pb-2">
                        {filteredData.length} TRANSACTION{filteredData.length !== 1 ? 'S' : ''}
                    </p>
                </>
            )}
        </div>
    );
}

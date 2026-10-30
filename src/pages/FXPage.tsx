import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { FinancialFX } from '../types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Group, Segmented } from '@/components/ios';
import { cn, getErrorMessage } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, X, BarChart2, ArrowRight, Inbox, Loader2 } from 'lucide-react';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const CURRENCIES = ['THB', 'USD', 'FCD', 'SAVE'];
const PAGE = 40;

type View = 'all' | 'month';

// Amount colour follows the destination: USD violet, FCD yellow-green, SAVE plain.
const TO_TONE: Record<string, string> = {
    USD: 'text-violet-600 dark:text-violet-400',
    FCD: 'text-lime-700 dark:text-lime-400',
};

const num = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function FxRow({ item }: { item: FinancialFX }) {
    const d = new Date(item.transaction_at);
    const tone = TO_TONE[item.to_currency] ?? '';
    return (
        <div className="flex items-center gap-3 px-4 py-3 min-h-[68px]">
            <div className="w-11 shrink-0 text-center">
                <p className="text-[20px] leading-none font-semibold tabular-nums">{d.getDate()}</p>
                <p className="text-[12px] text-muted-foreground mt-1">{d.toLocaleDateString('en-GB', { month: 'short' })}</p>
            </div>
            <div className="flex-1 min-w-0">
                <p className="flex items-center gap-1.5 text-[15px] font-medium">
                    {item.from_currency}
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    {item.to_currency}
                </p>
                <p className="text-[13px] text-muted-foreground tabular-nums">
                    @ {item.exchange_rate.toFixed(4)} · {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
            <div className="text-right">
                <p className={cn('text-[17px] font-semibold tabular-nums', tone)}>
                    {num(item.foreign_amount)} <span className="text-[13px] font-medium text-muted-foreground">{item.to_currency}</span>
                </p>
                <p className="text-[13px] text-muted-foreground tabular-nums">฿ {num(item.thb_amount)}</p>
            </div>
        </div>
    );
}

export default function FXPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<FinancialFX[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [view, setView] = useState<View>('all');
    const [shown, setShown] = useState(PAGE);

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
            const { data, error } = await db
                .from('pantagon_financial_fx')
                .select('*')
                .order('transaction_at', { ascending: false });

            if (error) throw error;
            setData(data || []);

            // Monthly view opens on the month of the latest record.
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

            const { error } = await db.from('pantagon_financial_fx').insert({
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
            toast.error('Could not save', { description: getErrorMessage(err) });
        } finally {
            setFormLoading(false);
        }
    };

    const liveRate = useMemo(() => {
        const thb = Number(form.thb_amount);
        const foreign = Number(form.foreign_amount);
        return thb > 0 && foreign > 0 ? thb / foreign : null;
    }, [form.thb_amount, form.foreign_amount]);

    const availableYears = useMemo(() => {
        const years = new Set(data.map(item => new Date(item.transaction_at).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [data]);

    const availableFromCurrencies = useMemo(() =>
        Array.from(new Set(data.map(item => item.from_currency))).sort(), [data]);
    const availableToCurrencies = useMemo(() =>
        Array.from(new Set(data.map(item => item.to_currency))).sort(), [data]);

    // Currency filters apply to both views; the month window only to "month".
    const currencyFiltered = useMemo(() => data.filter(item =>
        (selectedFromCurrency === 'All' || item.from_currency === selectedFromCurrency) &&
        (selectedToCurrency === 'All' || item.to_currency === selectedToCurrency)
    ), [data, selectedFromCurrency, selectedToCurrency]);

    const monthData = useMemo(() => currencyFiltered.filter(item => {
        const date = new Date(item.transaction_at);
        return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
    }), [currencyFiltered, selectedYear, selectedMonth]);

    const visibleAll = currencyFiltered.slice(0, shown);

    // Group the "all" list under month headings (data is newest first).
    const grouped = useMemo(() => {
        const out: { key: string; label: string; items: FinancialFX[] }[] = [];
        visibleAll.forEach(item => {
            const d = new Date(item.transaction_at);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const last = out[out.length - 1];
            if (last && last.key === key) last.items.push(item);
            else out.push({ key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, items: [item] });
        });
        return out;
    }, [visibleAll]);

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
            <div className="flex flex-col gap-3">
                <Skeleton className="h-11 w-full rounded-xl" />
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />)}
            </div>
        );
    }

    if (error) return <div className="p-4 text-center text-destructive text-sm pt-20">Error: {error}</div>;

    const emptyState = (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                <EmptyTitle>No transactions</EmptyTitle>
                <EmptyDescription>Nothing matches these filters.</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">{data.length} records</span>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => navigate('/fx/analytics')}>
                        <BarChart2 data-icon="inline-start" />
                        Analytics
                    </Button>
                    <Button variant={showForm ? 'secondary' : 'default'} onClick={() => setShowForm(!showForm)}>
                        {showForm ? <X data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                        {showForm ? 'Cancel' : 'Add FX'}
                    </Button>
                </div>
            </div>

            {/* Add form */}
            {showForm && (
                <div className="rounded-2xl bg-card p-4 animate-in slide-in-from-top-2 duration-200">
                    <h2 className="text-[17px] font-semibold mb-4">Add foreign exchange</h2>
                    <form onSubmit={handleSave} className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-medium text-muted-foreground">From</label>
                                <Select
                                    value={form.from_currency}
                                    onValueChange={(val) => setForm(prev => ({
                                        ...prev, from_currency: val,
                                        to_currency: prev.to_currency === val ? '' : prev.to_currency
                                    }))}
                                    required
                                >
                                    <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-medium text-muted-foreground">To</label>
                                <Select value={form.to_currency} onValueChange={(val) => setForm({ ...form, to_currency: val })} required>
                                    <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {CURRENCIES.filter(c => c !== form.from_currency).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-medium text-muted-foreground">THB amount</label>
                                <Input type="number" inputMode="decimal" step="0.01" value={form.thb_amount} onChange={(e) => setForm({ ...form, thb_amount: e.target.value })} placeholder="0.00" required />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-medium text-muted-foreground">Foreign amount</label>
                                <Input type="number" inputMode="decimal" step="0.000001" value={form.foreign_amount} onChange={(e) => setForm({ ...form, foreign_amount: e.target.value })} placeholder="0.00" required />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-[13px] font-medium text-muted-foreground">Rate (optional)</label>
                                {liveRate !== null && (
                                    <span className="text-[13px] font-medium text-primary tabular-nums">
                                        1 {form.to_currency || '?'} = {liveRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} THB
                                    </span>
                                )}
                            </div>
                            <Input
                                type="number" inputMode="decimal" step="0.000001"
                                value={form.exchange_rate}
                                onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })}
                                placeholder={liveRate !== null ? liveRate.toFixed(6) : 'Calculated from amounts'}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-medium text-muted-foreground">Date & time</label>
                            <Input type="datetime-local" value={form.transaction_at} onChange={(e) => setForm({ ...form, transaction_at: e.target.value })} required />
                        </div>

                        <Button type="submit" disabled={formLoading} size="lg" className="w-full h-[52px] rounded-2xl text-[17px]">
                            {formLoading ? <><Loader2 className="animate-spin" data-icon="inline-start" />Saving…</> : 'Save FX transaction'}
                        </Button>
                    </form>
                </div>
            )}

            {!showForm && (
                <>
                    {/* Primary view = everything; monthly is the secondary view */}
                    <Segmented
                        value={view}
                        onChange={(v) => { setView(v); setShown(PAGE); }}
                        options={[{ value: 'all', label: 'All' }, { value: 'month', label: 'Monthly' }]}
                    />

                    {view === 'month' && (
                        <div className="flex items-center justify-between bg-card rounded-2xl p-2">
                            <Button variant="ghost" size="icon" onClick={handlePrevMonth} aria-label="Previous month">
                                <ChevronLeft />
                            </Button>
                            <div className="text-center">
                                <div className="font-semibold text-[17px]">{MONTHS[selectedMonth]}</div>
                                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                                    <SelectTrigger className="h-6 border-0 bg-transparent p-0 text-[13px] text-muted-foreground shadow-none focus:ring-0 w-auto mx-auto gap-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleNextMonth} aria-label="Next month">
                                <ChevronRight />
                            </Button>
                        </div>
                    )}

                    {/* Currency filters */}
                    <div className="grid grid-cols-2 gap-2">
                        <Select value={selectedFromCurrency} onValueChange={setSelectedFromCurrency}>
                            <SelectTrigger className="h-11 w-full" aria-label="Filter by from currency"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="All">From: All</SelectItem>
                                    {availableFromCurrencies.map(c => <SelectItem key={c} value={c}>From: {c}</SelectItem>)}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <Select value={selectedToCurrency} onValueChange={setSelectedToCurrency}>
                            <SelectTrigger className="h-11 w-full" aria-label="Filter by to currency"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="All">To: All</SelectItem>
                                    {availableToCurrencies.map(c => <SelectItem key={c} value={c}>To: {c}</SelectItem>)}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {view === 'month' ? (
                        monthData.length === 0 ? emptyState : (
                            <>
                                <Group>{monthData.map(item => <FxRow key={item.id} item={item} />)}</Group>
                                <p className="text-center text-[13px] text-muted-foreground">
                                    {monthData.length} transaction{monthData.length !== 1 ? 's' : ''}
                                </p>
                            </>
                        )
                    ) : currencyFiltered.length === 0 ? emptyState : (
                        <>
                            {grouped.map(g => (
                                <Fragment key={g.key}>
                                    <h2 className="px-1 pt-2 -mb-2 text-[13px] font-medium text-muted-foreground">{g.label}</h2>
                                    <Group>{g.items.map(item => <FxRow key={item.id} item={item} />)}</Group>
                                </Fragment>
                            ))}
                            {visibleAll.length < currencyFiltered.length && (
                                <Button variant="secondary" size="lg" className="w-full h-12" onClick={() => setShown(s => s + PAGE)}>
                                    Show more ({currencyFiltered.length - visibleAll.length} left)
                                </Button>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}

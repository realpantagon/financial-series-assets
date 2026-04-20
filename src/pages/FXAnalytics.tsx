import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { PantagonUSD } from '../types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, TrendingUp, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function FXAnalytics() {
    const navigate = useNavigate();
    const [data, setData] = useState<PantagonUSD[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('pantagon_usd').select('*');
            if (error) throw error;
            setData(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const availableYears = useMemo(() => {
        const years = new Set(data.map(item => new Date(item.transaction_at).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [data]);

    const availableCurrencies = useMemo(() => {
        const currs = new Set<string>();
        data.forEach(item => {
            if (item.from_currency !== 'THB') currs.add(item.from_currency);
            if (item.to_currency !== 'THB') currs.add(item.to_currency);
        });
        return Array.from(currs).sort();
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const date = new Date(item.transaction_at);
            const matchYear = selectedYear === 'All' || date.getFullYear().toString() === selectedYear;
            const matchCurrency = selectedCurrency === 'All' ||
                item.from_currency === selectedCurrency ||
                item.to_currency === selectedCurrency;
            return matchYear && matchCurrency;
        });
    }, [data, selectedYear, selectedCurrency]);

    const analytics = useMemo(() => {
        let totalThbIn = 0, totalThbOut = 0, totalForeignIn = 0, totalForeignOut = 0, count = 0;

        filteredData.forEach(item => {
            const isSellingForeign = selectedCurrency !== 'All' && item.from_currency === selectedCurrency;
            const isBuyingForeign = selectedCurrency !== 'All' && item.to_currency === selectedCurrency;

            if (item.to_currency === 'THB' || isSellingForeign) totalThbIn += Number(item.thb_amount || 0);
            if (item.from_currency === 'THB' || isBuyingForeign) totalThbOut += Number(item.thb_amount || 0);

            if (selectedCurrency !== 'All') {
                if (item.to_currency === selectedCurrency) totalForeignIn += item.foreign_amount;
                if (item.from_currency === selectedCurrency) totalForeignOut += item.foreign_amount;
            }
            count++;
        });

        const totalThbVolume = filteredData.reduce((acc, item) => acc + Number(item.thb_amount || 0), 0);
        const totalForeignVolume = filteredData.reduce((acc, item) => acc + Number(item.foreign_amount || 0), 0);
        const weightedAvgRate = totalForeignVolume > 0 ? totalThbVolume / totalForeignVolume : 0;

        return { totalThbIn, totalThbOut, totalForeignIn, totalForeignOut, avgRate: weightedAvgRate, count };
    }, [filteredData, selectedCurrency]);

    if (loading) {
        return (
            <div className="flex flex-col gap-4 pt-4 pb-24">
                <Skeleton className="h-8 w-32" />
                <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-10 rounded-lg" />
                    <Skeleton className="h-10 rounded-lg" />
                </div>
                <Skeleton className="h-36 rounded-2xl" />
                <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-28 rounded-xl" />
                </div>
            </div>
        );
    }

    if (error) return <div className="p-4 text-center text-destructive text-sm pt-20">Error: {error}</div>;

    return (
        <div className="flex flex-col gap-4 pb-24 pt-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => navigate('/fx')} className="size-9 rounded-full shrink-0">
                    <ArrowLeft className="size-4" />
                </Button>
                <h1 className="text-xl font-bold text-foreground">FX Analytics</h1>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Year</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Time</SelectItem>
                            {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Currency</label>
                    <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {availableCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Avg Rate Hero */}
            <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-card to-blue-500/5 p-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 to-transparent pointer-events-none" />
                <TrendingUp className="absolute -right-4 -bottom-4 size-32 text-blue-500/8 pointer-events-none" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 relative">
                    Weighted Average Rate
                </p>
                <p className="font-mono text-5xl font-bold tracking-tight text-foreground relative">{analytics.avgRate.toFixed(4)}</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-2 relative">
                    {analytics.count} transaction{analytics.count !== 1 ? 's' : ''}
                    {selectedYear !== 'All' ? ` · ${selectedYear}` : ''}
                </p>
            </div>

            {/* Currency Flow Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/30 bg-card/60 p-4">
                    <div className="size-9 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mb-3">
                        <span className="text-blue-400 font-bold text-[10px]">{selectedCurrency}</span>
                    </div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                        {selectedCurrency} In
                    </p>
                    <p className="text-xl font-mono font-bold text-foreground truncate">
                        {analytics.totalForeignIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="rounded-xl border border-border/30 bg-card/60 p-4">
                    <div className="size-9 rounded-full bg-orange-500/15 border border-orange-500/25 flex items-center justify-center mb-3">
                        <span className="text-orange-400 font-bold text-[10px]">{selectedCurrency}</span>
                    </div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                        {selectedCurrency} Out
                    </p>
                    <p className="text-xl font-mono font-bold text-foreground truncate">
                        {analytics.totalForeignOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="rounded-xl border border-border/30 bg-card/60 p-4">
                    <div className="size-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-3">
                        <ArrowDownLeft className="size-4 text-emerald-400" />
                    </div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                        THB In
                    </p>
                    <p className="text-xl font-mono font-bold text-foreground truncate">
                        {analytics.totalThbIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>

                <div className="rounded-xl border border-border/30 bg-card/60 p-4">
                    <div className="size-9 rounded-full bg-rose-500/15 border border-rose-500/25 flex items-center justify-center mb-3">
                        <ArrowUpRight className="size-4 text-rose-400" />
                    </div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                        THB Out
                    </p>
                    <p className="text-xl font-mono font-bold text-foreground truncate">
                        {analytics.totalThbOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            <p className="text-center text-xs text-muted-foreground pb-2">
                Showing <strong>{selectedYear === 'All' ? 'all time' : selectedYear}</strong> · <strong>{selectedCurrency}</strong> flow
            </p>
        </div>
    );
}

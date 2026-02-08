
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { PantagonUSD } from '../types';

export default function FXAnalytics() {
    const navigate = useNavigate();
    const [data, setData] = useState<PantagonUSD[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter States
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('pantagon_usd')
                .select('*');

            if (error) throw error;
            setData(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Derived Lists
    const availableYears = useMemo(() => {
        const years = new Set(data.map(item => new Date(item.transaction_at).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [data]);

    const availableCurrencies = useMemo(() => {
        // Collect all distinct currencies from both from/to columns, excluding THB
        const currs = new Set<string>();
        data.forEach(item => {
            if (item.from_currency !== 'THB') currs.add(item.from_currency);
            if (item.to_currency !== 'THB') currs.add(item.to_currency);
        });
        return Array.from(currs).sort();
    }, [data]);

    // Filtering
    const filteredData = useMemo(() => {
        return data.filter(item => {
            const date = new Date(item.transaction_at);
            const matchYear = selectedYear === 'All' || date.getFullYear().toString() === selectedYear;

            // Currency Filter: 
            // We want transactions involving the selected currency (e.g. USD).
            // So either from_currency or to_currency must match.
            // If selectedCurrency is 'All', usually we might just show global THB stats, 
            // but for "Foreign In/Out" summing mixed currencies doesn't make sense.
            // So if 'All', we might hide Foreign cards or sum them if user accepts (but effectively meaningless).
            // Let's assume 'USD' is default and users select specific currency to see foreign stats.
            const matchCurrency = selectedCurrency === 'All' ||
                item.from_currency === selectedCurrency ||
                item.to_currency === selectedCurrency;

            return matchYear && matchCurrency;
        });
    }, [data, selectedYear, selectedCurrency]);

    // Analytics Calculation
    const analytics = useMemo(() => {
        let totalThbIn = 0;
        let totalThbOut = 0;
        let totalForeignIn = 0;
        let totalForeignOut = 0;

        let count = 0;

        filteredData.forEach(item => {
            // THB Flow
            // THB In: Receiving THB OR Selling Selected Currency (Source = Selected)
            // THB Out: Spending THB OR Buying Selected Currency (Dest = Selected)

            const isSellingForeign = selectedCurrency !== 'All' && item.from_currency === selectedCurrency;
            const isBuyingForeign = selectedCurrency !== 'All' && item.to_currency === selectedCurrency;

            if (item.to_currency === 'THB' || isSellingForeign) {
                totalThbIn += Number(item.thb_amount || 0);
            }

            if (item.from_currency === 'THB' || isBuyingForeign) {
                totalThbOut += Number(item.thb_amount || 0);
            }

            // Foreign Flow (relative to selectedCurrency)
            if (selectedCurrency !== 'All') {
                // Foreign In: Receiving selected currency
                if (item.to_currency === selectedCurrency) {
                    totalForeignIn += item.foreign_amount;
                }
                // Foreign Out: Spending selected currency
                if (item.from_currency === selectedCurrency) {
                    totalForeignOut += item.foreign_amount;
                }
            }

            // For Weighted Average: Sum all foreign volume in this filter view
            // We use item.foreign_amount as the volume weight
            // And item.thb_amount as the value
            // (Note: This assumes thb_amount corresponds to the value of foreign_amount)

            // We use the sum of THB In + THB Out as the total THB volume involved
            // But item.thb_amount is simpler and more direct for every transaction row

            count++;
        });

        // Weighted Average Calculation
        // Formula: Sum(THB Amount) / Sum(Foreign Amount)
        // We need to iterate again or accumulate during the loop. 
        // Let's use reduce for clarity or just add to the loop above.
        // Actually, let's just sum it up in the loop for efficiency.

        const totalThbVolume = data.reduce((acc, item) => {
            // We only care about filtered items
            const isIncluded = filteredData.includes(item);
            return isIncluded ? acc + Number(item.thb_amount || 0) : acc;
        }, 0);

        const totalForeignVolume = filteredData.reduce((acc, item) => acc + Number(item.foreign_amount || 0), 0);

        const weightedAvgRate = totalForeignVolume > 0 ? totalThbVolume / totalForeignVolume : 0;

        return {
            totalThbIn,
            totalThbOut,
            totalForeignIn,
            totalForeignOut,
            avgRate: weightedAvgRate,
            count
        };
    }, [filteredData, selectedCurrency, data]);

    if (loading) return <div className="p-4 text-center">Loading...</div>;
    if (error) return <div className="p-4 text-center text-red-500">Error: {error}</div>;

    return (
        <div className="p-4 pb-24 max-w-lg mx-auto">
            <div className="flex items-center mb-4">
                <button
                    onClick={() => navigate('/fx')}
                    className="mr-3 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <i className="pi pi-arrow-left text-gray-600"></i>
                </button>
                <h1 className="text-2xl font-bold text-[#001f3f]">Analytics</h1>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Year</label>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 shadow-sm"
                    >
                        <option value="All">All Time</option>
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Currency</label>
                    <select
                        value={selectedCurrency}
                        onChange={(e) => setSelectedCurrency(e.target.value)}
                        className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 shadow-sm"
                    >
                        {availableCurrencies.map(curr => (
                            <option key={curr} value={curr}>{curr}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-2">Average Rate</div>
                        <div className="text-4xl font-bold">{analytics.avgRate.toFixed(4)}</div>
                        <div className="text-blue-200 text-xs mt-2">Based on {analytics.count} transactions</div>
                    </div>
                    <i className="pi pi-chart-line absolute -right-4 -bottom-4 text-9xl text-white opacity-10"></i>
                </div>

                {/* Foreign Currency Section */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                            <span className="text-blue-600 font-bold text-xs">{selectedCurrency}</span>
                        </div>
                        <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{selectedCurrency} In</div>
                        <div className="text-xl font-bold text-gray-800 mt-1 truncate">
                            {analytics.totalForeignIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mb-3">
                            <span className="text-orange-600 font-bold text-xs">{selectedCurrency}</span>
                        </div>
                        <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{selectedCurrency} Out</div>
                        <div className="text-xl font-bold text-gray-800 mt-1 truncate">
                            {analytics.totalForeignOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                {/* THB Section */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-3">
                            <i className="pi pi-arrow-down-left text-green-600 font-bold"></i>
                        </div>
                        <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide">THB In</div>
                        <div className="text-xl font-bold text-gray-800 mt-1 truncate">
                            {analytics.totalThbIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
                            <i className="pi pi-arrow-up-right text-red-600 font-bold"></i>
                        </div>
                        <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide">THB Out</div>
                        <div className="text-xl font-bold text-gray-800 mt-1 truncate">
                            {analytics.totalThbOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl text-center text-xs text-gray-400 mt-4">
                    Showing statistics for <strong>{selectedYear === 'All' ? 'All Time' : selectedYear}</strong> and <strong>{selectedCurrency}</strong> flow.
                </div>
            </div>
        </div>
    );
}

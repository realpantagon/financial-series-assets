
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { PantagonUSD } from '../types';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function FXPage() {
    const [data, setData] = useState<PantagonUSD[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedFromCurrency, setSelectedFromCurrency] = useState<string>('All');
    const [selectedToCurrency, setSelectedToCurrency] = useState<string>('All');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('pantagon_usd')
                .select('*')
                .order('transaction_at', { ascending: false });

            if (error) {
                throw error;
            }

            setData(data || []);

            // Set initial year/month from data if available
            if (data && data.length > 0) {
                const latestDate = new Date(data[0].transaction_at);
                setSelectedYear(latestDate.getFullYear());
                setSelectedMonth(latestDate.getMonth());
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Derived lists for dropdowns
    const availableYears = useMemo(() => {
        const years = new Set(data.map(item => new Date(item.transaction_at).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [data]);

    const availableFromCurrencies = useMemo(() => {
        return Array.from(new Set(data.map(item => item.from_currency))).sort();
    }, [data]);

    const availableToCurrencies = useMemo(() => {
        return Array.from(new Set(data.map(item => item.to_currency))).sort();
    }, [data]);

    // Filtering logic
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

    // Analytics Calculation
    const analytics = useMemo(() => {
        let totalThbIn = 0;
        let totalThbOut = 0;
        let totalRate = 0;
        let count = 0;

        filteredData.forEach(item => {
            // THB In/Out Logic
            if (item.to_currency === 'THB') {
                totalThbIn += item.thb_amount;
            } else if (item.from_currency === 'THB') {
                totalThbOut += item.thb_amount;
            }

            // Rate Average
            totalRate += item.exchange_rate;
            count++;
        });

        return {
            totalThbIn,
            totalThbOut,
            avgRate: count > 0 ? totalRate / count : 0,
            count
        };
    }, [filteredData]);

    const handlePrevMonth = () => {
        if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear(prev => prev - 1);
        } else {
            setSelectedMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear(prev => prev + 1);
        } else {
            setSelectedMonth(prev => prev + 1);
        }
    };

    if (loading) return <div className="p-4 text-center">Loading...</div>;
    if (error) return <div className="p-4 text-center text-red-500">Error: {error}</div>;

    return (
        <div className="p-4 pb-24 max-w-lg mx-auto">
            <h1 className="text-2xl font-bold mb-4 text-[#001f3f]">FX Transactions</h1>

            {/* Top Controls: Year & Month Nav */}
            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                <button onClick={handlePrevMonth} className="p-2 text-gray-500 hover:text-[#001f3f] transition-colors">
                    <i className="pi pi-chevron-left text-xl"></i>
                </button>
                <div className="text-center">
                    <div className="font-bold text-lg text-[#001f3f]">{MONTHS[selectedMonth]}</div>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="text-sm text-gray-500 bg-transparent border-none focus:ring-0 p-0 text-center font-medium cursor-pointer appearance-none hover:text-gray-700"
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                        {availableYears.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                    </select>
                </div>
                <button onClick={handleNextMonth} className="p-2 text-gray-500 hover:text-[#001f3f] transition-colors">
                    <i className="pi pi-chevron-right text-xl"></i>
                </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <select
                    value={selectedFromCurrency}
                    onChange={(e) => setSelectedFromCurrency(e.target.value)}
                    className="bg-white border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 shadow-sm"
                >
                    <option value="All">From: All</option>
                    {availableFromCurrencies.map(curr => <option key={curr} value={curr}>{curr}</option>)}
                </select>
                <select
                    value={selectedToCurrency}
                    onChange={(e) => setSelectedToCurrency(e.target.value)}
                    className="bg-white border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 shadow-sm"
                >
                    <option value="All">To: All</option>
                    {availableToCurrencies.map(curr => <option key={curr} value={curr}>{curr}</option>)}
                </select>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-3 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">AVG Rate</p>
                    <p className="text-lg font-extrabold text-[#001f3f]">
                        {analytics.avgRate.toFixed(4)}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-3 rounded-xl border border-green-100 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">THB In</p>
                    <p className="text-sm font-extrabold text-emerald-700 truncate w-full">
                        {analytics.totalThbIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-rose-50 to-red-50 p-3 rounded-xl border border-red-100 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mb-1">THB Out</p>
                    <p className="text-sm font-extrabold text-rose-700 truncate w-full">
                        {analytics.totalThbOut.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            {/* Transactions List (Cards) */}
            <div className="space-y-3">
                {filteredData.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <i className="pi pi-inbox text-4xl mb-2 opacity-50"></i>
                        <p className="text-sm">No transactions found</p>
                    </div>
                ) : (
                    filteredData.map((item) => (
                        <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-all hover:shadow-md relative overflow-hidden group">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.to_currency === 'USD' ? 'bg-green-500' :
                                    item.from_currency === 'USD' ? 'bg-red-500' : 'bg-gray-300'
                                }`}></div>

                            <div className="flex justify-between items-start mb-2 pl-2">
                                <div>
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        {new Date(item.transaction_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {new Date(item.transaction_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-end pl-2">
                                <div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-bold text-gray-800">
                                            {item.foreign_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-500">{item.to_currency}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                        <span>{item.from_currency}</span>
                                        <i className="pi pi-arrow-right text-[10px]"></i>
                                        <span>{item.to_currency}</span>
                                        <span className="text-gray-300 mx-1">|</span>
                                        <span>Rate: {item.exchange_rate.toFixed(4)}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-[#001f3f]">
                                        {item.thb_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium">THB</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-6 text-center text-xs text-gray-400">
                Showing {filteredData.length} transactions
            </div>
        </div>
    );
}

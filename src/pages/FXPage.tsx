
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { PantagonUSD } from '../types';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function FXPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<PantagonUSD[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form states
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            // Calculate exchange rate if empty
            let finalRate = Number(form.exchange_rate);
            const foreign = Number(form.foreign_amount);
            const thb = Number(form.thb_amount);

            if (!finalRate && foreign > 0 && thb > 0) {
                finalRate = thb / foreign;
            }

            const { error } = await supabase.from('pantagon_usd').insert({
                transaction_at: new Date(form.transaction_at).toISOString(),
                from_currency: form.from_currency,
                to_currency: form.to_currency,
                thb_amount: thb,
                foreign_amount: foreign,
                exchange_rate: finalRate
            });

            if (error) throw error;

            setShowForm(false);
            setForm({
                transaction_at: new Date().toISOString().slice(0, 16),
                from_currency: 'THB',
                to_currency: 'USD',
                thb_amount: '',
                foreign_amount: '',
                exchange_rate: ''
            });
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setFormLoading(false);
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
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-[#001f3f]">FX Transactions</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/fx/analytics')}
                        className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center gap-1"
                    >
                        <i className="pi pi-chart-bar"></i> Analytics
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${showForm
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                            }`}
                    >
                        <i className={`pi ${showForm ? 'pi-times' : 'pi-plus'}`}></i>
                        {showForm ? 'Cancel' : 'Add FX'}
                    </button>
                </div>
            </div>

            {/* Inline Add FX Form */}
            {showForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
                    <h2 className="text-sm font-bold text-[#001f3f] mb-3">Add Foreign Exchange</h2>
                    <form onSubmit={handleSave} className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">From Currency</label>
                                <div className="relative">
                                    <select
                                        value={form.from_currency}
                                        onChange={(e) => {
                                            const newFrom = e.target.value.toUpperCase();
                                            setForm(prev => ({
                                                ...prev,
                                                from_currency: newFrom,
                                                to_currency: prev.to_currency === newFrom ? '' : prev.to_currency
                                            }));
                                        }}
                                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase font-semibold appearance-none"
                                        required
                                    >
                                        <option value="" disabled>Select</option>
                                        {['USD', 'FCD', 'SAVE'].map(currency => (
                                            <option key={currency} value={currency}>{currency}</option>
                                        ))}
                                    </select>
                                    <i className="pi pi-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">To Currency</label>
                                <div className="relative">
                                    <select
                                        value={form.to_currency}
                                        onChange={(e) => setForm({ ...form, to_currency: e.target.value.toUpperCase() })}
                                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase font-semibold appearance-none"
                                        required
                                    >
                                        <option value="" disabled>Select</option>
                                        {['USD', 'FCD', 'SAVE']
                                            .filter(currency => currency !== form.from_currency)
                                            .map(currency => (
                                                <option key={currency} value={currency}>{currency}</option>
                                            ))}
                                    </select>
                                    <i className="pi pi-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">THB Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={form.thb_amount}
                                    onChange={(e) => setForm({ ...form, thb_amount: e.target.value })}
                                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Foreign Amount</label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={form.foreign_amount}
                                    onChange={(e) => setForm({ ...form, foreign_amount: e.target.value })}
                                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Exchange Rate (Optional)</label>
                            <input
                                type="number"
                                step="0.000001"
                                value={form.exchange_rate}
                                onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })}
                                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                                placeholder="Auto-calculated if left blank"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Date</label>
                            <input
                                type="datetime-local"
                                value={form.transaction_at}
                                onChange={(e) => setForm({ ...form, transaction_at: e.target.value })}
                                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={formLoading}
                            className="w-full mt-2 bg-gradient-to-r from-blue-600 to-[#001f3f] text-white font-bold py-3 rounded-xl disabled:opacity-50 active:scale-95 transition-transform shadow-md"
                        >
                            {formLoading ? <i className="pi pi-spin pi-spinner"></i> : 'Save FX Transaction'}
                        </button>
                    </form>
                </div>
            )}

            {/* List & Filtering */}
            {!showForm && (
                <>
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
                </>
            )}
        </div>
    );
}

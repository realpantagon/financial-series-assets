
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AddTransaction() {
    const navigate = useNavigate();
    const location = useLocation();
    const [accountName, setAccountName] = useState('');
    const [type, setType] = useState<'IN' | 'OUT'>('IN');
    const [amount, setAmount] = useState<number | ''>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [tag, setTag] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (location.state?.accountName) {
            setAccountName(location.state.accountName);
        }
    }, [location.state]);

    const accountOptions = [
        'SCB [Recieve/ Saving]',
        'Dime [Invest]',
        'Dime [Save]',
        'Dime [FCD]',
        'KBank Emergency',
        'Make Monthly Expense',
        'ttb Emergency Main',
        'PVD [Kbank]',
        'SSO'
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!accountName || !amount || !date) return;

        setLoading(true);
        const { error } = await supabase
            .from('pantagon_assets')
            .insert([
                {
                    account_name: accountName,
                    type: type,
                    amount: Number(amount),
                    date: date,
                    tag: tag || null,
                    note: note || null
                }
            ]);

        setLoading(false);

        if (error) {
            console.error('Error adding transaction:', error);
            alert('Error adding transaction: ' + error.message);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="flex justify-center">
            <div className="w-full max-w-lg">
                <div className="bg-white shadow-sm rounded-2xl p-6 mb-20 border border-gray-100">
                    <h2 className="text-xl font-bold text-[#001f3f] mb-6 flex items-center gap-2">
                        <i className="pi pi-plus-circle text-blue-600"></i>
                        New Transaction
                    </h2>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="space-y-4">
                            {/* Type Selection */}
                            <div className="grid grid-cols-2 gap-3 p-1 bg-gray-50 rounded-lg">
                                <label className={`flex items-center justify-center gap-2 p-3 rounded-md cursor-pointer transition-all ${type === 'IN' ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}>
                                    <input type="radio" name="type" value="IN" checked={type === 'IN'} onChange={() => setType('IN')} className="hidden" />
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${type === 'IN' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <i className="pi pi-arrow-down text-sm font-bold"></i>
                                    </div>
                                    <span className={`text-sm font-bold ${type === 'IN' ? 'text-green-700' : 'text-gray-500'}`}>Income</span>
                                </label>
                                <label className={`flex items-center justify-center gap-2 p-3 rounded-md cursor-pointer transition-all ${type === 'OUT' ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}>
                                    <input type="radio" name="type" value="OUT" checked={type === 'OUT'} onChange={() => setType('OUT')} className="hidden" />
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${type === 'OUT' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <i className="pi pi-arrow-up text-sm font-bold"></i>
                                    </div>
                                    <span className={`text-sm font-bold ${type === 'OUT' ? 'text-red-700' : 'text-gray-500'}`}>Expense</span>
                                </label>
                            </div>

                            {/* Amount Input */}
                            <div>
                                <label htmlFor="amount" className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Amount (USD)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-400 font-bold">$</span>
                                    </div>
                                    <input
                                        type="number"
                                        id="amount"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value) || '')}
                                        className="pl-7 w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg font-semibold text-gray-800 placeholder-gray-300"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0.01"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Account Selection */}
                            <div>
                                <label htmlFor="accountName" className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Account</label>
                                <div className="relative">
                                    <select
                                        id="accountName"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium text-gray-700 appearance-none"
                                        required
                                    >
                                        <option value="" disabled>Select Account</option>
                                        {accountOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <i className="pi pi-chevron-down text-gray-400 text-xs"></i>
                                    </div>
                                </div>
                            </div>

                            {/* Date Input */}
                            <div>
                                <label htmlFor="date" className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Date</label>
                                <input
                                    type="date"
                                    id="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium text-gray-700"
                                    required
                                />
                            </div>

                            {/* Tag Input */}
                            <div>
                                <label htmlFor="tag" className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Tag (Optional)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <i className="pi pi-tag text-gray-400 text-sm"></i>
                                    </div>
                                    <input
                                        type="text"
                                        id="tag"
                                        value={tag}
                                        onChange={(e) => setTag(e.target.value)}
                                        className="pl-9 w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium text-gray-700 placeholder-gray-300"
                                        placeholder="Food, Transport, etc."
                                    />
                                </div>
                            </div>

                            {/* Note Input */}
                            <div>
                                <label htmlFor="note" className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Note (Optional)</label>
                                <textarea
                                    id="note"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium text-gray-700 placeholder-gray-300 min-h-[80px]"
                                    placeholder="Add details..."
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3.5 px-4 rounded-xl text-white font-bold tracking-wide shadow-lg transform transition-all active:scale-95 ${loading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-[#001f3f] to-[#003366] hover:shadow-xl'
                                    }`}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <i className="pi pi-spin pi-spinner"></i> Saving...
                                    </span>
                                ) : (
                                    'Save Transaction'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

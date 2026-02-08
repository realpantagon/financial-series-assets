
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AddTransaction() {
    const navigate = useNavigate();
    const [accountName, setAccountName] = useState('');
    const [type, setType] = useState<'IN' | 'OUT'>('IN');
    const [amount, setAmount] = useState<number | ''>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [tag, setTag] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

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

    const inputClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors";
    const labelClasses = "block text-sm font-medium text-gray-700 mb-1";

    return (
        <div className="flex justify-center">
            <div className="w-full max-w-lg bg-white shadow-lg rounded-xl p-6 border border-gray-100">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <h2 className="text-2xl font-bold text-gray-800 m-0 text-center">Add Transaction</h2>

                    <div>
                        <label htmlFor="accountName" className={labelClasses}>Account Name</label>
                        <select
                            id="accountName"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            className={inputClasses}
                            required
                        >
                            <option value="" disabled>Select Account</option>
                            {accountOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClasses}>Type</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    value="IN"
                                    checked={type === 'IN'}
                                    onChange={() => setType('IN')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="text-sm font-medium text-gray-700">Income (IN)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    value="OUT"
                                    checked={type === 'OUT'}
                                    onChange={() => setType('OUT')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="text-sm font-medium text-gray-700">Expense (OUT)</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="amount" className={labelClasses}>Amount (USD)</label>
                        <input
                            type="number"
                            id="amount"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value) || '')}
                            className={inputClasses}
                            placeholder="0.00"
                            step="0.01"
                            min="0.01"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="date" className={labelClasses}>Date</label>
                        <input
                            type="date"
                            id="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={inputClasses}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="tag" className={labelClasses}>Tag</label>
                        <input
                            type="text"
                            id="tag"
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                            className={inputClasses}
                            placeholder="e.g. Food, Transport"
                        />
                    </div>

                    <div>
                        <label htmlFor="note" className={labelClasses}>Note</label>
                        <textarea
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className={inputClasses}
                            rows={3}
                            placeholder="Optional note..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-secondary shadow-md hover:shadow-lg'}`}
                    >
                        {loading ? 'Submitting...' : 'Submit Transaction'}
                    </button>
                </form>
            </div>
        </div>
    );
}

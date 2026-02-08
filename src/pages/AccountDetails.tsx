import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { PantagonAsset } from '../types';

export default function AccountDetails() {
    const { accountName } = useParams<{ accountName: string }>();
    const navigate = useNavigate();
    const [assets, setAssets] = useState<PantagonAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ total: 0, in: 0, out: 0 });

    // Helper to get icon based on account name
    const getAccountIcon = (accountName: string): string | undefined => {
        const lowerName = accountName.toLowerCase();
        if (lowerName.includes('scb')) return '/scb.jpg';
        if (lowerName.includes('dime')) return '/Dime.png';
        if (lowerName.includes('kbank') || lowerName.includes('make')) return '/kbank.png';
        if (lowerName.includes('ttb')) return '/ttb.png';
        if (lowerName.includes('sso')) return '/SSO.jpg';
        return undefined;
    };

    useEffect(() => {
        if (accountName) {
            fetchAccountAssets(accountName);
        }
    }, [accountName]);

    const fetchAccountAssets = async (name: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pantagon_assets')
            .select('*')
            .eq('account_name', name)
            .order('date', { ascending: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching account assets:', error);
        } else {
            const fetchedAssets = data || [];
            setAssets(fetchedAssets);
            calculateSummary(fetchedAssets);
        }
        setLoading(false);
    };

    const calculateSummary = (data: PantagonAsset[]) => {
        let total = 0;
        let totalIn = 0;
        let totalOut = 0;

        data.forEach(item => {
            const amount = Number(item.amount);
            if (item.type === 'IN') {
                total += amount;
                totalIn += amount;
            } else {
                total -= amount;
                totalOut += amount;
            }
        });

        setSummary({ total, in: totalIn, out: totalOut });
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen text-gray-500 font-sans">Loading details...</div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-lg mx-auto pb-24">
            {/* Header / Summary Section */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-gray-600 shadow-sm hover:bg-gray-50 transition-colors border border-gray-100"
                    >
                        <i className="pi pi-arrow-left"></i>
                    </button>

                    {accountName && getAccountIcon(accountName) && (
                        <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm border border-gray-100 flex-shrink-0 bg-white flex items-center justify-center">
                            <img
                                src={getAccountIcon(accountName)}
                                alt={accountName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                    )}

                    <h2 className="text-xl font-bold text-[#001f3f] m-0">{accountName}</h2>
                </div>

                <div className="bg-white shadow-sm rounded-2xl p-6 border border-gray-100 flex flex-col items-center justify-center">
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">Total Balance</div>
                    <div className="text-[#001f3f] font-extrabold text-3xl">{formatCurrency(summary.total)}</div>
                </div>
            </div>

            {/* Transactions List */}
            <div className="flex flex-col gap-3">
                <h3 className="text-lg font-bold text-gray-800 px-2">Transactions</h3>

                <div className="flex flex-col gap-0 backdrop-blur-sm">
                    {assets.map((item) => (
                        <div key={item.id} className="bg-white p-4 border-b border-gray-100 last:border-0 first:rounded-t-2xl last:rounded-b-2xl flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-4">
                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === 'IN' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                    <i className={`pi ${item.type === 'IN' ? 'pi-arrow-down-left' : 'pi-arrow-up-right'} text-lg`}></i>
                                </div>

                                {/* Info */}
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className="font-bold text-gray-800 text-sm text-left line-clamp-1">
                                        {item.tag || (item.type === 'IN' ? 'Income' : 'Expense')}
                                    </span>
                                    <span className="text-gray-400 text-xs text-left">
                                        {formatDate(item.date)}
                                        {item.note ? ` • ${item.note}` : ''}
                                    </span>
                                </div>
                            </div>

                            {/* Amount */}
                            <div className={`font-bold text-sm ${item.type === 'IN' ? 'text-green-600' : 'text-gray-900'}`}>
                                {item.type === 'IN' ? '+' : '-'}{formatCurrency(Number(item.amount))}
                            </div>
                        </div>
                    ))}

                    {assets.length === 0 && (
                        <div className="bg-white p-8 rounded-2xl text-center text-gray-500 text-sm">
                            No transactions found for this account.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

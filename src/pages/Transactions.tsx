import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { PantagonAsset } from '../types';

export default function Transactions() {
    const [assets, setAssets] = useState<PantagonAsset[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAllAssets();
    }, []);

    const fetchAllAssets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pantagon_assets')
            .select('*')
            .order('date', { ascending: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching assets:', error);
        } else {
            setAssets(data || []);
        }
        setLoading(false);
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

    // Helper to get icon based on account name
    const getAccountIcon = (accountName: string): string | undefined => {
        if (!accountName) return undefined;
        const lowerName = accountName.toLowerCase();
        if (lowerName.includes('scb')) return '/scb.jpg';
        if (lowerName.includes('dime')) return '/Dime.png';
        if (lowerName.includes('kbank') || lowerName.includes('make')) return '/kbank.png';
        if (lowerName.includes('ttb')) return '/ttb.png';
        if (lowerName.includes('sso')) return '/SSO.jpg';
        return undefined;
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen text-gray-500 font-sans">Loading transactions...</div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-lg mx-auto pb-24 px-4 pt-4">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => window.history.back()}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-gray-600 shadow-sm hover:bg-gray-50 transition-colors border border-gray-100"
                >
                    <i className="pi pi-arrow-left"></i>
                </button>
                <h2 className="text-2xl font-bold text-[#001f3f] m-0">All Transactions</h2>
            </div>

            <div className="flex flex-col gap-0 backdrop-blur-sm">
                {assets.map((item) => (
                    <div key={item.id} className="bg-white p-4 border-b border-gray-100 last:border-0 first:rounded-t-2xl last:rounded-b-2xl flex items-center justify-between hover:bg-gray-50 transition-colors shadow-sm">
                        <div className="flex items-center gap-4">
                            {/* Account Icon */}
                            <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm border border-gray-100 flex-shrink-0 bg-white flex items-center justify-center">
                                {getAccountIcon(item.account_name) ? (
                                    <img
                                        src={getAccountIcon(item.account_name)}
                                        alt={item.account_name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                ) : (
                                    <div className={`w-full h-full flex items-center justify-center ${item.type === 'IN' ? 'bg-green-50' : 'bg-red-50'}`}>
                                        <i className={`pi ${item.type === 'IN' ? 'pi-arrow-down-left' : 'pi-arrow-up-right'} text-sm ${item.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}></i>
                                    </div>
                                )}
                                <i className={`pi pi-wallet text-gray-400 hidden`}></i>
                            </div>

                            {/* Info */}
                            <div className="flex flex-col items-start gap-0.5">
                                <span className="font-bold text-gray-800 text-sm text-left line-clamp-1">
                                    {item.tag || item.account_name}
                                </span>
                                <span className="text-gray-400 text-xs text-left">
                                    {formatDate(item.date)} • {item.account_name}
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
                    <div className="bg-white p-8 rounded-2xl text-center text-gray-500 text-sm shadow-sm">
                        No transactions found.
                    </div>
                )}
            </div>
        </div>
    );
}

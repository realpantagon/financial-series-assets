import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { PantagonAsset } from '../types';


export default function Dashboard() {
    const navigate = useNavigate();
    const [assets, setAssets] = useState<PantagonAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalAssetValue, setTotalAssetValue] = useState(0);
    const [accounts, setAccounts] = useState<{ name: string; balance: number; type: string }[]>([]);

    useEffect(() => {
        fetchAssets();
    }, []);

    const fetchAssets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pantagon_assets')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching assets:', error);
        } else {
            const fetchedAssets = data || [];
            setAssets(fetchedAssets);
            calculateAssetView(fetchedAssets);
        }
        setLoading(false);
    };

    const calculateAssetView = (data: PantagonAsset[]) => {
        let total = 0;
        const accountMap: { [key: string]: number } = {};

        data.forEach(item => {
            const amount = Number(item.amount);
            // Assuming 'IN' is income/addition to asset, 'OUT' is expense/reduction
            const signedAmount = item.type === 'IN' ? amount : -amount;

            total += signedAmount;

            const accName = item.account_name || 'Unassigned';
            accountMap[accName] = (accountMap[accName] || 0) + signedAmount;
        });

        setTotalAssetValue(total);

        const getRank = (name: string) => {
            const lower = name.toLowerCase();
            if (lower.includes('dime')) return 1;
            if (lower.includes('scb')) return 2;
            if (lower.includes('kbank')) return 3;
            if (lower.includes('ttb')) return 4;
            if (lower.includes('pvd')) return 5;
            if (lower.includes('sso')) return 6;
            return 7;
        };

        const accountList = Object.keys(accountMap).map(name => ({
            name,
            balance: accountMap[name],
            type: 'Asset'
        })).sort((a, b) => {
            const rankA = getRank(a.name);
            const rankB = getRank(b.name);
            if (rankA !== rankB) return rankA - rankB;
            return b.balance - a.balance;
        });

        setAccounts(accountList);
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const handleAccountClick = (accountName: string) => {
        navigate(`/account/${encodeURIComponent(accountName)}`);
    };

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

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen text-gray-400 font-sans text-sm">Loading...</div>;
    }

    return (
        <div className="flex flex-col gap-5 max-w-lg mx-auto pb-20 pt-6 px-5">
            {/* Total Asset Value Section */}
            <div className="rounded-2xl bg-[#001f3f] p-5">
  <span className="text-[11px] uppercase tracking-widest text-white/60">
    Total Net Worth
  </span>
  <div className="mt-1 text-[34px] font-bold text-white">
    {formatCurrency(totalAssetValue)}
  </div>
</div>


            {/* Assets List */}
            <div className="flex flex-col gap-3 mt-1">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#001f3f] uppercase tracking-wider opacity-70">Accounts</span>
                </div>

                <div className="flex flex-col gap-2.5">
                    {accounts.map((acc, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-xl p-3 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-slate-100 hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all duration-200 active:scale-[0.99] flex items-center justify-between group"
                            onClick={() => handleAccountClick(acc.name)}
                        >
                            <div className="flex items-center gap-3 flex-1">
                                <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-50 bg-slate-50 flex-shrink-0 flex items-center justify-center">
                                    {getAccountIcon(acc.name) ? (
                                        <img
                                            src={getAccountIcon(acc.name)}
                                            alt={acc.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                            }}
                                        />
                                    ) : null}
                                    <i className={`pi ${acc.balance >= 0 ? 'pi-wallet' : 'pi-exclamation-circle'} text-base ${acc.balance >= 0 ? 'text-[#001f3f]' : 'text-red-500'} ${getAccountIcon(acc.name) ? 'hidden' : ''}`}></i>
                                </div>
                                <div className="flex flex-col items-start min-w-0 pr-2">
                                    <span className="font-semibold text-[#001f3f] text-sm truncate max-w-full leading-tight">{acc.name}</span>
                                    <span className="text-gray-400 text-[10px] uppercase tracking-wide mt-0.5">{fetchedAssetsCount(acc.name, assets)} Transactions</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end pl-1">
                                <span className={`font-bold text-sm ${acc.balance >= 0 ? 'text-[#001f3f]' : 'text-red-500'}`}>
                                    {formatCurrency(acc.balance)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Helper to count transactions for UI
const fetchedAssetsCount = (accountName: string, allAssets: PantagonAsset[]) => {
    return allAssets.filter(a => a.account_name === accountName).length;
};

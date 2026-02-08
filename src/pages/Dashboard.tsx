import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { PantagonAsset } from '../types';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard() {
    const navigate = useNavigate();
    const [assets, setAssets] = useState<PantagonAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalAssetValue, setTotalAssetValue] = useState(0);
    const [accounts, setAccounts] = useState<{ name: string; balance: number; type: string }[]>([]);
    const [chartData, setChartData] = useState<any>(null);

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

        const accountList = Object.keys(accountMap).map(name => ({
            name,
            balance: accountMap[name],
            type: 'Asset'
        })).sort((a, b) => b.balance - a.balance);

        setAccounts(accountList);
        prepareChartData(accountList);
    };

    const prepareChartData = (accountList: { name: string; balance: number }[]) => {
        const validAccounts = accountList.filter(acc => acc.balance > 0);

        setChartData({
            labels: validAccounts.map(acc => acc.name),
            datasets: [
                {
                    data: validAccounts.map(acc => acc.balance),
                    backgroundColor: [
                        '#001f3f', // Navy
                        '#003366', // Lighter Navy
                        '#3949ab', // Indigo
                        '#1e88e5', // Blue
                        '#42a5f5', // Lighter Blue
                        '#90caf9', // Pale Blue
                        '#cfd8dc', // Blue Grey
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }
            ]
        });
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const handleAccountClick = (accountName: string) => {
        navigate(`/account/${encodeURIComponent(accountName)}`);
    };

    const chartOptions = {
        plugins: {
            legend: {
                display: false
            }
        },
        cutout: '70%',
        responsive: true,
        maintainAspectRatio: false
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
        return <div className="flex justify-center items-center min-h-screen text-gray-500 font-sans">Loading...</div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-lg mx-auto pb-20">
            {/* Total Asset Value Card */}
            <div className="w-full">
                <div className="bg-white text-primary shadow-lg rounded-3xl p-6 relative overflow-hidden border border-gray-100">
                    <div className="flex flex-col items-center gap-1 z-10 relative text-center">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Total Net Worth</span>
                        <div className="text-4xl font-extrabold text-[#001f3f] spacing-tight">{formatCurrency(totalAssetValue)}</div>
                    </div>
                </div>
            </div>

            {/* Chart Section */}

            
            

            {/* Assets List */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center px-2">
                    <span className="text-lg font-bold text-gray-800">Your Accounts</span>
                </div>

                <div className="flex flex-col gap-3">
                    {accounts.map((acc, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 border border-gray-100 active:scale-95 flex items-center justify-between group"
                            onClick={() => handleAccountClick(acc.name)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm border border-gray-100 flex-shrink-0 bg-white flex items-center justify-center">
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
                                    <i className={`pi ${acc.balance >= 0 ? 'pi-wallet' : 'pi-exclamation-circle'} text-xl ${acc.balance >= 0 ? 'text-[#001f3f]' : 'text-red-500'} ${getAccountIcon(acc.name) ? 'hidden' : ''}`}></i>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800 text-base">{acc.name}</span>
                                    <span className="text-gray-400 text-xs">{fetchedAssetsCount(acc.name, assets)} Transactions</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`font-bold text-base ${acc.balance >= 0 ? 'text-[#001f3f]' : 'text-red-500'}`}>
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

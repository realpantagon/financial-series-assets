import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { PantagonAsset } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ChevronRight, Wallet } from 'lucide-react';

export default function Dashboard() {
    const navigate = useNavigate();
    const [assets, setAssets] = useState<PantagonAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalAssetValue, setTotalAssetValue] = useState(0);
    const [accounts, setAccounts] = useState<{ name: string; balance: number }[]>([]);

    useEffect(() => { fetchAssets(); }, []);

    const fetchAssets = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('pantagon_assets').select('*').order('date', { ascending: false });
        if (!error) { const a = data || []; setAssets(a); calculateAssetView(a); }
        setLoading(false);
    };

    const calculateAssetView = (data: PantagonAsset[]) => {
        let total = 0;
        const accountMap: { [key: string]: number } = {};
        data.forEach(item => {
            const amount = Number(item.amount);
            const signed = item.type === 'IN' ? amount : -amount;
            total += signed;
            const acc = item.account_name || 'Unassigned';
            accountMap[acc] = (accountMap[acc] || 0) + signed;
        });
        setTotalAssetValue(total);
        const getRank = (name: string) => {
            const l = name.toLowerCase();
            if (l.includes('dime')) return 1; if (l.includes('scb')) return 2;
            if (l.includes('kbank')) return 3; if (l.includes('ttb')) return 4;
            if (l.includes('pvd')) return 5; if (l.includes('sso')) return 6;
            return 7;
        };
        setAccounts(
            Object.keys(accountMap).map(name => ({ name, balance: accountMap[name] }))
                .sort((a, b) => { const r = getRank(a.name) - getRank(b.name); return r !== 0 ? r : b.balance - a.balance; })
        );
    };

    const formatCurrency = (value: number) =>
        value.toLocaleString('en-US', { style: 'currency', currency: 'THB' });

    const getAccountIcon = (accountName: string): string | undefined => {
        const lower = accountName.toLowerCase();
        if (lower.includes('scb')) return '/scb.jpg';
        if (lower.includes('dime')) return '/Dime.png';
        if (lower.includes('kbank') || lower.includes('make')) return '/kbank.png';
        if (lower.includes('ttb')) return '/ttb.png';
        if (lower.includes('sso')) return '/SSO.jpg';
        return undefined;
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-4 pt-4 pb-20">
                <Skeleton className="h-32 w-full rounded-xl" />
                <div className="flex flex-col gap-2">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 pb-20 pt-4">
            {/* Net Worth Hero */}
            <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-card to-blue-500/5 p-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 to-transparent pointer-events-none" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 relative">
                    Total Net Worth
                </p>
                <div className="font-mono font-bold text-4xl text-foreground tracking-tight relative">
                    {formatCurrency(totalAssetValue)}
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/20 relative">
                    <span className="text-[11px] font-mono text-muted-foreground">{accounts.length} accounts</span>
                    <span className="text-border/50">·</span>
                    <span className="text-[11px] font-mono text-muted-foreground">{assets.length} transactions</span>
                </div>
            </div>

            {/* Accounts */}
            <div className="flex flex-col gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
                    Accounts
                </span>

                {accounts.length === 0 ? (
                    <div className="border border-dashed border-border/30 rounded-xl py-10 text-center text-muted-foreground text-sm">
                        No accounts yet. Add a transaction to get started.
                    </div>
                ) : accounts.map((acc) => {
                    const icon = getAccountIcon(acc.name);
                    const txCount = assets.filter(a => a.account_name === acc.name).length;
                    const isNegative = acc.balance < 0;

                    return (
                        <button
                            key={acc.name}
                            onClick={() => navigate(`/account/${encodeURIComponent(acc.name)}`)}
                            className="w-full text-left border border-border/30 rounded-xl bg-card/70 hover:border-border/60 hover:bg-card/90 transition-all duration-150 active:scale-[0.99] overflow-hidden"
                        >
                            <div className="flex items-center gap-3 p-3.5">
                                {/* Icon */}
                                <div className="size-10 rounded-full overflow-hidden border border-border/30 bg-muted/30 flex-shrink-0 flex items-center justify-center">
                                    {icon ? (
                                        <>
                                            <img src={icon} alt={acc.name} className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                                            <Wallet className={cn('size-4 hidden', isNegative ? 'text-rose-400' : 'text-primary')} />
                                        </>
                                    ) : (
                                        <Wallet className={cn('size-4', isNegative ? 'text-rose-400' : 'text-muted-foreground')} />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                    <span className="font-semibold text-foreground text-sm truncate">{acc.name}</span>
                                    <span className="text-[11px] font-mono text-muted-foreground">{txCount} transactions</span>
                                </div>

                                {/* Balance */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={cn('font-mono font-bold text-sm', isNegative ? 'text-rose-400' : 'text-foreground')}>
                                        {formatCurrency(acc.balance)}
                                    </span>
                                    <ChevronRight className="size-4 text-muted-foreground/30" />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

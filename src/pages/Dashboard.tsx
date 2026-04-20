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
            <div className="flex flex-col gap-3 pt-4 pb-20">
                <Skeleton className="h-28 w-full rounded-xl" />
                <div className="flex flex-col gap-2">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 pb-20 pt-4">
            {/* Net Worth Hero */}
            <div className="rounded-xl border border-cyan-500/15 bg-gradient-to-br from-[oklch(0.12_0.02_250)] to-[oklch(0.09_0.015_240)] p-5 relative overflow-hidden">
                <div className="h-px w-full absolute top-0 left-0 bg-gradient-to-r from-cyan-500/50 via-cyan-400/15 to-transparent" />
                <p className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground/40 font-bold mb-1 relative">
                    Total Net Worth
                </p>
                <div className="font-mono font-black text-4xl text-foreground tracking-tight relative leading-none">
                    {formatCurrency(totalAssetValue)}
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/15 relative">
                    <span className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">{accounts.length} accounts</span>
                    <span className="text-border/30 text-[9px]">·</span>
                    <span className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">{assets.length} transactions</span>
                </div>
            </div>

            {/* Accounts label */}
            <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.16em] px-1 mt-1">
                Accounts
            </span>

            {accounts.length === 0 ? (
                <div className="border border-dashed border-border/20 rounded-xl py-10 text-center text-muted-foreground/30 text-xs tracking-wider">
                    NO ACCOUNTS YET
                </div>
            ) : accounts.map((acc) => {
                const icon = getAccountIcon(acc.name);
                const txCount = assets.filter(a => a.account_name === acc.name).length;
                const isNegative = acc.balance < 0;

                return (
                    <button
                        key={acc.name}
                        onClick={() => navigate(`/account/${encodeURIComponent(acc.name)}`)}
                        className="w-full text-left border border-border/25 rounded-xl bg-[oklch(0.12_0.015_255)] hover:border-border/50 hover:bg-[oklch(0.13_0.015_255)] transition-all duration-150 active:scale-[0.99] overflow-hidden group"
                    >
                        <div className="flex items-center gap-3 p-3.5">
                            {/* Icon */}
                            <div className={cn(
                                'size-9 rounded-full overflow-hidden border flex-shrink-0 flex items-center justify-center',
                                icon ? 'border-border/25 bg-black/20' : isNegative ? 'border-rose-500/15 bg-rose-500/8' : 'border-cyan-500/15 bg-cyan-500/8'
                            )}>
                                {icon ? (
                                    <>
                                        <img src={icon} alt={acc.name} className="w-full h-full object-cover"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                                        <Wallet className={cn('size-4 hidden', isNegative ? 'text-rose-400' : 'text-cyan-400')} />
                                    </>
                                ) : (
                                    <Wallet className={cn('size-4', isNegative ? 'text-rose-400' : 'text-muted-foreground/40')} />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                <span className="font-bold text-sm text-foreground truncate">{acc.name}</span>
                                <span className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">{txCount} tx</span>
                            </div>

                            {/* Balance */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className={cn('font-mono font-black text-sm', isNegative ? 'text-rose-400' : 'text-foreground')}>
                                    {formatCurrency(acc.balance)}
                                </span>
                                <ChevronRight className="size-3.5 text-muted-foreground/20 group-hover:text-cyan-400/40 transition-colors" />
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

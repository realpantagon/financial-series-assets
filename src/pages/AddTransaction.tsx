import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, DollarSign, Tag, FileText, Loader2, ChevronLeft, ChevronDown } from 'lucide-react';

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
    const [accountOpen, setAccountOpen] = useState(false);

    useEffect(() => {
        if (location.state?.accountName) setAccountName(location.state.accountName);
    }, [location.state]);

    // Close dropdown on outside click
    useEffect(() => {
        if (!accountOpen) return;
        const handler = () => setAccountOpen(false);
        setTimeout(() => document.addEventListener('click', handler), 0);
        return () => document.removeEventListener('click', handler);
    }, [accountOpen]);

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
        const { error } = await supabase.from('pantagon_assets').insert([{
            account_name: accountName,
            type,
            amount: Number(amount),
            date,
            tag: tag || null,
            note: note || null
        }]);
        setLoading(false);

        if (error) {
            toast.error('Failed to save transaction', { description: error.message });
        } else {
            toast.success('Transaction saved');
            navigate('/');
        }
    };

    const isIn = type === 'IN';

    return (
        <div className="pt-4 pb-24">
            {/* Back button */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-cyan-400 transition-colors mb-4 tracking-[0.1em]"
            >
                <ChevronLeft className="size-3.5" />
                BACK
            </button>

            <div className="border border-border/30 bg-[oklch(0.11_0.014_255)] flex flex-col gap-5 overflow-visible">
                {/* Page header */}
                <div className="px-4 pt-4">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground font-bold">New Transaction</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-4">
                    {/* Type Toggle — rectangle style */}
                    <div className="grid grid-cols-2 gap-0 border border-border/30">
                        {(['IN', 'OUT'] as const).map((t) => {
                            const isSelected = type === t;
                            const isInType = t === 'IN';
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    className={cn(
                                        'flex items-center justify-center gap-2 py-3 px-3 transition-all text-xs font-bold tracking-[0.1em]',
                                        isSelected
                                            ? isInType
                                                ? 'bg-emerald-500/12 border-r border-border/20 text-emerald-400'
                                                : 'bg-rose-500/12 text-rose-400'
                                            : 'text-muted-foreground hover:bg-white/3 border-r border-border/20 last:border-r-0'
                                    )}
                                >
                                    <div className={cn(
                                        'size-5 rounded-full flex items-center justify-center border',
                                        isSelected
                                            ? isInType ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-rose-500/20 border-rose-500/40'
                                            : 'bg-white/5 border-border/20'
                                    )}>
                                        {isInType
                                            ? <ArrowDownLeft className={cn('size-3', isSelected ? 'text-emerald-400' : 'text-muted-foreground')} />
                                            : <ArrowUpRight className={cn('size-3', isSelected ? 'text-rose-400' : 'text-muted-foreground')} />
                                        }
                                    </div>
                                    {isInType ? 'INCOME' : 'EXPENSE'}
                                </button>
                            );
                        })}
                    </div>

                    {/* Amount */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            Amount (THB)
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value) || '')}
                                className="pl-8 text-lg font-black rounded-none border-border/30 bg-black/20 h-11 focus-visible:border-cyan-500/40 focus-visible:ring-cyan-500/10"
                                placeholder="0.00"
                                step="0.01"
                                min="0.01"
                                required
                            />
                        </div>
                    </div>

                    {/* Account — custom dropdown */}
                    <div className="flex flex-col gap-1.5 relative">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            Account
                        </label>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setAccountOpen(!accountOpen); }}
                            className={cn(
                                'w-full h-10 flex items-center justify-between px-3 border text-sm font-bold transition-all text-left rounded-none',
                                accountOpen ? 'border-cyan-500/40 bg-black/30 text-foreground' : 'border-border/30 bg-black/20 text-foreground',
                                !accountName && 'text-muted-foreground font-normal'
                            )}
                        >
                            <span>{accountName || 'Select account'}</span>
                            <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform shrink-0', accountOpen && 'rotate-180')} />
                        </button>

                        {/* Dropdown list — rendered in portal-like fixed position within the form */}
                        {accountOpen && (
                            <div
                                className="absolute left-0 right-0 top-[calc(100%+2px)] z-[100] border border-border/40 bg-[oklch(0.13_0.018_255)] shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {accountOptions.map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => { setAccountName(opt); setAccountOpen(false); }}
                                        className={cn(
                                            'w-full text-left px-3 py-2.5 text-sm border-b border-border/20 last:border-b-0 transition-colors',
                                            accountName === opt
                                                ? 'text-cyan-300 bg-cyan-500/8 font-bold'
                                                : 'text-foreground hover:bg-white/5 font-medium'
                                        )}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Date */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            Date
                        </label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            className="rounded-none border-border/30 bg-black/20 h-10 text-sm focus-visible:border-cyan-500/40"
                        />
                    </div>

                    {/* Tag */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            Tag <span className="text-muted-foreground/40 normal-case tracking-normal font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
                            <Input
                                type="text"
                                value={tag}
                                onChange={(e) => setTag(e.target.value)}
                                className="pl-8 rounded-none border-border/30 bg-black/20 h-10 text-sm focus-visible:border-cyan-500/40"
                                placeholder="Food, Transport, Salary…"
                            />
                        </div>
                    </div>

                    {/* Note */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            Note <span className="text-muted-foreground/40 normal-case tracking-normal font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 size-3.5 text-muted-foreground/40" />
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full pl-8 pr-3 py-2.5 bg-black/20 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10 resize-none min-h-[64px] font-mono rounded-none"
                                placeholder="Add details…"
                            />
                        </div>
                    </div>

                    {/* Submit — rectangle button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={cn(
                            'w-full h-11 text-xs font-bold tracking-[0.14em] border transition-all rounded-none',
                            isIn
                                ? 'bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/35 hover:border-emerald-400/55'
                                : 'bg-rose-500/12 hover:bg-rose-500/20 text-rose-300 border-rose-500/35 hover:border-rose-400/55'
                        )}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="size-3.5 animate-spin" />
                                SAVING…
                            </span>
                        ) : (
                            `+ SAVE ${isIn ? 'INCOME' : 'EXPENSE'}`
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

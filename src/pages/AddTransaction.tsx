import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, DollarSign, Tag, FileText, Loader2 } from 'lucide-react';

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
        if (location.state?.accountName) setAccountName(location.state.accountName);
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

    return (
        <div className="pt-4 pb-20">
            <div className="rounded-xl border border-border/30 bg-card/60 p-4 flex flex-col gap-5">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">New Transaction</p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {/* Type Toggle */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border/20">
                            {(['IN', 'OUT'] as const).map((t) => {
                                const isSelected = type === t;
                                const isIn = t === 'IN';
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setType(t)}
                                        className={cn(
                                            'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg transition-all',
                                            isSelected
                                                ? isIn
                                                    ? 'bg-emerald-500/15 border border-emerald-500/25'
                                                    : 'bg-rose-500/15 border border-rose-500/25'
                                                : 'text-muted-foreground hover:bg-card/50'
                                        )}
                                    >
                                        <div className={cn(
                                            'size-7 rounded-full flex items-center justify-center border',
                                            isSelected
                                                ? isIn ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-rose-500/20 border-rose-500/30'
                                                : 'bg-muted border-border/20'
                                        )}>
                                            {isIn
                                                ? <ArrowDownLeft className={cn('size-3.5', isSelected ? 'text-emerald-400' : 'text-muted-foreground')} />
                                                : <ArrowUpRight className={cn('size-3.5', isSelected ? 'text-rose-400' : 'text-muted-foreground')} />
                                            }
                                        </div>
                                        <span className={cn(
                                            'text-sm font-semibold',
                                            isSelected
                                                ? isIn ? 'text-emerald-400' : 'text-rose-400'
                                                : 'text-muted-foreground'
                                        )}>
                                            {isIn ? 'Income' : 'Expense'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <Separator />

                        {/* Amount */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Amount (USD)
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value) || '')}
                                    className="pl-9 text-lg font-semibold"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0.01"
                                    required
                                />
                            </div>
                        </div>

                        {/* Account */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Account
                            </label>
                            <Select value={accountName} onValueChange={setAccountName} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accountOptions.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Date
                            </label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>

                        {/* Tag */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Tag <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    value={tag}
                                    onChange={(e) => setTag(e.target.value)}
                                    className="pl-9"
                                    placeholder="Food, Transport, Salary…"
                                />
                            </div>
                        </div>

                        {/* Note */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Note <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 size-4 text-muted-foreground" />
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[72px]"
                                    placeholder="Add details…"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-1 h-11 text-sm font-semibold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                                    Saving…
                                </>
                            ) : (
                                'Save Transaction'
                            )}
                        </Button>
                    </form>
            </div>
        </div>
    );
}

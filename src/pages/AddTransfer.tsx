import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAccounts } from '@/lib/accounts';
import { AccountOption } from '@/components/AccountOption';
import { cn, getErrorMessage } from '@/lib/utils';
import { ArrowRightLeft, ChevronLeft, FileText, Loader2 } from 'lucide-react';

export default function AddTransfer() {
    const navigate = useNavigate();
    const { accounts: accountList } = useAccounts();
    const accountOptions = accountList.map(a => a.name);

    const [fromAccount, setFromAccount] = useState('');
    const [toAccount, setToAccount] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const sameAccount = !!fromAccount && fromAccount === toAccount;
    const canSave = !!fromAccount && !!toAccount && !sameAccount && Number(amount) > 0 && !!date;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) return;

        setSaving(true);
        try {
            const { error } = await supabase.from('pantagon_financial_transactions').insert([
                {
                    account_name: fromAccount,
                    type: 'OUT' as const,
                    amount: Number(amount),
                    date,
                    tag: 'Transfer',
                    note: note || `Transfer to ${toAccount}`,
                },
                {
                    account_name: toAccount,
                    type: 'IN' as const,
                    amount: Number(amount),
                    date,
                    tag: 'Transfer',
                    note: note || `Transfer from ${fromAccount}`,
                },
            ]);
            if (error) throw error;

            toast.success('Transfer saved');
            navigate('/');
        } catch (err) {
            toast.error('Failed to save transfer', { description: getErrorMessage(err) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="pt-4 pb-24">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-cyan-400 transition-colors mb-4 tracking-[0.1em]"
            >
                <ChevronLeft className="size-3.5" />
                BACK
            </button>

            <div className="border border-border/30 bg-gray-100 dark:bg-[oklch(0.11_0.014_255)] flex flex-col gap-5 overflow-visible">
                <div className="px-4 pt-4">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground font-bold">
                        Transfer Between Accounts
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-4">
                    {/* From account */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            From (Expense)
                        </label>
                        <Select value={fromAccount} onValueChange={setFromAccount}>
                            <SelectTrigger className="h-10 w-full rounded-none border-border/30 bg-black/20 text-sm">
                                <SelectValue placeholder="Select source account" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none border border-border/60 bg-slate-50 dark:bg-[oklch(0.13_0.018_255)] shadow-2xl backdrop-blur-none">
                                {accountOptions.map(opt => (
                                    <SelectItem key={opt} value={opt} disabled={opt === toAccount}>
                                        <AccountOption name={opt} />
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Direction indicator */}
                    <div className="flex items-center justify-center -my-2">
                        <div className="size-7 rounded-full bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
                            <ArrowRightLeft className="size-3.5 text-cyan-400" />
                        </div>
                    </div>

                    {/* To account */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            To (Income)
                        </label>
                        <Select value={toAccount} onValueChange={setToAccount}>
                            <SelectTrigger className="h-10 w-full rounded-none border-border/30 bg-black/20 text-sm">
                                <SelectValue placeholder="Select destination account" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none border border-border/60 bg-slate-50 dark:bg-[oklch(0.13_0.018_255)] shadow-2xl backdrop-blur-none">
                                {accountOptions.map(opt => (
                                    <SelectItem key={opt} value={opt} disabled={opt === fromAccount}>
                                        <AccountOption name={opt} />
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {sameAccount && (
                            <p className="text-[10px] text-rose-400 font-semibold tracking-wide">
                                Source and destination must be different accounts
                            </p>
                        )}
                    </div>

                    {/* Amount */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            Amount (THB)
                        </label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            className="text-lg font-black rounded-none border-border/30 bg-black/20 h-11 focus-visible:border-cyan-500/40 focus-visible:ring-cyan-500/10"
                            placeholder="0.00"
                            step="0.01"
                            min="0.01"
                            required
                        />
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

                    <Button
                        type="submit"
                        disabled={!canSave || saving}
                        className={cn(
                            'w-full h-11 text-xs font-bold tracking-[0.14em] border transition-all rounded-none',
                            canSave
                                ? 'bg-cyan-500/12 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/35 hover:border-cyan-400/55'
                                : 'bg-white/3 text-muted-foreground/40 border-border/20 cursor-not-allowed'
                        )}
                    >
                        {saving ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="size-3.5 animate-spin" />
                                SAVING…
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <ArrowRightLeft className="size-3.5" />
                                SAVE TRANSFER
                            </span>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}

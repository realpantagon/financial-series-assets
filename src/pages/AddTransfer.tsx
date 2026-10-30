import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { db } from '../db';
import { useAccounts } from '@/lib/accounts';
import { useBalances } from '@/lib/balances';
import { cn, fmtTHB, getErrorMessage } from '@/lib/utils';
import { AccountPicker, Field, PrimaryButton, fieldClass } from '@/components/ios';

export default function AddTransfer() {
    const navigate = useNavigate();
    const { accounts } = useAccounts();
    const { balances } = useBalances();
    const names = accounts.map(a => a.name);

    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const amt = Number(amount) || 0;
    const same = !!from && from === to;
    const canSave = !!from && !!to && !same && amt > 0 && !!date;

    const preview = (name: string, sign: 1 | -1) => {
        const cur = balances[name] ?? 0;
        return (
            <p className="text-[13px] text-muted-foreground tabular-nums">
                Now {fmtTHB(cur)}
                {amt > 0 && <> → <span className={cn('font-medium', sign > 0 ? 'text-emerald-500' : 'text-rose-500')}>{fmtTHB(cur + sign * amt)}</span></>}
            </p>
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) return;
        setSaving(true);
        try {
            const { error } = await db.from('pantagon_financial_transactions').insert([
                { account_name: from, type: 'OUT' as const, amount: amt, date, tag: 'Transfer', note: note || `Transfer to ${to}` },
                { account_name: to, type: 'IN' as const, amount: amt, date, tag: 'Transfer', note: note || `Transfer from ${from}` },
            ]);
            if (error) throw error;
            toast.success('Transfer saved');
            navigate('/');
        } catch (err) {
            toast.error('Could not save transfer', { description: getErrorMessage(err) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field label="Amount (THB)">
                <input
                    type="number" inputMode="decimal" step="0.01" min="0.01" required autoFocus
                    value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00" className={cn(fieldClass, 'h-16 text-[34px] font-semibold tabular-nums')}
                />
            </Field>

            <AccountPicker label="From" value={from} onChange={setFrom} accounts={names} balances={balances}
                disabledNames={to ? [to] : []} hint={from && preview(from, -1)} />
            <AccountPicker label="To" value={to} onChange={setTo} accounts={names} balances={balances}
                disabledNames={from ? [from] : []} hint={to && preview(to, 1)} />

            <Field label="Date">
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={fieldClass} />
            </Field>
            <Field label="Note (optional)">
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note" className={fieldClass} />
            </Field>

            <PrimaryButton type="submit" disabled={!canSave} loading={saving}>Transfer</PrimaryButton>
        </form>
    );
}

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { db } from '../db';
import { useAccounts } from '@/lib/accounts';
import { useBalances } from '@/lib/balances';
import { cn, fmtTHB } from '@/lib/utils';
import { AccountPicker, Field, PrimaryButton, Segmented, fieldClass } from '@/components/ios';

export default function AddTransaction() {
    const navigate = useNavigate();
    const location = useLocation();
    const { accounts } = useAccounts();
    const { balances } = useBalances();
    const [accountName, setAccountName] = useState<string>(() => location.state?.accountName ?? '');
    const [type, setType] = useState<'IN' | 'OUT'>('OUT');
    const [amount, setAmount] = useState<number | ''>('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [tag, setTag] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const current = accountName ? balances[accountName] ?? 0 : 0;
    const delta = (type === 'IN' ? 1 : -1) * (Number(amount) || 0);
    const canSave = !!accountName && Number(amount) > 0 && !!date;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) return;
        setSaving(true);
        const { error } = await db.from('pantagon_financial_transactions').insert([{
            account_name: accountName, type, amount: Number(amount), date,
            tag: tag || null, note: note || null,
        }]);
        setSaving(false);
        if (error) toast.error('Could not save transaction', { description: error.message });
        else { toast.success(type === 'IN' ? 'Income saved' : 'Expense saved'); navigate(-1); }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Segmented
                value={type} onChange={setType}
                options={[{ value: 'OUT', label: 'Expense', tone: 'out' }, { value: 'IN', label: 'Income', tone: 'in' }]}
            />

            <Field label="Amount (THB)">
                <input
                    type="number" inputMode="decimal" step="0.01" min="0.01" required autoFocus
                    value={amount}
                    onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className={cn(fieldClass, 'h-16 text-[34px] font-semibold tabular-nums')}
                />
            </Field>

            <AccountPicker
                label="Account" value={accountName} onChange={setAccountName}
                accounts={accounts.map(a => a.name)} balances={balances}
                hint={accountName && (
                    <p className="text-[13px] text-muted-foreground tabular-nums">
                        Now {fmtTHB(current)}
                        {delta !== 0 && <> → <span className={cn('font-medium', delta > 0 ? 'text-emerald-500' : 'text-rose-500')}>{fmtTHB(current + delta)}</span></>}
                    </p>
                )}
            />

            <Field label="Date">
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={fieldClass} />
            </Field>

            <Field label="Tag (optional)">
                <input type="text" value={tag} onChange={e => setTag(e.target.value)} placeholder="Food, Transport, Salary…" className={fieldClass} />
            </Field>

            <Field label="Note (optional)">
                <textarea
                    value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Add details"
                    className={cn(fieldClass, 'h-auto py-3 resize-none')}
                />
            </Field>

            <PrimaryButton type="submit" disabled={!canSave} loading={saving}>
                Save {type === 'IN' ? 'income' : 'expense'}
            </PrimaryButton>
        </form>
    );
}

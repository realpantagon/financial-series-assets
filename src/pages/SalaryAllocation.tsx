import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { db } from '../db';
import type { PantagonSalaryLog, SalaryAllocationRow } from '../types';
import { useAccounts } from '@/lib/accounts';
import { useBalances } from '@/lib/balances';
import { cn, fmtTHB, getErrorMessage } from '@/lib/utils';
import { AccountPicker, Field, PrimaryButton, SectionLabel, fieldClass } from '@/components/ios';
import { ArrowRight, Copy, Plus, X } from 'lucide-react';

interface Row { key: number; account_name: string; amount: number | '' }

let rowKeySeq = 0;
const newRow = (account_name = '', amount: number | '' = ''): Row => ({ key: rowKeySeq++, account_name, amount });

export default function SalaryAllocation() {
    const navigate = useNavigate();
    const [totalSalary, setTotalSalary] = useState<number | ''>('');
    const [rows, setRows] = useState<Row[]>([newRow()]);
    const [date] = useState(() => new Date().toISOString().split('T')[0]);
    const [lastLog, setLastLog] = useState<PantagonSalaryLog | null>(null);
    const [saving, setSaving] = useState(false);
    const { accounts: accountList } = useAccounts();
    const { balances } = useBalances();
    const accountNames = accountList.map(a => a.name);

    useEffect(() => {
        db.from('pantagon_financial_salary_logs')
            .select('*')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }: { data: PantagonSalaryLog | null }) => { if (data) setLastLog(data); });
    }, []);

    const applyTemplate = () => {
        if (!lastLog) return;
        setTotalSalary(Number(lastLog.total_amount));
        setRows((lastLog.allocations || []).map((a: SalaryAllocationRow) => newRow(a.account_name, Number(a.amount))));
        toast.success('Copied last month’s split');
    };

    const updateRow = (key: number, patch: Partial<Row>) =>
        setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    const removeRow = (key: number) => setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : prev));

    const allocated = useMemo(
        () => rows.reduce((sum, r) => sum + (r.account_name ? Number(r.amount) || 0 : 0), 0),
        [rows]
    );
    const remaining = Math.round(((Number(totalSalary) || 0) - allocated) * 100) / 100;
    const used = useMemo(() => rows.map(r => r.account_name).filter(Boolean), [rows]);
    const hasDuplicates = new Set(used).size !== used.length;
    const rowsValid = rows.every(r => r.account_name && Number(r.amount) > 0);
    const canSave = Number(totalSalary) > 0 && rowsValid && !hasDuplicates && remaining === 0;

    const status =
        remaining === 0 && Number(totalSalary) > 0
            ? { text: 'Fully allocated', tone: 'text-emerald-500' }
            : remaining > 0
                ? { text: `${fmtTHB(remaining)} left to allocate`, tone: 'text-amber-500' }
                : remaining < 0
                    ? { text: `${fmtTHB(-remaining)} over salary`, tone: 'text-rose-500' }
                    : { text: 'Enter your salary to begin', tone: 'text-muted-foreground' };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) return;
        setSaving(true);
        try {
            const allocations: SalaryAllocationRow[] = rows.map(r => ({ account_name: r.account_name, amount: Number(r.amount) }));
            const { error: txError } = await db.from('pantagon_financial_transactions').insert(
                allocations.map(a => ({
                    account_name: a.account_name, type: 'IN' as const, amount: a.amount, date,
                    tag: 'Salary', note: `Salary allocation - ${a.account_name}`,
                }))
            );
            if (txError) throw txError;

            const { error: logError } = await db.from('pantagon_financial_salary_logs').upsert(
                { month: format(new Date(date), 'yyyy-MM'), total_amount: Number(totalSalary), allocations, date },
                { onConflict: 'month' }
            );
            if (logError) throw logError;

            toast.success('Salary allocated');
            navigate('/');
        } catch (err) {
            toast.error('Could not save allocation', { description: getErrorMessage(err) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col">
            <Field label="Total salary (THB)">
                <input
                    type="number" inputMode="decimal" step="0.01" min="0.01" required
                    value={totalSalary}
                    onChange={e => setTotalSalary(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className={cn(fieldClass, 'h-14 text-[28px] font-semibold tabular-nums')}
                />
            </Field>

            <SectionLabel
                right={lastLog && (
                    <button type="button" onClick={applyTemplate} className="press flex items-center gap-1 text-[15px] text-primary h-8">
                        <Copy className="size-4" /> Copy last month
                    </button>
                )}
            >
                Split across accounts
            </SectionLabel>

            <div className="flex flex-col gap-3">
                {rows.map(row => {
                    const current = row.account_name ? balances[row.account_name] ?? 0 : 0;
                    const add = Number(row.amount) || 0;
                    const dup = row.account_name && used.filter(n => n === row.account_name).length > 1;
                    return (
                        <div key={row.key} className={cn('rounded-2xl bg-card p-3 flex flex-col gap-3', dup && 'ring-1 ring-rose-500/60')}>
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <AccountPicker
                                        label="Account"
                                        value={row.account_name}
                                        onChange={name => updateRow(row.key, { account_name: name })}
                                        accounts={accountNames}
                                        balances={balances}
                                        disabledNames={used}
                                    />
                                </div>
                                <button
                                    type="button" onClick={() => removeRow(row.key)} disabled={rows.length === 1}
                                    aria-label="Remove account"
                                    className="press size-11 mt-[22px] shrink-0 flex items-center justify-center rounded-full text-muted-foreground disabled:opacity-25"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <input
                                type="number" inputMode="decimal" step="0.01" min="0.01"
                                value={row.amount}
                                onChange={e => updateRow(row.key, { amount: e.target.value === '' ? '' : Number(e.target.value) })}
                                placeholder="Amount to add"
                                aria-label="Amount to add"
                                className={cn(fieldClass, 'bg-muted tabular-nums text-right text-[20px] font-semibold')}
                            />

                            {/* Balance before → after */}
                            {row.account_name && (
                                <div className="rounded-xl bg-muted px-3 py-2.5 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[12px] text-muted-foreground">Now</p>
                                        <p className="text-[15px] font-medium tabular-nums truncate">{fmtTHB(current)}</p>
                                    </div>
                                    <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0 text-right">
                                        <p className="text-[12px] text-muted-foreground">After{add > 0 ? ` (+${fmtTHB(add)})` : ''}</p>
                                        <p className={cn('text-[15px] font-semibold tabular-nums truncate', add > 0 ? 'text-emerald-500' : '')}>
                                            {fmtTHB(current + add)}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {dup && <p className="text-[13px] text-rose-500">This account is already in the split.</p>}
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={() => setRows(prev => [...prev, newRow()])}
                    disabled={accountNames.length > 0 && rows.length >= accountNames.length}
                    className="press h-12 rounded-2xl border border-dashed border-border flex items-center justify-center gap-2 text-[17px] text-primary disabled:opacity-30"
                >
                    <Plus className="size-5" /> Add account
                </button>
            </div>

            {/* Pinned summary + save */}
            <div className="sticky bottom-0 -mx-4 mt-6 px-4 pt-3 pb-3 bg-background/90 backdrop-blur-xl border-t border-border/60">
                <div className="flex items-center justify-between pb-3 text-[15px]">
                    <span className="text-muted-foreground">Allocated {fmtTHB(allocated)}</span>
                    <span className={cn('font-medium', status.tone)}>{status.text}</span>
                </div>
                <PrimaryButton type="submit" disabled={!canSave} loading={saving}>
                    Save allocation
                </PrimaryButton>
            </div>
        </form>
    );
}


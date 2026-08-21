import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '../supabaseClient';
import type { PantagonSalaryLog, SalaryAllocationRow } from '../types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ChevronLeft, Plus, X, Copy, Loader2, Wallet } from 'lucide-react';

interface Row {
    key: number;
    account_name: string;
    amount: number | '';
}

let rowKeySeq = 0;
const newRow = (account_name = '', amount: number | '' = ''): Row => ({ key: rowKeySeq++, account_name, amount });

export default function SalaryAllocation() {
    const navigate = useNavigate();
    const [totalSalary, setTotalSalary] = useState<number | ''>('');
    const [rows, setRows] = useState<Row[]>([newRow()]);
    const [date] = useState<string>(new Date().toISOString().split('T')[0]);
    const [lastLog, setLastLog] = useState<PantagonSalaryLog | null>(null);
    const [loadingLast, setLoadingLast] = useState(true);
    const [saving, setSaving] = useState(false);
    const { accounts: accountList } = useAccounts();
    const accountOptions = accountList.map(a => a.name);

    const fetchLastLog = useCallback(async () => {
        setLoadingLast(true);
        const { data, error } = await supabase
            .from('pantagon_financial_salary_logs')
            .select('*')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!error && data) setLastLog(data as PantagonSalaryLog);
        setLoadingLast(false);
    }, []);

    useEffect(() => { fetchLastLog(); }, [fetchLastLog]);

    const applyTemplate = () => {
        if (!lastLog) return;
        setTotalSalary(Number(lastLog.total_amount));
        setRows(
            (lastLog.allocations || []).map((a: SalaryAllocationRow) => newRow(a.account_name, Number(a.amount)))
        );
        toast.success('Copied allocation from last month');
    };

    const addRow = () => setRows(prev => [...prev, newRow()]);
    const removeRow = (key: number) => setRows(prev => prev.length > 1 ? prev.filter(r => r.key !== key) : prev);

    const updateRow = (key: number, patch: Partial<Row>) =>
        setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));

    const allocatedTotal = useMemo(
        () => rows.reduce((sum, r) => sum + (r.account_name ? (Number(r.amount) || 0) : 0), 0),
        [rows]
    );

    const remaining = (Number(totalSalary) || 0) - allocatedTotal;

    const usedAccounts = useMemo(() => new Set(rows.map(r => r.account_name).filter(Boolean)), [rows]);

    const hasDuplicateAccounts = useMemo(() => {
        const names = rows.map(r => r.account_name).filter(Boolean);
        return new Set(names).size !== names.length;
    }, [rows]);

    const rowsValid = rows.length > 0 && rows.every(r => r.account_name && Number(r.amount) > 0);
    const canSave = Number(totalSalary) > 0 && rowsValid && !hasDuplicateAccounts && remaining === 0;

    const formatCurrency = (value: number) =>
        value.toLocaleString('en-US', { style: 'currency', currency: 'THB' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) return;

        setSaving(true);
        try {
            const allocations: SalaryAllocationRow[] = rows.map(r => ({
                account_name: r.account_name,
                amount: Number(r.amount),
            }));

            const { error: txError } = await supabase.from('pantagon_financial_transactions').insert(
                allocations.map(a => ({
                    account_name: a.account_name,
                    type: 'IN' as const,
                    amount: a.amount,
                    date,
                    tag: 'Salary',
                    note: `Salary allocation - ${a.account_name}`,
                }))
            );
            if (txError) throw txError;

            const { error: logError } = await supabase
                .from('pantagon_financial_salary_logs')
                .upsert(
                    {
                        month: format(new Date(date), 'yyyy-MM'),
                        total_amount: Number(totalSalary),
                        allocations,
                        date,
                    },
                    { onConflict: 'month' }
                );
            if (logError) throw logError;

            toast.success('Salary allocation saved');
            navigate('/');
        } catch (err) {
            toast.error('Failed to save', { description: getErrorMessage(err) });
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
                <div className="px-4 pt-4 flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground font-bold">
                        Salary Allocation
                    </p>
                    {!loadingLast && lastLog && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={applyTemplate}
                            className="h-7 text-[10px] gap-1 rounded-none"
                        >
                            <Copy className="size-3" />
                            Copy from last month
                        </Button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-4">
                    {/* Total salary */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            Total Salary (THB)
                        </label>
                        <Input
                            type="number"
                            value={totalSalary}
                            onChange={(e) => setTotalSalary(e.target.value === '' ? '' : Number(e.target.value))}
                            className="text-lg font-black rounded-none border-border/30 bg-black/20 h-11 focus-visible:border-cyan-500/40 focus-visible:ring-cyan-500/10"
                            placeholder="0.00"
                            step="0.01"
                            min="0.01"
                            required
                        />
                    </div>

                    {/* Allocation rows */}
                    <div className="flex flex-col gap-2.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.14em]">
                            Allocations
                        </label>

                        {rows.map((row) => {
                            const duplicate = row.account_name && rows.filter(r => r.account_name === row.account_name).length > 1;
                            return (
                                <div key={row.key} className="flex items-center gap-2">
                                    <Select
                                        value={row.account_name}
                                        onValueChange={(v) => updateRow(row.key, { account_name: v })}
                                    >
                                        <SelectTrigger className={cn('h-10 flex-1 rounded-none border-border/30 bg-black/20 text-sm', duplicate && 'border-rose-500/50')}>
                                            <SelectValue placeholder="Select account" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-none border border-border/60 bg-slate-50 dark:bg-[oklch(0.13_0.018_255)] shadow-2xl backdrop-blur-none">
                                            {accountOptions.map(opt => (
                                                <SelectItem
                                                    key={opt}
                                                    value={opt}
                                                    disabled={usedAccounts.has(opt) && row.account_name !== opt}
                                                >
                                                    <AccountOption name={opt} />
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Input
                                        type="number"
                                        value={row.amount}
                                        onChange={(e) => updateRow(row.key, { amount: e.target.value === '' ? '' : Number(e.target.value) })}
                                        className="w-28 h-10 rounded-none border-border/30 bg-black/20 text-sm text-right font-mono"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0.01"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => removeRow(row.key)}
                                        disabled={rows.length === 1}
                                        className="size-10 flex items-center justify-center text-muted-foreground/50 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            );
                        })}

                        <button
                            type="button"
                            onClick={addRow}
                            disabled={accountOptions.length > 0 && rows.length >= accountOptions.length}
                            className="flex items-center justify-center gap-1.5 h-9 border border-dashed border-border/30 text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/30 transition-colors text-xs font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Plus className="size-3.5" />
                            Add account
                        </button>

                        {hasDuplicateAccounts && (
                            <p className="text-[10px] text-rose-400 font-semibold tracking-wide">
                                Duplicate accounts are not allowed
                            </p>
                        )}
                    </div>

                    {/* Remaining status */}
                    <div className={cn(
                        'flex items-center justify-between px-3 py-2.5 border text-xs font-bold tracking-wide',
                        remaining === 0
                            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                            : remaining > 0
                                ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
                                : 'border-rose-500/35 bg-rose-500/10 text-rose-300'
                    )}>
                        <span>
                            {remaining === 0
                                ? 'Fully allocated'
                                : remaining > 0
                                    ? 'Remaining'
                                    : 'Over-allocated'}
                        </span>
                        <span className="font-mono">
                            {remaining === 0 ? '' : remaining > 0 ? '+' : '-'}
                            {formatCurrency(Math.abs(remaining))}
                        </span>
                    </div>

                    <button
                        type="submit"
                        disabled={!canSave || saving}
                        className={cn(
                            'w-full h-11 text-xs font-bold tracking-[0.14em] border transition-all rounded-none',
                            canSave
                                ? 'bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/35 hover:border-emerald-400/55'
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
                                <Wallet className="size-3.5" />
                                SAVE ALLOCATION
                            </span>
                        )}
                    </button>
                </form>

                {loadingLast && (
                    <div className="px-4 pb-4">
                        <Skeleton className="h-7 w-40" />
                    </div>
                )}
            </div>
        </div>
    );
}

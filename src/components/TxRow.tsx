import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { FinancialTransaction } from '../types';
import { cn, fmtTHB } from '@/lib/utils';
import { Avatar } from '@/components/ios';

export const fmtDay = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** One ledger line. `showAccount` swaps the secondary label between account and note. */
export function TxRow({ tx, showAccount = true }: { tx: FinancialTransaction; showAccount?: boolean }) {
    const isIn = tx.type === 'IN';
    return (
        <div className="flex items-center gap-3 px-4 min-h-[64px] py-2">
            {showAccount ? (
                <Avatar name={tx.account_name} size={40} />
            ) : (
                <span className={cn(
                    'size-10 rounded-full shrink-0 flex items-center justify-center',
                    isIn ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                )}>
                    {isIn ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                </span>
            )}
            <div className="flex-1 min-w-0">
                <p className="truncate text-[17px] font-medium leading-snug">{tx.tag || (isIn ? 'Income' : 'Expense')}</p>
                <p className="truncate text-[13px] text-muted-foreground">
                    {fmtDay(tx.date)}{showAccount ? ` · ${tx.account_name}` : tx.note ? ` · ${tx.note}` : ''}
                </p>
            </div>
            <span className={cn('text-[17px] font-semibold tabular-nums shrink-0', isIn ? 'text-emerald-500' : 'text-foreground')}>
                {isIn ? '+' : '-'}{fmtTHB(Number(tx.amount))}
            </span>
        </div>
    );
}

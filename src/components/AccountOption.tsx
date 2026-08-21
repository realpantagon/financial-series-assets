import { Wallet } from 'lucide-react';
import { getAccountIcon } from '@/lib/accounts';

export function AccountOption({ name }: { name: string }) {
    const icon = getAccountIcon(name);
    return (
        <span className="flex items-center gap-2 min-w-0">
            {icon ? (
                <img
                    src={icon}
                    alt=""
                    className="size-5 rounded-full object-cover border border-border/40 shrink-0"
                />
            ) : (
                <span className="size-5 rounded-full bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
                    <Wallet className="size-2.5 text-cyan-400" />
                </span>
            )}
            <span className="truncate">{name}</span>
        </span>
    );
}

import { useState, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Check, ChevronDown, Loader2, Wallet } from 'lucide-react';
import { cn, fmtTHB } from '@/lib/utils';
import { getAccountIcon } from '@/lib/accounts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// ─── Layout primitives (iOS inset-grouped style) ──────────────────────────────

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
    return (
        <div className="flex items-end justify-between px-1 pt-6 pb-2">
            <h2 className="text-[13px] font-medium text-muted-foreground">{children}</h2>
            {right}
        </div>
    );
}

/** Rounded card whose children are separated by hairlines. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn(
            'rounded-2xl bg-card overflow-hidden',
            '[&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-border/60',
            className
        )}>
            {children}
        </div>
    );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
    const icon = getAccountIcon(name);
    const [broken, setBroken] = useState(false);
    return (
        <span
            className="shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center"
            style={{ width: size, height: size }}
        >
            {icon && !broken
                ? <img src={icon} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
                : <Wallet className="text-muted-foreground" style={{ width: size * 0.45, height: size * 0.45 }} />}
        </span>
    );
}

// ─── Form primitives ──────────────────────────────────────────────────────────

export const fieldClass =
    'w-full h-12 rounded-xl bg-card px-4 text-foreground placeholder:text-muted-foreground/60 outline-none border border-transparent focus:border-primary/60 transition-colors';

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
    return (
        <label className="block">
            <span className="block px-1 pb-1.5 text-[13px] font-medium text-muted-foreground">{label}</span>
            {children}
            {hint && <span className="block px-1 pt-1.5 text-[13px] text-muted-foreground">{hint}</span>}
        </label>
    );
}

export function Segmented<T extends string>({
    value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; tone?: 'in' | 'out' }[] }) {
    return (
        <div className="grid p-1 rounded-xl bg-muted" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="tablist">
            {options.map(o => {
                const on = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            'press h-10 rounded-[10px] text-[15px] font-semibold transition-all',
                            on ? 'bg-card shadow-sm' : 'text-muted-foreground',
                            on && o.tone === 'in' && 'text-emerald-500',
                            on && o.tone === 'out' && 'text-rose-500',
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

export function PrimaryButton({
    children, loading, disabled, className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
    return (
        <button
            {...rest}
            disabled={disabled || loading}
            className={cn(
                'press w-full h-[52px] rounded-2xl text-[17px] font-semibold flex items-center justify-center gap-2',
                'bg-primary text-primary-foreground disabled:opacity-40 disabled:active:scale-100',
                className
            )}
        >
            {loading && <Loader2 className="size-5 animate-spin" />}
            {children}
        </button>
    );
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

export function BottomSheet({
    open, onOpenChange, title, children,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 animate-backdrop" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className="fixed z-[61] inset-x-0 bottom-0 mx-auto max-w-[430px] max-h-[82dvh] flex flex-col rounded-t-3xl bg-background animate-sheet-up outline-none"
                >
                    <div className="pt-2 pb-1 flex justify-center"><span className="h-1 w-9 rounded-full bg-border" /></div>
                    <Dialog.Title className="px-5 pb-3 pt-1 text-[17px] font-semibold text-center">{title}</Dialog.Title>
                    <div className="scroll-y px-4 pb-4 safe-bottom">{children}</div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

/** Tap-to-pick account field. Each option — and the chosen value — shows its current balance. */
export function AccountPicker({
    label, value, onChange, accounts, balances, disabledNames = [], placeholder = 'Select account', hint,
}: {
    label: string;
    value: string;
    onChange: (name: string) => void;
    accounts: string[];
    balances: Record<string, number>;
    disabledNames?: string[];
    placeholder?: string;
    hint?: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <span className="block px-1 pb-1.5 text-[13px] font-medium text-muted-foreground">{label}</span>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="press w-full h-14 rounded-xl bg-card px-3 flex items-center gap-3 text-left"
            >
                {value ? <Avatar name={value} size={34} /> : <span className="size-[34px] rounded-full bg-muted shrink-0" />}
                <span className={cn('flex-1 min-w-0 truncate text-[17px]', !value && 'text-muted-foreground/70')}>
                    {value || placeholder}
                </span>
                <ChevronDown className="size-5 text-muted-foreground shrink-0" />
            </button>
            {hint && <div className="px-1 pt-1.5">{hint}</div>}

            <BottomSheet open={open} onOpenChange={setOpen} title={label}>
                <Group>
                    {accounts.map(name => {
                        const disabled = disabledNames.includes(name) && name !== value;
                        return (
                            <button
                                key={name}
                                type="button"
                                disabled={disabled}
                                onClick={() => { onChange(name); setOpen(false); }}
                                className="press w-full flex items-center gap-3 px-4 min-h-[60px] text-left disabled:opacity-35"
                            >
                                <Avatar name={name} size={36} />
                                <span className="flex-1 min-w-0">
                                    <span className="block truncate text-[17px]">{name}</span>
                                    <span className="block text-[13px] text-muted-foreground tabular-nums">{fmtTHB(balances[name] ?? 0)}</span>
                                </span>
                                {name === value && <Check className="size-5 text-primary" strokeWidth={2.5} />}
                            </button>
                        );
                    })}
                </Group>
            </BottomSheet>
        </div>
    );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
    return (
        <div className="py-16 text-center">
            <p className="text-[17px] font-semibold">{title}</p>
            {body && <p className="text-[15px] text-muted-foreground mt-1">{body}</p>}
        </div>
    );
}

/** Pill filter row (single choice) — scrolls sideways instead of wrapping. */
export function Chips<T extends string>({
    value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
    return (
        <ToggleGroup
            type="single" variant="chip" value={value}
            onValueChange={v => onChange((v || value) as T)}
            className={cn('scroll-x flex-nowrap -mx-4 px-4', className)}
        >
            {options.map(o => <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>)}
        </ToggleGroup>
    );
}

/** Large currency figure: small symbol and muted decimals so the baht digits carry the weight. */
export function Money({ value, className, size = 'lg', symbol = '฿' }: { value: number; className?: string; size?: 'lg' | 'md'; symbol?: string }) {
    const abs = Math.abs(value);
    const [whole, cents] = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
    const big = size === 'lg';
    return (
        <span className={cn('tabular-nums inline-flex items-baseline whitespace-nowrap', className)}>
            {value < 0 && <span className={big ? 'text-[32px] mr-1' : 'text-[24px] mr-0.5'}>−</span>}
            <span className={cn('font-medium text-muted-foreground', big ? 'text-[24px] mr-1.5' : 'text-[18px] mr-1')}>{symbol}</span>
            <span className={cn('font-semibold', big ? 'text-[44px] leading-none' : 'text-[34px] leading-none')}>{whole}</span>
            <span className={cn('font-medium text-muted-foreground', big ? 'text-[24px] ml-0.5' : 'text-[18px] ml-0.5')}>.{cents}</span>
        </span>
    );
}

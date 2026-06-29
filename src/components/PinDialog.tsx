import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';

interface PinDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Correct PIN as a string of digits, e.g. "2460". */
    correctPin: string;
    /** Called once the correct PIN is entered. */
    onSuccess: () => void;
    title?: string;
    description?: string;
}

/**
 * OTP-style PIN gate. Renders `correctPin.length` single-digit boxes with
 * auto-advance, validates on completion, and shakes + clears on a wrong code.
 */
export function PinDialog({
    open,
    onOpenChange,
    correctPin,
    onSuccess,
    title = 'Enter PIN',
    description = 'Enter your code to reveal balances',
}: PinDialogProps) {
    const length = correctPin.length;
    const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''));
    const [error, setError] = useState(false);
    const inputs = useRef<Array<HTMLInputElement | null>>([]);

    // Reset and focus the first box whenever the dialog opens.
    useEffect(() => {
        if (open) {
            setDigits(Array(length).fill(''));
            setError(false);
            // Defer focus until the dialog content is mounted.
            const t = setTimeout(() => inputs.current[0]?.focus(), 50);
            return () => clearTimeout(t);
        }
    }, [open, length]);

    const submit = (code: string) => {
        if (code === correctPin) {
            onSuccess();
            onOpenChange(false);
        } else {
            setError(true);
            setDigits(Array(length).fill(''));
            setTimeout(() => {
                setError(false);
                inputs.current[0]?.focus();
            }, 450);
        }
    };

    const handleChange = (index: number, raw: string) => {
        const digit = raw.replace(/\D/g, '').slice(-1); // keep only the last typed digit
        if (!digit && raw !== '') return;

        const next = [...digits];
        next[index] = digit;
        setDigits(next);

        if (digit && index < length - 1) {
            inputs.current[index + 1]?.focus();
        }

        if (next.every(d => d !== '')) {
            submit(next.join(''));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
        if (!pasted) return;
        const next = Array(length).fill('').map((_, i) => pasted[i] ?? '');
        setDigits(next);
        const lastFilled = Math.min(pasted.length, length) - 1;
        inputs.current[lastFilled]?.focus();
        if (pasted.length === length) submit(pasted);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xs bg-card border border-border/40 shadow-2xl">
                <DialogHeader className="items-center text-center">
                    <div className="size-11 rounded-full bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center mb-1">
                        <Lock className="size-5 text-cyan-400" strokeWidth={2} />
                    </div>
                    <DialogTitle className="font-mono tracking-tight">{title}</DialogTitle>
                    <DialogDescription className="text-[11px]">{description}</DialogDescription>
                </DialogHeader>

                <div
                    className={cn(
                        'flex items-center justify-center gap-2.5 py-2',
                        error && 'animate-pin-shake'
                    )}
                >
                    {digits.map((d, i) => (
                        <input
                            key={i}
                            ref={el => { inputs.current[i] = el; }}
                            type="password"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={1}
                            value={d}
                            onChange={e => handleChange(i, e.target.value)}
                            onKeyDown={e => handleKeyDown(i, e)}
                            onPaste={handlePaste}
                            onFocus={e => e.target.select()}
                            className={cn(
                                'size-12 rounded-lg border bg-card text-center font-mono text-xl font-black text-foreground caret-cyan-400 outline-none transition-colors',
                                error
                                    ? 'border-rose-500/60 ring-1 ring-rose-500/40'
                                    : 'border-border/40 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40'
                            )}
                        />
                    ))}
                </div>

                <p className={cn(
                    'text-center text-[11px] font-mono tracking-wider transition-colors h-4',
                    error ? 'text-rose-400' : 'text-transparent'
                )}>
                    Incorrect code
                </p>
            </DialogContent>
        </Dialog>
    );
}

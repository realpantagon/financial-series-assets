import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`px-3 py-2 border border-border/30 rounded-none text-sm font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/40 bg-black/20 ${className}`}
      {...props}
    />
  );
}

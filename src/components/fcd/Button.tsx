import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export default function Button({ className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2.5 rounded-none font-bold tracking-[0.1em] text-[10px] sm:text-xs transition-all uppercase ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

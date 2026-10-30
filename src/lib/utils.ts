import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Safely extract a human-readable message from an unknown caught error. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "Unexpected error"
}

/** ฿1,234.50 — the sign leads the symbol, so negatives read -฿1,234.50. */
export function fmtTHB(value: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const d = opts.decimals ?? 2
  const abs = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
  const sign = value < 0 ? "-" : opts.sign && value > 0 ? "+" : ""
  return `${sign}฿ ${abs}`
}

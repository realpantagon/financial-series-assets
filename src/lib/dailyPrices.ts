export interface PriceQuote {
    c: number;   // current price
    d: number;   // change from prev close
    dp: number;  // change percent
    pc: number;  // previous close
}

export type PriceMap = Record<string, PriceQuote>;

const KEY_PREFIX = 'panassets_prices_';
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1100; // keep under Finnhub free tier (60 req/min)

const GOLD_SYMBOLS = new Set(['XAU', 'XAUUSD', 'XAUSD', 'GOLD_SPOT']);

function todayKey(): string {
    return KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

export function getCachedPrices(): PriceMap | null {
    try {
        const raw = localStorage.getItem(todayKey());
        if (!raw) return null;
        return JSON.parse(raw) as PriceMap;
    } catch {
        return null;
    }
}

// Merge new prices into today's cache so multiple callers don't overwrite each other
function savePrices(newPrices: PriceMap): void {
    // Evict yesterday's entries
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(KEY_PREFIX) && k !== todayKey()) localStorage.removeItem(k);
    }
    try {
        const existing = getCachedPrices() ?? {};
        localStorage.setItem(todayKey(), JSON.stringify({ ...existing, ...newPrices }));
    } catch {}
}

async function fetchFinnhub(symbol: string, apiKey: string): Promise<PriceQuote | null> {
    try {
        const r = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
        );
        if (!r.ok) return null;
        const d = await r.json();
        if (!d.c || d.c === 0) return null;
        return { c: d.c, d: d.d ?? 0, dp: d.dp ?? 0, pc: d.pc ?? d.c };
    } catch {
        return null;
    }
}

async function fetchGoldSpot(): Promise<PriceQuote | null> {
    try {
        const r = await fetch('https://api.metals.live/v1/spot/gold');
        if (!r.ok) return null;
        const d = await r.json();
        const price: number = Array.isArray(d) ? d[0]?.gold : d?.gold;
        if (!price) return null;
        return { c: price, d: 0, dp: 0, pc: price };
    } catch {
        return null;
    }
}

export async function fetchDailyPrices(
    symbols: string[],
    apiKey: string,
    onProgress?: (done: number, total: number) => void
): Promise<PriceMap> {
    const prices: PriceMap = {};
    let done = 0;

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        const batch = symbols.slice(i, i + BATCH_SIZE);

        const results = await Promise.all(
            batch.map(async (sym) => {
                const quote = GOLD_SYMBOLS.has(sym.toUpperCase())
                    ? await fetchGoldSpot()
                    : await fetchFinnhub(sym, apiKey);
                return { sym, quote };
            })
        );

        results.forEach(({ sym, quote }) => {
            if (quote) prices[sym] = quote;
        });

        done += batch.length;
        onProgress?.(done, symbols.length);

        if (i + BATCH_SIZE < symbols.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
    }

    savePrices(prices);
    return prices;
}

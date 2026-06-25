import { useState, useEffect, useCallback, useRef } from 'react';
import { getCachedPrices, fetchDailyPrices, type PriceMap } from '@/lib/dailyPrices';

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined;

export function useDailyPrices(symbols: string[]) {
    const [prices, setPrices] = useState<PriceMap>(() => getCachedPrices() ?? {});
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const hasFetched = useRef(false);

    const refresh = useCallback(async () => {
        if (!symbols.length || !API_KEY) return;
        setLoading(true);
        setError(null);
        setProgress(0);
        try {
            const result = await fetchDailyPrices(symbols, API_KEY, (done, total) => {
                setProgress(Math.round((done / total) * 100));
            });
            setPrices(result);
        } catch {
            setError('Price fetch failed');
        } finally {
            setLoading(false);
            setProgress(100);
        }
    }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-fetch on mount if no cache for today
    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;
        const cached = getCachedPrices();
        if (cached && Object.keys(cached).length > 0) {
            setPrices(cached);
        } else if (API_KEY) {
            refresh();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const isConfigured = !!API_KEY;

    return { prices, loading, progress, error, refresh, isConfigured };
}

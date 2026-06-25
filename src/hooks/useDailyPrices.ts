import { useState, useEffect, useCallback, useRef } from 'react';
import { getCachedPrices, fetchDailyPrices, type PriceMap } from '@/lib/dailyPrices';

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined;

export function useDailyPrices(symbols: string[]) {
    const [prices, setPrices] = useState<PriceMap>(() => getCachedPrices() ?? {});
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const hasFetched = useRef(false);

    // Force re-fetch all requested symbols
    const refresh = useCallback(async () => {
        if (!symbols.length || !API_KEY) return;
        setLoading(true);
        setError(null);
        setProgress(0);
        try {
            const result = await fetchDailyPrices(symbols, API_KEY, (done, total) => {
                setProgress(Math.round((done / total) * 100));
            });
            setPrices(prev => ({ ...prev, ...result }));
        } catch {
            setError('Price fetch failed');
        } finally {
            setLoading(false);
            setProgress(100);
        }
    }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    // On mount: load cache then fetch only symbols NOT in cache
    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const cached = getCachedPrices() ?? {};
        if (Object.keys(cached).length > 0) {
            setPrices(cached);
        }

        if (!API_KEY || !symbols.length) return;

        // Only request symbols that aren't already cached today
        const missing = symbols.filter(s => !cached[s]);
        if (missing.length === 0) return;

        setLoading(true);
        fetchDailyPrices(missing, API_KEY, (done, total) => {
            setProgress(Math.round((done / total) * 100));
        })
            .then(result => {
                setPrices(prev => ({ ...prev, ...result }));
            })
            .catch(() => setError('Price fetch failed'))
            .finally(() => {
                setLoading(false);
                setProgress(100);
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return { prices, loading, progress, error, refresh, isConfigured: !!API_KEY };
}

import { useEffect, useState } from "react";
import { getSymbolMeta } from "../constants/symbols";
import type { HistoryPoint } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export interface UseHistoricalDataResult {
  data: HistoryPoint[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetch the 1-minute historical series for `symbol` from the REST API on mount
 * (and whenever `symbol` changes). Picks the index or stock endpoint based on
 * the symbol's type.
 */
export function useHistoricalData(symbol: string): UseHistoricalDataResult {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return undefined;

    const meta = getSymbolMeta(symbol);
    const path =
      meta.type === "index"
        ? `/api/history/index/${meta.code}`
        : `/api/history/stock/${meta.code}`;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_URL}${path}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: unknown) => {
        if (cancelled) return;
        setData(Array.isArray(json) ? (json as HistoryPoint[]) : []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return { data, loading, error };
}

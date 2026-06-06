import { useEffect, useMemo, useState } from "react";

import { getSessionRange } from "../utils/marketStatus";
import { useHistoricalData } from "./useHistoricalData";
import { useWebSocket } from "./useWebSocket";
import type { HistoryPoint, SeriesPoint } from "../types";

const MINUTE_MS = 60_000;
const floorMinute = (ms: number): number => Math.floor(ms / MINUTE_MS) * MINUTE_MS;

export interface SessionSeries {
  series: SeriesPoint[];
  latestIndex: number;
}

interface BuildSessionSeriesArgs {
  historical?: HistoryPoint[];
  liveByMinute?: Map<number, number>;
  startMs: number;
  endMs: number;
}

/**
 * Build the full-session 1-minute series for the chart.
 *
 * Rules:
 *  - one entry per minute from open → close (X-axis spans the whole session);
 *  - latest value wins within a minute (live overrides historical);
 *  - gaps up to the latest data point are forward-filled (no missing minutes);
 *  - minutes after the latest data point are null (future — line stops there).
 */
export function buildSessionSeries({
  historical = [],
  liveByMinute = new Map<number, number>(),
  startMs,
  endMs,
}: BuildSessionSeriesArgs): SessionSeries {
  const byMinute = new Map<number, number>();
  for (const p of historical) byMinute.set(floorMinute(p.time), p.value);
  for (const [m, v] of liveByMinute) byMinute.set(m, v); // live is newer → overrides

  const startMinute = floorMinute(startMs);
  const endMinute = floorMinute(endMs);

  // Latest minute (within the session) that actually has a value.
  let latestDataMinute = -Infinity;
  for (const m of byMinute.keys()) {
    if (m >= startMinute && m <= endMinute && m > latestDataMinute) latestDataMinute = m;
  }

  const series: SeriesPoint[] = [];
  let latestIndex = -1;
  let last: number | null = historical.length ? historical[0].value : null; // back-fill leading gaps
  let i = 0;
  for (let m = startMinute; m <= endMinute; m += MINUTE_MS, i++) {
    if (byMinute.has(m)) last = byMinute.get(m)!;
    const value = m <= latestDataMinute ? last : null;
    if (m === latestDataMinute) latestIndex = i;
    series.push({ time: m, value });
  }
  return { series, latestIndex };
}

export interface UseChartDataResult {
  series: SeriesPoint[];
  latestIndex: number;
  latest: SeriesPoint | null;
  yesterdayClose: number | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Live chart data for a symbol: loads history on mount, then keeps a gap-free
 * per-minute series updated in real time from the WebSocket feed.
 */
export function useChartData(symbol: string): UseChartDataResult {
  const { data, loading, error } = useHistoricalData(symbol);
  const { update, connected } = useWebSocket(symbol);

  const [liveByMinute, setLiveByMinute] = useState<Map<number, number>>(
    () => new Map<number, number>()
  );

  // Drop live ticks from the previously selected symbol.
  useEffect(() => {
    setLiveByMinute(new Map<number, number>());
  }, [symbol]);

  // Fold each live tick into its minute bucket (keeping only the latest value).
  useEffect(() => {
    if (!update) return;
    const t = update.timestamp ? Date.parse(update.timestamp) : Date.now();
    const minute = floorMinute(t);
    setLiveByMinute((prev) => {
      const next = new Map(prev);
      next.set(minute, update.price);
      return next;
    });
  }, [update]);

  const yesterdayClose = data[0]?.yesterdayClose ?? null;
  const { startMs, endMs } = getSessionRange();

  const { series, latestIndex } = useMemo(
    () => buildSessionSeries({ historical: data, liveByMinute, startMs, endMs }),
    [data, liveByMinute, startMs, endMs]
  );

  const latest = latestIndex >= 0 ? series[latestIndex] : null;

  return { series, latestIndex, latest, yesterdayClose, connected, loading, error };
}

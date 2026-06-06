import { prisma } from './db.js';
import { marketOpenEpoch } from '../utils/marketTime.js';
import type { SeriesPoint, HistoryPoint, HistoryResult } from '../types.js';

const MINUTE_MS = 60_000;

const floorToMinute = (ms: number): number =>
    Math.floor(ms / MINUTE_MS) * MINUTE_MS;

/**
 * Aggregate raw ticks into a gap-free 1-minute series.
 *
 * @param ticks  ascending by time, within [start,end]
 * @param start  window start (epoch ms)
 * @param end    window end (epoch ms)
 * @returns one point per minute, start→end inclusive
 *
 * Rules:
 *  - latest value wins within each minute (ticks are ascending, so last set wins);
 *  - missing minutes are forward-filled with the last known value;
 *  - minutes before the first tick are back-filled with the first known value,
 *    so the series never has a gap or a leading null.
 */
export function buildMinuteSeries(
    ticks: SeriesPoint[],
    start: number,
    end: number,
): SeriesPoint[] {
    if (ticks.length === 0) return [];

    const latestPerMinute = new Map<number, number>();
    for (const t of ticks) latestPerMinute.set(floorToMinute(t.time), t.value);

    const startMinute = floorToMinute(start);
    const endMinute = floorToMinute(end);

    const series: SeriesPoint[] = [];
    let last = ticks[0].value; // back-fill leading minutes with the first known value
    for (let m = startMinute; m <= endMinute; m += MINUTE_MS) {
        if (latestPerMinute.has(m)) last = latestPerMinute.get(m)!;
        series.push({ time: m, value: last });
    }
    return series;
}

/** Shape a minute series + yesterday close into the API response array. */
function toResponse(
    series: SeriesPoint[],
    yesterdayClose: number | null,
): HistoryPoint[] {
    return series.map((p) => ({
        time: p.time,
        value: p.value,
        yesterdayClose,
    }));
}

/**
 * Index history: market open → now, aggregated to 1-minute intervals.
 * Returns { yesterdayClose, data } where data is [{ time, value, yesterdayClose }].
 */
export async function fetchIndexHistory(
    indexId: string,
): Promise<HistoryResult> {
    const start = marketOpenEpoch();
    const end = Date.now();

    const rows = await prisma.indexTick.findMany({
        where: { indexId, time: { gte: BigInt(start), lte: BigInt(end) } },
        orderBy: { time: 'asc' },
        select: { time: true, capitalValue: true, yesterdayCloseValue: true },
    });

    if (rows.length === 0) return { yesterdayClose: null, data: [] };

    const ticks = rows.map((r) => ({
        time: Number(r.time),
        value: r.capitalValue,
    }));
    const yesterdayClose = rows[0].yesterdayCloseValue;
    return {
        yesterdayClose,
        data: toResponse(buildMinuteSeries(ticks, start, end), yesterdayClose),
    };
}

/**
 * Stock history: market open → now, aggregated to 1-minute intervals.
 * Returns { yesterdayClose, data } where data is [{ time, value, yesterdayClose }].
 */
export async function fetchStockHistory(
    tradeCode: string,
): Promise<HistoryResult> {
    const start = marketOpenEpoch();
    const end = Date.now();

    const rows = await prisma.stockTick.findMany({
        where: { tradeCode, time: { gte: BigInt(start), lte: BigInt(end) } },
        orderBy: { time: 'asc' },
        select: { time: true, closePrice: true, yesterdayClosePrice: true },
    });

    if (rows.length === 0) return { yesterdayClose: null, data: [] };

    const ticks = rows.map((r) => ({
        time: Number(r.time),
        value: r.closePrice,
    }));
    const yesterdayClose = rows[0].yesterdayClosePrice;
    return {
        yesterdayClose,
        data: toResponse(buildMinuteSeries(ticks, start, end), yesterdayClose),
    };
}

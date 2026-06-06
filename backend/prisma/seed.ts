import { pathToFileURL } from 'url';
import { prisma, connectDb, disconnectDb } from '../src/services/db.js';
import { config } from '../src/config.js';
import { epochForTimeToday } from '../src/utils/marketTime.js';

// ─────────────────────────────────────────────────────────────────────────
// Seed configuration — yesterday-close anchors and fluctuation bands.
// ─────────────────────────────────────────────────────────────────────────
const DSEX = {
    indexId: 'DSEX',
    yesterdayClose: 5200, // yesterday_close_value
    band: 100, // capital_value fluctuates within ±100 of yesterday close
    step: 9, // max per-tick random-walk move
};

const GP = {
    tradeCode: 'GP',
    yesterdayClose: 238.88, // yesterday_close_price
    band: 1, // close_price fluctuates within ±1 of yesterday close
    step: 0.18, // max per-tick random-walk move
};

// Random gap between consecutive ticks (NON-uniform — not a fixed minute).
const MIN_GAP_MS = 15_000; // 15s
const MAX_GAP_MS = 120_000; // 2m

const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number): number =>
    Math.min(hi, Math.max(lo, n));

interface SeedWindow {
    start: number;
    end: number;
    fallback: boolean;
}

interface SeriesSpec {
    start: number;
    end: number;
    base: number;
    band: number;
    step: number;
}

interface SeedPoint {
    time: number;
    value: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Seeding window — resolve "HH:MM in Asia/Dhaka" to an epoch-ms range.
// Timezone math lives in the shared marketTime util (also used by the API).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resolve the seeding window [start, end] in epoch ms.
 *  - Normally: today's market open → now.
 *  - If the market hasn't opened yet today, fall back to yesterday's full
 *    session so the seed is never empty (Asia/Dhaka has no DST, so −24h is
 *    the same wall-clock time the previous day).
 */
export function resolveWindow(nowMs: number = Date.now()): SeedWindow {
    const open = epochForTimeToday(config.market.openTime, new Date(nowMs));
    const close = epochForTimeToday(config.market.closeTime, new Date(nowMs));
    if (nowMs <= open) {
        const DAY = 24 * 60 * 60 * 1000;
        return { start: open - DAY, end: close - DAY, fallback: true };
    }
    return { start: open, end: nowMs, fallback: false };
}

// ─────────────────────────────────────────────────────────────────────────
// Series generation — non-uniform timeline + bounded random walk.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Generate { time, value } points from `start` to `end`. Timestamps advance
 * by a random gap each step (non-uniform). `value` is a random walk that
 * starts at `base` and stays clamped within ±`band`.
 */
export function buildSeries({
    start,
    end,
    base,
    band,
    step,
}: SeriesSpec): SeedPoint[] {
    const points: SeedPoint[] = [];
    let t = start;
    let value = base;
    while (t <= end) {
        points.push({ time: t, value: round2(value) });
        const gap =
            MIN_GAP_MS +
            Math.floor(Math.random() * (MAX_GAP_MS - MIN_GAP_MS + 1));
        t += gap;
        const delta = (Math.random() * 2 - 1) * step;
        value = clamp(value + delta, base - band, base + band);
    }
    return points;
}

function buildIndexRows(window: SeedWindow) {
    return buildSeries({
        start: window.start,
        end: window.end,
        base: DSEX.yesterdayClose,
        band: DSEX.band,
        step: DSEX.step,
    }).map(({ time, value }) => ({
        indexId: DSEX.indexId,
        time: BigInt(time),
        capitalValue: value,
        yesterdayCloseValue: DSEX.yesterdayClose,
        percentageChangeFromYesterdayCloseValue: round2(
            ((value - DSEX.yesterdayClose) / DSEX.yesterdayClose) * 100,
        ),
    }));
}

function buildStockRows(window: SeedWindow) {
    return buildSeries({
        start: window.start,
        end: window.end,
        base: GP.yesterdayClose,
        band: GP.band,
        step: GP.step,
    }).map(({ time, value }) => ({
        tradeCode: GP.tradeCode,
        time: BigInt(time),
        closePrice: value,
        yesterdayClosePrice: GP.yesterdayClose,
    }));
}

// ─────────────────────────────────────────────────────────────────────────
// Main — idempotent: only populates a table when it is empty.
// ─────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
    await connectDb();

    const window = resolveWindow();
    const range = `${new Date(window.start).toISOString()} → ${new Date(window.end).toISOString()}`;
    console.log(
        `[seed] window: ${range}${window.fallback ? ' (fallback: previous session)' : ''}`,
    );

    const [indexCount, stockCount] = await Promise.all([
        prisma.indexTick.count(),
        prisma.stockTick.count(),
    ]);

    if (indexCount > 0) {
        console.log(
            `[seed] index_ticks already has ${indexCount} rows — skipping`,
        );
    } else {
        const rows = buildIndexRows(window);
        await prisma.indexTick.createMany({ data: rows });
        console.log(`[seed] inserted ${rows.length} DSEX index_ticks`);
    }

    if (stockCount > 0) {
        console.log(
            `[seed] stock_ticks already has ${stockCount} rows — skipping`,
        );
    } else {
        const rows = buildStockRows(window);
        await prisma.stockTick.createMany({ data: rows });
        console.log(`[seed] inserted ${rows.length} GP stock_ticks`);
    }

    console.log('[seed] done');
}

// Only run when executed directly (so tests can import the pure functions).
const invokedDirectly =
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
    main()
        .catch((err) => {
            console.error('[seed] failed:', err);
            process.exitCode = 1;
        })
        .finally(() => disconnectDb());
}

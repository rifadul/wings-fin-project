import { prisma } from './db.js';
import { isMarketOpen } from '../config.js';
import type { Broadcast } from '../types.js';

/**
 * Live data simulator.
 *
 * Independently produces DSEX (index) and GP (stock) ticks, each on its own
 * random 1–3s cadence. Every tick is a bounded random walk, persisted to the
 * database and (optionally) broadcast over the WebSocket feed.
 *
 * Ticks are only generated while the market is OPEN (per MARKET_OPEN_TIME /
 * MARKET_CLOSE_TIME). When closed, the scheduler keeps ticking but writes
 * nothing and the value is frozen until the market reopens.
 */

interface IndexInstrument {
    indexId: string;
    base: number;
    band: number;
    step: number;
}

interface StockInstrument {
    tradeCode: string;
    base: number;
    band: number;
    step: number;
}

const DSEX: IndexInstrument = {
    indexId: 'DSEX',
    base: 5200,
    band: 100,
    step: 9,
};
const GP: StockInstrument = {
    tradeCode: 'GP',
    base: 238.88,
    band: 1,
    step: 0.18,
};

const MIN_INTERVAL_MS = 1000;
const MAX_INTERVAL_MS = 3000;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number): number =>
    Math.min(hi, Math.max(lo, n));
const randInterval = (): number =>
    MIN_INTERVAL_MS +
    Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1));

/** One random-walk step around `base`, clamped to ±`band`. */
function nextValue(
    prev: number,
    { base, band, step }: { base: number; band: number; step: number },
): number {
    const raw = prev + (Math.random() * 2 - 1) * step;
    return round2(clamp(raw, base - band, base + band));
}

/** Read the most recent persisted value so restarts continue smoothly. */
async function lastValue(
    read: () => Promise<number | null | undefined>,
    fallback: number,
): Promise<number> {
    try {
        const value = await read();
        return value ?? fallback;
    } catch {
        return fallback; // DB unavailable at startup — begin from yesterday close
    }
}

export interface SimulatorOptions {
    broadcast?: Broadcast;
}

export interface SimulatorHandle {
    stop(): void;
}

export async function startSimulator({
    broadcast,
}: SimulatorOptions = {}): Promise<SimulatorHandle> {
    // Continue the walk from wherever the persisted data left off (e.g. the seed).
    let dsexValue = await lastValue(
        () =>
            prisma.indexTick
                .findFirst({
                    orderBy: { time: 'desc' },
                    select: { capitalValue: true },
                })
                .then((r) => r?.capitalValue),
        DSEX.base,
    );
    let gpValue = await lastValue(
        () =>
            prisma.stockTick
                .findFirst({
                    orderBy: { time: 'desc' },
                    select: { closePrice: true },
                })
                .then((r) => r?.closePrice),
        GP.base,
    );

    let running = true;
    let indexTimer: NodeJS.Timeout | null = null;
    let stockTimer: NodeJS.Timeout | null = null;

    async function tickIndex(): Promise<void> {
        if (running && isMarketOpen()) {
            const prev = dsexValue;
            dsexValue = nextValue(prev, DSEX);
            const change = round2(dsexValue - prev);
            const time = Date.now();
            const percentageChange = round2(
                ((dsexValue - DSEX.base) / DSEX.base) * 100,
            );
            try {
                await prisma.indexTick.create({
                    data: {
                        indexId: DSEX.indexId,
                        time: BigInt(time),
                        capitalValue: dsexValue,
                        yesterdayCloseValue: DSEX.base,
                        percentageChangeFromYesterdayCloseValue:
                            percentageChange,
                    },
                });
                broadcast?.({
                    type: 'tick',
                    symbol: DSEX.indexId,
                    price: dsexValue,
                    change,
                    marketOpen: true,
                    timestamp: new Date(time).toISOString(),
                });
            } catch (err) {
                console.error(
                    '[sim] DSEX write failed:',
                    (err as Error).message,
                );
            }
        }
        if (running) indexTimer = setTimeout(tickIndex, randInterval());
    }

    async function tickStock(): Promise<void> {
        if (running && isMarketOpen()) {
            const prev = gpValue;
            gpValue = nextValue(prev, GP);
            const change = round2(gpValue - prev);
            const time = Date.now();
            try {
                await prisma.stockTick.create({
                    data: {
                        tradeCode: GP.tradeCode,
                        time: BigInt(time),
                        closePrice: gpValue,
                        yesterdayClosePrice: GP.base,
                    },
                });
                broadcast?.({
                    type: 'tick',
                    symbol: GP.tradeCode,
                    price: gpValue,
                    change,
                    marketOpen: true,
                    timestamp: new Date(time).toISOString(),
                });
            } catch (err) {
                console.error('[sim] GP write failed:', (err as Error).message);
            }
        }
        if (running) stockTimer = setTimeout(tickStock, randInterval());
    }

    indexTimer = setTimeout(tickIndex, randInterval());
    stockTimer = setTimeout(tickStock, randInterval());
    console.log(
        `[sim] simulator started — DSEX & GP every ${MIN_INTERVAL_MS / 1000}-${MAX_INTERVAL_MS / 1000}s while market is open`,
    );

    return {
        stop() {
            running = false;
            if (indexTimer) clearTimeout(indexTimer);
            if (stockTimer) clearTimeout(stockTimer);
            console.log('[sim] simulator stopped');
        },
    };
}

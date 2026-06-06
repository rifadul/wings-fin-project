import { config } from '../config.js';

/**
 * Timezone helpers for resolving DSE market hours (Asia/Dhaka, "HH:MM")
 * to absolute epoch milliseconds. Shared by the seed script and the API.
 */

/** Milliseconds the given IANA timezone is ahead of UTC at `instantMs`. */
export function tzOffsetMs(timeZone: string, instantMs: number): number {
    const d = new Date(instantMs);
    const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tz = new Date(d.toLocaleString('en-US', { timeZone }));
    return tz.getTime() - utc.getTime();
}

/** Epoch ms for a Y/M/D H:M wall-clock time interpreted in `timeZone`. */
export function zonedToEpoch(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timeZone: string,
): number {
    const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
    return guess - tzOffsetMs(timeZone, guess);
}

/** Epoch ms for an "HH:MM" time on the current Dhaka calendar day. */
export function epochForTimeToday(
    hhmm: string,
    now: Date = new Date(),
): number {
    const tz = config.market.timezone;
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
        .format(now)
        .split('-')
        .map(Number);
    const [hh, mm] = hhmm.split(':').map(Number);
    return zonedToEpoch(y, m, d, hh, mm, tz);
}

/** Epoch ms of today's configured market-open time (Asia/Dhaka). */
export function marketOpenEpoch(now: Date = new Date()): number {
    return epochForTimeToday(config.market.openTime, now);
}

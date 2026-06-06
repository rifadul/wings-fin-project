import dotenv from 'dotenv';

dotenv.config();

export interface MarketConfig {
    openTime: string;
    closeTime: string;
    timezone: string;
}

export interface AppConfig {
    port: number;
    dbUrl: string | undefined;
    market: MarketConfig;
}

/**
 * Centralized, validated environment config.
 * Market hours are configurable via MARKET_OPEN_TIME / MARKET_CLOSE_TIME
 * (24h "HH:MM" format, interpreted in the Asia/Dhaka timezone).
 */
export const config: AppConfig = {
    port: Number(process.env.BACKEND_PORT || process.env.PORT) || 4000,
    dbUrl: process.env.DB_URL,
    market: {
        openTime: process.env.MARKET_OPEN_TIME || '10:00',
        closeTime: process.env.MARKET_CLOSE_TIME || '14:20',
        timezone: 'Asia/Dhaka',
    },
};

/** Parse an "HH:MM" string into minutes-since-midnight. */
function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Returns true if `now` falls within the configured DSE trading session.
 * Compares against wall-clock minutes in the configured timezone.
 */
export function isMarketOpen(now: Date = new Date()): boolean {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: config.market.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const current = toMinutes(fmt.format(now));
    return (
        current >= toMinutes(config.market.openTime) &&
        current <= toMinutes(config.market.closeTime)
    );
}

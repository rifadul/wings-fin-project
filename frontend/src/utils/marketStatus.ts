/**
 * Market-hours utility.
 *
 * Reads MARKET_OPEN_TIME / MARKET_CLOSE_TIME from the Vite env (must be
 * VITE_-prefixed to be exposed to the browser) and evaluates "open vs closed"
 * against the current time in the configured market timezone (Asia/Dhaka) —
 * not the visitor's local timezone — so it matches the backend.
 */

const OPEN_TIME = import.meta.env.VITE_MARKET_OPEN_TIME || "10:00";
const CLOSE_TIME = import.meta.env.VITE_MARKET_CLOSE_TIME || "14:20";
const TIMEZONE = import.meta.env.VITE_MARKET_TIMEZONE || "Asia/Dhaka";

/** "HH:MM" → minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface MarketHours {
  open: string;
  close: string;
  timezone: string;
}

/** The configured trading hours, for display. */
export function getMarketHours(): MarketHours {
  return { open: OPEN_TIME, close: CLOSE_TIME, timezone: TIMEZONE };
}

/** True if `now` falls within the configured trading session. */
export function isMarketOpen(now: Date = new Date()): boolean {
  const current = toMinutes(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now)
  );
  return current >= toMinutes(OPEN_TIME) && current <= toMinutes(CLOSE_TIME);
}

/** Milliseconds the given timezone is ahead of UTC at `instantMs`. */
function tzOffsetMs(timeZone: string, instantMs: number): number {
  const d = new Date(instantMs);
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const tz = new Date(d.toLocaleString("en-US", { timeZone }));
  return tz.getTime() - utc.getTime();
}

/** Epoch ms for a Y/M/D H:M wall-clock time interpreted in `timeZone`. */
function zonedToEpoch(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  return guess - tzOffsetMs(timeZone, guess);
}

export interface SessionRange {
  startMs: number;
  endMs: number;
}

/**
 * Today's full trading session as epoch milliseconds — the X-axis span for the
 * chart (market open → close on the current Dhaka calendar day).
 */
export function getSessionRange(now: Date = new Date()): SessionRange {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  const [oh, om] = OPEN_TIME.split(":").map(Number);
  const [ch, cm] = CLOSE_TIME.split(":").map(Number);
  return {
    startMs: zonedToEpoch(y, m, d, oh, om, TIMEZONE),
    endMs: zonedToEpoch(y, m, d, ch, cm, TIMEZONE),
  };
}

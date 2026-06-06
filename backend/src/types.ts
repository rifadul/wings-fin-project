/** A live tick pushed over the WebSocket feed (server → client). */
export interface TickMessage {
    type: 'tick';
    symbol: string;
    price: number;
    change: number;
    marketOpen: boolean;
    timestamp: string;
}

/** Broadcast a message to every client subscribed to `message.symbol`. */
export type Broadcast = (message: TickMessage) => void;

/** A single point in an aggregated 1-minute series. */
export interface SeriesPoint {
    time: number;
    value: number;
}

/** A history response point: a series point plus the yesterday-close reference. */
export interface HistoryPoint extends SeriesPoint {
    yesterdayClose: number | null;
}

/** Result of a history query: the yesterday close plus the response series. */
export interface HistoryResult {
    yesterdayClose: number | null;
    data: HistoryPoint[];
}

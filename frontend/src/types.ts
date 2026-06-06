/** Shared data contracts for the frontend. */

/** Instrument kind — selects the REST endpoint and chart labelling. */
export type SymbolType = "index" | "stock";

/** Metadata describing one selectable instrument. */
export interface SymbolMeta {
  type: SymbolType;
  code: string;
  label: string;
}

/** A history response point from the REST API. */
export interface HistoryPoint {
  time: number;
  value: number;
  yesterdayClose: number | null;
}

/** A live tick received over the WebSocket feed. */
export interface TickUpdate {
  type: string;
  symbol: string;
  price: number;
  change: number;
  marketOpen: boolean;
  timestamp: string;
}

/** A single point in the chart's full-session series (value may be null = no data yet). */
export interface SeriesPoint {
  time: number;
  value: number | null;
}

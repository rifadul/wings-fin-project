import type { SymbolMeta } from "../types";

/**
 * The instruments the UI can display. `type` selects the REST endpoint
 * (`/api/history/index/:id` vs `/api/history/stock/:code`); `code` is also the
 * WebSocket subscription key.
 */
export const SYMBOLS: SymbolMeta[] = [
  { type: "index", code: "DSEX", label: "Index (DSEX)" },
  { type: "stock", code: "GP", label: "Stock (GP)" },
];

// Default selection is the index.
export const DEFAULT_SYMBOL = "DSEX";

/** Look up a symbol's metadata by code (falls back to the default). */
export function getSymbolMeta(code: string): SymbolMeta {
  return SYMBOLS.find((s) => s.code === code) ?? SYMBOLS[0];
}

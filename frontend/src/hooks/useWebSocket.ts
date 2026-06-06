import { useEffect, useRef, useState } from "react";
import type { TickUpdate } from "../types";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4000";

export interface UseWebSocketResult {
  update: TickUpdate | null;
  connected: boolean;
  marketOpen: boolean;
}

/**
 * Connect to the backend WebSocket and stream live ticks for one `symbol`.
 *
 * On open it sends `{ subscribe: symbol }`; the server then pushes only that
 * symbol's ticks. Reconnects automatically if the socket drops, and re-points
 * at the new symbol whenever `symbol` changes.
 */
export function useWebSocket(symbol: string): UseWebSocketResult {
  const [update, setUpdate] = useState<TickUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!symbol) return undefined;

    // Clear any tick left over from the previously selected symbol.
    setUpdate(null);

    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    function connect() {
      const ws = new WebSocket(`${WS_URL}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ subscribe: symbol }));
      };

      ws.onclose = () => {
        setConnected(false);
        if (!disposed) reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onmessage = (event: MessageEvent) => {
        let msg: Partial<TickUpdate>;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (typeof msg.marketOpen === "boolean") setMarketOpen(msg.marketOpen);
        if (msg.type === "tick" && msg.symbol === symbol) setUpdate(msg as TickUpdate);
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [symbol]);

  return { update, connected, marketOpen };
}

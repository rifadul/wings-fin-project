import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { isMarketOpen } from '../config.js';
import type { TickMessage, Broadcast } from '../types.js';

// Per-connection subscription set, attached to each socket. Declared via module
// augmentation so `socket.subscriptions` is typed wherever a ws WebSocket is used.
declare module 'ws' {
    interface WebSocket {
        subscriptions?: Set<string>;
    }
}

export interface MarketFeed {
    wss: WebSocketServer;
    broadcast: Broadcast;
}

/**
 * Attach a WebSocket server (path `/ws`) to the given HTTP server — so it runs
 * on the SAME port as Express — and return a `broadcast` function.
 *
 * Protocol (client → server), JSON text messages:
 *   { "subscribe":   "DSEX" }   subscribe to a symbol's tick stream
 *   { "unsubscribe": "DSEX" }   stop receiving that symbol
 *
 * Server → client messages:
 *   { type:"welcome",      marketOpen }
 *   { type:"subscribed",   symbol }
 *   { type:"unsubscribed", symbol }
 *   { type:"error",        message }
 *   { type:"tick", symbol, price, change, marketOpen, timestamp }   (live data)
 *
 * The data simulator (services/simulator.ts) is the sole producer; it calls
 * `broadcast(message)` and we fan the message out only to clients subscribed
 * to `message.symbol`.
 */
export function attachMarketFeed(server: Server): MarketFeed {
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (socket: WebSocket) => {
        // Per-connection subscription set. Lives and dies with the socket, so
        // disconnection cleanup is automatic (ws drops it from wss.clients).
        socket.subscriptions = new Set();
        console.log('[ws] client connected');
        socket.send(
            JSON.stringify({ type: 'welcome', marketOpen: isMarketOpen() }),
        );

        socket.on('message', (raw) => {
            let msg: { subscribe?: unknown; unsubscribe?: unknown };
            try {
                msg = JSON.parse(raw.toString());
            } catch {
                socket.send(
                    JSON.stringify({ type: 'error', message: 'Invalid JSON' }),
                );
                return;
            }

            if (typeof msg.subscribe === 'string') {
                const symbol = msg.subscribe.toUpperCase();
                socket.subscriptions?.add(symbol);
                socket.send(JSON.stringify({ type: 'subscribed', symbol }));
                console.log(`[ws] client subscribed to ${symbol}`);
            } else if (typeof msg.unsubscribe === 'string') {
                const symbol = msg.unsubscribe.toUpperCase();
                socket.subscriptions?.delete(symbol);
                socket.send(JSON.stringify({ type: 'unsubscribed', symbol }));
            } else {
                socket.send(
                    JSON.stringify({
                        type: 'error',
                        message: 'Expected { subscribe: <symbol> }',
                    }),
                );
            }
        });

        socket.on('close', () => {
            socket.subscriptions?.clear();
            console.log('[ws] client disconnected');
        });

        // Prevent an unhandled socket error from crashing the process.
        socket.on('error', (err: Error) => {
            console.error('[ws] socket error:', err.message);
        });
    });

    /**
     * Fan a tick message out to every client subscribed to `message.symbol`.
     * No-op for symbols nobody is watching.
     */
    function broadcast(message: TickMessage): void {
        const symbol = message?.symbol;
        if (!symbol) return;
        const payload = JSON.stringify(message);
        for (const client of wss.clients) {
            if (
                client.readyState === client.OPEN &&
                client.subscriptions?.has(symbol)
            ) {
                client.send(payload);
            }
        }
    }

    console.log('[ws] market feed mounted at /ws (per-symbol subscriptions)');
    return { wss, broadcast };
}

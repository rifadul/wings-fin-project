import http from 'http';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';

import { config, isMarketOpen } from './config.js';
import { connectDb, disconnectDb } from './services/db.js';
import { healthRouter } from './routes/health.js';
import { quotesRouter } from './routes/quotes.js';
import { historyRouter } from './routes/history.js';
import { attachMarketFeed } from './websocket/marketFeed.js';
import { startSimulator, type SimulatorHandle } from './services/simulator.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/history', historyRouter);

// Lightweight market-status endpoint driven by the configurable hours.
app.get('/api/market-status', (_req, res) => {
    res.json({
        open: isMarketOpen(),
        openTime: config.market.openTime,
        closeTime: config.market.closeTime,
        timezone: config.market.timezone,
        serverTime: new Date().toISOString(),
    });
});

// Centralized error handler (keeps route handlers free of res.status noise).
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error('[backend] error:', err);
    res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);

const server = http.createServer(app);

// Attach the WebSocket transport; the simulator pushes ticks through `broadcast`.
const { broadcast } = attachMarketFeed(server);

let simulator: SimulatorHandle | undefined;

async function start(): Promise<void> {
    await connectDb();
    // Start producing live ticks (writes to DB only while the market is open).
    simulator = await startSimulator({ broadcast });
    server.listen(config.port, () => {
        console.log(`[backend] HTTP + WS listening on :${config.port}`);
        console.log(
            `[backend] Market hours ${config.market.openTime}–${config.market.closeTime} (${config.market.timezone})`,
        );
    });
}

// Graceful shutdown: stop the simulator, stop accepting connections, close the pool.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`[backend] ${signal} received, shutting down`);
        simulator?.stop();
        server.close(async () => {
            await disconnectDb();
            process.exit(0);
        });
    });
}

start().catch((err) => {
    console.error('[backend] failed to start:', err);
    process.exit(1);
});

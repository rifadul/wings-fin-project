# DSE Real-Time Stock Chart

A real-time stock market chart application for the **Dhaka Stock Exchange (DSE)**.
A backend simulator generates live price ticks during market hours, persists them
to PostgreSQL, and streams them to a React chart over WebSocket. The chart also
loads the day's history on mount and fills it in to a continuous 1-minute series.

| Layer      | Tech                              |
|------------|-----------------------------------|
| Language   | TypeScript (frontend + backend)   |
| Frontend   | React 18 + Vite, Recharts         |
| Backend    | Node.js + Express (run via `tsx`) |
| Database   | PostgreSQL 16                     |
| ORM        | Prisma 5                          |
| Real-time  | WebSocket (`ws` library)          |
| Runtime    | Docker / Docker Compose           |

---

## 1. Project overview

The app shows one instrument at a time — the **DSEX index** or the **GP stock** —
selectable from a dropdown (default: index). While the market is open you see a
live chart that updates every 1–3 seconds; outside market hours you see a
**"Market is Closed"** screen.

What happens under the hood:

- A **data simulator** in the backend produces a new value for DSEX and GP on
  independent random 1–3s intervals (a bounded random walk around yesterday's
  close). It runs **only while the market is open**.
- Each tick is **saved to PostgreSQL** and **broadcast over WebSocket** to every
  client subscribed to that symbol.
- On load, the chart fetches the day's history via REST and renders it as a
  gap-free **1-minute** series spanning the whole trading session; new ticks then
  arrive live and extend the line.

Key behaviours:

- **Configurable market hours** via environment variables (Asia/Dhaka timezone).
- **1-minute aggregation** with "latest value per minute" and forward-fill so the
  chart never has gaps.
- **Per-symbol WebSocket subscriptions** — clients receive only what they ask for.
- **Idempotent seed + migrations** run automatically on startup.

### Project structure

```
.
├── backend/                      # Node.js + Express + WebSocket + Prisma (TypeScript)
│   ├── prisma/
│   │   ├── schema.prisma          # index_ticks + stock_ticks models
│   │   ├── migrations/            # committed SQL migrations
│   │   └── seed.ts                # historical seed (idempotent)
│   ├── src/
│   │   ├── config.ts              # env config + isMarketOpen()
│   │   ├── index.ts               # Express + HTTP + WS bootstrap
│   │   ├── types.ts               # shared tick / history data contracts
│   │   ├── routes/                # health, quotes, history
│   │   ├── services/              # db, history (aggregation), simulator
│   │   ├── utils/marketTime.ts    # Asia/Dhaka "HH:MM" → epoch helpers
│   │   └── websocket/marketFeed.ts# WS transport + per-symbol broadcast
│   ├── tsconfig.json
│   ├── docker-entrypoint.sh       # migrate → seed → start
│   └── Dockerfile
├── frontend/                     # React + Vite SPA (TypeScript)
│   ├── src/
│   │   ├── components/            # ChartView, SymbolDropdown, MarketClosed (.tsx)
│   │   ├── hooks/                 # useWebSocket, useHistoricalData, useChartData
│   │   ├── utils/marketStatus.ts  # market-hours + session-range helpers
│   │   ├── constants/symbols.ts   # DSEX / GP metadata
│   │   ├── types.ts               # shared frontend data contracts
│   │   └── App.tsx
│   ├── tsconfig.json
│   └── Dockerfile
├── docs/
│   └── ARCHITECTURE.md            # system design, data flow, trade-offs
├── docker-compose.yml             # postgres + backend + frontend
├── .env.example
└── README.md
```

---

## 2. Run it with `docker compose up`

**Prerequisites:** Docker with the Compose plugin.

```bash
# 1. Configure environment (optional — sensible defaults are built in)
cp .env.example .env

# 2. Build and start the whole stack
docker compose up --build
```

That's it. Compose starts the services **in order**, each waiting for the
previous to be healthy:

1. **postgres** starts and becomes healthy (`pg_isready`).
2. **backend** waits for postgres, then runs migrations → seed → starts the API,
   WebSocket server, and simulator. It becomes healthy once `/api/health` responds.
3. **frontend** waits for the backend to be healthy, then serves the Vite app.

Open:

| Service        | URL                                            |
|----------------|------------------------------------------------|
| Frontend       | <http://localhost:3000>                        |
| Backend health | <http://localhost:4000/api/health>             |
| Market status  | <http://localhost:4000/api/market-status>      |
| History (index)| <http://localhost:4000/api/history/index/DSEX> |
| History (stock)| <http://localhost:4000/api/history/stock/GP>   |

Useful commands:

```bash
docker compose logs -f backend     # follow backend logs (migrate/seed/sim)
docker compose ps                  # service status + health
docker compose down                # stop (keeps the data volume)
docker compose down -v             # stop AND wipe the DB (fresh seed next up)
```

> **Database persistence:** PostgreSQL data lives in the named volume
> `postgres_data`, so it survives `docker compose down`. Use `down -v` to reset.

### Running locally without Docker (optional)

```bash
# Backend (needs a reachable PostgreSQL via DB_URL)
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

> **TypeScript:** the stack is written in TypeScript. The backend runs via `tsx`
> (no build step); the frontend is built by Vite. Type-check either side with
> `npm run typecheck`. Shared data shapes (live tick + history) live in
> `backend/src/types.ts` and `frontend/src/types.ts`.

---

## 3. Environment variables

All configuration is environment-driven. Copy `.env.example` to `.env` to
override defaults. Compose substitutes these at startup.

### Market hours (shared by backend + frontend)

| Variable             | Default     | Description                                                              |
|----------------------|-------------|--------------------------------------------------------------------------|
| `MARKET_OPEN_TIME`   | `10:00`     | Trading session start, 24h `HH:MM`, evaluated in `Asia/Dhaka`.           |
| `MARKET_CLOSE_TIME`  | `14:20`     | Trading session end, 24h `HH:MM`, evaluated in `Asia/Dhaka`.             |
| `MARKET_TIMEZONE`    | `Asia/Dhaka`| IANA timezone the open/close times are interpreted in.                   |

These gate the simulator (it only writes while open) and the frontend's
"Market is Closed" screen.

### Backend

| Variable   | Default | Description                                                       |
|------------|---------|-------------------------------------------------------------------|
| `PORT`     | `4000`  | Port the Express **and** WebSocket server listen on (same port).  |
| `DB_URL`   | see note| PostgreSQL connection string used by Prisma.                      |

> **`DB_URL` note (important):** Inside Docker, the backend reaches PostgreSQL at
> the **internal** host `postgres:5432`. Compose builds this string automatically
> from the `POSTGRES_*` values, so you normally don't set `DB_URL` yourself. The
> `DB_URL` in `.env.example` (port **5433**) is for **host-side** tools (psql,
> Prisma Studio) connecting to the *published* port — not for the container.

### PostgreSQL (used by Compose to provision the DB)

| Variable            | Default       | Description                  |
|---------------------|---------------|------------------------------|
| `POSTGRES_USER`     | `dse_user`    | Database user.               |
| `POSTGRES_PASSWORD` | `dse_password`| Database password.           |
| `POSTGRES_DB`       | `dse_market`  | Database name.               |

> Postgres is published on host port **5433** (`5433:5432`) to avoid clashing with
> a local Postgres on 5432. Containers still talk to it on **5432** internally.

### Frontend (Vite — must be `VITE_`-prefixed to reach the browser)

| Variable                 | Default                 | Description                                       |
|--------------------------|-------------------------|---------------------------------------------------|
| `VITE_API_URL`           | `http://localhost:4000` | Backend REST base URL (resolved in the browser).  |
| `VITE_WS_URL`            | `ws://localhost:4000`   | Backend WebSocket base URL (resolved in browser). |
| `VITE_MARKET_OPEN_TIME`  | `10:00`                 | Open time for the frontend's market check.        |
| `VITE_MARKET_CLOSE_TIME` | `14:20`                 | Close time for the frontend's market check.       |
| `VITE_MARKET_TIMEZONE`   | `Asia/Dhaka`            | Timezone for the frontend's market check.         |

> In `docker-compose.yml`, the `VITE_MARKET_*` values are fed from the same
> `MARKET_*` variables as the backend, so there's a single source of truth.

---

## 4. How to test the live updates

Live ticks **only flow while the market is open** (per `MARKET_OPEN_TIME` /
`MARKET_CLOSE_TIME` in Asia/Dhaka). There are two ways to see them:

### Option A — during real market hours

If the current Asia/Dhaka time is within the configured window, just open
<http://localhost:3000>: the chart updates every 1–3s and the latest point
blinks. Confirm the market is open:

```bash
curl -s http://localhost:4000/api/market-status
# {"open":true,...}  ← live updates are flowing
```

### Option B — force the market open (any time)

Recreate the backend with a 24-hour window, then watch ticks:

```bash
# Force the market open and restart just the backend
MARKET_OPEN_TIME=00:00 MARKET_CLOSE_TIME=23:59 docker compose up -d backend
```

Now verify each part of the pipeline:

```bash
# 1. Watch the simulator + DB writes in the logs
docker compose logs -f backend       # look for "[sim] simulator started", tick writes

# 2. Confirm rows are accumulating in PostgreSQL
docker compose exec postgres psql -U dse_user -d dse_market \
  -c "select count(*) from index_ticks;"   # run twice — the count grows

# 3. Subscribe to the live WebSocket and print ticks
docker compose exec backend node -e "
import('ws').then(({WebSocket}) => {
  const ws = new WebSocket('ws://127.0.0.1:4000/ws');
  ws.on('open', () => { ws.send(JSON.stringify({subscribe:'DSEX'})); ws.send(JSON.stringify({subscribe:'GP'})); });
  ws.on('message', d => console.log(d.toString()));
});"
# → {\"type\":\"welcome\",...} {\"type\":\"subscribed\",...} {\"type\":\"tick\",\"symbol\":\"GP\",...}
```

Then reload the frontend — the chart will animate in real time. **Restore normal
hours** when done:

```bash
docker compose up -d backend          # back to .env / default market hours
```

### WebSocket protocol (for manual testing)

Connect to `ws://localhost:4000/ws` and send:

```json
{ "subscribe": "DSEX" }      // or { "subscribe": "GP" }
{ "unsubscribe": "GP" }
```

You'll receive:

```json
{ "type": "welcome", "marketOpen": true }
{ "type": "subscribed", "symbol": "DSEX" }
{ "type": "tick", "symbol": "DSEX", "price": 5207.27, "change": 1.2, "marketOpen": true, "timestamp": "2026-06-03T16:42:19.958Z" }
```

---

## 5. Architecture & design

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the component overview,
the simulator → DB → WebSocket → chart data flow, technology choices, and
trade-offs — including a Mermaid diagram you can render directly.

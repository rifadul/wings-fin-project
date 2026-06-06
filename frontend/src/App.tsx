import { useEffect, useState } from "react";

import { DEFAULT_SYMBOL, getSymbolMeta } from "./constants/symbols";
import { isMarketOpen, getSessionRange } from "./utils/marketStatus";
import SymbolDropdown from "./components/SymbolDropdown";
import MarketClosed from "./components/MarketClosed";
import ChartView from "./components/ChartView";
import { useChartData } from "./hooks/useChartData";

const fmt = (n: number | null | undefined): string =>
  n == null ? "—" : Number(n).toFixed(2);

export default function App() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [open, setOpen] = useState(() => isMarketOpen());

  // Re-check the configured hours periodically so the closed screen toggles
  // on its own as time crosses market open / close.
  useEffect(() => {
    const id = setInterval(() => setOpen(isMarketOpen()), 15_000);
    return () => clearInterval(id);
  }, []);

  if (!open) return <MarketClosed />;

  // Dashboard owns the data hooks, so they're only mounted while the market is
  // open and are never called conditionally.
  return <Dashboard symbol={symbol} onSymbolChange={setSymbol} />;
}

interface DashboardProps {
  symbol: string;
  onSymbolChange: (code: string) => void;
}

function Dashboard({ symbol, onSymbolChange }: DashboardProps) {
  const meta = getSymbolMeta(symbol);
  const { series, latestIndex, latest, yesterdayClose, connected, loading, error } =
    useChartData(symbol);
  const { startMs, endMs } = getSessionRange();

  const currentValue = latest?.value ?? yesterdayClose;
  const change =
    yesterdayClose != null && currentValue != null ? currentValue - yesterdayClose : null;
  const changePct = change != null && yesterdayClose ? (change / yesterdayClose) * 100 : null;
  const up = change != null && change >= 0;

  return (
    <main className="app">
      <header className="app__header">
        <h1>DSE Live</h1>
        <div className="app__controls">
          <SymbolDropdown value={symbol} onChange={onSymbolChange} />
          <span className={`badge ${connected ? "badge--on" : "badge--off"}`}>
            <span className={`dot ${connected ? "dot--on" : "dot--off"}`} />
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </div>
      </header>

      {error && <p className="app__error">Failed to load history: {error}</p>}

      <section className="quote-card">
        <div className="quote-card__title">{meta.label}</div>
        <div className="quote-card__price">{fmt(currentValue)}</div>
        <div className={`quote-card__change ${up ? "up" : "down"}`}>
          {change == null
            ? "—"
            : `${up ? "▲" : "▼"} ${fmt(Math.abs(change))} (${fmt(Math.abs(changePct ?? 0))}%)`}
        </div>
        <div className="quote-card__sub">Yesterday close: {fmt(yesterdayClose)}</div>
      </section>

      {loading ? (
        <p className="recent__empty">Loading chart…</p>
      ) : (
        <ChartView
          series={series}
          latestIndex={latestIndex}
          yesterdayClose={yesterdayClose}
          sessionStart={startMs}
          sessionEnd={endMs}
          label={meta.label}
        />
      )}
    </main>
  );
}

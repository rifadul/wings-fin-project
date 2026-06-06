import { getMarketHours } from "../utils/marketStatus";

/**
 * Full-screen "Market is Closed" state, shown when the current time is outside
 * the configured trading hours.
 */
export default function MarketClosed() {
  const { open, close, timezone } = getMarketHours();
  return (
    <div className="market-closed">
      <div className="market-closed__card">
        <div className="market-closed__icon">🔔</div>
        <h1>Market is Closed</h1>
        <p>
          Trading hours are <strong>{open}</strong> – <strong>{close}</strong> ({timezone}).
        </p>
        <p className="market-closed__hint">Live data resumes when the market reopens.</p>
      </div>
    </div>
  );
}

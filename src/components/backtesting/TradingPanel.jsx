import { TrendingUp, TrendingDown } from "lucide-react";

export default function TradingPanel({ session, candles, trades, currentIndex, onOpenOrder }) {
  if (!session) return null;

  const currentCandle = candles[currentIndex];
  const currentPrice = currentCandle?.close ?? 0;

  const realizedPnl = trades.filter((t) => t.status === "closed").reduce((s, t) => s + (t.pnl || 0), 0);
  const unrealizedPnl = trades.filter((t) => t.status === "open").reduce((s, t) => {
    return s + ((currentPrice - t.entryPrice) * (t.side === "buy" ? 1 : -1) * t.positionSize);
  }, 0);

  return (
    <div className="bt-trading-panel">
      <div className="bt-tp-left">
        <button className="bt-btn bt-btn-buy" onClick={() => onOpenOrder("buy")}>
          <TrendingUp size={16} /> Buy
        </button>
        <button className="bt-btn bt-btn-sell" onClick={() => onOpenOrder("sell")}>
          <TrendingDown size={16} /> Sell
        </button>
        <span className="bt-tp-price">${currentPrice.toFixed(2)}</span>
      </div>
      <div className="bt-tp-stats">
        <span className="bt-tp-stat">
          Balance: <strong>${session.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </span>
        <span className={`bt-tp-stat ${realizedPnl >= 0 ? "bt-up" : "bt-down"}`}>
          Realized PnL: <strong>${realizedPnl >= 0 ? "+" : ""}{realizedPnl.toFixed(2)}</strong>
        </span>
        <span className={`bt-tp-stat ${unrealizedPnl >= 0 ? "bt-up" : "bt-down"}`}>
          Unrealized PnL: <strong>${unrealizedPnl >= 0 ? "+" : ""}{unrealizedPnl.toFixed(2)}</strong>
        </span>
      </div>
    </div>
  );
}

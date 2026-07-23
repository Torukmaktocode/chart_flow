import { useMemo } from "react";
import { calculateBacktestStats } from "../../utils/backtestHelpers";

export default function SessionStats({ trades, session }) {
  if (!session) return null;
  const stats = useMemo(() => calculateBacktestStats(trades), [trades]);

  return (
    <div className="bt-stats">
      <h4 className="bt-stats-title">Session Stats</h4>
      <div className="bt-stats-grid">
        <div className="bt-stat-block">
          <span className="bt-stat-label">Total Trades</span>
          <strong className="bt-stat-value">{stats.totalTrades}</strong>
        </div>
        <div className="bt-stat-block">
          <span className="bt-stat-label">Win Rate</span>
          <strong className="bt-stat-value bt-up">{stats.winRate.toFixed(1)}%</strong>
        </div>
        <div className="bt-stat-block">
          <span className="bt-stat-label">Total PnL</span>
          <strong className={`bt-stat-value ${stats.totalPnl >= 0 ? "bt-up" : "bt-down"}`}>
            ${stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(2)}
          </strong>
        </div>
        <div className="bt-stat-block">
          <span className="bt-stat-label">Profit Factor</span>
          <strong className="bt-stat-value">{stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}</strong>
        </div>
        <div className="bt-stat-block">
          <span className="bt-stat-label">Winners</span>
          <strong className="bt-stat-value bt-up">{stats.winners}</strong>
        </div>
        <div className="bt-stat-block">
          <span className="bt-stat-label">Losers</span>
          <strong className="bt-stat-value bt-down">{stats.losers}</strong>
        </div>
        <div className="bt-stat-block">
          <span className="bt-stat-label">Avg Win</span>
          <strong className="bt-stat-value bt-up">${stats.averageWin.toFixed(2)}</strong>
        </div>
        <div className="bt-stat-block">
          <span className="bt-stat-label">Avg Loss</span>
          <strong className="bt-stat-value bt-down">${stats.averageLoss.toFixed(2)}</strong>
        </div>
        <div className="bt-stat-block">
          <span className="bt-stat-label">Buy WR</span>
          <strong className="bt-stat-value">{stats.buyWinRate.toFixed(1)}%</strong>
        </div>
        <div className="bt-stat-block">
          <span className="bt-stat-label">Sell WR</span>
          <strong className="bt-stat-value">{stats.sellWinRate.toFixed(1)}%</strong>
        </div>
      </div>
    </div>
  );
}

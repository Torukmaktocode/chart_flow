import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import SessionStats from "./SessionStats";
import { calculateBacktestStats } from "../../utils/backtestHelpers";

export default function SessionDetail({ session, onBack }) {
  const trades = session.trades || [];
  const stats = useMemo(() => calculateBacktestStats(trades), [trades]);
  const closedTrades = trades.filter((t) => t.status === "closed");

  return (
    <div className="bt-setup">
      <div className="bt-setup-header">
        <button className="bt-btn-icon" onClick={onBack}><ChevronLeft size={20} /></button>
        <div>
          <h2 className="bt-setup-title">{session.name}</h2>
          <p className="bt-setup-desc">
            {session.asset} · {session.timeframe} · {session.startDate} to {session.endDate}
          </p>
        </div>
      </div>

      <SessionStats trades={trades} session={session} />

      {closedTrades.length > 0 && (
        <div className="bt-sessions-table" style={{ marginTop: 16 }}>
          <div className="bt-sessions-head">
            <span>Side</span>
            <span>Entry</span>
            <span>Exit</span>
            <span>Size</span>
            <span>PnL</span>
            <span>R Mult</span>
            <span>Result</span>
            <span>Tags</span>
          </div>
          {closedTrades.map((t) => (
            <div key={t.id} className="bt-sessions-row">
              <span className={t.side === "buy" ? "bt-up" : "bt-down"}>{t.side.toUpperCase()}</span>
              <span>${t.entryPrice?.toFixed(2)}</span>
              <span>${t.exitPrice?.toFixed(2)}</span>
              <span>{t.positionSize}</span>
              <span className={t.pnl >= 0 ? "bt-up" : "bt-down"}>${t.pnl >= 0 ? "+" : ""}{t.pnl?.toFixed(2)}</span>
              <span>{t.rMultiple?.toFixed(2) || "-"}</span>
              <span>
                <span className={`bt-result-tag ${t.result === "win" ? "bt-tag-win" : t.result === "loss" ? "bt-tag-loss" : "bt-tag-break"}`}>
                  {t.result || "Open"}
                </span>
              </span>
              <span className="bt-tags-cell">{(t.tags || []).join(", ")}</span>
            </div>
          ))}
        </div>
      )}

      {closedTrades.filter((t) => t.notes).length > 0 && (
        <div className="bt-journal-section">
          <h4 className="bt-stats-title">Journal Notes</h4>
          {closedTrades.filter((t) => t.notes).map((t) => (
            <div key={t.id} className="bt-journal-entry">
              <div className="bt-journal-header">
                <span className={t.side === "buy" ? "bt-up" : "bt-down"}>{t.side.toUpperCase()}</span>
                <span className={`bt-result-tag ${t.result === "win" ? "bt-tag-win" : t.result === "loss" ? "bt-tag-loss" : "bt-tag-break"}`}>{t.result}</span>
                <span>${t.pnl?.toFixed(2)}</span>
              </div>
              <p className="bt-journal-text">{t.notes}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

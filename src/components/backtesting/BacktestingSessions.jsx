import { BarChart3, ChevronLeft, Plus, Trash2 } from "lucide-react";

export default function BacktestingSessions({ sessions, onBack, onNew, onViewSession, onDeleteSession }) {
  return (
    <div className="bt-setup">
      <div className="bt-setup-header">
        <button className="bt-btn-icon" onClick={onBack}><ChevronLeft size={20} /></button>
        <div>
          <h2 className="bt-setup-title">Backtesting Sessions</h2>
          <p className="bt-setup-desc">Review and analyze all historical replay sessions.</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="bt-empty">
          <BarChart3 size={48} opacity={0.3} />
          <p>No sessions yet. Start a new backtest.</p>
        </div>
      ) : (
        <div className="bt-sessions-table">
          <div className="bt-sessions-head">
            <span>Name</span>
            <span>Asset</span>
            <span>Range</span>
            <span>TF</span>
            <span>Capital</span>
            <span>Balance</span>
            <span>Trades</span>
            <span>Actions</span>
          </div>
          {sessions.map((s) => {
            const closedTrades = (s.trades || []).filter((t) => t.status === "closed");
            const pnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
            return (
              <div key={s.id} className="bt-sessions-row">
                <span className="bt-sessions-name">{s.name}</span>
                <span>{s.asset}</span>
                <span className="bt-sessions-range">{s.startDate} - {s.endDate}</span>
                <span>{s.timeframe}</span>
                <span>${s.initialCapital.toLocaleString()}</span>
                <span className={pnl >= 0 ? "bt-up" : "bt-down"}>${s.currentBalance.toLocaleString()}</span>
                <span>{closedTrades.length}</span>
                <span className="bt-sessions-actions">
                  <button className="bt-btn-icon" onClick={() => onViewSession(s)} title="View"><BarChart3 size={16} /></button>
                  <button className="bt-btn-icon bt-btn-danger" onClick={() => onDeleteSession(s.id)} title="Delete"><Trash2 size={16} /></button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button className="bt-btn bt-btn-primary bt-btn-start" onClick={onNew}>
        <Plus size={18} /> New Backtest
      </button>
    </div>
  );
}

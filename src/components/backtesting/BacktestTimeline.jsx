export default function BacktestTimeline({ session, candles, trades, onSetIndex, onSelectTrade }) {
  if (!session || !candles.length) return null;

  return (
    <div className="bt-timeline">
      <input
        type="range"
        min={0}
        max={candles.length - 1}
        value={session.currentCandleIndex}
        onChange={(e) => onSetIndex(Number(e.target.value))}
        className="bt-timeline-range"
      />
      <div className="bt-timeline-marks">
        {trades.map((t) => {
          const idx = candles.findIndex((c) => c.time === t.entryTime);
          if (idx < 0) return null;
          const left = (idx / candles.length) * 100;
          const color = t.result === "win" ? "#22c55e" : t.result === "loss" ? "#ef4444" : t.result === "breakeven" ? "#94a3b8" : "#3b82f6";
          return (
            <button
              key={t.id}
              className="bt-timeline-dot"
              style={{ left: `${left}%`, background: color }}
              onClick={() => { onSelectTrade(t); onSetIndex(idx); }}
              title={`${t.side.toUpperCase()} ${t.pnl ? "$" + t.pnl.toFixed(2) : "Open"}`}
            />
          );
        })}
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Save,
  BookOpen,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronLeft,
  Trash2,
} from "lucide-react";

const REPLAY_SPEEDS = [
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "15s", value: 15000 },
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
  { label: "3m", value: 180000 },
  { label: "5m", value: 300000 },
  { label: "10m", value: 600000 },
];

const TIMEFRAMES = ["5s", "1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"];

const ASSETS = ["NAS100USD", "US30USD", "SPX500USD", "EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "BTCUSDT.P", "ETHUSDT.P", "SOLUSDT.P"];

function generateMockCandles(count = 500, startPrice = 19500) {
  const candles = [];
  let price = startPrice;
  const now = new Date("2026-01-01T00:00:00Z").getTime();

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * price * 0.003;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * price * 0.002;
    const low = Math.min(open, close) - Math.random() * price * 0.002;
    candles.push({
      time: new Date(now + i * 1800000).toISOString(),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(Math.random() * 10000) + 1000,
    });
    price = close;
  }
  return candles;
}

function filterCandlesByDateRange({ candles, startDate, endDate, startTime, endTime }) {
  const start = new Date(startTime ? `${startDate}T${startTime}:00` : `${startDate}T00:00:00`);
  const end = new Date(endTime ? `${endDate}T${endTime}:00` : `${endDate}T23:59:59`);

  return candles.filter((candle) => {
    const candleTime = new Date(candle.time);
    return candleTime >= start && candleTime <= end;
  });
}

function validateBacktestDateRange({ startDate, endDate, startTime, endTime }) {
  const start = new Date(startTime ? `${startDate}T${startTime}:00` : `${startDate}T00:00:00`);
  const end = new Date(endTime ? `${endDate}T${endTime}:00` : `${endDate}T23:59:59`);

  if (start >= end) {
    return { valid: false, message: "La fecha inicial debe ser menor que la fecha final." };
  }
  return { valid: true, message: "" };
}

function calculateBacktestStats(trades) {
  const closedTrades = trades.filter((t) => t.status === "closed");
  const winners = closedTrades.filter((t) => (t.pnl || 0) > 0);
  const losers = closedTrades.filter((t) => (t.pnl || 0) < 0);
  const breakeven = closedTrades.filter((t) => (t.pnl || 0) === 0);

  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossProfit = winners.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + (t.pnl || 0), 0));
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgWin = winners.length > 0 ? grossProfit / winners.length : 0;
  const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0;
  const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

  const buyTrades = closedTrades.filter((t) => t.side === "buy");
  const sellTrades = closedTrades.filter((t) => t.side === "sell");
  const buyWins = buyTrades.filter((t) => (t.pnl || 0) > 0);
  const sellWins = sellTrades.filter((t) => (t.pnl || 0) > 0);

  return {
    totalTrades: closedTrades.length,
    winners: winners.length,
    losers: losers.length,
    breakeven: breakeven.length,
    winRate,
    totalPnl,
    grossProfit,
    grossLoss,
    profitFactor,
    averageWin: avgWin,
    averageLoss: avgLoss,
    expectancy,
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    buyWinRate: buyTrades.length > 0 ? (buyWins.length / buyTrades.length) * 100 : 0,
    sellWinRate: sellTrades.length > 0 ? (sellWins.length / sellTrades.length) * 100 : 0,
  };
}

function BacktestingSetup({ allCandles, onStart, onBack }) {
  const [asset, setAsset] = useState("NAS100USD");
  const [initialCapital, setInitialCapital] = useState(100000);
  const [timeframe, setTimeframe] = useState("30m");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-01-10");
  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("16:00");
  const [commission, setCommission] = useState(0);
  const [riskPerTrade, setRiskPerTrade] = useState(1);

  const handleStart = () => {
    const validation = validateBacktestDateRange({ startDate, endDate, startTime, endTime });
    if (!validation.valid) { alert(validation.message); return; }

    const filtered = filterCandlesByDateRange({ candles: allCandles, startDate, endDate, startTime, endTime });
    if (filtered.length === 0) { alert("No hay velas disponibles para el rango seleccionado."); return; }

    onStart({
      id: crypto.randomUUID(),
      name: `Backtest ${asset} ${startDate} - ${endDate}`,
      asset,
      timeframe,
      initialCapital,
      currentBalance: initialCapital,
      startDate,
      endDate,
      startTime,
      endTime,
      commission,
      riskPerTrade,
      currentCandleIndex: 0,
      isPlaying: false,
      replaySpeed: 5000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, filtered);
  };

  return (
    <div className="bt-setup">
      <div className="bt-setup-header">
        <button className="bt-btn-icon" onClick={onBack}><ChevronLeft size={20} /></button>
        <div>
          <h2 className="bt-setup-title">Backtesting Setup</h2>
          <p className="bt-setup-desc">Select the historical range, asset and capital to start practicing.</p>
        </div>
      </div>
      <div className="bt-setup-grid">
        <label className="bt-field">
          <span className="bt-field-label">Asset</span>
          <select value={asset} onChange={(e) => setAsset(e.target.value)} className="bt-input">
            {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="bt-field">
          <span className="bt-field-label">Initial Capital</span>
          <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} className="bt-input" />
        </label>
        <label className="bt-field">
          <span className="bt-field-label">Start Date</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bt-input" />
        </label>
        <label className="bt-field">
          <span className="bt-field-label">End Date</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bt-input" />
        </label>
        <label className="bt-field">
          <span className="bt-field-label">Start Time</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bt-input" />
        </label>
        <label className="bt-field">
          <span className="bt-field-label">End Time</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bt-input" />
        </label>
        <label className="bt-field">
          <span className="bt-field-label">Timeframe</span>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="bt-input">
            {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
          </select>
        </label>
        <label className="bt-field">
          <span className="bt-field-label">Commission</span>
          <input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} className="bt-input" />
        </label>
        <label className="bt-field">
          <span className="bt-field-label">Risk Per Trade %</span>
          <input type="number" value={riskPerTrade} onChange={(e) => setRiskPerTrade(Number(e.target.value))} className="bt-input" />
        </label>
      </div>
      <button className="bt-btn bt-btn-primary bt-btn-start" onClick={handleStart}>
        <Play size={18} /> Start Backtesting
      </button>
    </div>
  );
}

function CandleChart({ candles, trades, session, currentIndex }) {
  const chartRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { visibleCandles, priceMin, priceMax, candleWidth, pathD } = useMemo(() => {
    if (!candles.length) return { visibleCandles: [], priceMin: 0, priceMax: 0, candleWidth: 0, pathD: "" };

    const visible = candles.slice(0, currentIndex + 1);
    if (!visible.length) return { visibleCandles: [], priceMin: 0, priceMax: 0, candleWidth: 0, pathD: "" };

    const prices = visible.flatMap((c) => [c.high, c.low]);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    const pad = (max - min) * 0.08 || 1;
    min -= pad;
    max += pad;

    const w = dimensions.width;
    const h = dimensions.height;
    const cw = Math.max(2, Math.min(w / visible.length - 1, 12));

    let path = "";
    if (visible.length > 1) {
      path = visible.map((c, i) => {
        const x = (i / (visible.length - 1)) * w;
        const y = h - ((c.close - min) / (max - min)) * h;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(" ");
    }

    return { visibleCandles: visible, priceMin: min, priceMax: max, candleWidth: cw, pathD: path };
  }, [candles, currentIndex, dimensions]);

  const openTrades = useMemo(() => trades.filter((t) => t.status === "open"), [trades]);

  if (!visibleCandles.length) {
    return <div className="bt-chart" ref={chartRef}><div className="bt-chart-empty">No data</div></div>;
  }

  const w = dimensions.width;
  const h = dimensions.height;
  const range = priceMax - priceMin || 1;
  const yScale = (price) => h - ((price - priceMin) / range) * h;

  return (
    <div className="bt-chart" ref={chartRef}>
      <svg width={w} height={h} className="bt-chart-svg">
        {visibleCandles.map((c, i) => {
          const x = (i / Math.max(visibleCandles.length - 1, 1)) * w;
          const cw = candleWidth;
          const bodyTop = yScale(Math.max(c.open, c.close));
          const bodyBottom = yScale(Math.min(c.open, c.close));
          const bodyH = Math.max(bodyBottom - bodyTop, 1);
          const wickTop = yScale(c.high);
          const wickBottom = yScale(c.low);
          const isUp = c.close >= c.open;
          const color = isUp ? "#86efac" : "#fca5a5";

          return (
            <g key={i}>
              <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={color} strokeWidth={0.8} />
              <rect x={x - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={color} opacity={isUp ? 0.85 : 0.7} />
            </g>
          );
        })}

        <path d={pathD} fill="none" stroke="#67e8f9" strokeWidth="1.5" opacity="0.4" />

        {trades.filter((t) => t.status === "open" || t.status === "closed").map((t) => {
          const entryY = yScale(t.entryPrice);
          const entryX = (() => {
            const idx = visibleCandles.findIndex((c) => c.time === t.entryTime);
            if (idx >= 0) return (idx / Math.max(visibleCandles.length - 1, 1)) * w;
            return 0;
          })();
          return (
            <g key={t.id}>
              <line x1={0} y1={entryY} x2={w} y2={entryY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
              {t.stopLoss && (
                <line x1={0} y1={yScale(t.stopLoss)} x2={w} y2={yScale(t.stopLoss)} stroke="#f87171" strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
              )}
              {t.takeProfit && (
                <line x1={0} y1={yScale(t.takeProfit)} x2={w} y2={yScale(t.takeProfit)} stroke="#4ade80" strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
              )}
              <circle cx={entryX} cy={entryY} r={4} fill={t.side === "buy" ? "#22c55e" : "#ef4444"} />
            </g>
          );
        })}
      </svg>

      <div className="bt-chart-price-labels">
        <span>{priceMax.toFixed(2)}</span>
        <span>{((priceMax + priceMin) / 2).toFixed(2)}</span>
        <span>{priceMin.toFixed(2)}</span>
      </div>
    </div>
  );
}

function ReplayControl({ session, candles, onPlay, onPause, onNext, onPrev, onSpeedChange, onSetIndex, onEnd }) {
  if (!session) return null;

  return (
    <div className="bt-replay-control">
      <button className="bt-btn-icon" onClick={onPrev} title="Backward"><SkipBack size={16} /></button>

      {session.isPlaying ? (
        <button className="bt-btn bt-btn-replay" onClick={onPause}><Pause size={16} /> Pause</button>
      ) : (
        <button className="bt-btn bt-btn-replay" onClick={onPlay}><Play size={16} /> Play</button>
      )}

      <button className="bt-btn-icon" onClick={onNext} title="Forward"><SkipForward size={16} /></button>

      <select value={session.replaySpeed} onChange={(e) => onSpeedChange(Number(e.target.value))} className="bt-speed-select">
        {REPLAY_SPEEDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <div className="bt-replay-progress">
        <span className="bt-replay-pct">{Math.round((session.currentCandleIndex / Math.max(candles.length - 1, 1)) * 100)}%</span>
        <span className="bt-replay-count">{session.currentCandleIndex + 1} / {candles.length}</span>
      </div>

      <button className="bt-btn-icon bt-btn-danger" onClick={onEnd} title="End Session"><X size={16} /></button>
    </div>
  );
}

function TradingPanel({ session, candles, trades, currentIndex, onOpenOrder }) {
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

function OrderModal({ side, entryPrice, session, onClose, onSave }) {
  const [type, setType] = useState("market");
  const [positionSize, setPositionSize] = useState(1);
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = (withJournal) => {
    onSave({
      id: crypto.randomUUID(),
      sessionId: session.id,
      asset: session.asset,
      timeframe: session.timeframe,
      side,
      type,
      status: "open",
      entryPrice,
      stopLoss: stopLossEnabled && stopLoss ? Number(stopLoss) : undefined,
      takeProfit: takeProfitEnabled && takeProfit ? Number(takeProfit) : undefined,
      positionSize,
      entryTime: new Date().toISOString(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: withJournal ? notes : "",
    });
    onClose();
  };

  return (
    <div className="bt-overlay" onClick={onClose}>
      <div className="bt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bt-modal-header">
          <h3 className="bt-modal-title">Place Order — {side === "buy" ? "Buy" : "Sell"}</h3>
          <button className="bt-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="bt-modal-grid">
          <label className="bt-field">
            <span className="bt-field-label">Side</span>
            <select value={side} disabled className="bt-input">
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </label>
          <label className="bt-field">
            <span className="bt-field-label">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="bt-input">
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </label>
          <label className="bt-field">
            <span className="bt-field-label">Position Size</span>
            <input type="number" value={positionSize} onChange={(e) => setPositionSize(Number(e.target.value))} className="bt-input" />
          </label>
          <label className="bt-field">
            <span className="bt-field-label">Entry Price</span>
            <input type="number" value={entryPrice} readOnly className="bt-input" />
          </label>
        </div>
        <div className="bt-modal-toggles">
          <label className="bt-toggle-row">
            <span>Stop Loss</span>
            <input type="checkbox" checked={stopLossEnabled} onChange={(e) => setStopLossEnabled(e.target.checked)} />
          </label>
          {stopLossEnabled && (
            <input type="number" placeholder="Stop Loss Price" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className="bt-input" />
          )}
          <label className="bt-toggle-row">
            <span>Take Profit</span>
            <input type="checkbox" checked={takeProfitEnabled} onChange={(e) => setTakeProfitEnabled(e.target.checked)} />
          </label>
          {takeProfitEnabled && (
            <input type="number" placeholder="Take Profit Price" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className="bt-input" />
          )}
        </div>
        <div className="bt-modal-fields">
          <label className="bt-field">
            <span className="bt-field-label">Tags (comma separated)</span>
            <input placeholder="ORB, FVG, London, NY..." value={tags} onChange={(e) => setTags(e.target.value)} className="bt-input" />
          </label>
          <label className="bt-field">
            <span className="bt-field-label">Journal Notes</span>
            <textarea placeholder="Reason for entry, mistake, lesson..." value={notes} onChange={(e) => setNotes(e.target.value)} className="bt-textarea" rows={3} />
          </label>
        </div>
        <div className="bt-modal-actions">
          <button className="bt-btn bt-btn-ghost" onClick={onClose}>Discard</button>
          <button className="bt-btn bt-btn-secondary" onClick={() => handleSave(false)}><Save size={16} /> Save</button>
          <button className="bt-btn bt-btn-primary" onClick={() => handleSave(true)}><BookOpen size={16} /> Save &amp; Journal</button>
        </div>
      </div>
    </div>
  );
}

function BacktestTimeline({ session, candles, trades, onSetIndex, onSelectTrade }) {
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

function SessionStats({ trades, session }) {
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

function BacktestingSessions({ sessions, onBack, onNew, onViewSession, onDeleteSession }) {
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

function SessionDetail({ session, onBack }) {
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

export default function BacktestingPage({ allCandles: externalCandles }) {
  const [view, setView] = useState("sessions");
  const [session, setSession] = useState(null);
  const [candles, setCandles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(5000);
  const [trades, setTrades] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [orderSide, setOrderSide] = useState(null);
  const [savedSessions, setSavedSessions] = useState([]);
  const [viewingSession, setViewingSession] = useState(null);

  const allCandles = externalCandles?.length > 0 ? externalCandles : useMemo(() => generateMockCandles(480), []);

  const visibleCandles = useMemo(() => candles.slice(0, currentIndex + 1), [candles, currentIndex]);

  const currentCandle = candles[currentIndex];
  const currentPrice = currentCandle?.close ?? 0;

  const closeTrade = useCallback((tradeId) => {
    if (!currentCandle) return;
    setTrades((prev) => {
      const trade = prev.find((t) => t.id === tradeId);
      if (!trade || trade.status === "closed") return prev;

      const direction = trade.side === "buy" ? 1 : -1;
      const pnl = (currentPrice - trade.entryPrice) * direction * trade.positionSize;
      let rMultiple = 0;
      if (trade.stopLoss) {
        const riskPerUnit = Math.abs(trade.entryPrice - trade.stopLoss);
        if (riskPerUnit > 0) rMultiple = pnl / (riskPerUnit * trade.positionSize);
      }

      const updated = prev.map((t) =>
        t.id === tradeId
          ? { ...t, status: "closed", exitPrice: currentPrice, exitTime: currentCandle.time, pnl, rMultiple, result: pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven" }
          : t
      );

      setSession((s) => s ? { ...s, currentBalance: s.currentBalance + pnl } : s);
      return updated;
    });
  }, [currentCandle]);

  useEffect(() => {
    if (!session) return;
    const openTrades = trades.filter((t) => t.status === "open");
    openTrades.forEach((t) => {
      if (t.stopLoss && ((t.side === "buy" && currentPrice <= t.stopLoss) || (t.side === "sell" && currentPrice >= t.stopLoss))) {
        closeTrade(t.id);
      }
      if (t.takeProfit && ((t.side === "buy" && currentPrice >= t.takeProfit) || (t.side === "sell" && currentPrice <= t.takeProfit))) {
        closeTrade(t.id);
      }
    });
  }, [currentIndex, currentPrice, session]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= candles.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, candles.length]);

  const handleStart = (newSession, filteredCandles) => {
    setSession(newSession);
    setCandles(filteredCandles);
    setCurrentIndex(0);
    setIsPlaying(false);
    setSpeed(5000);
    setTrades([]);
    setSelectedTrade(null);
    setView("replay");
  };

  const handleEnd = () => {
    const finalSession = { ...session, trades, currentCandleIndex: currentIndex, isPlaying: false, updatedAt: new Date().toISOString() };
    setSavedSessions((prev) => [...prev, finalSession]);
    setSession(null);
    setCandles([]);
    setTrades([]);
    setView("sessions");
  };

  const handlePlay = () => {
    if (currentIndex >= candles.length - 1) return;
    setIsPlaying(true);
  };
  const handlePause = () => setIsPlaying(false);
  const handleNext = () => setCurrentIndex((prev) => Math.min(prev + 1, candles.length - 1));
  const handlePrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));
  const handleSetIndex = (idx) => setCurrentIndex(Math.max(0, Math.min(idx, candles.length - 1)));
  const handleSpeedChange = (newSpeed) => setSpeed(newSpeed);

  const handleOpenOrder = (side) => setOrderSide(side);
  const handleSaveOrder = (trade) => {
    setTrades((prev) => [...prev, trade]);
  };

  const handleSelectTrade = (trade) => setSelectedTrade(trade);

  const handleDeleteSession = (id) => setSavedSessions((prev) => prev.filter((s) => s.id !== id));

  if (viewingSession) {
    return (
      <div className="bt-page">
        <SessionDetail session={viewingSession} onBack={() => setViewingSession(null)} />
      </div>
    );
  }

  if (view === "sessions") {
    return (
      <div className="bt-page">
        <BacktestingSessions
          sessions={savedSessions}
          onBack={() => {}}
          onNew={() => setView("setup")}
          onViewSession={(s) => setViewingSession(s)}
          onDeleteSession={handleDeleteSession}
        />
      </div>
    );
  }

  if (view === "setup") {
    return (
      <div className="bt-page">
        <BacktestingSetup
          allCandles={allCandles}
          onStart={handleStart}
          onBack={() => setView("sessions")}
        />
      </div>
    );
  }

  if (view === "replay" && session) {
    const replaySession = { ...session, currentCandleIndex: currentIndex, isPlaying, replaySpeed: speed };
    const stats = calculateBacktestStats(trades);

    return (
      <div className="bt-page bt-page-replay">
        <ReplayControl
          session={replaySession}
          candles={candles}
          onPlay={handlePlay}
          onPause={handlePause}
          onNext={handleNext}
          onPrev={handlePrev}
          onSpeedChange={handleSpeedChange}
          onSetIndex={handleSetIndex}
          onEnd={handleEnd}
        />

        <div className="bt-main-area">
          <div className="bt-chart-area">
            <CandleChart
              candles={candles}
              trades={trades}
              session={replaySession}
              currentIndex={currentIndex}
            />
          </div>

          <SessionStats trades={trades} session={replaySession} />
        </div>

        <BacktestTimeline
          session={replaySession}
          candles={candles}
          trades={trades}
          onSetIndex={handleSetIndex}
          onSelectTrade={handleSelectTrade}
        />

        <TradingPanel
          session={replaySession}
          candles={candles}
          trades={trades}
          currentIndex={currentIndex}
          onOpenOrder={handleOpenOrder}
        />

        {orderSide && (
          <OrderModal
            side={orderSide}
            entryPrice={currentPrice}
            session={session}
            onClose={() => setOrderSide(null)}
            onSave={handleSaveOrder}
          />
        )}
      </div>
    );
  }

  return null;
}

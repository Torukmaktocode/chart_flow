import { useState } from "react";
import { ChevronLeft, Play } from "lucide-react";
import { ASSETS, TIMEFRAMES, filterCandlesByDateRange, validateBacktestDateRange } from "../../utils/backtestHelpers";

export default function BacktestingSetup({ allCandles, onStart, onBack }) {
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

import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RefreshCw, Search, TrendingUp, ShieldAlert, Activity } from "lucide-react";
import BacktestingPage from "./backtesting";
import Sparkline from "./components/Sparkline";
import ModuleCard from "./components/ModuleCard";
import Stat from "./components/Stat";
import DashboardDetail from "./components/DashboardDetail";
import ErrorBoundary from "./components/ErrorBoundary";
import useMarketData from "./hooks/useMarketData";
import { MODULES, formatNumber } from "./utils/constants";
import "./styles.css";

function App() {
  const { symbol, data, status, allCandles, changeSymbol, reload } = useMarketData("NAS100");
  const [query, setQuery] = useState("NAS100");
  const [active, setActive] = useState("panel");

  function submit(event) {
    event.preventDefault();
    const next = query.trim() || "AAPL";
    changeSymbol(next);
  }

  const activeModule = MODULES.find((item) => item.id === active) || MODULES[0];
  const metrics = data?.metrics || {};
  const options = data?.options || {};

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sistema QUANT con datos gratuitos</p>
          <h1>Options Flow Command Center</h1>
        </div>
        <form className="searchbar" onSubmit={submit}>
          <Search size={19} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="NAS100, EURUSD, XAUUSD, BTCUSDT.P, ETHUSDT.P, SOLUSDT.P" />
          <button type="submit">Analizar</button>
          <button className="icon-button" type="button" onClick={reload} aria-label="Actualizar">
            <RefreshCw size={18} className={status === "loading" ? "spin" : ""} />
          </button>
        </form>
      </header>

      <section className="overview">
        <div className="chart-panel">
          <div className="chart-head">
            <div>
              <span>{data?.symbol || symbol}</span>
              <strong>${formatNumber(metrics.price)}</strong>
            </div>
            <div className={metrics.changePct >= 0 ? "pill up" : "pill down"}>
              <TrendingUp size={16} />
              {formatNumber(metrics.changePct, 2)}%
            </div>
          </div>
          <Sparkline rows={data?.chart || []} />
        </div>
        <div className="signal-panel">
          <div className="status-line">
            <Activity size={18} />
            <span>{status === "ready" ? "Datos reales conectados" : status === "loading" ? "Cargando mercado" : "Error de datos"}</span>
          </div>
          <Stat label="Put / Call volumen" value={formatNumber(options.putCallVolumeRatio, 2)} />
          <Stat label="Put / Call OI" value={formatNumber(options.putCallOiRatio, 2)} />
          <Stat label="Max pain" value={options.maxPain ? `$${formatNumber(options.maxPain)}` : "N/D"} />
          <Stat label="Fuente" value={data?.provider || "Yahoo Finance"} />
        </div>
      </section>

      <section className="workspace">
        <aside className="module-grid">
          {MODULES.map((module) => (
            <ModuleCard key={module.id} module={module} active={active === module.id} onClick={setActive} />
          ))}
        </aside>

        {active === "backtesting" ? (
          <section className="analysis-panel">
            <BacktestingPage allCandles={allCandles} />
          </section>
        ) : (
          <section className="analysis-panel">
            <div className="analysis-head">
              <span className="module-icon large" style={{ "--accent": activeModule.color }}>
                <activeModule.icon size={25} />
              </span>
              <div>
                <h2>{activeModule.title}</h2>
                <p>{activeModule.text}</p>
              </div>
            </div>
            <DashboardDetail active={active} data={data} />
            <div className="warnings">
              <ShieldAlert size={18} />
              <span>{data?.warnings?.[0] || "Los datos gratuitos pueden venir retrasados según el proveedor."}</span>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

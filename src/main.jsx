import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Gauge,
  Home,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  Sigma,
  TrendingUp,
  History
} from "lucide-react";
import BacktestingPage from "./backtesting";
import "./styles.css";

const MODULES = [
  {
    id: "panel",
    icon: Home,
    title: "Panel",
    text: "Flujo de órdenes, opciones, deriva neta, noticias simuladas por señal y ganadores/perdedores.",
    color: "#0ea5e9"
  },
  {
    id: "exposure",
    icon: Network,
    title: "Exposición",
    text: "GEX, VEX, DEX y CHEX por precio de ejercicio y fecha de vencimiento.",
    color: "#60a5fa"
  },
  {
    id: "flow",
    icon: BarChart3,
    title: "Análisis de flujo",
    text: "Mapa de calor de flujo neto, deriva neta y actividad de opciones.",
    color: "#38bdf8"
  },
  {
    id: "dark",
    icon: CircleDollarSign,
    title: "Mercado oscuro / Acciones",
    text: "Precio de acciones, tiempo, volumen relativo y proxy de niveles tipo Dark Pool.",
    color: "#22c55e"
  },
  {
    id: "stats",
    icon: Sigma,
    title: "Estadística",
    text: "Contratos, comerciales, cuota de mercado, ratios put/call y tabla de contratos.",
    color: "#a78bfa"
  },
  {
    id: "interest",
    icon: Building2,
    title: "Interés abierto",
    text: "Dolor máximo, máximo interés abierto por strike, vencimiento y serie temporal.",
    color: "#f59e0b"
  },
  {
    id: "volatility",
    icon: Gauge,
    title: "Análisis de volatilidad",
    text: "Volatilidad realizada, rangos, asimetría proxy y estructura temporal.",
    color: "#ef4444"
  },
  {
    id: "backtesting",
    icon: History,
    title: "Backtesting",
    text: "Replay histórico, simulación de trades, análisis de sesiones y estadísticas.",
    color: "#8b5cf6"
  }
];

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/D";
  return Intl.NumberFormat("es-CL", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(Number(value));
}

function compact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/D";
  return Intl.NumberFormat("es-CL", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(value));
}

function Sparkline({ rows }) {
  const path = useMemo(() => {
    if (!rows?.length) return "";
    const width = 720;
    const height = 180;
    const values = rows.map((row) => row.close);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(max - min, 1);
    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width;
        const y = height - ((value - min) / spread) * height;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [rows]);

  return (
    <svg className="sparkline" viewBox="0 0 720 180" role="img" aria-label="Serie de precio">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L 720 180 L 0 180 Z`} fill="url(#lineFill)" />
      <path d={path} fill="none" stroke="#67e8f9" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function ModuleCard({ module, active, onClick }) {
  const Icon = module.icon;
  return (
    <button className={`module-card ${active ? "active" : ""}`} onClick={() => onClick(module.id)}>
      <span className="module-icon" style={{ "--accent": module.color }}>
        <Icon size={23} strokeWidth={2.2} />
      </span>
      <span className="module-copy">
        <strong>{module.title}</strong>
        <span>{module.text}</span>
      </span>
    </button>
  );
}

function Stat({ label, value, trend }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {trend && <em className={trend.startsWith("-") ? "down" : "up"}>{trend}</em>}
    </div>
  );
}

function HeatCell({ label, value }) {
  const intensity = Math.min(Math.abs(value), 1);
  const positive = value >= 0;
  return (
    <div
      className="heat-cell"
      style={{
        "--heat": positive ? "34, 197, 94" : "239, 68, 68",
        "--alpha": 0.18 + intensity * 0.58
      }}
    >
      <span>{label}</span>
      <strong>{formatNumber(value * 100, 1)}%</strong>
    </div>
  );
}

function DashboardDetail({ active, data }) {
  const metrics = data?.metrics || {};
  const options = data?.options || {};
  const contracts = options.highestOi || [];

  if (active === "exposure") {
    return (
      <section className="detail-grid">
        <Stat label="GEX proxy" value={compact(metrics.gexProxy, 0)} />
        <Stat label="DEX proxy" value={compact(metrics.dexProxy, 0)} />
        <Stat label="VEX proxy" value={formatNumber(metrics.vannaProxy * 100, 1) + "%"} />
        <Stat label="CHEX proxy" value={formatNumber(metrics.charmProxy * 100, 1) + "%"} />
      </section>
    );
  }

  if (active === "flow") {
    return (
      <section className="heatmap">
        <HeatCell label="Flujo neto" value={metrics.flowScore || 0} />
        <HeatCell label="Call / Put vol" value={(1 / (options.putCallVolumeRatio || 1) - 1) || 0} />
        <HeatCell label="Volumen relativo" value={metrics.darkPoolProxy || 0} />
        <HeatCell label="Sesgo OI" value={Math.tanh((metrics.gexProxy || 0) / 100000)} />
      </section>
    );
  }

  if (active === "interest" || active === "stats") {
    return (
      <section className="table-wrap">
        <div className="table-head">
          <span>Contrato</span>
          <span>Tipo</span>
          <span>Strike</span>
          <span>Vol.</span>
          <span>OI</span>
        </div>
        {contracts.map((item) => (
          <div className="table-row" key={item.contractSymbol}>
            <span>{item.contractSymbol}</span>
            <span className={item.type === "CALL" ? "tag call" : "tag put"}>{item.type}</span>
            <span>{formatNumber(item.strike)}</span>
            <span>{compact(item.volume, 0)}</span>
            <span>{compact(item.openInterest, 0)}</span>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="detail-grid">
      <Stat label="Precio" value={`$${formatNumber(metrics.price)}`} trend={`${formatNumber(metrics.changePct, 2)}%`} />
      <Stat label="Volatilidad realizada" value={`${formatNumber(metrics.realizedVol, 2)}%`} />
      <Stat label="Volumen" value={compact(metrics.volume, 0)} />
      <Stat label="Dark proxy" value={`${formatNumber((metrics.darkPoolProxy || 0) * 100, 1)}%`} />
    </section>
  );
}

function App() {
  const [symbol, setSymbol] = useState("NAS100");
  const [query, setQuery] = useState("NAS100");
  const [active, setActive] = useState("panel");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [allCandles, setAllCandles] = useState([]);

  async function load(nextSymbol = symbol) {
    setStatus("loading");
    try {
      const response = await fetch(`/api/market/${encodeURIComponent(nextSymbol)}?range=3mo&interval=1d`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setData(json);
      setAllCandles(json?.chart || []);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setData({ error: error.message });
    }
  }

  useEffect(() => {
    load(symbol);
  }, []);

  function submit(event) {
    event.preventDefault();
    const next = query.trim() || "AAPL";
    setSymbol(next);
    load(next);
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="NAS100, EURUSD, XAUUSD, BTCUSDT.P, ETHUSDT.P, SOLUSDT.P" />
          <button type="submit">Analizar</button>
          <button className="icon-button" type="button" onClick={() => load(symbol)} aria-label="Actualizar">
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

createRoot(document.getElementById("root")).render(<App />);

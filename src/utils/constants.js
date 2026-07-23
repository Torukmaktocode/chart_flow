import {
  Activity, BarChart3, Building2, CircleDollarSign,
  Gauge, Home, Network, Sigma, History
} from "lucide-react";

export const MODULES = [
  { id: "panel", icon: Home, title: "Panel", text: "Flujo de órdenes, opciones, deriva neta, noticias simuladas por señal y ganadores/perdedores.", color: "#0ea5e9" },
  { id: "exposure", icon: Network, title: "Exposición", text: "GEX, VEX, DEX y CHEX por precio de ejercicio y fecha de vencimiento.", color: "#60a5fa" },
  { id: "flow", icon: BarChart3, title: "Análisis de flujo", text: "Mapa de calor de flujo neto, deriva neta y actividad de opciones.", color: "#38bdf8" },
  { id: "dark", icon: CircleDollarSign, title: "Mercado oscuro / Acciones", text: "Precio de acciones, tiempo, volumen relativo y proxy de niveles tipo Dark Pool.", color: "#22c55e" },
  { id: "stats", icon: Sigma, title: "Estadística", text: "Contratos, comerciales, cuota de mercado, ratios put/call y tabla de contratos.", color: "#a78bfa" },
  { id: "interest", icon: Building2, title: "Interés abierto", text: "Dolor máximo, máximo interés abierto por strike, vencimiento y serie temporal.", color: "#f59e0b" },
  { id: "volatility", icon: Gauge, title: "Análisis de volatilidad", text: "Volatilidad realizada, rangos, asimetría proxy y estructura temporal.", color: "#ef4444" },
  { id: "backtesting", icon: History, title: "Backtesting", text: "Replay histórico, simulación de trades, análisis de sesiones y estadísticas.", color: "#8b5cf6" }
];

export const ASSETS = [
  "NAS100", "US30", "US500", "EURUSD", "GBPUSD",
  "XAUUSD", "BTCUSDT_P", "ETHUSDT_P", "SOLUSDT_P"
];

export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/D";
  return Intl.NumberFormat("es-CL", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(Number(value));
}

export function compact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/D";
  return Intl.NumberFormat("es-CL", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(value));
}

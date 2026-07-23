import { createCanvas } from "canvas";
import fs from "fs";
import https from "https";
import FormData from "form-data";

// Configuración de Telegram
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ Define TELEGRAM_BOT_TOKEN en .env"); process.exit(1); }

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!CHAT_ID) { console.error("❌ Define TELEGRAM_CHAT_ID en .env"); process.exit(1); }
const W = 800, H = 500;
const MARGIN = { top: 30, right: 70, bottom: 50, left: 55 };
const CW = W - MARGIN.left - MARGIN.right;
const CH = H - MARGIN.top - MARGIN.bottom - 60;
const VH = 50;

const COLORS = {
  bg: "#0b1018",
  grid: "#1a2435",
  bull: "#00e5a0",
  bear: "#ff3355",
  text: "#8a9ab0",
  textBright: "#e8ecf4",
  volBull: "rgba(0,229,160,0.25)",
  volBear: "rgba(255,51,85,0.25)",
};

// Mapeo de símbolos
const SYMBOLS = {
  "NAS100": { label: "NASDAQ 100", basePrice: 21500, volatility: 0.02 },
  "NASDAQ": { label: "NASDAQ 100", basePrice: 21500, volatility: 0.02 },
  "US30": { label: "DOW JONES", basePrice: 42000, volatility: 0.015 },
  "DJI": { label: "DOW JONES", basePrice: 42000, volatility: 0.015 },
  "US500": { label: "S&P 500", basePrice: 5800, volatility: 0.012 },
  "SPX": { label: "S&P 500", basePrice: 5800, volatility: 0.012 },
  "EURUSD": { label: "EUR/USD", basePrice: 1.0850, volatility: 0.003 },
  "GBPUSD": { label: "GBP/USD", basePrice: 1.2700, volatility: 0.004 },
  "USDJPY": { label: "USD/JPY", basePrice: 157.50, volatility: 0.005 },
  "BTC": { label: "BTC/USD", basePrice: 104000, volatility: 0.03 },
  "ETH": { label: "ETH/USD", basePrice: 2500, volatility: 0.04 },
  "SOL": { label: "SOL/USD", basePrice: 180, volatility: 0.05 },
  "XAUUSD": { label: "GOLD", basePrice: 3350, volatility: 0.008 },
  "GOLD": { label: "GOLD", basePrice: 3350, volatility: 0.008 },
  "AAPL": { label: "APPLE", basePrice: 215, volatility: 0.02 },
  "TSLA": { label: "TESLA", basePrice: 340, volatility: 0.04 },
  "NVDA": { label: "NVIDIA", basePrice: 155, volatility: 0.035 },
};

// Timeframes
const TF_LABELS = {
  "1m": "1 Minuto",
  "5m": "5 Minutos",
  "15m": "15 Minutos",
  "1h": "1 Hora",
  "4h": "4 Horas",
  "1d": "Diario",
  "1w": "Semanal",
};

// Generar datos de velas simuladas
function generateCandles(basePrice, volatility, count = 80) {
  const candles = [];
  let price = basePrice;
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * volatility * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
    const volume = Math.floor(Math.random() * 1000000 + 500000);
    
    candles.push({
      t: new Date(now - (count - i) * 86400000),
      o: open,
      h: high,
      l: low,
      c: close,
      v: volume,
    });
    
    price = close;
  }
  return candles;
}

// Generar gráfico
function generateChart(symbolKey, tf = "1d") {
  const symbolInfo = SYMBOLS[symbolKey] || { label: symbolKey, basePrice: 100, volatility: 0.02 };
  const candles = generateCandles(symbolInfo.basePrice, symbolInfo.volatility, 80);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Fondo
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const high = Math.max(...candles.map((c) => c.h));
  const low = Math.min(...candles.map((c) => c.l));
  const range_ = high - low || 1;
  const pad = range_ * 0.05;
  const yMin = low - pad;
  const yMax = high + pad;
  const yRange = yMax - yMin || 1;
  const volMax = Math.max(...candles.map((c) => c.v || 0)) || 1;

  const n = candles.length;
  const candleW = Math.max(1, Math.floor((CW / n) * 0.6));
  const gap = Math.max(0, Math.floor(CW / n) - candleW);
  const step = candleW + gap;

  const toX = (i) => MARGIN.left + i * step + step / 2;
  const toY = (v) => MARGIN.top + CH - ((v - yMin) / yRange) * CH;
  const toVolY = (v) => MARGIN.top + CH + 10 + VH - (v / volMax) * VH;

  // Grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = MARGIN.top + (CH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(W - MARGIN.right, y);
    ctx.stroke();
  }

  // Labels de precio
  ctx.font = "11px monospace";
  for (let i = 0; i <= 5; i++) {
    const y = MARGIN.top + (CH / 5) * i;
    const val = yMax - (yRange / 5) * i;
    const label = val >= 1000 ? val.toLocaleString("en-US", { maximumFractionDigits: 0 }) : val.toFixed(val < 10 ? 4 : 2);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "right";
    ctx.fillText(label, MARGIN.left - 8, y + 4);
  }

  // Título y precio
  const last = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2].c : last.o;
  const chg = last.c - prev;
  const pct = prev ? (chg / prev) * 100 : 0;

  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "left";
  ctx.font = "bold 13px monospace";
  ctx.fillText(`${symbolInfo.label} • ${tf.toUpperCase()}`, MARGIN.left, 20);
  
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.textBright;
  ctx.font = "bold 14px monospace";
  ctx.fillText(last.c.toFixed(last.c < 100 ? 2 : 0), W - MARGIN.right, 20);
  
  ctx.font = "10px monospace";
  ctx.fillStyle = chg >= 0 ? COLORS.bull : COLORS.bear;
  ctx.fillText(`${chg >= 0 ? "+" : ""}${chg.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`, W - MARGIN.right, 34);

  // Velas
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const x = toX(i);
    const isUp = c.c >= c.o;
    const color = isUp ? COLORS.bull : COLORS.bear;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, toY(c.h));
    ctx.lineTo(x, toY(c.l));
    ctx.stroke();

    ctx.fillStyle = color;
    const w = Math.max(2, candleW);
    const bodyTop = Math.min(toY(c.o), toY(c.c));
    const bodyH = Math.max(1, Math.abs(toY(c.c) - toY(c.o)));
    ctx.fillRect(x - w / 2, bodyTop, w, bodyH);

    ctx.fillStyle = isUp ? COLORS.volBull : COLORS.volBear;
    const volH = Math.max(1, (c.v / volMax) * VH);
    ctx.fillRect(x - Math.max(1, candleW * 0.3), toVolY(c.v), Math.max(2, candleW * 0.6), volH);
  }

  // Borde
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN.left, MARGIN.top, CW, CH);

  // Línea de precio actual
  const lastX = toX(n - 1);
  const lastY = toY(last.c);
  ctx.strokeStyle = "rgba(0,212,255,0.4)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, lastY);
  ctx.lineTo(lastX, lastY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Marca de agua
  ctx.font = "bold 60px monospace";
  ctx.fillStyle = "rgba(0,212,255,0.03)";
  ctx.textAlign = "center";
  ctx.fillText(symbolInfo.label, W / 2, H / 2 + 20);

  // Calcular estadísticas
  const openPrice = candles[0].o;
  const highPrice = high;
  const lowPrice = low;
  const closePrice = last.c;
  const totalVolume = candles.reduce((sum, c) => sum + c.v, 0);
  const changeFromOpen = closePrice - openPrice;
  const changePercentFromOpen = (changeFromOpen / openPrice) * 100;

  return {
    buffer: canvas.toBuffer("image/jpeg", { quality: 0.9 }),
    data: {
      symbol: symbolInfo.label,
      timeframe: TF_LABELS[tf] || tf,
      open: openPrice,
      high: highPrice,
      low: lowPrice,
      close: closePrice,
      change: changeFromOpen,
      changePercent: changePercentFromOpen,
      volume: totalVolume,
      candles: candles.length,
    },
  };
}

// Enviar foto por Telegram usando form-data
function sendPhoto(buffer, caption) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("chat_id", CHAT_ID);
    if (caption) form.append("caption", caption);
    form.append("photo", buffer, { filename: "chart.jpg", contentType: "image/jpeg" });

    const options = {
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/sendPhoto`,
      method: "POST",
      headers: form.getHeaders(),
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) resolve(json);
          else reject(new Error(json.description || "Error"));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    form.pipe(req);
  });
}

// Main
const args = process.argv.slice(2);
const symbolArg = (args[0] || "NAS100").toUpperCase();
const tfArg = args[1] || "1d";

const symbolInfo = SYMBOLS[symbolArg] || { label: symbolArg, basePrice: 100, volatility: 0.02 };

console.log(`Generando gráfico de ${symbolInfo.label} (${tfArg})...`);

try {
  const { buffer, data } = generateChart(symbolArg, tfArg);
  console.log(`Gráfico generado (${buffer.length} bytes). Enviando...`);
  
  // Crear caption con datos detallados
  const caption = `📊 ${data.symbol} - ${data.timeframe}

💰 Precio Actual: $${data.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
📈 Máximo: $${data.high.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
📉 Mínimo: $${data.low.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🔓 Apertura: $${data.open.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

📊 Cambio: ${data.change >= 0 ? "+" : ""}${data.change.toFixed(2)} (${data.changePercent >= 0 ? "+" : ""}${data.changePercent.toFixed(2)}%)
📦 Volumen: ${(data.volume / 1000000).toFixed(2)}M
🕯️ Velas: ${data.candles}`;

  sendPhoto(buffer, caption)
    .then(() => {
      console.log("OK: Gráfico enviado");
      process.exit(0);
    })
    .catch((e) => {
      console.error("Error enviando:", e.message);
      process.exit(1);
    });
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
}

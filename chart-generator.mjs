import { createCanvas } from "canvas";
import yahooFinance from "yahoo-finance2";

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

function roundTo(val, step) {
  return Math.round(val / step) * step;
}

function msAgo(days) {
  return new Date(Date.now() - days * 86400000);
}

export async function generateChart(symbolKey, yahooTicker, tf = "1d", bars = 80) {
  const periodDays = {
    "1m": 1, "5m": 3, "15m": 5, "30m": 10,
    "1h": 30, "2h": 60, "4h": 90,
    "1d": 200, "5d": 400, "1w": 800, "1mo": 2000,
  };
  const range = tf === "1d" ? "6mo" : tf === "1w" ? "2y" : "3mo";

  let candles;
  try {
    const result = await yahooFinance.chart(yahooTicker, { period1: msAgo(periodDays[tf] || 200), interval: tf });
    if (result?.quotes) {
      candles = result.quotes
        .filter((r) => Number.isFinite(r.close))
        .slice(-bars)
        .map((r) => ({
          t: new Date(r.date),
          o: r.open,
          h: r.high,
          l: r.low,
          c: r.close,
          v: r.volume || 0,
        }));
    }
  } catch {}
  if (!candles || candles.length < 2) {
    try {
      const result = await yahooFinance.historical(yahooTicker, { period1: range, interval: tf });
      if (result) {
        candles = result
          .filter((r) => Number.isFinite(r.close))
          .slice(-bars)
          .map((r) => ({
            t: new Date(r.date),
            o: r.open,
            h: r.high,
            l: r.low,
            c: r.close,
            v: r.volume || 0,
          }));
      }
    } catch {}
  }

  if (!candles || candles.length < 2) return null;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

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

  function drawGrid() {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const y = MARGIN.top + (CH / priceSteps) * i;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, y);
      ctx.lineTo(W - MARGIN.right, y);
      ctx.stroke();
    }
    const timeSteps = Math.min(6, Math.floor(n / 5));
    for (let i = 0; i <= timeSteps; i++) {
      const idx = Math.floor((n / timeSteps) * i);
      if (idx >= n) continue;
      const x = toX(idx);
      ctx.beginPath();
      ctx.moveTo(x, MARGIN.top);
      ctx.lineTo(x, MARGIN.top + CH);
      ctx.stroke();
    }
  }

  function drawLabels() {
    ctx.font = "11px 'JetBrains Mono', monospace";
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const y = MARGIN.top + (CH / priceSteps) * i;
      const val = yMax - (yRange / priceSteps) * i;
      const label = val >= 1000 ? val.toLocaleString("en-US", { maximumFractionDigits: 0 }) : val.toFixed(val < 10 ? 4 : val < 100 ? 2 : 1);
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "right";
      ctx.fillText(label, MARGIN.left - 8, y + 4);
    }

    const timeSteps = Math.min(6, Math.floor(n / 5));
    for (let i = 0; i <= timeSteps; i++) {
      const idx = Math.floor((n / timeSteps) * i);
      if (idx >= n) continue;
      const d = candles[idx].t;
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "center";
      ctx.fillText(label, toX(idx), MARGIN.top + CH + 20);
    }

    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "left";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    const last = candles[candles.length - 1];
    ctx.fillText(`${symbolKey} — ${tf}`, MARGIN.left, 20);
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.textBright;
    ctx.font = "bold 14px 'JetBrains Mono', monospace";
    const lastP = last.c.toLocaleString("en-US", { minimumFractionDigits: last.c < 100 ? 2 : 0, maximumFractionDigits: last.c < 10 ? 4 : 2 });
    ctx.fillText(lastP, W - MARGIN.right, 20);

    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = COLORS.text;
    const prev = candles.length > 1 ? candles[candles.length - 2].c : last.o;
    const chg = last.c - prev;
    const pct = prev ? (chg / prev) * 100 : 0;
    const chgStr = `${chg >= 0 ? "+" : ""}${chg.toFixed(last.c < 100 ? 4 : 2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`;
    ctx.fillStyle = chg >= 0 ? COLORS.bull : COLORS.bear;
    ctx.fillText(chgStr, W - MARGIN.right, 34);
  }

  function drawCandles() {
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const x = toX(i);
      const isUp = c.c >= c.o;
      const color = isUp ? COLORS.bull : COLORS.bear;
      const oy = toY(c.o);
      const cy = toY(c.c);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, toY(c.h));
      ctx.lineTo(x, toY(c.l));
      ctx.stroke();

      ctx.fillStyle = color;
      const w = Math.max(2, candleW);
      const bodyTop = Math.min(oy, cy);
      const bodyH = Math.max(1, Math.abs(cy - oy));
      ctx.fillRect(x - w / 2, bodyTop, w, bodyH);

      ctx.fillStyle = isUp ? COLORS.volBull : COLORS.volBear;
      const volH = Math.max(1, (c.v / volMax) * VH);
      const volX = x - Math.max(1, candleW * 0.3);
      ctx.fillRect(volX, toVolY(c.v), Math.max(2, candleW * 0.6), volH);
    }
  }

  function drawLabelsV() {
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "right";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillText("Vol", MARGIN.left - 8, MARGIN.top + CH + 30);
  }

  drawGrid();
  drawLabels();
  drawCandles();
  drawLabelsV();

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN.left, MARGIN.top, CW, CH);

  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 0.5;
  const lastX = toX(n - 1);
  ctx.beginPath();
  ctx.moveTo(lastX, MARGIN.top);
  ctx.lineTo(lastX, MARGIN.top + CH);
  ctx.stroke();

  const lastC = candles[candles.length - 1];
  const lastY = toY(lastC.c);
  ctx.strokeStyle = "rgba(0,212,255,0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, lastY);
  ctx.lineTo(lastX, lastY);
  ctx.stroke();
  ctx.setLineDash([]);

  return canvas.toBuffer("image/png");
}

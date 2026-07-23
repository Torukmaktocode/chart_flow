import cors from "cors";
import express from "express";
import yahooFinance from "yahoo-finance2";
import alertsRouter from "./routes/alerts.mjs";
import { startPriceMonitor, getMonitorStatus } from "./price-monitor.mjs";
import { setupAlertNotifications } from "./telegram-alerts.mjs";
import { compactChart, defaultSymbolAliases as symbolAliases, quantMetrics, summarizeOptions } from "./lib/utils.mjs";

yahooFinance.setGlobalConfig({
  validation: {
    logErrors: false,
    logOptionsErrors: false
  }
});

const app = express();
const port = Number(process.env.PORT || 8787);
const cache = new Map();
const ttlMs = 60_000;

app.use(cors());
app.use(express.json());

app.use("/api/alerts", alertsRouter);

function normalizeSymbol(raw) {
  const clean = String(raw || "AAPL").trim().toUpperCase();
  return symbolAliases[clean] || clean;
}

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.created < ttlMs) return hit.value;
  const value = await loader();
  cache.set(key, { created: Date.now(), value });
  return value;
}

app.get("/api/market/:symbol", async (req, res) => {
  const symbol = normalizeSymbol(req.params.symbol);
  const range = req.query.range || "3mo";
  const interval = req.query.interval || "1d";

  try {
    const payload = await cached(`market:${symbol}:${range}:${interval}`, async () => {
      const [quote, chart, chain] = await Promise.allSettled([
        yahooFinance.quote(symbol),
        yahooFinance.chart(symbol, { period1: range, interval }),
        yahooFinance.options(symbol)
      ]);

      const quoteValue = quote.status === "fulfilled" ? quote.value : {};
      const chartRows = chart.status === "fulfilled" ? compactChart(chart.value) : [];
      const options = chain.status === "fulfilled" ? summarizeOptions(chain.value) : summarizeOptions(null);
      const metrics = quantMetrics({ quote: quoteValue, chartRows, options });

      return {
        symbol,
        provider: "Yahoo Finance",
        fetchedAt: new Date().toISOString(),
        quote: quoteValue,
        chart: chartRows,
        options,
        metrics,
        warnings: [
          "Opciones y greeks son no oficiales y pueden venir retrasadas o incompletas.",
          "Dark pool se muestra como proxy cuantitativo calculado desde volumen relativo."
        ]
      };
    });

    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: "No se pudieron obtener datos de mercado.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: "Yahoo Finance", cacheTtlMs: ttlMs });
});

app.get("/api/alerts/status", (_req, res) => {
  res.json(getMonitorStatus());
});

app.post("/api/telegram", express.json(), async (req, res) => {
  try {
    const { message, botToken, chatId } = req.body;
    if (!message || !botToken || !chatId) {
      return res.status(400).json({ ok: false, error: "Faltan parámetros: message, botToken, chatId" });
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });

    const data = await response.json();
    if (data.ok) {
      res.json({ ok: true, result: data.result });
    } else {
      res.status(500).json({ ok: false, error: data.description });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Quant API listening on http://127.0.0.1:${port}`);
  setupAlertNotifications();
  startPriceMonitor(30000);
});

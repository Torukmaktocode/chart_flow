import cors from "cors";
import express from "express";
import yahooFinance from "yahoo-finance2";

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

const symbolAliases = {
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "USDJPY=X",
  USDCLP: "USDCLP=X",
  XAUUSD: "GC=F",
  BTCUSD: "BTC-USD",
  BTCUSDT_P: "BTC-USD",
  ETHUSDT_P: "ETH-USD",
  SOLUSDT_P: "SOL-USD",
  SPX: "^GSPC",
  NDX: "^NDX",
  NAS100: "^NDX",
  US100: "^NDX",
  DJI: "^DJI"
};

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

function compactChart(chart) {
  const result = chart?.quotes || [];
  return result
    .filter((row) => Number.isFinite(row.close))
    .map((row) => ({
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume || 0
    }));
}

function pct(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function stdev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function summarizeOptions(chain) {
  const calls = chain?.options?.[0]?.calls || [];
  const puts = chain?.options?.[0]?.puts || [];
  const all = [...calls, ...puts];
  const totalCallVolume = calls.reduce((sum, item) => sum + pct(item.volume), 0);
  const totalPutVolume = puts.reduce((sum, item) => sum + pct(item.volume), 0);
  const totalCallOi = calls.reduce((sum, item) => sum + pct(item.openInterest), 0);
  const totalPutOi = puts.reduce((sum, item) => sum + pct(item.openInterest), 0);
  const maxPain = all.reduce(
    (best, item) => {
      const score = pct(item.openInterest) + pct(item.volume) * 0.35;
      return score > best.score ? { strike: item.strike, score } : best;
    },
    { strike: null, score: -1 }
  );
  const highestOi = all
    .sort((a, b) => pct(b.openInterest) - pct(a.openInterest))
    .slice(0, 8)
    .map((item) => ({
      contractSymbol: item.contractSymbol,
      type: calls.includes(item) ? "CALL" : "PUT",
      strike: item.strike,
      volume: pct(item.volume),
      openInterest: pct(item.openInterest),
      impliedVolatility: pct(item.impliedVolatility)
    }));

  return {
    expiration: chain?.options?.[0]?.expirationDate || null,
    calls: calls.length,
    puts: puts.length,
    callVolume: totalCallVolume,
    putVolume: totalPutVolume,
    callOpenInterest: totalCallOi,
    putOpenInterest: totalPutOi,
    putCallVolumeRatio: totalCallVolume ? totalPutVolume / totalCallVolume : null,
    putCallOiRatio: totalCallOi ? totalPutOi / totalCallOi : null,
    maxPain: maxPain.strike,
    highestOi
  };
}

function quantMetrics({ quote, chartRows, options }) {
  const closes = chartRows.map((row) => row.close);
  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const realizedVol = stdev(returns) * Math.sqrt(252) * 100;
  const last = closes.at(-1) || quote?.regularMarketPrice || 0;
  const prev = closes.at(-2) || quote?.regularMarketPreviousClose || last;
  const volume = chartRows.at(-1)?.volume || quote?.regularMarketVolume || 0;
  const avgVolume =
    chartRows.length > 1
      ? chartRows.slice(-20).reduce((sum, row) => sum + pct(row.volume), 0) / Math.min(20, chartRows.length)
      : volume;
  const netFlow = options.callVolume - options.putVolume;
  const oiBias = options.callOpenInterest - options.putOpenInterest;
  const flowScore = Math.tanh((netFlow + oiBias * 0.08) / 100_000);
  const darkProxy = Math.tanh((volume - avgVolume) / Math.max(avgVolume, 1));

  return {
    price: last,
    change: last - prev,
    changePct: prev ? ((last - prev) / prev) * 100 : 0,
    volume,
    avgVolume,
    realizedVol,
    flowScore,
    darkPoolProxy: darkProxy,
    gexProxy: oiBias,
    dexProxy: netFlow,
    vannaProxy: options.putCallOiRatio ? 1 / options.putCallOiRatio - 1 : 0,
    charmProxy: options.putCallVolumeRatio ? 1 / options.putCallVolumeRatio - 1 : 0
  };
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
        provider: "Yahoo Finance no oficial",
        fetchedAt: new Date().toISOString(),
        quote: quoteValue,
        chart: chartRows,
        options,
        metrics,
        warnings: [
          "Opciones y greeks son no oficiales y pueden venir retrasadas o incompletas.",
          "Dark pool se muestra como proxy cuantitativo calculado desde volumen relativo, no como feed TRF real."
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
  res.json({ ok: true, provider: "Yahoo Finance no oficial", cacheTtlMs: ttlMs });
});

app.listen(port, () => {
  console.log(`Quant API listening on http://127.0.0.1:${port}`);
});

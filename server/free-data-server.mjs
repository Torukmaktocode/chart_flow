import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { get as httpsGet } from "node:https";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { sendJson, normalizeSymbol, stdev, defaultSymbolAliases as aliases } from "./lib/utils.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT || 5180);
const cache = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function requestJson(targetUrl) {
  return new Promise((resolve, reject) => {
    const req = httpsGet(
      targetUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 ChartFlow/1.0",
          "Accept": "application/json"
        },
        rejectUnauthorized: false,
        timeout: 15_000
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => {
          if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
            reject(new Error(`Yahoo Chart respondió HTTP ${response.statusCode}`));
            return;
          }
          try { resolve(JSON.parse(body)); }
          catch (error) { reject(error); }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timeout al conectar con Yahoo Chart")));
    req.on("error", reject);
  });
}

function compactChart(payload) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  return timestamps
    .map((time, index) => ({
      date: new Date(time * 1000).toISOString(),
      open: quote.open?.[index] ?? null,
      high: quote.high?.[index] ?? null,
      low: quote.low?.[index] ?? null,
      close: quote.close?.[index] ?? null,
      volume: quote.volume?.[index] ?? 0
    }))
    .filter((row) => Number.isFinite(row.close));
}

function buildMetrics(meta, rows) {
  const closes = rows.map((row) => row.close);
  const last = closes.at(-1) || meta.regularMarketPrice || 0;
  const prev = closes.at(-2) || meta.chartPreviousClose || last;
  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const volume = rows.at(-1)?.volume || meta.regularMarketVolume || 0;
  const window = rows.slice(-20);
  const avgVolume = window.reduce((sum, row) => sum + (row.volume || 0), 0) / Math.max(window.length, 1);
  const realizedVol = stdev(returns) * Math.sqrt(252) * 100;
  const momentum = prev ? (last - prev) / prev : 0;
  const relativeVolume = avgVolume ? (volume - avgVolume) / avgVolume : 0;
  const darkPoolProxy = Math.tanh(relativeVolume);
  const flowScore = Math.tanh(momentum * 12 + darkPoolProxy * 0.7);

  return {
    price: last,
    change: last - prev,
    changePct: prev ? ((last - prev) / prev) * 100 : 0,
    volume,
    avgVolume,
    realizedVol,
    flowScore,
    darkPoolProxy,
    gexProxy: Math.round(flowScore * volume * 0.015),
    dexProxy: Math.round(momentum * volume),
    vannaProxy: Math.tanh(realizedVol / 100 - 0.25),
    charmProxy: Math.tanh(momentum * 18)
  };
}

function unixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function parseAsOf(raw) {
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchMarketForDate(symbol, asOfRaw) {
  const asOf = parseAsOf(asOfRaw);
  const key = `market:${symbol}:${asOfRaw || "latest"}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.created < 45_000) return cached.value;

  const yahooUrl = asOf
    ? `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${unixSeconds(asOf)}&period2=${unixSeconds(new Date(asOf.getTime() + 86400_000))}&interval=5m`
    : `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;

  let payload, interval = asOf ? "5m" : "1d", result, rows = [];

  try {
    payload = await requestJson(yahooUrl);
    result = payload?.chart?.result?.[0];
    rows = compactChart(payload);
  } catch (error) {
    if (!asOf) throw error;
  }

  if (asOf && (!result || rows.length < 2)) {
    const fallbackUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${unixSeconds(new Date(asOf.getTime() - 92 * 86400_000))}&period2=${unixSeconds(new Date(asOf.getTime() + 86400_000))}&interval=1d`;
    payload = await requestJson(fallbackUrl);
    interval = "1d";
    result = payload?.chart?.result?.[0];
    rows = compactChart(payload);
    const selectedDay = asOfRaw;
    const upToSelected = rows.filter((row) => row.date.slice(0, 10) <= selectedDay);
    rows = upToSelected.length ? upToSelected : rows;
  }
  if (!result) throw new Error("No hay datos para ese símbolo.");

  const meta = result.meta || {};
  const metrics = buildMetrics(meta, rows);
  const value = {
    symbol, name: meta.longName || meta.shortName || symbol,
    provider: "Yahoo Finance Chart API",
    fetchedAt: new Date().toISOString(), asOf: asOfRaw || null,
    interval, sessionPoints: rows.length,
    chart: rows, metrics,
    options: { putCallVolumeRatio: null, putCallOiRatio: null, maxPain: null, highestOi: [] },
    warnings: [
      "Precio, volumen y series salen de Yahoo Chart sin API key.",
      "Opciones, dark pool y order flow requieren proveedores pagos; aquí se muestran proxies cuantitativos derivados de precio y volumen."
    ]
  };
  cache.set(key, { created: Date.now(), value });
  return value;
}

async function routeApi(req, res, url) {
  const match = url.pathname.match(/^\/api\/market\/(.+)$/);
  if (!match) return sendJson(res, 404, { error: "Ruta API no encontrada." });

  try {
    const symbol = normalizeSymbol(decodeURIComponent(match[1]), aliases);
    const data = await fetchMarketForDate(symbol, url.searchParams.get("date"));
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 502, {
      error: "No se pudieron obtener datos reales.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

async function routeStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/preview.html" : url.pathname;
  const safePath = normalize(join(root, requested.replace(/^\/+/, "")));
  if (!safePath.startsWith(root) || !existsSync(safePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
    return;
  }
  res.writeHead(200, { "Content-Type": contentTypes[extname(safePath)] || "application/octet-stream" });
  createReadStream(safePath).pipe(res);
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await routeApi(req, res, url);
    return;
  }
  await routeStatic(req, res, url);
}).listen(port, "127.0.0.1", async () => {
  const packageInfo = JSON.parse(await readFile(join(root, "package.json"), "utf8").catch(() => "{}"));
  console.log(`${packageInfo.name || "chart-flow"} running at http://127.0.0.1:${port}`);
});

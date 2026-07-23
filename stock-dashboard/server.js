const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 8765;
const FINNHUB_TOKEN = process.env.FINNHUB_TOKEN || "";
const SYMBOLS = new Set(["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "GOOG", "META", "TSLA"]);

function getMassiveKey() {
  if (process.env.MASSIVE_API_KEY) return process.env.MASSIVE_API_KEY.trim();
  if (process.env.POLYGON_API_KEY) return process.env.POLYGON_API_KEY.trim();
  const file = path.join(ROOT, "polygon_key.txt");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  return "";
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 StockDashboard/1.0", "Accept": "application/json,text/plain,*/*" },
    cache: "no-store",
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { error: text || "Unexpected response" }; }
  return { status: r.status, data };
}

function cleanSymbol(searchParams) {
  const symbol = String(searchParams.get("symbol") || "").toUpperCase().trim();
  return SYMBOLS.has(symbol) ? symbol : "";
}

async function handleChart(req, res, symbol) {
  const interval = String(req.url.match(/[?&]interval=(\w+)/)?.[1] || '5m').replace(/[^0-9m]/g, '');
  const validIntervals = ['1m', '5m', '15m', '30m'];
  const safeInterval = validIntervals.includes(interval) ? interval : '5m';
  const rangeMap = { '1m': '1d', '5m': '5d', '15m': '5d', '30m': '1mo' };
  const range = rangeMap[safeInterval] || '5d';

  const encoded = encodeURIComponent(symbol);
  const candidates = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=${range}&interval=${safeInterval}&includePrePost=true`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=${safeInterval}&includePrePost=true`,
  ];

  let last = { status: 502, data: { error: "No chart data" } };
  for (const url of candidates) {
    last = await fetchJson(url);
    const result = last.data?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const times = result?.timestamp || [];
    const closes = quote?.close || [];
    const validCount = closes.filter((v) => Number(v) > 0).length;
    if (last.status < 400 && times.length && validCount >= 20) break;
  }

  sendJson(res, last.status, last.data);
}

async function handleQuote(req, res, symbol) {
  if (FINNHUB_TOKEN) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(FINNHUB_TOKEN)}`;
    const { status, data } = await fetchJson(url);
    if (data && Number(data.c) > 0) return sendJson(res, status, data);
  }
  const latest = await yahooLatest(symbol);
  if (latest.data && Number(latest.data.c) > 0) return sendJson(res, 200, latest.data);
  sendJson(res, 200, { c: 0, pc: 0, symbol, provider: "none" });
}

async function yahooLatest(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=true`;
  const { status, data } = await fetchJson(url);
  if (status >= 400) return { status, data };
  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const times = result?.timestamp || [];
  const closes = quote?.close || [];
  for (let i = times.length - 1; i >= 0; i--) {
    const price = Number(closes[i]);
    if (Number.isFinite(price) && price > 0) {
      return { status: 200, data: { provider: "yahoo_chart_fallback", symbol, c: price, t: times[i] } };
    }
  }
  return { status: 502, data: { error: "No latest price available", provider: "yahoo_chart_fallback" } };
}

async function handleRealtime(req, res, symbol) {
  const key = getMassiveKey();
  if (key) {
    const url = `https://api.massive.com/v2/last/trade/${encodeURIComponent(symbol)}?apiKey=${encodeURIComponent(key)}`;
    const { status, data } = await fetchJson(url);
    const last = data.last || data.results || {};
    const price = Number(last.price || last.p);
    const ts = last.sip_timestamp || last.participant_timestamp || last.t;
    if (status < 400 && Number.isFinite(price) && price > 0) {
      sendJson(res, 200, { provider: "massive", symbol, c: price, t: ts, raw: last });
      return;
    }
  }

  const latest = await yahooLatest(symbol);
  sendJson(res, latest.status, latest.data);
}

function serveFile(req, res, pathname) {
  const filePath = path.normalize(path.join(ROOT, pathname === "/" ? "dashboard.html" : pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, body) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
    const type = mime[ext] || "text/plain; charset=utf-8";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    const symbol = cleanSymbol(url.searchParams);
    if (url.pathname === "/api/config") return sendJson(res, 200, { finnhubConfigured: !!FINNHUB_TOKEN, symbols: [...SYMBOLS] });
    if (url.pathname.startsWith("/api/") && !symbol) {
      sendJson(res, 400, { error: "Invalid symbol" });
      return;
    }
    if (url.pathname === "/api/chart") return await handleChart(req, res, symbol);
    if (url.pathname === "/api/quote") return await handleQuote(req, res, symbol);
    if (url.pathname === "/api/realtime") return await handleRealtime(req, res, symbol);
    serveFile(req, res, decodeURIComponent(url.pathname));
  } catch (err) {
    sendJson(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Stock Dashboard: http://127.0.0.1:${PORT}/dashboard.html`);
});

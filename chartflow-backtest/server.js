const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 8790;
const CHARTFLOW_PORT = 8780;
const DATA_DIR = path.join(ROOT, "historical-data");
const TRADES_FILE = path.join(ROOT, "trade-records.json");

// Timeframe to minutes mapping
const TF_MINUTES = { "5m": 5, "15m": 15, "30m": 30, "1h": 60 };

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

function serveFile(res, pathname) {
  const safePath = pathname === "/" ? "dashboard.html" : decodeURIComponent(pathname.replace(/^\/+/, ""));
  const filePath = path.normalize(path.join(ROOT, safePath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, body) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath).toLowerCase();
    const ct = ext === ".html" ? "text/html; charset=utf-8"
      : ext === ".js" ? "application/javascript; charset=utf-8"
      : ext === ".css" ? "text/css; charset=utf-8"
      : "text/plain; charset=utf-8";
    res.writeHead(200, { "Content-Type": ct, "Cache-Control": "no-cache" });
    res.end(body);
  });
}

// Load trade records
function loadTradeRecords() {
  try {
    if (fs.existsSync(TRADES_FILE)) {
      return JSON.parse(fs.readFileSync(TRADES_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Error loading trade records:", e.message);
  }
  return [];
}

// Save trade records
function saveTradeRecords(records) {
  try {
    fs.writeFileSync(TRADES_FILE, JSON.stringify(records, null, 2));
    return true;
  } catch (e) {
    console.error("Error saving trade records:", e.message);
    return false;
  }
}

// Handle trade records API
function handleTradesApi(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  
  // GET - Load trade records
  if (req.method === "GET") {
    const records = loadTradeRecords();
    sendJson(res, 200, { records });
    return;
  }
  
  // POST - Save trade records
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        if (data.records && Array.isArray(data.records)) {
          saveTradeRecords(data.records);
          sendJson(res, 200, { success: true, count: data.records.length });
        } else {
          sendJson(res, 400, { error: "Invalid data" });
        }
      } catch (e) {
        sendJson(res, 400, { error: "Parse error" });
      }
    });
    return;
  }
  
  // DELETE - Clear trade records
  if (req.method === "DELETE") {
    saveTradeRecords([]);
    sendJson(res, 200, { success: true });
    return;
  }
  
  sendJson(res, 405, { error: "Method not allowed" });
}

// Load local historical data for a symbol and timeframe
function loadLocalData(symbol, tf, fromTs, toTs) {
  try {
    const filePath = path.join(DATA_DIR, symbol, `${tf}.json`);
    if (!fs.existsSync(filePath)) return null;
    
    let candles = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!candles || candles.length < 2) return null;
    
    // Filter by date range if provided
    if (fromTs) candles = candles.filter(c => c.t >= fromTs);
    if (toTs) candles = candles.filter(c => c.t <= toTs);
    
    return candles.length >= 2 ? candles : null;
  } catch (e) {
    console.error(`Error loading local data for ${symbol} ${tf}:`, e.message);
    return null;
  }
}

// Aggregate candles to higher timeframe
function aggregate(candles, targetMinutes) {
  if (!targetMinutes || targetMinutes <= 1) return candles;
  const bucketMs = targetMinutes * 60 * 1000;
  const buckets = new Map();
  for (const c of candles) {
    const b = Math.floor(c.t / bucketMs) * bucketMs;
    const cur = buckets.get(b);
    if (!cur) {
      buckets.set(b, { t: b, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v || 0 });
    } else {
      cur.h = Math.max(cur.h, c.h);
      cur.l = Math.min(cur.l, c.l);
      cur.c = c.c;
      cur.v = (cur.v || 0) + (c.v || 0);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
}

// Try to serve from local data first, then proxy to ChartFlow
function handleChartRequest(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const symbol = url.searchParams.get("symbol") || "NAS100";
  const tf = url.searchParams.get("tf") || "5m";
  const fromTs = parseInt(url.searchParams.get("from")) || 0;
  const toTs = parseInt(url.searchParams.get("to")) || 0;
  const count = parseInt(url.searchParams.get("count")) || 0;

  // Try local data first
  const localData = loadLocalData(symbol, tf, fromTs, toTs);
  if (localData) {
    console.log(`📁 Local: ${symbol} ${tf} → ${localData.length} velas`);
    sendJson(res, 200, {
      symbol,
      label: symbol,
      timeframe: tf,
      source: "local",
      candles: localData,
    });
    return;
  }

  // Fallback to ChartFlow proxy
  console.log(`🌐 Proxy: ${symbol} ${tf}`);
  const proxyUrl = `http://127.0.0.1:${CHARTFLOW_PORT}${url.pathname}${url.search}`;
  http.get(proxyUrl, { headers: { "User-Agent": "ChartFlow-Backtest/1.0" } }, proxyRes => {
    res.writeHead(proxyRes.statusCode, {
      "Content-Type": proxyRes.headers["content-type"] || "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    proxyRes.pipe(res);
  }).on("error", () => {
    sendJson(res, 502, { error: "Sin datos disponibles" });
  });
}

// API: List available local data
function handleDataStatus(req, res) {
  const status = {};
  if (fs.existsSync(DATA_DIR)) {
    for (const sym of fs.readdirSync(DATA_DIR)) {
      const symDir = path.join(DATA_DIR, sym);
      if (!fs.statSync(symDir).isDirectory()) continue;
      status[sym] = {};
      for (const f of fs.readdirSync(symDir)) {
        if (!f.endsWith(".json")) continue;
        const tf = f.replace(".json", "");
        const data = JSON.parse(fs.readFileSync(path.join(symDir, f), "utf8"));
        if (data.length > 0) {
          status[sym][tf] = {
            count: data.length,
            first: new Date(data[0].t).toISOString(),
            last: new Date(data[data.length - 1].t).toISOString(),
          };
        }
      }
    }
  }
  sendJson(res, 200, { dataDir: DATA_DIR, symbols: status });
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/api/chart") {
      handleChartRequest(req, res);
      return;
    }
    if (url.pathname === "/api/data-status") {
      handleDataStatus(req, res);
      return;
    }
    if (url.pathname === "/api/trades") {
      handleTradesApi(req, res);
      return;
    }
    serveFile(res, url.pathname);
  } catch (err) {
    sendJson(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ChartFlow Backtest: http://127.0.0.1:${PORT}/`);
  console.log(`Datos locales:     ${DATA_DIR}`);
  console.log(`Registros trades:  ${TRADES_FILE}`);
  console.log(`Proxy a ChartFlow: http://127.0.0.1:${CHARTFLOW_PORT}/`);
});

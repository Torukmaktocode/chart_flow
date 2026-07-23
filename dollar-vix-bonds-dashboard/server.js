const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 8770;

const INSTRUMENTS = {
  DXY: { yahoo: "DX-Y.NYB", label: "Indice del dolar de EE. UU." },
  VIX: { yahoo: "^VIX", label: "Indice Volatility S&P 500" },
  US10Y: { yahoo: "^TNX", label: "Rend. bonos deuda publica EE. UU. a 10A" },
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 DollarDashboard/1.0",
      "Accept": "application/json,text/plain,*/*",
    },
    cache: "no-store",
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Unexpected response" };
  }
  return { status: response.status, data };
}

async function chartData(key, intervalParam) {
  const inst = INSTRUMENTS[key];
  if (!inst) return { status: 400, data: { error: "Invalid instrument" } };

  const interval = ["1m","5m","15m","30m"].includes(intervalParam) ? intervalParam : "5m";
  const rangeMap = { "1m": "1d", "5m": "5d", "15m": "5d", "30m": "1mo" };
  const range = rangeMap[interval] || "5d";

  const encoded = encodeURIComponent(inst.yahoo);
  const candidates = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=${range}&interval=${interval}&includePrePost=true`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=${interval}&includePrePost=true`,
  ];

  let last = { status: 502, data: { error: "No data" } };
  for (const url of candidates) {
    last = await fetchJson(url);
    const result = last.data?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const times = result?.timestamp || [];
    const closes = quote?.close || [];
    const validCount = closes.filter((v) => Number(v) > 0).length;
    if (last.status < 400 && times.length && validCount >= 30) {
      return {
        status: 200,
        data: {
          key,
          yahoo: inst.yahoo,
          label: inst.label,
          source: url,
          chart: last.data.chart,
        },
      };
    }
  }
  return last;
}

async function latestData(key) {
  const inst = INSTRUMENTS[key];
  if (!inst) return { status: 400, data: { error: "Invalid instrument" } };

  const encoded = encodeURIComponent(inst.yahoo);
  const candidates = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=5d&interval=5m&includePrePost=true`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=5m&includePrePost=true`,
  ];

  let lastResponse = { status: 502, data: { error: "No latest data" } };
  for (const url of candidates) {
    lastResponse = await fetchJson(url);
    const result = lastResponse.data?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const times = result?.timestamp || [];
    const closes = quote?.close || [];
    for (let i = times.length - 1; i >= 0; i--) {
      const close = Number(closes[i]);
      if (Number.isFinite(close) && close > 0) {
        return {
          status: 200,
          data: {
            key,
            yahoo: inst.yahoo,
            label: inst.label,
            source: url,
            point: {
              t: times[i],
              o: Number(quote?.open?.[i]) || close,
              h: Number(quote?.high?.[i]) || close,
              l: Number(quote?.low?.[i]) || close,
              c: close,
            },
          },
        };
      }
    }
  }
  return lastResponse;
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
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".html"
      ? "text/html; charset=utf-8"
      : ext === ".js"
        ? "text/javascript; charset=utf-8"
        : "text/plain; charset=utf-8";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    res.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname === "/api/chart") {
      const key = String(url.searchParams.get("instrument") || "").toUpperCase();
      const interval = String(url.searchParams.get("interval") || "5m");
      const result = await chartData(key, interval);
      sendJson(res, result.status, result.data);
      return;
    }
    if (url.pathname === "/api/latest") {
      const key = String(url.searchParams.get("instrument") || "").toUpperCase();
      const result = await latestData(key);
      sendJson(res, result.status, result.data);
      return;
    }
    serveFile(res, url.pathname);
  } catch (err) {
    sendJson(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Dollar dashboard: http://127.0.0.1:${PORT}/dashboard.html`);
});

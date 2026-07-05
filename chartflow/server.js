const http = require("http");
const fs = require("fs");
const path = require("path");
const tls = require("tls");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = 8780;
const ALERTS_FILE = path.join(__dirname, '..', 'data', 'alerts.json');

// ============================================
// 📁 FUNCIONES DE ALERTAS
// ============================================

// Mapeo de símbolos del bot al formato del dashboard
const SYMBOL_MAP_TO_DASHBOARD = {
  'BTC': 'BTC',
  'ETH': 'ETHUSDT_P',
  'SOL': 'SOLUSDT_P',
  'NAS100': 'NAS100',
  'US30': 'US30',
  'US500': 'US500',
  'XAUUSD': 'XAUUSD',
  'EURUSD': 'EURUSD',
  'DXY': 'DXY',
  'VIX': 'VIX',
};

// Convertir formato del bot al formato del dashboard
function convertBotAlertToDashboard(botAlert) {
  const symbol = SYMBOL_MAP_TO_DASHBOARD[botAlert.symbol] || botAlert.symbol;
  const operator = botAlert.direction === 'above' ? 'cross_up' : 'cross_down';
  const price = Number(botAlert.targetPrice) || Number(botAlert.value) || 0;
  
  return {
    id: botAlert.id,
    symbol: symbol,
    value: price,
    operator: operator,
    active: botAlert.active !== false,
    message: botAlert.message || `${symbol} ${botAlert.direction === 'above' ? 'supera' : 'baja de'} $${price}`,
    createdAt: botAlert.createdAt,
    triggeredAt: botAlert.triggeredAt,
    source: 'telegram',
  };
}

function loadAlertsFromDisk() {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error cargando alertas:', e.message);
  }
  return [];
}

function loadAlerts() {
  return loadAlertsFromDisk().map(convertBotAlertToDashboard);
}

function saveAlertsToDisk(alerts) {
  try {
    const dataDir = path.dirname(ALERTS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
    return true;
  } catch (e) {
    console.error('Error guardando alertas:', e.message);
    return false;
  }
}

function saveAlerts(alerts) {
  return saveAlertsToDisk(alerts);
}
const INSTRUMENTS = {
  NAS100: {
    key: "NAS100",
    label: "NAS100",
    title: "CFD US 100 Cash",
    exchange: "Pepperstone",
    tv: process.env.NAS100_TV_SYMBOL || "PEPPERSTONE:NAS100",
    yahoo: ["NQ=F", "^NDX"],
    tag: "100",
    unit: "USD",
  },
  XAUUSD: {
    key: "XAUUSD",
    label: "XAUUSD",
    title: "Gold Spot / U.S. Dollar",
    exchange: "Pepperstone",
    tv: process.env.XAUUSD_TV_SYMBOL || "PEPPERSTONE:XAUUSD",
    yahoo: ["GC=F", "XAUUSD=X"],
    tag: "X",
    unit: "USD",
  },
  US30: {
    key: "US30",
    label: "US30",
    title: "Wall Street 30 Cash",
    exchange: "Pepperstone",
    tv: process.env.US30_TV_SYMBOL || "PEPPERSTONE:US30",
    yahoo: ["YM=F", "^DJI"],
    tag: "30",
    unit: "USD",
  },
  US500: {
    key: "US500",
    label: "US500",
    title: "US 500 Cash",
    exchange: "Pepperstone",
    tv: process.env.US500_TV_SYMBOL || "PEPPERSTONE:US500",
    yahoo: ["ES=F", "^GSPC"],
    tag: "500",
    unit: "USD",
  },
  BTC: {
    key: "BTC",
    label: "BTCUSD",
    title: "Bitcoin / U.S. Dollar",
    exchange: "Coinbase",
    tv: process.env.BTC_TV_SYMBOL || "COINBASE:BTCUSD",
    yahoo: ["BTC-USD"],
    tag: "BTC",
    unit: "USD",
  },
  ETH: {
    key: "ETH",
    label: "ETHUSD",
    title: "Ethereum / U.S. Dollar",
    exchange: "Coinbase",
    tv: process.env.ETH_TV_SYMBOL || "COINBASE:ETHUSD",
    yahoo: ["ETH-USD"],
    tag: "ETH",
    unit: "USD",
  },
  SOL: {
    key: "SOL",
    label: "SOLUSD",
    title: "Solana / U.S. Dollar",
    exchange: "Coinbase",
    tv: process.env.SOL_TV_SYMBOL || "COINBASE:SOLUSD",
    yahoo: ["SOL-USD"],
    tag: "SOL",
    unit: "USD",
  },
  BTCUSDT_P: {
    key: "BTCUSDT_P",
    label: "BTCUSDT.P",
    title: "Bitcoin / Tether Perpetual",
    exchange: "Binance",
    tv: process.env.BTCUSDT_P_TV_SYMBOL || "BINANCE:BTCUSDT.P",
    yahoo: ["BTC-USD"],
    tag: "BTC",
    unit: "USD",
  },
  ETHUSDT_P: {
    key: "ETHUSDT_P",
    label: "ETHUSDT.P",
    title: "Ethereum / Tether Perpetual",
    exchange: "Binance",
    tv: process.env.ETHUSDT_P_TV_SYMBOL || "BINANCE:ETHUSDT.P",
    yahoo: ["ETH-USD"],
    tag: "ETH",
    unit: "USD",
  },
  SOLUSDT_P: {
    key: "SOLUSDT_P",
    label: "SOLUSDT.P",
    title: "Solana / Tether Perpetual",
    exchange: "Binance",
    tv: process.env.SOLUSDT_P_TV_SYMBOL || "BINANCE:SOLUSDT.P",
    yahoo: ["SOL-USD"],
    tag: "SOL",
    unit: "USD",
  },
  EURUSD: {
    key: "EURUSD",
    label: "EURUSD",
    title: "Euro / U.S. Dollar",
    exchange: "Pepperstone",
    tv: process.env.EURUSD_TV_SYMBOL || "PEPPERSTONE:EURUSD",
    yahoo: ["EURUSD=X", "6E=F"],
    tag: "€",
    unit: "USD",
  },
  DXY: {
    key: "DXY",
    label: "USDX",
    title: "US Dollar Index",
    exchange: "Pepperstone",
    tv: process.env.DXY_TV_SYMBOL || "PEPPERSTONE:USDX",
    yahoo: ["DX-Y.NYB", "DX=F"],
    tag: "$",
    unit: "USD",
  },
  VIX: {
    key: "VIX",
    label: "VIX",
    title: "CBOE Volatility Index",
    exchange: "CBOE",
    tv: process.env.VIX_TV_SYMBOL || "TVC:VIX",
    yahoo: ["^VIX", "VIX"],
    tag: "VIX",
    unit: "USD",
  },
};

const TIMEFRAMES = {
  "1m": { tvInterval: "1", sourceInterval: "1m", range: "1d", minutes: 1 },
  "3m": { tvInterval: "3", sourceInterval: "1m", range: "5d", minutes: 3 },
  "5m": { tvInterval: "5", sourceInterval: "1m", range: "5d", minutes: 5 },
  "15m": { tvInterval: "15", sourceInterval: "1m", range: "5d", minutes: 15 },
  "30m": { tvInterval: "30", sourceInterval: "1m", range: "5d", minutes: 30 },
  "45m": { tvInterval: "45", sourceInterval: "1m", range: "5d", minutes: 45 },
  "1h": { tvInterval: "60", sourceInterval: "60m", range: "1mo", minutes: 60 },
  "2h": { tvInterval: "120", sourceInterval: "60m", range: "1mo", minutes: 120 },
  "4h": { tvInterval: "240", sourceInterval: "60m", range: "3mo", minutes: 240 },
  "D": { tvInterval: "1D", sourceInterval: "1d", range: "1y", minutes: 1440 },
  "S": { tvInterval: "1W", sourceInterval: "1wk", range: "5y", minutes: 10080 },
  "M": { tvInterval: "1M", sourceInterval: "1mo", range: "10y", minutes: 43200 },
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
      "User-Agent": "Mozilla/5.0 Nas100Dashboard/1.0",
      Accept: "application/json,text/plain,*/*",
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

function tvMessage(method, params) {
  const payload = JSON.stringify({ m: method, p: params });
  return `~m~${Buffer.byteLength(payload)}~m~${payload}`;
}

function tvFrame(text) {
  const payload = Buffer.from(text);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  }

  const mask = crypto.randomBytes(4);
  const out = Buffer.alloc(header.length + 4 + payload.length);
  header.copy(out, 0);
  mask.copy(out, header.length);
  for (let i = 0; i < payload.length; i += 1) {
    out[header.length + 4 + i] = payload[i] ^ mask[i % 4];
  }
  return out;
}

function parseWsFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const b1 = buffer[offset];
    const b2 = buffer[offset + 1];
    let length = b2 & 0x7f;
    let pos = offset + 2;

    if (length === 126) {
      if (pos + 2 > buffer.length) break;
      length = buffer.readUInt16BE(pos);
      pos += 2;
    } else if (length === 127) {
      if (pos + 8 > buffer.length) break;
      const high = buffer.readUInt32BE(pos);
      const low = buffer.readUInt32BE(pos + 4);
      if (high > 0) throw new Error("WebSocket frame too large");
      length = low;
      pos += 8;
    }

    let mask = null;
    if (b2 & 0x80) {
      if (pos + 4 > buffer.length) break;
      mask = buffer.slice(pos, pos + 4);
      pos += 4;
    }

    if (pos + length > buffer.length) break;
    let payload = buffer.slice(pos, pos + length);
    if (mask) payload = Buffer.from(payload.map((value, index) => value ^ mask[index % 4]));
    if ((b1 & 0x0f) === 1) messages.push(payload.toString());
    offset = pos + length;
  }

  return { messages, rest: buffer.slice(offset) };
}

function splitTvMessages(text) {
  const out = [];
  let offset = 0;
  while (offset < text.length) {
    const match = text.slice(offset).match(/^~m~(\d+)~m~/);
    if (!match) break;
    const start = offset + match[0].length;
    const length = Number(match[1]);
    out.push(text.slice(start, start + length));
    offset = start + length;
  }
  return out;
}

function parseTvCandles(series) {
  return (series || [])
    .map((item) => {
      const v = item?.v || [];
      const time = Number(v[0]);
      const open = Number(v[1]);
      const high = Number(v[2]);
      const low = Number(v[3]);
      const close = Number(v[4]);
      const volume = Number(v[5]);
      if (![time, open, high, low, close].every(Number.isFinite)) return null;
      return { t: time * 1000, o: open, h: high, l: low, c: close, v: Number.isFinite(volume) ? volume : 0 };
    })
    .filter(Boolean);
}

function publicInstrument(inst) {
  return {
    key: inst.key,
    label: inst.label,
    title: inst.title,
    exchange: inst.exchange,
    tag: inst.tag,
    unit: inst.unit,
    tv: inst.tv,
  };
}

function normalizeInstrument(value) {
  const raw = String(value || "NAS100").trim().toUpperCase();
  if (INSTRUMENTS[raw]) return INSTRUMENTS[raw];
  if (/^[A-Z0-9_.:^=-]{2,40}$/.test(raw)) {
    const key = raw.replace(/^[A-Z]+:/, "");
    return {
      key,
      label: key,
      title: key,
      exchange: raw.includes(":") ? raw.split(":")[0] : "TradingView",
      tv: raw.includes(":") ? raw : `PEPPERSTONE:${raw}`,
      yahoo: [],
      tag: key.slice(0, 3),
      unit: "USD",
    };
  }
  return INSTRUMENTS.NAS100;
}

function fetchTradingViewCandles(tf, tvSymbol, bars = 900, fromTs) {
  const cfg = TIMEFRAMES[tf] || TIMEFRAMES["5m"];

  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString("base64");
    const chartSession = `cs_${crypto.randomBytes(6).toString("hex")}`;
    let handshook = false;
    let rawHeader = "";
    let rest = Buffer.alloc(0);

    const socket = tls.connect(
      443,
      "data.tradingview.com",
      { servername: "data.tradingview.com", rejectUnauthorized: false },
      () => {
        socket.write([
          "GET /socket.io/websocket HTTP/1.1",
          "Host: data.tradingview.com",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "Origin: https://www.tradingview.com",
          "User-Agent: Mozilla/5.0",
          "",
          "",
        ].join("\r\n"));
      },
    );

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("TradingView timeout"));
    }, 12000);

    const finish = (candles) => {
      clearTimeout(timer);
      socket.end();
      resolve(candles);
    };

    const fail = (err) => {
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    };

    const send = (method, params) => {
      socket.write(tvFrame(tvMessage(method, params)));
    };

    socket.on("data", (chunk) => {
      if (!handshook) {
        rawHeader += chunk.toString("binary");
        const headerEnd = rawHeader.indexOf("\r\n\r\n");
        if (headerEnd < 0) return;
        if (!rawHeader.startsWith("HTTP/1.1 101")) {
          fail(new Error(`TradingView handshake failed: ${rawHeader.split("\r\n")[0]}`));
          return;
        }
        handshook = true;
        rest = Buffer.concat([rest, Buffer.from(rawHeader.slice(headerEnd + 4), "binary")]);
        send("set_auth_token", ["unauthorized_user_token"]);
        send("chart_create_session", [chartSession, ""]);
        send("switch_timezone", [chartSession, "America/New_York"]);
        send("resolve_symbol", [
          chartSession,
          "symbol_1",
          `={"symbol":"${tvSymbol}","adjustment":"splits","session":"regular"}`,
        ]);
        const seriesParams = [chartSession, "s1", "s1", "symbol_1", cfg.tvInterval, bars];
        if (fromTs) seriesParams.push(Math.floor(fromTs / 1000));
        send("create_series", seriesParams);
      } else {
        rest = Buffer.concat([rest, chunk]);
      }

      const parsed = parseWsFrames(rest);
      rest = parsed.rest;
      for (const message of parsed.messages) {
        for (const part of splitTvMessages(message)) {
          if (part.startsWith("~h~")) {
            socket.write(tvFrame(part));
            continue;
          }
          if (!part.startsWith("{")) continue;
          const obj = JSON.parse(part);
          if (obj.m === "timescale_update") {
            const candles = parseTvCandles(obj?.p?.[1]?.s1?.s).slice(-bars);
            if (candles.length > 1) finish(candles);
          } else if (obj.m === "critical_error") {
            fail(new Error(JSON.stringify(obj.p || obj)));
          }
        }
      }
    });

    socket.on("error", fail);
  });
}

function parseYahoo(payload) {
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const times = result?.timestamp || [];
  const out = [];

  for (let i = 0; i < times.length; i += 1) {
    const close = Number(quote?.close?.[i]);
    if (!Number.isFinite(close) || close <= 0) continue;
    const open = Number(quote?.open?.[i]) || close;
    const high = Number(quote?.high?.[i]) || Math.max(open, close);
    const low = Number(quote?.low?.[i]) || Math.min(open, close);
    const volume = Number(quote?.volume?.[i]);
    out.push({
      t: Number(times[i]) * 1000,
      o: open,
      h: high,
      l: low,
      c: close,
      v: Number.isFinite(volume) ? volume : 0,
    });
  }
  return out;
}

function aggregate(candles, minutes) {
  if (!minutes || minutes <= 1) return candles;
  const bucketMs = minutes * 60 * 1000;
  const buckets = new Map();

  for (const candle of candles) {
    const bucket = Math.floor(candle.t / bucketMs) * bucketMs;
    const current = buckets.get(bucket);
    if (!current) {
      buckets.set(bucket, { t: bucket, o: candle.o, h: candle.h, l: candle.l, c: candle.c, v: candle.v || 0 });
    } else {
      current.h = Math.max(current.h, candle.h);
      current.l = Math.min(current.l, candle.l);
      current.c = candle.c;
      current.v = (current.v || 0) + (candle.v || 0);
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
}

function cleanOutliers(candles) {
  if (candles.length < 4) return candles;
  const cleaned = [];
  let previousClose = null;

  for (const candle of candles) {
    if (previousClose && Math.abs(candle.c - previousClose) / previousClose > 0.035) {
      continue;
    }
    const open = previousClose && Math.abs(candle.o - previousClose) / previousClose > 0.02
      ? previousClose
      : candle.o;
    const bodyHi = Math.max(open, candle.c);
    const bodyLo = Math.min(open, candle.c);
    const maxWick = Math.max(Math.abs(bodyHi - bodyLo) * 4, previousClose ? previousClose * 0.006 : candle.c * 0.006);
    const safe = {
      t: candle.t,
      o: open,
      h: Math.min(Math.max(candle.h, bodyHi), bodyHi + maxWick),
      l: Math.max(Math.min(candle.l, bodyLo), bodyLo - maxWick),
      c: candle.c,
      v: candle.v || 0,
    };
    cleaned.push(safe);
    previousClose = safe.c;
  }
  return cleaned;
}

const YAHOO_INTERVAL_MAP = {
  "1d":"1m","5d":"1m","1mo":"5m","3mo":"15m","6mo":"15m",
  "1y":"60m","2y":"60m","5y":"1d","10y":"1d","max":"1d",
  ytd:"1d"
};
function yahooIntervalFor(range, defaultInterval) {
  const min = YAHOO_INTERVAL_MAP[range];
  if (!min) return defaultInterval;
  const order = {"1m":1,"2m":2,"3m":3,"5m":5,"15m":15,"30m":30,"60m":60,"1d":1440,"1wk":10080,"1mo":43200};
  if ((order[min] || 0) >= (order[defaultInterval] || 0)) return min;
  return defaultInterval;
}

async function chartData(tf, symbolKey, countOverride, rangeOverride, fromTs, toTs) {
  const cfg = TIMEFRAMES[tf] || TIMEFRAMES["5m"];
  const inst = normalizeInstrument(symbolKey);
  let lastResponse = null;

  try {
    const tvBars = countOverride > 0 ? countOverride : 900;
    const candles = await fetchTradingViewCandles(tf, inst.tv, tvBars, fromTs);
    const tvCovers = !fromTs || (candles.length > 1 && candles[0].t <= fromTs + 3600000);
    if (candles.length > 1 && tvCovers) {
      return {
        status: 200,
        data: {
          symbol: inst.key,
          label: inst.label,
          title: inst.title,
          exchange: inst.exchange,
          tag: inst.tag,
          unit: inst.unit,
          provider: "TradingView",
          tvSymbol: inst.tv,
          timeframe: tf,
          sourceInterval: cfg.tvInterval,
          source: `tradingview:${inst.tv}`,
          candles,
        },
      };
    }
  } catch (err) {
    lastResponse = { status: 502, data: { error: String(err.message || err) } };
  }

  for (const symbol of inst.yahoo || []) {
    const encoded = encodeURIComponent(symbol);
    const yahooRange = rangeOverride || cfg.range;
    let yahooInterval = yahooIntervalFor(yahooRange, cfg.sourceInterval);
    let url;
    if (fromTs && toTs) {
      const daysSpan = (toTs - fromTs) / 86400000;
      const spanRange = daysSpan <= 32 ? "1mo" : daysSpan <= 92 ? "3mo" : daysSpan <= 367 ? "1y" : "max";
      yahooInterval = yahooIntervalFor(spanRange, cfg.sourceInterval);
      const p1 = Math.floor(fromTs / 1000);
      const p2 = Math.floor(toTs / 1000);
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?period1=${p1}&period2=${p2}&interval=${cfg.sourceInterval}&includePrePost=true`;
    } else {
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=${yahooRange}&interval=${yahooInterval}&includePrePost=true`;
    }
    let response = await fetchJson(url);
    if (response.status >= 400 && fromTs && toTs) {
      const fallbackUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=${spanRange}&interval=${yahooInterval}&includePrePost=true`;
      response = await fetchJson(fallbackUrl);
    }
    lastResponse = response;
    if (response.status >= 400) continue;

    let candles = cleanOutliers(parseYahoo(response.data));
    candles = aggregate(candles, cfg.minutes);
    if (fromTs && toTs) candles = candles.filter(c => c.t >= fromTs && c.t <= toTs);
    const maxKeep = countOverride > 0 ? countOverride : 900;
    if (candles.length > maxKeep) candles = candles.slice(-maxKeep);
    if (candles.length < 2) continue;

    return {
      status: 200,
      data: {
        symbol: inst.key,
        label: inst.label,
        title: inst.title,
        exchange: inst.exchange,
        tag: inst.tag,
        unit: inst.unit,
        yahoo: symbol,
        timeframe: tf,
        sourceInterval: cfg.sourceInterval,
        range: yahooRange,
        source: url,
        candles,
      },
    };
  }

  return lastResponse || { status: 502, data: { error: "No candles available" } };
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
    const contentType = ext === ".html" ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0" });
    res.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname === "/api/chart") {
      const tf = String(url.searchParams.get("tf") || "5m");
      const symbol = String(url.searchParams.get("symbol") || "NAS100");
      const count = parseInt(url.searchParams.get("count")) || 0;
      const range = url.searchParams.get("range") || null;
      const from = parseInt(url.searchParams.get("from")) || 0;
      const to = parseInt(url.searchParams.get("to")) || 0;
      console.log("REQ:", {tf, symbol, count, range, from, to, fromDate: from?new Date(from).toISOString():null, toDate: to?new Date(to).toISOString():null});
      const result = await chartData(tf, symbol, count, range, from, to);
      console.log("RES:", {status: result.status, provider: result.data?.provider, candles: result.data?.candles?.length, first: result.data?.candles?.[0]?.t?new Date(result.data.candles[0].t).toISOString():null, last: result.data?.candles?.[result.data.candles.length-1]?.t?new Date(result.data.candles[result.data.candles.length-1].t).toISOString():null, error: result.data?.error});
      sendJson(res, result.status, result.data);
      return;
    }
    if (url.pathname === "/api/instruments") {
      sendJson(res, 200, { instruments: Object.values(INSTRUMENTS).map(publicInstrument) });
      return;
    }
    
    // ============================================
    // 📱 API DE ALERTAS
    // ============================================
    if (url.pathname === "/api/alerts") {
      // GET - Obtener todas las alertas
      if (req.method === "GET") {
        try {
          const rawAlerts = loadAlertsFromDisk();
          const alerts = rawAlerts.map(convertBotAlertToDashboard).filter(a => a.value > 0 && a.symbol);
          // Auto-limpiar alertas rotas del archivo
          const cleanAlerts = rawAlerts.filter(a => {
            const price = Number(a.targetPrice) || Number(a.value) || 0;
            return price > 0 && a.symbol;
          });
          if (cleanAlerts.length < rawAlerts.length) {
            saveAlertsToDisk(cleanAlerts);
            console.log(`🧹 Limpiadas ${rawAlerts.length - cleanAlerts.length} alertas sin precio`);
          }
          console.log(`📱 Sirviendo ${alerts.length} alertas convertidas`);
          sendJson(res, 200, { alerts });
        } catch (e) {
          console.error('Error sirviendo alertas:', e.message);
          sendJson(res, 200, { alerts: [] });
        }
        return;
      }
      // POST - Crear nueva alerta
      if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            const price = parseFloat(data.value) || parseFloat(data.targetPrice) || 0;
            if (price <= 0) {
              sendJson(res, 400, { error: "Se requiere un precio válido" });
              return;
            }
            const alerts = loadAlerts();
            
            const newAlert = {
              id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              symbol: data.symbol || "NAS100",
              value: price,
              targetPrice: price,
              operator: data.operator || "cross_up",
              direction: data.operator === 'cross_up' ? 'above' : 'below',
              active: true,
              message: data.message || `${data.symbol || "NAS100"} ${data.operator === 'cross_up' ? 'supera' : 'baja de'} $${price}`,
              createdAt: new Date().toISOString(),
            };
            
            alerts.push(newAlert);
            saveAlerts(alerts);
            
            console.log(`✅ Alerta creada: ${newAlert.symbol} ${newAlert.operator} $${newAlert.value}`);
            sendJson(res, 201, { success: true, alert: newAlert });
          } catch (e) {
            sendJson(res, 400, { error: "Datos inválidos" });
          }
        });
        return;
      }
      // PUT - Actualizar alerta
      if (req.method === "PUT") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            const rawAlerts = loadAlertsFromDisk();
            const index = rawAlerts.findIndex(a => a.id === data.id);
            
            if (index !== -1) {
              // Convertir formato del dashboard al formato del bot
              const updatedAlert = {
                ...rawAlerts[index],
                active: data.active,
                targetPrice: data.value || rawAlerts[index].targetPrice,
                direction: data.operator === 'cross_up' ? 'above' : 'below',
              };
              rawAlerts[index] = updatedAlert;
              saveAlertsToDisk(rawAlerts);
              console.log(`🔄 Alerta actualizada: ${data.id}`);
              sendJson(res, 200, { success: true });
            } else {
              sendJson(res, 404, { error: "Alerta no encontrada" });
            }
          } catch (e) {
            sendJson(res, 400, { error: "Datos inválidos" });
          }
        });
        return;
      }
      // DELETE - Eliminar alerta
      if (req.method === "DELETE") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            let rawAlerts = loadAlertsFromDisk();
            const before = rawAlerts.length;
            rawAlerts = rawAlerts.filter(a => a.id !== data.id);
            
            if (rawAlerts.length < before) {
              saveAlertsToDisk(rawAlerts);
              console.log(`🗑️ Alerta eliminada: ${data.id}`);
              sendJson(res, 200, { success: true });
            } else {
              sendJson(res, 404, { error: "Alerta no encontrada" });
            }
          } catch (e) {
            sendJson(res, 400, { error: "Datos inválidos" });
          }
        });
        return;
      }
    }
    
    serveFile(res, url.pathname);
  } catch (err) {
    sendJson(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const { networkInterfaces } = require("os");
  const ifaces = networkInterfaces();
  let ip = "127.0.0.1";
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) { ip = iface.address; break; }
    }
    if (ip !== "127.0.0.1") break;
  }
  console.log(`NAS100 dashboard: http://127.0.0.1:${PORT}/dashboard.html`);
  console.log(`Red local:       http://${ip}:${PORT}/dashboard.html`);
});

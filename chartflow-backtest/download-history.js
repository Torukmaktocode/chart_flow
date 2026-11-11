const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'historical-data');

const SYMBOLS = {
  NAS100:  { yahoo: 'NQ=F',        label: 'NAS100' },
  US500:   { yahoo: 'ES=F',        label: 'S&P500' },
  US30:    { yahoo: 'YM=F',        label: 'US30' },
  EURUSD:  { yahoo: 'EURUSD=X',    label: 'EURUSD' },
  XAUUSD:  { yahoo: 'GC=F',        label: 'XAUUSD' },
  BTCUSD:  { yahoo: 'BTC-USD',     label: 'BTCUSD' },
  ETHUSD:  { yahoo: 'ETH-USD',     label: 'ETHUSD' },
  SOLUSD:  { yahoo: 'SOL-USD',     label: 'SOLUSD' },
};

// ── ESCALA COMPLETA DE TEMPORALIDADES DEL REPLAY (estilo TradingView) ──
// 1m 3m 5m 10m 15m 30m 1h 4h
// - Yahoo NO ofrece 3m/10m/4h nativos -> se descarga la TF base y se agrega xN
// - Yahoo 1m solo conserva ~30 dias de historial (limite de la fuente)
// - Binance (crypto) si tiene 1m/3m/4h nativos, pero NO 10m -> 5m agregado x2
const TF_SPECS = {
  '1m':  { yahoo: '1m',  chunk: 6,   days: 30,  binance: '1m',  binYears: 1 },
  '3m':  { aggFrom: '1m', factor: 3, days: 30,  binance: '3m',  binYears: 1 },
  '5m':  { yahoo: '5m',  chunk: 57,  days: 730, binance: '5m',  binYears: 2 },
  '10m': { aggFrom: '5m', factor: 2, days: 730, binanceFrom: '5m', binYears: 2 },
  '15m': { yahoo: '15m', chunk: 57,  days: 730, binance: '15m', binYears: 2 },
  '30m': { yahoo: '30m', chunk: 57,  days: 730, binance: '30m', binYears: 3 },
  '1h':  { yahoo: '60m', chunk: 57,  days: 730, binance: '1h',  binYears: 4 },
  '4h':  { aggFrom: '1h', factor: 4, days: 730, binance: '4h',  binYears: 4 },
};
const TIMEFRAMES = Object.keys(TF_SPECS);

const CHUNK_DAYS_DEFAULT = 57; // margen bajo el limite de 60d por request de yahoo
const EMPTY_CHUNKS_STOP = 3;   // corta si llegan N chunks vacios seguidos

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseYahoo(payload) {
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const times = result?.timestamp || [];
  const out = [];
  for (let i = 0; i < times.length; i++) {
    const close = Number(quote?.close?.[i]);
    if (!Number.isFinite(close) || close <= 0) continue;
    const open = Number(quote?.open?.[i]) || close;
    const high = Number(quote?.high?.[i]) || Math.max(open, close);
    const low = Number(quote?.low?.[i]) || Math.min(open, close);
    const volume = Number(quote?.volume?.[i]) || 0;
    out.push({ t: Number(times[i]) * 1000, o: open, h: high, l: low, c: close, v: volume });
  }
  return out;
}

function mergeCandles(prev, fresh) {
  const seen = new Set(prev.map(c => c.t));
  for (const c of fresh) if (!seen.has(c.t)) { prev.push(c); seen.add(c.t); }
  prev.sort((a, b) => a.t - b.t);
  return prev;
}

// Agrega velas de una TF base a una TF mayor (mismo criterio que server.js:
// buckets alineados por epoch, o=primera h=max l=min c=ultima v=suma)
function aggregate(candles, minutes) {
  if (!minutes || minutes <= 1) return candles;
  const bucketMs = minutes * 60 * 1000;
  const buckets = new Map();
  for (const c of candles) {
    const b = Math.floor(c.t / bucketMs) * bucketMs;
    const cur = buckets.get(b);
    if (!cur) buckets.set(b, { t: b, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v || 0 });
    else {
      cur.h = Math.max(cur.h, c.h);
      cur.l = Math.min(cur.l, c.l);
      cur.c = c.c;
      cur.v = (cur.v || 0) + (c.v || 0);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
}

// Descarga paginada de una TF NATIVA de yahoo: chunks hacia atras hasta targetDays
// o hasta que yahoo deje de tener datos (EMPTY_CHUNKS_STOP vacios seguidos)
async function downloadYahoo(symbol, yahooInterval, chunkDays, targetDays) {
  const cfg = SYMBOLS[symbol];
  const now = Date.now();

  let candles = [];
  let emptyStreak = 0;
  let pages = 0;

  for (let offsetDays = 0; offsetDays < targetDays; offsetDays += chunkDays) {
    const toTs = now - offsetDays * 86400000;
    const fromTs = toTs - chunkDays * 86400000;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cfg.yahoo)}?period1=${Math.floor(fromTs / 1000)}&period2=${Math.floor(toTs / 1000)}&interval=${yahooInterval}&includePrePost=true`;
    try {
      const data = await fetchJson(url);
      const fresh = parseYahoo(data);
      pages++;
      if (fresh.length > 0) {
        mergeCandles(candles, fresh);
        emptyStreak = 0;
      } else {
        // Los mercados cierran fines de semana: 1 chunk vacio puede ser normal;
        // los chunks consecutivos vacios indican el final del historico disponible
        emptyStreak++;
        if (emptyStreak >= EMPTY_CHUNKS_STOP) break;
      }
    } catch (e) {
      console.error(`  chunk ${symbol} ${yahooInterval} (−${offsetDays}d): ${e.message}`);
      emptyStreak++;
      if (emptyStreak >= EMPTY_CHUNKS_STOP) break;
    }
    await new Promise(r => setTimeout(r, 450)); // rate limit de yahoo
  }

  candles = candles.filter(c => Number.isFinite(c.c) && c.c > 0);
  return candles.length >= 2 ? { candles, pages } : null;
}

// ── BINANCE (crypto con anos de historial gratis, sin API key) ──
const BINANCE_SYMBOLS = { BTCUSD: 'BTCUSDT', ETHUSD: 'ETHUSDT', SOLUSD: 'SOLUSDT' };
const BINANCE_MS = {
  '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000,
  '30m': 1800000, '1h': 3600000, '4h': 14400000,
};

async function fetchBinance(asset, interval, years) {
  const out = [];
  const msPer = BINANCE_MS[interval];
  if (!msPer) throw new Error(`Intervalo binance no soportado: ${interval}`);
  const startTarget = Date.now() - (years || 1) * 365.25 * 86400000;
  let end = Date.now();
  while (end > startTarget) {
    const startTime = Math.max(0, end - 1000 * msPer);
    const url = `https://api.binance.com/api/v3/klines?symbol=${asset}&interval=${interval}&startTime=${startTime}&endTime=${end}&limit=1000`;
    let data;
    try {
      data = await fetchJson(url);
    } catch (e) {
      break;
    }
    if (!Array.isArray(data) || data.length === 0) break;
    const batch = data.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
    out.unshift(...batch);
    end = batch[0].t - msPer;
    if (batch.length < 1000) break; // llego al inicio del historial de Binance
    await new Promise(r => setTimeout(r, 120)); // peso de binance: 1-2 por request
  }
  return out;
}

// Obtiene las velas de una TF de la escala para un simbolo:
// 1) Binance nativo (crypto)  2) Yahoo nativo  3) Agregacion desde la TF base
async function getTFData(symbol, tf) {
  const spec = TF_SPECS[tf];
  if (!spec) return null;
  const binAsset = BINANCE_SYMBOLS[symbol];

  // Crypto: Binance primero (historial completo en anios); yahoo como respaldo
  if (binAsset) {
    let bin = [];
    if (spec.binance) {
      bin = await fetchBinance(binAsset, spec.binance, spec.binYears);
      if (bin.length >= 2) return { candles: bin, source: 'binance' };
    } else if (spec.binanceFrom) {
      // TF no nativa en binance (10m): base agregada
      const base = await fetchBinance(binAsset, spec.binanceFrom, spec.binYears);
      const agg = aggregate(base, parseInt(tf));
      if (agg.length >= 2) return { candles: agg, source: `binance-agg:${spec.binanceFrom}` };
    }
    console.log('  (binance vacio, fallback yahoo)');
  }

  // Yahoo: TF nativa directa
  if (spec.yahoo) {
    const res = await downloadYahoo(symbol, spec.yahoo, spec.chunk || CHUNK_DAYS_DEFAULT, spec.days || 730);
    if (res) return { candles: res.candles, source: 'yahoo' };
  }

  // Yahoo: TF agregada desde su TF base (3m<-1m, 10m<-5m, 4h<-1h)
  if (spec.aggFrom) {
    const baseSpec = TF_SPECS[spec.aggFrom] || {};
    const baseInterval = baseSpec.yahoo;
    if (baseInterval) {
      const res = await downloadYahoo(symbol, baseInterval, baseSpec.chunk || CHUNK_DAYS_DEFAULT, spec.days || 730);
      if (res) {
        const agg = aggregate(res.candles, parseInt(tf));
        if (agg.length >= 2) return { candles: agg, source: `yahoo-agg:${spec.aggFrom}x${spec.factor}` };
      }
    }
  }

  return null;
}

async function main() {
  console.log('=== Descargando historicos (escala 1m-4h, paginado) ===\n');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const summary = {};

  for (const [symbol, cfg] of Object.entries(SYMBOLS)) {
    console.log(`[SYMBOL] ${cfg.label} (${cfg.yahoo})`);
    summary[symbol] = {};

    for (const tf of TIMEFRAMES) {
      process.stdout.write(`  ${tf}... `);
      let res = null;
      try {
        res = await getTFData(symbol, tf);
      } catch (e) {
        console.error(`  error ${symbol} ${tf}: ${e.message}`);
      }

      if (res) {
        const dir = path.join(DATA_DIR, symbol);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${tf}.json`);
        fs.writeFileSync(filePath, JSON.stringify(res.candles));

        const first = new Date(res.candles[0].t).toLocaleDateString('es-ES');
        const last = new Date(res.candles[res.candles.length - 1].t).toLocaleDateString('es-ES');
        console.log(`OK ${res.candles.length} velas (${res.source}) (${first} -> ${last})`);
        summary[symbol][tf] = { count: res.candles.length, first, last, source: res.source };
      } else {
        console.log('Sin datos');
        summary[symbol][tf] = { count: 0 };
      }
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('');
  }

  fs.writeFileSync(path.join(DATA_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('=== Completado ===');
  console.log(`Datos guardados en: ${DATA_DIR}`);
}

main().catch(console.error);

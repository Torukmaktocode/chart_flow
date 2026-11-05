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

const TIMEFRAMES = ['5m', '15m', '30m', '1h'];

// Historial objetivo por timeframe (dias). Yahoo entrega intradia en chunks de
// ~60 dias por request: se pagina hacia atras hasta que ya no hay mas datos.
const TARGET_DAYS = {
  '5m':  730,   // intenta 2 anios de velas de 5m (lo que yahoo tenga)
  '15m': 730,
  '30m': 730,
  '1h':  730,
};
const CHUNK_DAYS = 57; // margen bajo el limite de 60d por request de yahoo
const EMPTY_CHUNKS_STOP = 3; // corta si llegan N chunks vacios seguidos

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

// Descarga paginada: chunks de CHUNK_DAYS hacia atras hasta TARGET_DAYS
// o hasta que yahoo deje de tener datos (EMPTY_CHUNKS_STOP vacios seguidos)
async function downloadSymbol(symbol, tf) {
  const cfg = SYMBOLS[symbol];
  const interval = tf;
  const back = TARGET_DAYS[tf] || 730;
  const now = Date.now();

  let candles = [];
  let emptyStreak = 0;
  let pages = 0;

  for (let offsetDays = 0; offsetDays < back; offsetDays += CHUNK_DAYS) {
    const toTs = now - offsetDays * 86400000;
    const fromTs = toTs - CHUNK_DAYS * 86400000;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cfg.yahoo)}?period1=${Math.floor(fromTs / 1000)}&period2=${Math.floor(toTs / 1000)}&interval=${interval}&includePrePost=true`;
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
      console.error(`  chunk ${symbol} ${tf} (−${offsetDays}d): ${e.message}`);
      emptyStreak++;
      if (emptyStreak >= EMPTY_CHUNKS_STOP) break;
    }
    await new Promise(r => setTimeout(r, 450)); // rate limit de yahoo
  }

  candles = candles.filter(c => Number.isFinite(c.c) && c.c > 0);
  return candles.length >= 2 ? { candles, pages } : null;
}

// ── BINANCE (crypto con anos de historial gratis, sin API key) ──
// Yahoo limita 5m/15m/30m a ~60 dias; Binance entrega anios completos
const BINANCE_SYMBOLS = { BTCUSD: 'BTCUSDT', ETHUSD: 'ETHUSDT', SOLUSD: 'SOLUSDT' };
const BINANCE_YEARS = { '5m': 2, '15m': 2, '30m': 3, '1h': 4 };

async function fetchBinance(asset, tf) {
  const out = [];
  const msPer = { '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000 }[tf];
  const years = BINANCE_YEARS[tf] || 1;
  const startTarget = Date.now() - years * 365.25 * 86400000;
  let end = Date.now();
  while (end > startTarget) {
    const startTime = Math.max(0, end - 1000 * msPer);
    const url = `https://api.binance.com/api/v3/klines?symbol=${asset}&interval=${tf}&startTime=${startTime}&endTime=${end}&limit=1000`;
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

async function main() {
  console.log('=== Descargando historicos (paginado) ===\n');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const summary = {};

  for (const [symbol, cfg] of Object.entries(SYMBOLS)) {
    console.log(`[SYMBOL] ${cfg.label} (${cfg.yahoo})`);
    summary[symbol] = {};

    for (const tf of TIMEFRAMES) {
      process.stdout.write(`  ${tf}... `);
      let res = null;
      let source = '';

      // Crypto: Binance primero (historial completo en anios); yahoo como respaldo
      const binAsset = BINANCE_SYMBOLS[symbol];
      if (binAsset) {
        const bin = await fetchBinance(binAsset, tf);
        await new Promise(r => setTimeout(r, 400));
        if (bin.length >= 2) {
          res = { candles: bin, pages: Math.ceil((Date.now() - bin[0].t) / (1000 * ({ '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000 }[tf]))) };
          source = ' (binance)';
        } else {
          console.log('  (binance vacio, fallback yahoo)');
        }
      }
      if (!res) res = await downloadSymbol(symbol, tf);

      if (res) {
        const dir = path.join(DATA_DIR, symbol);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${tf}.json`);
        fs.writeFileSync(filePath, JSON.stringify(res.candles));

        const first = new Date(res.candles[0].t).toLocaleDateString('es-ES');
        const last = new Date(res.candles[res.candles.length - 1].t).toLocaleDateString('es-ES');
        console.log(`OK ${res.candles.length} velas${source} (${first} -> ${last})`);
        summary[symbol][tf] = { count: res.candles.length, first, last, source: source.trim() || 'yahoo' };
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

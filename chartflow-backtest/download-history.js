const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'historical-data');

// Symbol mapping to Yahoo Finance
const SYMBOLS = {
  NAS100:  { yahoo: 'NQ=F',        label: 'NAS100' },
  US500:   { yahoo: 'ES=F',         label: 'S&P500' },
  US30:    { yahoo: 'YM=F',         label: 'US30' },
  EURUSD:  { yahoo: 'EURUSD=X',     label: 'EURUSD' },
  XAUUSD:  { yahoo: 'GC=F',         label: 'XAUUSD' },
  BTCUSD:  { yahoo: 'BTC-USD',      label: 'BTCUSD' },
  ETHUSD:  { yahoo: 'ETH-USD',      label: 'ETHUSD' },
  SOLUSD:  { yahoo: 'SOL-USD',      label: 'SOLUSD' },
};

// Timeframes to download
const TIMEFRAMES = ['5m', '15m', '30m', '1h'];

// Yahoo ranges for each timeframe
const RANGES = {
  '5m':  { range: '60d',  interval: '5m' },
  '15m': { range: '60d',  interval: '15m' },
  '30m': { range: '60d',  interval: '30m' },
  '1h':  { range: '730d', interval: '1h' },
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error: ' + data.slice(0, 200))); }
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

function aggregate(candles, minutes) {
  if (!minutes || minutes <= 1) return candles;
  const bucketMs = minutes * 60 * 1000;
  const buckets = new Map();
  for (const c of candles) {
    const b = Math.floor(c.t / bucketMs) * bucketMs;
    const cur = buckets.get(b);
    if (!cur) {
      buckets.set(b, { t: b, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v });
    } else {
      cur.h = Math.max(cur.h, c.h);
      cur.l = Math.min(cur.l, c.l);
      cur.c = c.c;
      cur.v += c.v;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
}

async function downloadSymbol(symbol, tf) {
  const cfg = SYMBOLS[symbol];
  const rangeCfg = RANGES[tf];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cfg.yahoo)}?range=${rangeCfg.range}&interval=${rangeCfg.interval}&includePrePost=true`;
  
  try {
    const data = await fetchJson(url);
    let candles = parseYahoo(data);
    if (candles.length < 2) return null;
    
    // Remove duplicates and sort
    candles.sort((a, b) => a.t - b.t);
    const seen = new Set();
    candles = candles.filter(c => { if (seen.has(c.t)) return false; seen.add(c.t); return true; });
    
    return candles;
  } catch (e) {
    console.error(`  Error ${symbol} ${tf}: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('=== Descargando históricos ===\n');
  
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  
  const summary = {};
  
  for (const [symbol, cfg] of Object.entries(SYMBOLS)) {
    console.log(`📊 ${cfg.label} (${cfg.yahoo})`);
    summary[symbol] = {};
    
    for (const tf of TIMEFRAMES) {
      process.stdout.write(`  ${tf}... `);
      const candles = await downloadSymbol(symbol, tf);
      
      if (candles && candles.length > 0) {
        const dir = path.join(DATA_DIR, symbol);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${tf}.json`);
        fs.writeFileSync(filePath, JSON.stringify(candles));
        
        const first = new Date(candles[0].t).toLocaleDateString('es-ES');
        const last = new Date(candles[candles.length - 1].t).toLocaleDateString('es-ES');
        console.log(`✅ ${candles.length} velas (${first} → ${last})`);
        summary[symbol][tf] = { count: candles.length, first, last };
      } else {
        console.log('❌ Sin datos');
        summary[symbol][tf] = { count: 0 };
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('');
  }
  
  // Save summary
  fs.writeFileSync(path.join(DATA_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('=== Completado ===');
  console.log(`Datos guardados en: ${DATA_DIR}`);
}

main().catch(console.error);

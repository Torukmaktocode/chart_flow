// Transforma un CSV M1 de HistData (DATE TIME;OHLC;VOL separado por ;) en
// candles de 5m/15m/30m/1h y los MERGEA con los JSON existentes de historical-data
const fs = require("fs");
const path = require("path");

const csvFile = process.argv[2];
const symbol = process.argv[3];      // ej: EURUSD
const root = process.env.CHARTFLOW_ROOT || "C:\\Users\\goddi\\Documents\\PROYECTOS DE CODIGO\\chart_flow-master\\chart_flow-master";

const TF_MIN = { "5m": 5, "15m": 15, "30m": 30, "1h": 60 };

function aggregate(candles, minutes) {
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
  return [...buckets.values()].sort((a, b) => a.t - b.t);
}

function mergeInto(symbolFile, freshCandles) {
  let existing = [];
  let dates = new Set();
  try {
    existing = JSON.parse(fs.readFileSync(symbolFile, "utf8"));
    existing.forEach(c => dates.add(c.t));
  } catch {}
  const combined = existing.concat(freshCandles.filter(c => !dates.has(c.t)));
  combined.sort((a, b) => a.t - b.t);
  fs.writeFileSync(symbolFile, JSON.stringify(combined));
  return { added: combined.length - existing.length, total: combined.length,
           first: new Date(combined[0].t).toISOString().slice(0, 10),
           last: new Date(combined[combined.length - 1].t).toISOString().slice(0, 10) };
}

let m1 = [];
const raw = fs.readFileSync(csvFile, "utf8").split(/\r?\n/);
for (const line of raw) {
  if (!line || line.startsWith("DATE") || /^[FL] /i.test(line)) continue;
  const p = line.split(" ");
  if (p.length < 2) continue;
  const dt = p[0]; const vals = p[1].split(";");
  if (vals.length < 5) continue;
  const y = +dt.slice(0, 4), mo = +dt.slice(4, 6), d = +dt.slice(6, 8);
  const h = +vals[0].slice(0, 2), mi = +vals[0].slice(2, 4), s = +vals[0].slice(4, 6);
  const t = Date.UTC(y, mo - 1, d, h, mi, s);
  const o = +vals[1], hI = +vals[2], lI = +vals[3], c = +vals[4], v = +vals[5] || 0;
  if (!Number.isFinite(c) || c <= 0) continue;
  m1.push({ t, o, h: hI, l: lI, c, v });
}
m1.sort((a, b) => a.t - b.t);
const dataDir = path.join(root, "chartflow-backtest", "historical-data", symbol);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

console.log(`M1 parseadas: ${m1.length} (${new Date(m1[0].t).toISOString().slice(0, 10)} -> ${new Date(m1[m1.length - 1].t).toISOString().slice(0, 10)})`);
for (const [tf, min] of Object.entries(TF_MIN)) {
  const agg = aggregate(m1, min);
  const file = path.join(dataDir, `${tf}.json`);
  const r = mergeInto(file, agg);
  console.log(`  ${tf}: agregadas ${r.added}, total ${r.total} (${r.first} -> ${r.last})`);
}

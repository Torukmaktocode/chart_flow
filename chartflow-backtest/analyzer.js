// ============ ANALIZADOR MT4/MT5 ============
// Parseo de historiales de trading exportados desde MT4/MT5 (xlsx, html, csv/tsv)
// y motor de analitica + diagnostico (lo bueno / lo malo / a mejorar).
const ExcelJS = require("exceljs");

// ---- utilidades de parseo ----
function parseNum(v) {
  if (typeof v === "number") return v;
  if (v == null) return null;
  let s = String(v).trim().replace(/[\s\u00A0]/g, "").replace(/[$€]|USD|USD/ig, "");
  if (!s) return null;
  let neg = /^\(.*\)$/.test(s); if (neg) s = s.slice(1, -1);
  s = s.replace(/^-/, m => { neg = !neg ? false : neg; return ""; }) ? s : s;
  const hadMinus = /^-/.test(s); s = s.replace(/^-/, "");
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    const dec = s.split(",")[1] || "";
    if (dec.length !== 3) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return (hadMinus || neg) ? -Math.abs(n) : n;
}
function parseDate(v) {
  if (v == null) return null;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d) ? null : d.getTime();
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  m = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    const a = +m[1], b = +m[2];
    const day = a > 12 ? a : a, mon = a > 12 ? b : b; // asumimos dd/mm (locale ES)
    const d = new Date(y, mon - 1, day, +(m[4] || 0), +(m[5] || 0), 0);
    return isNaN(d) ? null : d.getTime();
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.getTime();
}
function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

// Extrae filas de celdas desde un buffer: xlsx (PK), html (tablas) o csv/tsv
async function extractRows(buffer, filename) {
  const name = (filename || "").toLowerCase();
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (isZip || /\.xlsx$/i.test(name)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    for (const ws of wb.worksheets) {
      const rows = [];
      ws.eachRow({ includeEmpty: false }, row => {
        const vals = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          vals[col - 1] = cell.value == null ? "" : (typeof cell.value === "object" && cell.value.text ? cell.value.text : cell.value);
        });
        rows.push(vals);
      });
      const out = rowsToTrades(rows);
      if (out.trades.length) return out;
    }
    return { trades: [], capital: null };
  }
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  let rows;
  if (/<table|<html|<tr/i.test(text)) {
    rows = [];
    const trs = text.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trs) {
      const cells = [];
      const tds = tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
      for (const td of tds) cells.push(stripTags(td));
      rows.push(cells);
    }
  } else {
    rows = text.split(/\r?\n/).map(line => {
      const delim = (line.split("\t").length > line.split(";").length) ? "\t" : (line.split(";").length > line.split(",").length ? ";" : ",");
      return line.split(delim).map(c => stripTags(c));
    });
  }
  return rowsToTrades(rows);
}

// Mapea filas de celdas a trades cerrados estilo MT4/MT5
function rowsToTrades(rows) {
  if (!rows.length) return [];
  // encontrar fila de encabezado
  let headIdx = -1, col = {};
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i].map(c => String(c).toLowerCase());
    const find = re => cells.findIndex(c => re.test(c));
    const cType = find(/^(type|tipo)/) >= 0 ? find(/^(type|tipo)/) : find(/type|tipo/);
    const cProf = find(/profit|beneficio|ganancia/);
    if (cType >= 0 && cProf >= 0) {
      headIdx = i;
      col = {
        type: cType,
        size: find(/size|tama\u00f1o|tamano|lote|lots/),
        symbol: find(/item|symbol|simbolo|elemento|par/),
        open: find(/open time|apertura|open|hora de apertura/),
        close: find(/close time|cierre|close|hora de cierre/),
        sl: find(/^s\/?l$|sl|stop/),
        tp: find(/^t\/?p$|tp|take/),
        openPrice: find(/open price|precio de apertura/),
        closePrice: find(/price|precio/),
        profit: cProf,
        swap: find(/swap/),
        commission: find(/commission|comision/),
        ticket: find(/ticket|billete|orden|order/)
      };
      break;
    }
  }
  const out = [];
  const startPos = headIdx >= 0 ? headIdx + 1 : 0;
  for (let i = startPos; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells || cells.length < 6) continue;
    const typeRaw = headIdx >= 0 ? String(cells[col.type] || "") : cells.find(c => /^(buy|sell|compra|venta)/i.test(String(c))) || "";
    const typeMatch = String(typeRaw).toLowerCase().match(/(buy|sell|compra|venta)/);
    if (!typeMatch) continue; // filas de balance/creditos/detalles se descartan
    if (/cancel|delete|pend/i.test(String(typeRaw))) continue;
    const get = (idx, altIdx) => {
      if (idx != null && idx >= 0) return cells[idx];
      if (altIdx != null && altIdx >= 0) return cells[altIdx];
      return null;
    };
    const openTs = parseDate(headIdx >= 0 ? get(col.open) : cells[1] || cells[0]);
    const closeTs = parseDate(headIdx >= 0 ? get(col.close) : cells.find(c => /(\d{4}[.\-\/]\d{2}[.\-\/]\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})/.test(String(c)) && cells.indexOf(c) > (col.openPrice ?? 0)));
    const profit = parseNum(headIdx >= 0 ? get(col.profit) : cells.find(c => /^-?[\d\s.,]+$/.test(String(c).trim()) && parseNum(c) != null && !/^\d{4}[.\-]/.test(String(c))));
    if (closeTs == null || profit == null) continue;
    const type = /buy|compra/i.test(typeMatch[1]) ? "LONG" : "SHORT";
    out.push({
      symbol: (headIdx >= 0 ? get(col.symbol) : null) || "N/D",
      type,
      lots: parseNum(headIdx >= 0 ? get(col.size) : null) || 1,
      openTs: openTs || null,
      closeTs,
      openPrice: parseNum(headIdx >= 0 ? get(col.openPrice) : null),
      closePrice: parseNum(headIdx >= 0 ? get(col.closePrice) : null),
      sl: parseNum(headIdx >= 0 ? get(col.sl) : null),
      tp: parseNum(headIdx >= 0 ? get(col.tp) : null),
      profit,
      swap: parseNum(headIdx >= 0 ? get(col.swap) : null) || 0,
      commission: parseNum(headIdx >= 0 ? get(col.commission) : null) || 0,
      ticket: (headIdx >= 0 ? get(col.ticket) : null) || ("t-" + i)
    });
  }
  // dedupe por ticket
  const seen = new Set();
  const trades = out.filter(t => { const k = t.ticket; if (seen.has(k)) return false; seen.add(k); return true; });

  // ---- capital automatico desde el archivo ----
  let capital = null;
  // 1) filas de deposito/balance del historial (MT4: Type=balance, el deposito va en Profit)
  rows.forEach(cells => {
    if (capital != null) return;
    const typeCell = cells.find(c => /^(balance|deposito|deposit)$/i.test(String(c).trim()));
    if (typeCell) {
      const idx = cells.indexOf(typeCell);
      for (let j = cells.length - 1; j > idx; j--) {
        const v = parseNum(cells[j]);
        if (v != null && v > 0) { capital = v; return; }
      }
    }
  });
  // 2) etiquetas de informes HTML: Initial Deposit / Deposito inicial / Deposit / Balance previo
  if (capital == null) {
    rows.forEach(cells => {
      if (capital != null) return;
      cells.forEach((c, i) => {
        if (capital != null) return;
        if (/deposito inicial|initial deposit|^deposito\b|^deposit\b|balance previo|previous balance/i.test(String(c).trim())) {
          for (let j = i + 1; j < Math.min(i + 3, cells.length); j++) {
            const v = parseNum(cells[j]);
            if (v != null && v > 0) { capital = v; return; }
          }
        }
      });
    });
  }
  return { trades, capital };
}

// ---- analitica + diagnostico ----
function analyzeTrades(trades, balance) {
  const closed = trades.slice().sort((a, b) => a.closeTs - b.closeTs);
  const wins = closed.filter(t => t.profit > 0);
  const losses = closed.filter(t => t.profit < 0);
  const beTrades = closed.filter(t => Math.abs(t.profit) < 1e-9);
  const totalPnL = closed.reduce((s, t) => s + t.profit, 0);
  const net = closed.reduce((s, t) => s + t.profit + t.swap + t.commission, 0);
  const gw = wins.reduce((s, t) => s + t.profit, 0);
  const gl = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
  const pf = gl > 0 ? gw / gl : (gw > 0 ? Infinity : 0);
  const avgWin = wins.length ? gw / wins.length : 0;
  const avgLoss = losses.length ? gl / losses.length : 0;
  const expect = closed.length ? totalPnL / closed.length : 0;
  const winRate = closed.length ? wins.length / closed.length * 100 : 0;
  // RR real cuando el reporte trae SL
  const rs = closed.map(t => {
    if (t.sl == null || t.openPrice == null || t.closePrice == null) return 0;
    const risk = Math.abs(t.openPrice - t.sl), rew = Math.abs(t.closePrice - t.openPrice);
    return risk > 0 ? rew / risk : 0;
  }).filter(v => v > 0);
  const avgR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
  // duraciones (min)
  const durs = closed.map(t => (t.closeTs - t.openTs) / 60000).filter(v => v >= 0);
  const avgWinDur = wins.length ? wins.reduce((s, t) => s + (t.closeTs - t.openTs) / 60000, 0) / wins.length : 0;
  const avgLossDur = losses.length ? losses.reduce((s, t) => s + (t.closeTs - t.openTs) / 60000, 0) / losses.length : 0;
  // drawdown sobre equity
  let eq = balance, peak = balance, maxDD = 0, maxDDPct = 0, maxDDDur = 0, ddStart = 0;
  const equity = [];
  closed.forEach(t => {
    eq += t.profit;
    equity.push({ ts: t.closeTs, pnl: eq - balance });
    if (eq > peak) { peak = eq; ddStart = t.closeTs; }
    else {
      const dd = peak - eq;
      if (dd > maxDD) { maxDD = dd; maxDDPct = peak > 0 ? dd / peak * 100 : 0; maxDDDur = (t.closeTs - ddStart) / 86400000; }
    }
  });
  // dias / frecuencia / overtrading
  const dayMap = {};
  closed.forEach(t => {
    const d = new Date(t.closeTs); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (!dayMap[k]) dayMap[k] = { pnl: 0, trades: 0 };
    dayMap[k].pnl += t.profit; dayMap[k].trades++;
  });
  const daysTraded = Object.keys(dayMap).length;
  const dayPnls = Object.values(dayMap);
  const freqDay = closed.length / Math.max(1, daysTraded);
  const maxDayTrades = dayPnls.reduce((m, d) => Math.max(m, d.trades), 0);
  const overThreshold = Math.max(6, Math.ceil(freqDay * 2));
  const overDays = dayPnls.filter(d => d.trades >= overThreshold);
  const overtradePnl = overDays.reduce((s, d) => s + d.pnl, 0);
  const maxDayPnl = dayPnls.find(d => d.trades === maxDayTrades)?.pnl ?? 0;
  const spanDays = closed.length ? Math.max(1, (closed[closed.length - 1].closeTs - closed[0].closeTs) / 86400000) : 1;
  // breakdowns
  const bucket = (fn) => {
    const m = {};
    closed.forEach(t => {
      const k = fn(t); if (!k) return;
      if (!m[k]) m[k] = { trades: 0, wins: 0, pnl: 0 };
      m[k].trades++; if (t.profit > 0) m[k].wins++; m[k].pnl += t.profit;
    });
    return m;
  };
  const side = bucket(t => t.type);
  const sessOfTs = ts => { const h = new Date(ts).getHours(); return (h >= 19 || h < 7) ? "Asia" : (h < 13 ? "Londres" : "New York"); };
  const session = bucket(t => sessOfTs(t.openTs || t.closeTs));
  // CRUCES DE SESION: trades abiertos en una sesion y cerrados en otra.
  // El cambio de sesion trae gaps de precio y spreads ampliados.
  const cross = { count: 0, pnl: 0, paths: {}, weekend: { count: 0, pnl: 0 } };
  // PERDIDAS POR GAP: cerraron en la transicion y el precio se paso el stop
  // (stop saltado por el hueco) o la perdida es mucho mayor que la tipica.
  const gapLosses = { count: 0, pnl: 0, slipped: 0, list: [] };
  closed.forEach(t => {
    const a = sessOfTs(t.openTs || t.closeTs), b = sessOfTs(t.closeTs);
    const isCross = a !== b;
    const days = (t.closeTs - t.openTs) / 86400000;
    const weekendGap = t.openTs && t.closeTs && ((new Date(t.openTs).getDay() === 5 && (new Date(t.closeTs).getDay() === 0 || new Date(t.closeTs).getDay() === 6)) || days >= 2);
    if (a !== b) {
      cross.count++; cross.pnl += t.profit;
      const key = a + " \u2192 " + b;
      if (!cross.paths[key]) cross.paths[key] = { count: 0, pnl: 0, wins: 0 };
      cross.paths[key].count++; cross.paths[key].pnl += t.profit; if (t.profit > 0) cross.paths[key].wins++;
    }
    // gap de fin de semana: abre viernes, cierra domingo/lunes o tras 2+ dias
    if (t.openTs && t.closeTs) {
      const od = new Date(t.openTs).getDay(), cd = new Date(t.closeTs).getDay();
      if ((od === 5 && (cd === 0 || cd === 6)) || days >= 2) {
        cross.weekend.count++; cross.weekend.pnl += t.profit;
      }
    }
    if (t.profit >= 0 || (!isCross && !weekendGap)) return;
    // analisis del gap en la perdida
    let slipped = false, slip = 0;
    if (t.sl != null && t.openPrice != null && t.closePrice != null) {
      const risk = Math.abs(t.openPrice - t.sl);
      if (t.type === "LONG" && t.closePrice < t.sl) { slip = t.sl - t.closePrice; slipped = slip > 0; }
      if (t.type === "SHORT" && t.closePrice > t.sl) { slip = t.closePrice - t.sl; slipped = slip > 0; }
      slipped = slip > 0 && (risk > 0 ? slip / risk >= 0.1 : slip > 0);
    }
    const bigLoss = avgLoss > 0 ? Math.abs(t.profit) >= avgLoss * 1.5 : Math.abs(t.profit) > 0;
    if (slipped || bigLoss) {
      gapLosses.count++; gapLosses.pnl += t.profit;
      if (slipped) gapLosses.slipped++;
      gapLosses.list.push({
        symbol: t.symbol, type: t.type,
        date: new Date(t.closeTs).toLocaleString("es-ES"),
        pnl: t.profit, slipped, slip,
        transition: isCross ? (a + " \u2192 " + b) : (weekendGap ? "fin de semana" : "misma sesion")
      });
    }
  });
  gapLosses.worst = gapLosses.list.length ? gapLosses.list.reduce((m, g) => g.pnl < m.pnl ? g : m, gapLosses.list[0]) : null;
  const hourly = bucket(t => String(new Date(t.openTs || t.closeTs).getHours()).padStart(2, "0") + ":00");
  const weekday = bucket(t => ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(t.openTs || t.closeTs).getDay()]);
  const monthly = bucket(t => { const d = new Date(t.closeTs); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); });
  const symbols = bucket(t => t.symbol);
  // tamano de lote: consistencia de riesgo
  const lots = closed.map(t => t.lots).filter(v => v > 0);
  const lotsMean = lots.length ? lots.reduce((a, b) => a + b, 0) / lots.length : 0;
  const lotsCV = lotsMean > 0 ? Math.sqrt(lots.reduce((s, v) => s + (v - lotsMean) ** 2, 0) / lots.length) / lotsMean : 0;
  // rachas
  let maxConsecLoss = 0, cur = 0, maxConsecWin = 0, curW = 0;
  closed.forEach(t => {
    if (t.profit < 0) { cur++; maxConsecLoss = Math.max(maxConsecLoss, cur); } else cur = 0;
    if (t.profit > 0) { curW++; maxConsecWin = Math.max(maxConsecWin, curW); } else curW = 0;
  });
  const costs = closed.reduce((s, t) => s + Math.abs(t.swap + t.commission), 0);
  const costRatio = gw > 0 ? costs / gw : 0;

  // ---- TECNICA: estilo, buckets de duracion, ejecucion de TP y giro/continuacion ----
  const byDur = [
    { name: "Scalping (0-30 min)", test: d => d < 30 },
    { name: "Intradía (30-240 min)", test: d => d >= 30 && d < 240 },
    { name: "Swing (240+ min)", test: d => d >= 240 }
  ].map(b => {
    const g = closed.filter(t => { const d = (t.closeTs - t.openTs) / 60000; return d >= 0 && b.test(d); });
    const pnl = g.reduce((s, t) => s + t.profit, 0);
    return { name: b.name, trades: g.length, pnl, wr: g.length ? g.filter(t => t.profit > 0).length / g.length * 100 : 0 };
  }).filter(b => b.trades > 0);
  const medDur = durs.length ? durs.slice().sort((a, b) => a - b)[Math.floor(durs.length / 2)] : 0;
  let style = "Intradía";
  if (medDur < 30 && freqDay >= 3) style = "Scalping";
  else if (medDur >= 240) style = "Swing";
  // ejecucion de TP en ganadores: R realizado vs R ideal (profit dejado en la mesa)
  let fullTP = 0, partialWin = 0, leftR = 0, leftCount = 0;
  closed.forEach(t => {
    if (t.profit <= 0) return;
    if (t.sl == null || t.openPrice == null || t.closePrice == null || t.tp == null) return;
    const risk = Math.abs(t.openPrice - t.sl);
    if (risk <= 0) return;
    const realR = Math.abs(t.closePrice - t.openPrice) / risk;
    const idealR = Math.abs(t.tp - t.openPrice) / risk;
    if (idealR > 0 && realR >= idealR * 0.8) fullTP++;
    else { partialWin++; leftR += Math.max(0, idealR - realR); leftCount++; }
  });
  const leftRAvg = leftCount ? leftR / leftCount : 0;
  // giro/reversion vs continuacion: direccion del trade vs el anterior mismo simbolo
  const seqSameDir = { trades: 0, wins: 0, pnl: 0 }, seqRev = { trades: 0, wins: 0, pnl: 0 };
  for (let i = 1; i < closed.length; i++) {
    const prev = closed[i - 1], t = closed[i];
    if (t.symbol !== prev.symbol) continue;
    const g = t.type === prev.type ? seqSameDir : seqRev;
    g.trades++; if (t.profit > 0) g.wins++; g.pnl += t.profit;
  }

  // Monte Carlo bootstrap con reemplazo: percentiles del balance final y de la curva
  const pnlsAll = closed.map(t => t.profit);
  let mc = null;
  if (pnlsAll.length >= 4) {
    const N = 1000, n = pnlsAll.length;
    const finals = [], pathCols = Array.from({ length: n + 1 }, () => []);
    for (let s = 0; s < N; s++) {
      let b = balance;
      pathCols[0].push(b);
      for (let k = 0; k < n; k++) {
        b += pnlsAll[Math.floor(Math.random() * n)];
        pathCols[k + 1].push(b);
      }
      finals.push(b);
    }
    const pct = (arr, p) => { const s2 = arr.slice().sort((a, b) => a - b); return s2[Math.floor(s2.length * p)] ?? balance; };
    const q = p => pathCols.map(col => pct(col, p));
    mc = {
      n: N,
      p5: pct(finals, .05), p25: pct(finals, .25), p50: pct(finals, .5), p75: pct(finals, .75), p95: pct(finals, .95),
      probPos: finals.filter(f => f > balance).length / N * 100,
      paths: { p5: q(.05), p25: q(.25), p50: q(.5), p75: q(.75), p95: q(.95) }
    };
  }

  const stats = {
    count: closed.length, wins: wins.length, losses: losses.length, be: beTrades.length,
    totalPnL, net, winRate, pf, avgWin, avgLoss, expect, avgR,
    maxDD, maxDDPct, maxDDDur, avgWinDurMin: avgWinDur, avgLossDurMin: avgLossDur,
    daysTraded, freqDay, spanDays, maxDayTrades, maxDayPnl, overtradePnl, overDays: overDays.length,
    lotsMean, lotsCV, maxConsecLoss, maxConsecWin, costs, costRatio,
    worstLoss: losses.length ? losses.reduce((m, t) => Math.min(m, t.profit), 0) : 0,
    bestWin: wins.length ? wins.reduce((m, t) => Math.max(m, t.profit), 0) : 0,
    balanceNow: balance + net
  };
  stats.crossSessions = { count: cross.count, pnl: cross.pnl, paths: cross.paths, weekend: cross.weekend };
  stats.gapLosses = gapLosses;
  stats.mc = mc;
  stats.technique = { style, medDur, byDur, fullTP, partialWin, leftRAvg, leftCount, wins: wins.length, rev: seqRev, same: seqSameDir };

  // ---- diagnostico: lo bueno / lo malo / a mejorar ----
  const insights = [];
  const push = (kind, title, detail) => insights.push({ kind, title, detail });
  const money = v => (v >= 0 ? "+$" : "-$") + Math.abs(v).toFixed(2);
  if (!closed.length) { insights.push({ kind: "bad", title: "Sin trades cerrados", detail: "El archivo no contiene operativa cerrada." }); return { stats, equity, dayMap, side, session, hourly, weekday, monthly, symbols, insights }; }
  // Rentabilidad global
  if (pf === Infinity || pf >= 1.5) push("good", "Sistema rentable", "Profit Factor " + (pf === Infinity ? "∞" : pf.toFixed(2)) + ": generas " + (pf === Infinity ? "solo" : "$" + pf.toFixed(2)) + " por cada $1 que arriesgas en pérdidas.");
  else if (pf >= 1) push("improve", "Rentabilidad marginal", "PF " + pf.toFixed(2) + ": ganas, pero el margen es fino. Subir el RR promedio o el win rate un par de puntos lo vuelve consistente.");
  else push("bad", "Sistema perdedor hasta ahora", "PF " + pf.toFixed(2) + " con " + money(totalPnL) + " neto. Tus perdedores pesan más que tus ganadores.");
  // WR vs RR
  if (winRate < 45 && avgWin < avgLoss && losses.length && wins.length) push("bad", "Ganas poco cuando aciertas, pierdes mucho cuando fallas", "Win rate " + winRate.toFixed(0) + "% con ganancia media " + money(avgWin) + " vs pérdida media " + money(-avgLoss) + ". Con ese win rate necesitas un RR promedio ≥ " + (100 / Math.max(1, winRate)).toFixed(1) + ":1 solo para empatar.");
  else if (avgWin > avgLoss * 1.5 && wins.length && losses.length) push("good", "Dejas correr tus ganancias", "Tu ganancia media es " + (avgWin / Math.max(1e-9, avgLoss)).toFixed(1) + "x tu pérdida media (" + money(avgWin) + " vs " + money(-avgLoss) + ").");
  // Corta ganadores
  if (avgWinDur > 0 && avgLossDur > 0 && avgWinDur < avgLossDur * 0.5 && winRate < 55) push("improve", "Cortas a tus ganadores", "Duración media de ganadoras " + avgWinDur.toFixed(0) + " min vs " + avgLossDur.toFixed(0) + " min en perdedoras. Tiende a salirse de los aciertos antes que de los errores.");
  // Overtrading
  if (overDays.length && overtradePnl < 0) push("bad", "Los días de sobreoperación son los que pierden", overDays.length + " días con ≥" + overThreshold + " trades suman " + money(overtradePnl) + ". Tu peor día tuvo " + maxDayTrades + " trades (" + money(maxDayPnl) + "). Fija un tope de trades por día.");
  else if (freqDay <= 3 && pf >= 1) push("good", "Selectividad saludable", "Promedio " + freqDay.toFixed(1) + " trades/día en " + daysTraded + " días operados.");
  else if (freqDay > 6) push("improve", "Volumen de trades alto", "Promedio " + freqDay.toFixed(1) + " trades/día. Más trades = más comisiones y decisiones de menor calidad.");
  // Outlier de pérdida
  if (avgLoss > 0 && Math.abs(stats.worstLoss) > avgLoss * 2.5) push("bad", "Pérdida atípica grave", "Tu peor pérdida (" + money(stats.worstLoss) + ") es " + (Math.abs(stats.worstLoss) / avgLoss).toFixed(1) + "x la pérdida media. Un solo outlier así borra semanas: revisa qué pasó ese día.");
  // Drawdown
  if (maxDDPct > 25) push("bad", "Drawdown crítico", "Max drawdown " + maxDDPct.toFixed(1) + "% del capital sostenido " + maxDDDur.toFixed(1) + " días. Reduce el riesgo por trade antes de seguir.");
  else if (maxDDPct > 12) push("improve", "Drawdown alto", "Max drawdown " + maxDDPct.toFixed(1) + "% (" + money(-maxDD) + "). Objetivo profesional: mantenerlo bajo 10-12%.");
  else push("good", "Drawdown controlado", "Max drawdown " + maxDDPct.toFixed(1) + "% del capital. Riesgo bien administrado.");
  // Sesiones
  const sessE = Object.entries(session).sort((a, b) => a[1].pnl - b[1].pnl);
  if (sessE.length > 1) {
    const worst = sessE[0], best = sessE[sessE.length - 1];
    if (worst[1].pnl < 0 && best[1].pnl > 0) push("improve", "Evita operar la sesión " + worst[0], "En " + worst[0] + " pierdes " + money(worst[1].pnl) + " (WR " + (worst[1].wins / worst[1].trades * 100).toFixed(0) + "%) y en " + best[0] + " ganas " + money(best[1].pnl) + ". Sin esa sesión tu P&L sería " + money(totalPnL - worst[1].pnl) + ".");
    if (best[1].pnl > 0 && best[1].wins / best[1].trades > 0.5) push("good", "Tu sesión fuerte es " + best[0], best[1].trades + " trades, " + (best[1].wins / best[1].trades * 100).toFixed(0) + "% win rate, " + money(best[1].pnl) + ". Concéntrate ahí.");
  }
  // Día de semana
  const dowE = Object.entries(weekday).sort((a, b) => a[1].pnl - b[1].pnl);
  if (dowE.length > 2) {
    const worst = dowE[0];
    if (worst[1].pnl < 0 && worst[1].trades >= 3) push("improve", "Los " + worst[0] + " te cuestan dinero", money(worst[1].pnl) + " en " + worst[1].trades + " trades los " + worst[0] + ". Considera operarlos menos o con la mitad de tamaño.");
  }
  // Símbolo
  const symE = Object.entries(symbols).sort((a, b) => a[1].pnl - b[1].pnl);
  if (symE.length > 1) {
    const worst = symE[0], best = symE[symE.length - 1];
    if (worst[1].pnl < 0 && Math.abs(worst[1].pnl) > Math.abs(totalPnL) * 0.3) push("improve", worst[0] + " es tu talón de Aquiles", "Acumula " + money(worst[1].pnl) + " en " + worst[1].trades + " trades. Especializate en los pares donde ganas: tu mejor símbolo es " + best[0] + " (" + money(best[1].pnl) + ").");
    else if (best[1].pnl > 0 && best[1].wins / best[1].trades > 0.5) push("good", "Especialización en " + best[0], best[1].trades + " trades con " + money(best[1].pnl) + " y " + (best[1].wins / best[1].trades * 100).toFixed(0) + "% WR.");
  }
  // Tamaño de lote
  if (lotsCV > 0.45) push("improve", "Tamaño de posición inconsistente", "Tu lote varía ±" + (lotsCV * 100).toFixed(0) + "% respecto al promedio (" + lotsMean.toFixed(2) + "). Riesgo variable = curva errática: define % fijo de riesgo por trade.");
  else if (lotsCV <= 0.2 && closed.length >= 5) push("good", "Riesgo por trade consistente", "Tus lotes varían apenas ±" + (lotsCV * 100).toFixed(0) + "%. Eso estabiliza la curva.");
  // Costos
  if (costRatio > 0.12) push("improve", "Comisiones y swap comen tu margen", "Costos de $" + costs.toFixed(2) + " equivalen al " + (costRatio * 100).toFixed(0) + "% de tu ganancia bruta. Operar menos veces o pares con mejor spread lo reduce.");
  // Rachas
  if (maxConsecLoss >= 5) push("improve", "Rachas de pérdida largas", "Hasta " + maxConsecLoss + " pérdidas seguidas. Regla práctica: tras 3 pérdidas consecutivas, pausa el día y revisa el journal.");
  if (maxConsecWin >= 4) push("good", "Capacidad de rachas ganadoras", "Encadenaste " + maxConsecWin + " aciertos seguidos: la ejecución cuando estás en racha es sólida.");
  // Cruce de sesiones: gaps de precio y spreads ampliados en el cambio
  if (cross.count >= 3 && cross.pnl < 0) {
    const topPath = Object.entries(cross.paths).sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))[0];
    push("bad", "Trades que cruzan sesiones te cuestan dinero", cross.count + " trades se abrieron en una sesión y cerraron en otra, sumando " + money(cross.pnl) + " (peor transición: " + topPath[0] + ", " + money(topPath[1].pnl) + " en " + topPath[1].count + " trades). El cambio de sesión trae gaps de precio y spread ampliado: cierra o pasa a breakeven antes del cambio.");
  } else if (cross.count >= 3 && cross.pnl > 0) {
    push("improve", "Los cruces de sesión te han favorecido, por ahora", cross.count + " trades cruzaron sesiones con " + money(cross.pnl) + ". Ha funcionado, pero cada cambio de sesión trae gap y spread ampliado: no es rentable por diseño.");
  }
  if (cross.weekend.count && cross.weekend.pnl < 0) push("bad", "Trades cruzando el fin de semana", cross.weekend.count + " trades abiertos el viernes cerraron después del fin de semana con " + money(cross.weekend.pnl) + ". El gap de apertura de lunes puede saltarse tu stop: cierra el viernes o reduce tamaño.");
  // Perdidas por gap entre sesiones: el stop se salto o el hueco costaba dolares
  if (gapLosses.count && gapLosses.pnl < 0) {
    const w = gapLosses.worst;
    const worstTxt = w ? " Peor caso: " + w.symbol + " " + w.type + " el " + w.date + ", " + money(w.pnl) + (w.slipped ? " (stop saltado, deslizamiento " + w.slip.toFixed(5) + ")" : "") + " en " + w.transition + "." : "";
    const slipTxt = gapLosses.slipped ? " Tu stop se saltó " + gapLosses.slipped + " de esas veces." : " No tenías stop de protección.";
    push("bad", "El gap entre sesiones te costaba dólares de verdad", gapLosses.count + " pérdidas cerradas en la transición de sesión/fin de semana suman " + money(gapLosses.pnl) + "." + slipTxt + worstTxt + " Regla: sin posiciones abiertas en el cambio de sesión ni sostenidas el fin de semana.");
  }
  // Monte Carlo
  if (mc) {
    if (mc.probPos >= 60) push("good", "Monte Carlo favorece tu sistema", "Reordenando tus trades al azar 1000 veces, el " + mc.probPos.toFixed(0) + "% de las secuencias termina en positivo (mediana " + money(mc.p50 - balance) + "). La ventaja sobrevive el azar del orden.");
    else if (mc.probPos <= 40) push("bad", "Monte Carlo desfavorable", "En 1000 secuencias aleatorias de tus propios trades, solo el " + mc.probPos.toFixed(0) + "% termina en positivo (peor caso p5: " + money(mc.p5 - balance) + "). El orden del azar puede destruir este resultado: no hay margen para mala suerte.");
    else push("improve", "Monte Carlo al filo", "El " + mc.probPos.toFixed(0) + "% de las secuencias aleatorias termina en positivo (p5 " + money(mc.p5 - balance) + ", mediana " + money(mc.p50 - balance) + "). Estás en el filo: cada mejora de win rate o RR empuja la probabilidad a tu favor.");
  }
  // Expectancy
  if (expect > 0) push("good", "Expectancia positiva", "En promedio cada trade aporta " + money(expect) + ". Repetir el proceso es matemáticamente rentable.");
  else if (expect < 0 && pf < 1) push("bad", "Expectancia negativa", "Cada trade te cuesta " + money(expect).replace("-$", "$-") + " en promedio. Antes de escalar tamaño, necesitas un edge demostrado.");
  // TECNICA: que estilo funciona y que falta para mas profit
  if (byDur.length > 1) {
    const bestD = byDur.reduce((m, b) => b.pnl > m.pnl ? b : m, byDur[0]);
    const worstD = byDur.reduce((m, b) => b.pnl < m.pnl ? b : m, byDur[0]);
    if (bestD.pnl > 0 && bestD !== worstD) push("good", "Tu técnica de " + bestD.name.split(" ")[0].toLowerCase() + " es la que deja dinero", bestD.trades + " trades, " + bestD.wr.toFixed(0) + "% WR, " + money(bestD.pnl) + ". Ese es tu edge real: ponle más peso.");
    if (worstD.pnl < 0 && worstD !== bestD) push("improve", "La técnica de " + worstD.name.split(" ")[0].toLowerCase() + " te resta", worstD.trades + " trades con " + money(worstD.pnl) + ". Redúcela o elimínala: el profit extra está en tu otro estilo.");
  }
  if (leftCount > 0 && leftRAvg > 0.15) push("improve", "Profit que dejaste en la mesa", "En " + leftCount + " ganadores cerraste antes del TP dejando en promedio " + leftRAvg.toFixed(2) + "R cada uno. Solo " + fullTP + " de tus " + wins.length + " ganadores alcanzaron el TP ideal: con parciales y trailing, ese R no capturado se convierte en profit.");
  else if (wins.length >= 5 && fullTP >= wins.length * 0.6) push("good", "Ejecución de TP sólida", fullTP + " de " + wins.length + " ganadores alcanzaron su TP ideal. Tu plan de salida se está cumpliendo tal como lo diseñaste.");
  // Giro/reversion vs continuacion (proxy por secuencia de direccion propia)
  if (seqRev.trades >= 3 && seqSameDir.trades >= 3) {
    const revWR = seqRev.wins / seqRev.trades * 100, sameWR = seqSameDir.wins / seqSameDir.trades * 100;
    if (seqRev.pnl > seqSameDir.pnl && seqRev.pnl > 0) push("good", "Tus giros/reversiones funcionan", seqRev.trades + " entradas a contra de tu dirección anterior: " + revWR.toFixed(0) + "% WR y " + money(seqRev.pnl) + ", frente a " + money(seqSameDir.pnl) + " siguiendo la dirección previa (" + sameWR.toFixed(0) + "% WR).");
    else if (seqSameDir.pnl > seqRev.pnl && seqSameDir.pnl > 0) push("good", "La continuación es tu fuerza", seqSameDir.trades + " entradas en la misma dirección previa: " + sameWR.toFixed(0) + "% WR y " + money(seqSameDir.pnl) + ", frente a " + money(seqRev.pnl) + " en giros (" + revWR.toFixed(0) + "% WR).");
    if (seqRev.pnl < 0 && seqRev.trades >= 5) push("improve", "Tus giros/reversiones fallan", seqRev.trades + " entradas contrarias a la dirección previa suman " + money(seqRev.pnl) + " (" + revWR.toFixed(0) + "% WR). Falta confirmación de estructura antes del giro: espera el retroceso completo, no el primer impulso contrario.");
  }

  return {
    stats, equity,
    days: dayMap,
    side, session, hourly, weekday, monthly, symbols,
    crossSessions: { count: cross.count, pnl: cross.pnl, paths: cross.paths, weekend: cross.weekend },
    mc,
    insights,
    balanceNow: balance + net
  };
}

module.exports = { parseTradesFile: extractRows, analyzeTrades, parseNum, parseDate };

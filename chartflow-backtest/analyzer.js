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
      const trades = rowsToTrades(rows);
      if (trades.length) return trades;
    }
    return [];
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
  return out.filter(t => { const k = t.ticket; if (seen.has(k)) return false; seen.add(k); return true; });
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
  const session = bucket(t => { const h = new Date(t.openTs || t.closeTs).getHours(); return (h >= 19 || h < 7) ? "Asia" : (h < 13 ? "Londres" : "New York"); });
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
  // Expectancy
  if (expect > 0) push("good", "Expectancia positiva", "En promedio cada trade aporta " + money(expect) + ". Repetir el proceso es matemáticamente rentable.");
  else if (expect < 0 && pf < 1) push("bad", "Expectancia negativa", "Cada trade te cuesta " + money(expect).replace("-$", "$-") + " en promedio. Antes de escalar tamaño, necesitas un edge demostrado.");

  return {
    stats, equity,
    days: dayMap,
    side, session, hourly, weekday, monthly, symbols,
    insights,
    balanceNow: balance + net
  };
}

module.exports = { parseTradesFile: extractRows, analyzeTrades, parseNum, parseDate };

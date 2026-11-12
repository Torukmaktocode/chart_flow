const http = require("http");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const analyzer = require("./analyzer");

const ROOT = __dirname;
const PORT = 8790;
const CHARTFLOW_PORT = 8780;
const DATA_DIR = path.join(ROOT, "historical-data");
const TRADES_FILE = path.join(ROOT, "trade-records.json");
const EXCEL_DIR = path.join(ROOT, "trade-records");
const EXCEL_FILE = path.join(EXCEL_DIR, "trades.xlsx");

// Timeframe to minutes mapping
const TF_MINUTES = { "1m": 1, "3m": 3, "5m": 5, "10m": 10, "15m": 15, "30m": 30, "1h": 60, "4h": 240 };

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
  if (!(filePath === ROOT || filePath.startsWith(ROOT + path.sep))) {
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
    // También exportar a Excel automáticamente
    exportToExcel(records);
    return true;
  } catch (e) {
    console.error("Error saving trade records:", e.message);
    return false;
  }
}

// Calculate habit and progress stats
function calculateHabitStats(records) {
  if (!records || records.length === 0) {
    return {
      totalDays: 0,
      totalSessions: 0,
      totalTrades: 0,
      winRate: 0,
      totalPnL: 0,
      avgPnL: 0,
      bestDay: 0,
      worstDay: 0,
      currentStreak: 0,
      bestStreak: 0,
      dailyStats: {},
      weeklyStats: {},
      monthlyStats: {},
      hourlyStats: {},
      calendarData: {},
      consecutiveDays: 0,
      avgTradesPerDay: 0,
      consistency: 0
    };
  }

  const dailyStats = {};
  const weeklyStats = {};
  const monthlyStats = {};
  const hourlyStats = {};
  const calendarData = {};

  let totalWins = 0;
  let totalPnL = 0;
  let bestDayPnL = -Infinity;
  let worstDayPnL = Infinity;
  let bestDayDate = '';
  let worstDayDate = '';

  records.forEach(trade => {
    const entryDate = trade.entryTime ? new Date(trade.entryTime) : null;
    if (!entryDate) return;

    const dateKey = entryDate.toISOString().split('T')[0];
    const weekKey = getWeekKey(entryDate);
    const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
    const hour = entryDate.getHours();

    // Daily stats
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = { trades: 0, pnl: 0, wins: 0, losses: 0, sessions: new Set() };
    }
    dailyStats[dateKey].trades++;
    dailyStats[dateKey].pnl += trade.pnl || 0;
    if (trade.pnl > 0) {
      dailyStats[dateKey].wins++;
      totalWins++;
    } else {
      dailyStats[dateKey].losses++;
    }
    // Track unique sessions (trades within 2 hours are same session)
    const sessionHour = Math.floor(entryDate.getHours() / 2) * 2;
    dailyStats[dateKey].sessions.add(sessionHour);

    // Weekly stats
    if (!weeklyStats[weekKey]) {
      weeklyStats[weekKey] = { trades: 0, pnl: 0, wins: 0 };
    }
    weeklyStats[weekKey].trades++;
    weeklyStats[weekKey].pnl += trade.pnl || 0;
    if (trade.pnl > 0) weeklyStats[weekKey].wins++;

    // Monthly stats
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { trades: 0, pnl: 0, wins: 0 };
    }
    monthlyStats[monthKey].trades++;
    monthlyStats[monthKey].pnl += trade.pnl || 0;
    if (trade.pnl > 0) monthlyStats[monthKey].wins++;

    // Hourly stats
    if (!hourlyStats[hour]) {
      hourlyStats[hour] = { trades: 0, pnl: 0, wins: 0 };
    }
    hourlyStats[hour].trades++;
    hourlyStats[hour].pnl += trade.pnl || 0;
    if (trade.pnl > 0) hourlyStats[hour].wins++;

    totalPnL += trade.pnl || 0;

    // Calendar data (intensity based on PnL)
    if (!calendarData[dateKey]) {
      calendarData[dateKey] = { pnl: 0, trades: 0, intensity: 0 };
    }
    calendarData[dateKey].pnl += trade.pnl || 0;
    calendarData[dateKey].trades++;
  });

  // Calculate best/worst days
  Object.entries(dailyStats).forEach(([date, stats]) => {
    if (stats.pnl > bestDayPnL) {
      bestDayPnL = stats.pnl;
      bestDayDate = date;
    }
    if (stats.pnl < worstDayPnL) {
      worstDayPnL = stats.pnl;
      worstDayDate = date;
    }
  });

  // Calculate calendar intensity (0-4 scale)
  const pnlValues = Object.values(calendarData).map(d => d.pnl);
  const maxAbsPnL = Math.max(...pnlValues.map(Math.abs), 1);
  Object.keys(calendarData).forEach(date => {
    const intensity = Math.min(4, Math.floor((Math.abs(calendarData[date].pnl) / maxAbsPnL) * 4));
    calendarData[date].intensity = calendarData[date].pnl >= 0 ? intensity : -intensity;
  });

  // Calculate consecutive days
  const sortedDates = Object.keys(dailyStats).sort();
  let consecutiveDays = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  
  if (sortedDates.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Check if trading today or yesterday
    if (sortedDates.includes(today) || sortedDates.includes(yesterday)) {
      consecutiveDays = 1;
      for (let i = sortedDates.length - 1; i > 0; i--) {
        const curr = new Date(sortedDates[i]);
        const prev = new Date(sortedDates[i - 1]);
        const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
        
        if (diffDays <= 1) {
          consecutiveDays++;
        } else {
          break;
        }
      }
    }
  }

  // Calculate current streak
  if (sortedDates.length > 0) {
    currentStreak = 1;
    for (let i = sortedDates.length - 1; i > 0; i--) {
      const curr = new Date(sortedDates[i]);
      const prev = new Date(sortedDates[i - 1]);
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
      
      if (diffDays <= 1) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        bestStreak = Math.max(bestStreak, currentStreak);
        currentStreak = 1;
      }
    }
    bestStreak = Math.max(bestStreak, currentStreak);
  }

  // Calculate consistency score (0-100)
  const daysWithTrades = Object.keys(dailyStats).length;
  const totalDaysRange = sortedDates.length > 1 
    ? (new Date(sortedDates[sortedDates.length - 1]) - new Date(sortedDates[0])) / (1000 * 60 * 60 * 24) + 1
    : 1;
  const consistency = Math.min(100, Math.round((daysWithTrades / totalDaysRange) * 100));

  // Convert Sets to counts for sessions
  Object.keys(dailyStats).forEach(date => {
    dailyStats[date].sessions = dailyStats[date].sessions.size;
  });

  return {
    totalDays: daysWithTrades,
    totalSessions: Object.values(dailyStats).reduce((sum, d) => sum + d.sessions, 0),
    totalTrades: records.length,
    winRate: records.length > 0 ? (totalWins / records.length * 100).toFixed(1) : 0,
    totalPnL: totalPnL.toFixed(2),
    avgPnL: records.length > 0 ? (totalPnL / records.length).toFixed(2) : 0,
    bestDay: bestDayPnL > -Infinity ? { date: bestDayDate, pnl: bestDayPnL.toFixed(2) } : null,
    worstDay: worstDayPnL < Infinity ? { date: worstDayDate, pnl: worstDayPnL.toFixed(2) } : null,
    currentStreak,
    bestStreak,
    dailyStats,
    weeklyStats,
    monthlyStats,
    hourlyStats,
    calendarData,
    consecutiveDays,
    avgTradesPerDay: daysWithTrades > 0 ? (records.length / daysWithTrades).toFixed(1) : 0,
    consistency
  };
}

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Export trades to Excel
// ============ EXPORT EXCEL ESTILO MI PROGRESO ============
// Fecha REAL de ejecucion (misma cadena que el cliente):
// realClose -> realOpen -> ID t-<Date.now()> -> fecha del sim
function fxRealTS(t) {
  if (t.realClose) return t.realClose;
  if (t.realOpen) return t.realOpen;
  if (typeof t.id === "string" && /^t-\d+$/.test(t.id)) {
    const idTs = +t.id.slice(2);
    if (idTs > 0) return idTs;
  }
  return 0;
}
function fxRealISO(t) {
  const ts = fxRealTS(t);
  if (ts) return new Date(ts).toISOString();
  return t.date || (t.entryTime ? new Date(t.entryTime).toISOString() : null);
}
const fxSessionOf = h => (h >= 19 || h < 7) ? "Asia" : (h < 13 ? "Londres" : "New York");
const FX_GREEN = "FF00A86B", FX_RED = "FFE5484D", FX_AMBER = "FFFFC800";
const FX_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0D12' } };
const FX_HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Consolas' };
const FX_SUB_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10151C' } };
const FX_MONEY = '"$"#,##0.00';
const FX_PCT = '0.00"%"';

function fxStyleHeaderRow(row) {
  row.eachCell(cell => {
    cell.fill = FX_HEADER_FILL;
    cell.font = FX_HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin', color: { argb: 'FF2A2F3A' } }, bottom: { style: 'thin', color: { argb: 'FF2A2F3A' } }, left: { style: 'thin', color: { argb: 'FF2A2F3A' } }, right: { style: 'thin', color: { argb: 'FF2A2F3A' } } };
  });
  row.height = 22;
}
function fxSectionTitle(sheet, row, text, span = 2) {
  sheet.mergeCells(row, 1, row, span);
  const cell = sheet.getCell(row, 1);
  cell.value = text;
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Consolas' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F6BFF' } };
  cell.alignment = { vertical: 'middle' };
  row.height = 18;
}
function fxKv(sheet, row, label, value, { money = false, pct = false, color = null, bold = false } = {}) {
  sheet.getCell(row, 1).value = label;
  sheet.getCell(row, 1).font = { color: { argb: 'FF5F5F68' }, size: 10, name: 'Consolas' };
  const c = sheet.getCell(row, 2);
  c.value = value;
  c.font = { bold: bold || color != null, color: { argb: color || 'FFEEF1FB' }, size: 10, name: 'Consolas' };
  c.alignment = { horizontal: 'right' };
  if (money) c.numFmt = FX_MONEY;
  if (pct) c.numFmt = FX_PCT;
}

async function exportToExcel(records, balance = 100000) {
  try {
    if (!fs.existsSync(EXCEL_DIR)) fs.mkdirSync(EXCEL_DIR, { recursive: true });

    const closed = (records || []).filter(t => t.status === "CLOSED" || t.exitPrice != null)
      .slice().sort((a, b) => (a.exitTime || 0) - (b.exitTime || 0));
    const all = (records || []).slice().sort((a, b) => (a.exitTime || 0) - (b.exitTime || 0));
    const wins = closed.filter(t => t.pnl > 0);
    const losses = closed.filter(t => t.pnl < 0);
    const beTrades = closed.filter(t => Math.abs(t.pnl || 0) < 1e-9);
    const totalPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const gw = wins.reduce((s, t) => s + t.pnl, 0);
    const gl = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = gl > 0 ? gw / gl : (gw > 0 ? Infinity : 0);
    const expectancy = closed.length ? totalPnL / closed.length : 0;
    const avgRVals = closed.map(t => {
      if (!t.sl || !t.entryPrice || t.exitPrice == null) return 0;
      const risk = Math.abs(t.entryPrice - t.sl), rew = Math.abs(t.exitPrice - t.entryPrice);
      return risk > 0 ? rew / risk : 0;
    }).filter(v => v > 0);
    const avgR = avgRVals.length ? avgRVals.reduce((a, b) => a + b, 0) / avgRVals.length : 0;
    // Max drawdown sobre equity ordenada por cierre
    let eq = balance, peak = balance, ddBars = 0, maxDD = 0, maxDDPct = 0, maxDDBars = 0;
    closed.forEach(t => {
      eq += t.pnl || 0;
      if (eq > peak) { peak = eq; ddBars = 0; }
      else { ddBars++; const dd = peak - eq; if (dd > maxDD) { maxDD = dd; maxDDPct = peak > 0 ? dd / peak * 100 : 0; maxDDBars = ddBars; } }
    });
    // Frecuencia + dias reales
    const daySet = new Set(); let firstTs = Infinity, lastTs = -Infinity;
    const byDay = {};
    closed.forEach(t => {
      const iso = fxRealISO(t); if (!iso) return;
      const dk = iso.slice(0, 10);
      daySet.add(dk);
      if (!byDay[dk]) byDay[dk] = { pnl: 0, trades: 0 };
      byDay[dk].pnl += t.pnl || 0; byDay[dk].trades++;
      const ts = fxRealTS(t) || t.entryTime || 0;
      if (ts) { firstTs = Math.min(firstTs, ts); lastTs = Math.max(lastTs, ts); }
    });
    const spanDays = Math.max(1, (lastTs - firstTs) / 86400000);
    const freqD = closed.length / Math.max(1, daySet.size);
    const freqW = closed.length / Math.max(1, spanDays / 7);
    const freqM = closed.length / Math.max(1, spanDays / 30.4);
    let bestDay = null, worstDay = null;
    Object.keys(byDay).forEach(k => {
      if (!bestDay || byDay[k].pnl > byDay[bestDay].pnl) bestDay = k;
      if (!worstDay || byDay[k].pnl < byDay[worstDay].pnl) worstDay = k;
    });
    // Por lado / sesion / hora / dia semana / mes (fecha real)
    const bySide = {};
    closed.forEach(t => {
      const s = t.type || "?";
      if (!bySide[s]) bySide[s] = { trades: 0, wins: 0, pnl: 0 };
      bySide[s].trades++; if (t.pnl > 0) bySide[s].wins++; bySide[s].pnl += t.pnl || 0;
    });
    const bySess = {}, byHour = {}, byDow = {};
    const DOWS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    closed.forEach(t => {
      const s = fxSessionOf(new Date(t.entryTime || 0).getHours());
      if (!bySess[s]) bySess[s] = { trades: 0, wins: 0, pnl: 0 };
      bySess[s].trades++; if (t.pnl > 0) bySess[s].wins++; bySess[s].pnl += t.pnl || 0;
      const h = new Date(t.entryTime || 0).getHours();
      if (!byHour[h]) byHour[h] = { trades: 0, wins: 0, pnl: 0 };
      byHour[h].trades++; if (t.pnl > 0) byHour[h].wins++; byHour[h].pnl += t.pnl || 0;
      const iso = fxRealISO(t); if (!iso) return;
      const dw = new Date(iso).getDay();
      if (!byDow[dw]) byDow[dw] = { trades: 0, wins: 0, pnl: 0 };
      byDow[dw].trades++; if (t.pnl > 0) byDow[dw].wins++; byDow[dw].pnl += t.pnl || 0;
    });
    const byMonth = {};
    closed.forEach(t => {
      const iso = fxRealISO(t); if (!iso) return;
      const k = iso.slice(0, 7);
      if (!byMonth[k]) byMonth[k] = { pnl: 0, trades: 0 };
      byMonth[k].pnl += t.pnl || 0; byMonth[k].trades++;
    });
    const monthKeys = Object.keys(byMonth).sort();
    const yearNow = new Date().getFullYear();
    const ytd = monthKeys.filter(k => k.startsWith(String(yearNow))).reduce((s, k) => s + byMonth[k].pnl, 0);
    // Monte Carlo bootstrap
    const pnls = closed.map(t => t.pnl || 0);
    let mcLine = "Necesita 4+ trades cerrados";
    let mcProbPos = 0;
    if (pnls.length >= 4) {
      const N = 1000; const finals = [];
      for (let s = 0; s < N; s++) {
        let b = balance;
        for (let k = 0; k < pnls.length; k++) b += pnls[Math.floor(Math.random() * pnls.length)];
        finals.push(b);
      }
      finals.sort((a, b) => a - b);
      const p5 = finals[Math.floor(N * .05)], p50 = finals[Math.floor(N * .5)], p95 = finals[Math.floor(N * .95)];
      mcProbPos = (finals.filter(f => f > balance).length / N) * 100;
      mcLine = `p5 $${p5.toFixed(0)} · p50 $${p50.toFixed(0)} · p95 $${p95.toFixed(0)} · prob > balance: ${mcProbPos.toFixed(1)}%`;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ChartFlow Backtest';
    workbook.created = new Date();

    // ---- HOJA RESUMEN (KPIs de MI PROGRESO) ----
    const ws = workbook.addWorksheet('Resumen', { properties: { tabColor: { argb: 'FF2F6BFF' } } });
    ws.columns = [{ width: 34 }, { width: 26 }];
    ws.addRow(['CHARTFLOW BACKTEST - MI PROGRESO', '']);
    ws.mergeCells(1, 1, 1, 2);
    const t1 = ws.getCell(1, 1);
    t1.font = { bold: true, size: 14, color: { argb: 'FFEEF1FB' }, name: 'Consolas' };
    t1.fill = FX_HEADER_FILL;
    t1.alignment = { vertical: 'middle' };
    ws.getRow(1).height = 26;
    let r = 3;
    fxSectionTitle(ws, r, 'GENERAL', 2); r++;
    fxKv(ws, r, 'Capital base', balance, { money: true }); r++;
    fxKv(ws, r, 'P&L Total', totalPnL, { money: true, color: totalPnL >= 0 ? FX_GREEN : FX_RED, bold: true }); r++;
    fxKv(ws, r, 'Ganancia % s/ capital', totalPnL / balance * 100, { pct: true, color: totalPnL >= 0 ? FX_GREEN : FX_RED }); r++;
    fxKv(ws, r, 'Trades cerrados', closed.length); r++;
    fxKv(ws, r, `Ganadores / Perdedores / Breakeven`, `${wins.length} / ${losses.length} / ${beTrades.length}`); r++;
    fxKv(ws, r, 'Win Rate', closed.length ? wins.length / closed.length * 100 : 0, { pct: true, color: closed.length && wins.length / closed.length >= .5 ? FX_GREEN : FX_RED }); r++;
    fxKv(ws, r, 'Profit Factor', pf === Infinity ? '∞' : pf, { color: pf === Infinity || pf >= 1 ? FX_GREEN : FX_RED, bold: true }); r++;
    fxKv(ws, r, 'Expectancy por trade', expectancy, { money: true, color: expectancy >= 0 ? FX_GREEN : FX_RED }); r++;
    fxKv(ws, r, 'Average R (RR real)', avgR, { color: avgR >= 1 ? FX_GREEN : FX_RED }); r++;
    fxSectionTitle(ws, r, 'RIESGO', 2); r++;
    fxKv(ws, r, 'Max Drawdown', -maxDDPct, { pct: true, color: FX_RED }); r++;
    fxKv(ws, r, 'Drawdown $ · duración', `$${maxDD.toFixed(0)} · ${maxDDBars} velas`, { color: FX_RED }); r++;
    fxKv(ws, r, 'Frecuencia (día/sem/mes)', `${freqD.toFixed(1)} / ${freqW.toFixed(1)} / ${freqM.toFixed(1)}`); r++;
    fxSectionTitle(ws, r, 'DÍAS (fecha real)', 2); r++;
    fxKv(ws, r, 'Mejor día', bestDay ? `${new Date(bestDay).toLocaleDateString('es-ES')} · $${byDay[bestDay].pnl.toFixed(2)}` : '-', { color: FX_GREEN }); r++;
    fxKv(ws, r, 'Peor día', worstDay ? `${new Date(worstDay).toLocaleDateString('es-ES')} · $${byDay[worstDay].pnl.toFixed(2)}` : '-', { color: FX_RED }); r++;
    fxKv(ws, r, 'YTD (año actual)', ytd, { money: true, color: ytd >= 0 ? FX_GREEN : FX_RED }); r++;
    fxSectionTitle(ws, r, 'MONTE CARLO (1000 simulaciones)', 2); r++;
    fxKv(ws, r, 'Proyección de balance final', mcLine); r++;
    ws.eachRow(row => {
      if (!row.getCell(2).fill || row.getCell(2).fill.type !== 'pattern') {
        if (row.number % 2 === 0) row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F7F9' } };
      }
    });

    // ---- HOJA TRADES ----
    const tradesCols = [
      { header: 'Simbolo', key: 'symbol', width: 11 },
      { header: 'Lado', key: 'type', width: 8 },
      { header: 'Orden', key: 'orderType', width: 9 },
      { header: 'Entrada', key: 'entryPrice', width: 12 },
      { header: 'Salida', key: 'exitPrice', width: 12 },
      { header: 'SL', key: 'sl', width: 12 },
      { header: 'TP', key: 'tp', width: 12 },
      { header: 'R:R ideal', key: 'rrIdeal', width: 9 },
      { header: 'Lotes', key: 'size', width: 8 },
      { header: 'P&L $', key: 'pnl', width: 12 },
      { header: 'P&L % capital', key: 'pnlPct', width: 12 },
      { header: 'Cierre', key: 'reason', width: 9 },
      { header: 'Duracion', key: 'duration', width: 11 },
      { header: 'Fecha REAL', key: 'realDate', width: 17 },
      { header: 'Fecha sim (vela)', key: 'simDate', width: 17 }
    ];
    function fillTradeSheet(sheet, list, tabColor) {
      const s = workbook.addWorksheet(sheet, { properties: { tabColor: { argb: tabColor } } });
      s.columns = tradesCols;
      list.forEach(t => {
        const dur = (t.entryTime && t.exitTime) ? (() => {
          const h = Math.floor((t.exitTime - t.entryTime) / 3600000), m = Math.floor(((t.exitTime - t.entryTime) % 3600000) / 60000);
          return h > 0 ? `${h}h ${m}m` : `${m}m`;
        })() : '-';
        const rrIdeal = (t.sl && t.entryPrice && t.tp) ? Math.abs(t.tp - t.entryPrice) / Math.abs(t.entryPrice - t.sl) : null;
        const rrTxt = (rrIdeal != null && isFinite(rrIdeal)) ? rrIdeal.toFixed(2) : '-';
        const riso = fxRealISO(t);
        const row = s.addRow({
          symbol: t.symbol || 'N/D',
          type: t.type || '-',
          orderType: t.orderType || '-',
          entryPrice: t.entryPrice, exitPrice: t.exitPrice ?? '-', sl: t.sl ?? '-', tp: t.tp ?? '-',
          rrIdeal: rrTxt,
          size: t.size ?? 1,
          pnl: t.pnl || 0,
          pnlPct: balance > 0 ? (t.pnl || 0) / balance * 100 : 0,
          reason: t.reason || '-',
          duration: dur,
          realDate: riso ? new Date(riso).toLocaleString('es-ES') : '-',
          simDate: t.entryTime ? new Date(t.entryTime).toLocaleString('es-ES') : '-'
        });
        row.getCell('entryPrice').numFmt = '0.00';
        row.getCell('exitPrice').numFmt = '0.00';
        row.getCell('sl').numFmt = '0.00';
        row.getCell('tp').numFmt = '0.00';
        row.getCell('pnl').numFmt = FX_MONEY;
        row.getCell('pnlPct').numFmt = FX_PCT;
        const pc = row.getCell('pnl');
        pc.font = { bold: true, color: { argb: (t.pnl || 0) > 0 ? FX_GREEN : ((t.pnl || 0) < 0 ? FX_RED : FX_AMBER) } };
      });
      fxStyleHeaderRow(s.getRow(1));
      s.views = [{ state: 'frozen', ySplit: 1 }];
      s.autoFilter = { from: 'A1', to: 'O1' };
      return s;
    }
    fillTradeSheet('Trades', all, 'FF2F6BFF');
    fillTradeSheet('Ganadores', wins, FX_GREEN);
    fillTradeSheet('Perdedores', losses, FX_RED);

    // ---- HOJA CALENDARIO (dias reales) ----
    const cal = workbook.addWorksheet('Calendario', { properties: { tabColor: { argb: FX_AMBER } } });
    cal.columns = [{ header: 'Fecha', key: 'd', width: 14 }, { header: 'Trades', key: 't', width: 9 }, { header: 'P&L $', key: 'p', width: 13 }, { header: 'P&L % capital', key: 'pc', width: 13 }, { header: 'Resultado', key: 'r', width: 12 }];
    Object.keys(byDay).sort().reverse().forEach(k => {
      const d = byDay[k];
      const res = d.pnl > 0 ? 'PROFIT' : (d.pnl < 0 ? 'PÉRDIDA' : 'BREAKEVEN');
      const row = cal.addRow({ d: new Date(k + 'T12:00:00').toLocaleDateString('es-ES'), t: d.trades, p: d.pnl, pc: d.pnl / balance * 100, r: res });
      row.getCell('p').numFmt = FX_MONEY; row.getCell('pc').numFmt = FX_PCT;
      row.getCell('p').font = { bold: true, color: { argb: d.pnl > 0 ? FX_GREEN : (d.pnl < 0 ? FX_RED : FX_AMBER) } };
      row.getCell('r').font = { color: { argb: d.pnl > 0 ? FX_GREEN : (d.pnl < 0 ? FX_RED : FX_AMBER) } };
    });
    fxStyleHeaderRow(cal.getRow(1));
    cal.views = [{ state: 'frozen', ySplit: 1 }];

    // ---- HOJA PERFORMANCE (lado/sesion/hora/dia/mes) ----
    const perf = workbook.addWorksheet('Performance', { properties: { tabColor: { argb: 'FF00D4FF' } } });
    perf.columns = [{ width: 22 }, { width: 10 }, { width: 10 }, { width: 14 }];
    let pr = 1;
    function perfBlock(title, rows, labels) {
      fxSectionTitle(perf, pr, title, 4); pr++;
      perf.getRow(pr).values = ['', ...labels];
      fxStyleHeaderRow(perf.getRow(pr)); pr++;
      rows.forEach(([name, d]) => {
        const wr = d.trades ? d.wins / d.trades * 100 : 0;
        const row = perf.addRow([name, d.trades, wr, d.pnl]);
        row.getCell(3).numFmt = FX_PCT;
        row.getCell(4).numFmt = FX_MONEY;
        row.getCell(4).font = { bold: true, color: { argb: d.pnl > 0 ? FX_GREEN : (d.pnl < 0 ? FX_RED : FX_AMBER) } };
        pr++;
      });
      pr++;
    }
    perfBlock('POR LADO', Object.keys(bySide).map(k => [k === 'LONG' ? '▲ LONG' : '▼ SHORT', bySide[k]]), ['Trades', 'Win Rate', 'P&L $']);
    perfBlock('POR SESIÓN', ['Asia', 'Londres', 'New York'].map(k => [k, bySess[k] || { trades: 0, wins: 0, pnl: 0 }]), ['Trades', 'Win Rate', 'P&L $']);
    perfBlock('POR HORA', Object.keys(byHour).map(Number).sort((a, b) => a - b).map(h => [String(h).padStart(2, '0') + ':00', byHour[h]]), ['Trades', 'Win Rate', 'P&L $']);
    perfBlock('POR DÍA DE SEMANA', [1, 2, 3, 4, 5, 6, 0].filter(d => byDow[d]).map(d => [DOWS[d], byDow[d]]), ['Trades', 'Win Rate', 'P&L $']);
    perfBlock('POR MES (fecha real)', monthKeys.map(k => [k, byMonth[k]]), ['Trades', 'Win Rate', 'P&L $']);
    fxSectionTitle(perf, pr, 'MONTE CARLO · 1000 SIMULACIONES', 4); pr++;
    perf.getCell(pr, 1).value = mcLine;
    perf.getCell(pr, 1).font = { name: 'Consolas', size: 10, color: { argb: 'FFEEF1FB' } };

    // Guardar archivo
    await workbook.xlsx.writeFile(EXCEL_FILE);
    console.log(`Excel exportado (estilo MI PROGRESO): ${EXCEL_FILE}`);
    return true;
  } catch (e) {
    console.error("Error exporting to Excel:", e.message);
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

// Cache en memoria de los archivos historicos (antes se re-leia y re-parseaba
// un JSON de ~2MB con readFileSync en CADA peticion)
const dataCache = new Map(); // key: symbol|tf -> {mtime, candles}
function loadYearFileCached(filePath) {
  let entry = dataCache.get(filePath);
  const mtime = fs.statSync(filePath).mtimeMs;
  if (!entry || entry.mtime !== mtime) {
    entry = { mtime, candles: JSON.parse(fs.readFileSync(filePath, "utf8")) };
    dataCache.set(filePath, entry);
  }
  return entry.candles;
}

// Load local historical data for a symbol and timeframe
function loadLocalData(symbol, tf, fromTs, toTs, count) {
  try {
    const filePath = path.join(DATA_DIR, symbol, `${tf}.json`);
    if (!fs.existsSync(filePath)) return null;
    
    let candles = loadYearFileCached(filePath);
    if (!candles || candles.length < 2) return null;
    
    // Filter by date range if provided
    if (fromTs) candles = candles.filter(c => c.t >= fromTs);
    if (toTs) candles = candles.filter(c => c.t <= toTs);
    
    // Limitar la cantidad devuelta (count = ultimas N velas del rango)
    if (count > 0 && candles.length > count) {
      candles = candles.slice(candles.length - count);
    }
    
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

// Cobertura real de datos para avisar al usuario cuando el rango no cruza nada
function localCoverage(symbol, tf) {
  try {
    const filePath = path.join(DATA_DIR, symbol, `${tf}.json`);
    if (!fs.existsSync(filePath)) return null;
    const candles = loadYearFileCached(filePath);
    if (!candles || !candles.length) return null;
    return { first: candles[0].t, last: candles[candles.length - 1].t, total: candles.length };
  } catch { return null; }
}

// Try to serve from local data first, then proxy to ChartFlow
function handleChartRequest(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const symbol = url.searchParams.get("symbol") || "NAS100";
  const tf = url.searchParams.get("tf") || "5m";
  const fromTs = parseInt(url.searchParams.get("from")) || 0;
  const toTs = parseInt(url.searchParams.get("to")) || 0;
  const count = parseInt(url.searchParams.get("count")) || 0;

  const filePath = path.join(DATA_DIR, symbol, `${tf}.json`);

  // Try local data first (count: ultimas N velas del rango; el cliente pide 5000)
  const localData = loadLocalData(symbol, tf, fromTs, toTs, count);
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

  // Si el archivo local EXISTE pero el rango no cruza datos, NO salgas al proxy:
  // responde con la cobertura real para que la UI avise con fechas exactas
  if (fs.existsSync(filePath)) {
    const cov = localCoverage(symbol, tf);
    console.log(`📁 Local sin velas en rango: ${symbol} ${tf} | cobertura: ${cov ? new Date(cov.first).toISOString().slice(0, 10) + " → " + new Date(cov.last).toISOString().slice(0, 10) : "?"}`);
    sendJson(res, 200, {
      symbol,
      label: symbol,
      timeframe: tf,
      source: "local",
      candles: [],
      coverage: cov,
      hint: "El rango pedido no cruza los datos descargados. Ejecuta node download-history.js para refrescar.",
    });
    return;
  }

  // Agregacion desde una TF base local: 10m <- 5m x2, 4h <- 1h x4, 3m <- 1m x3
  // (permite replay en TFs que no tienen archivo propio usando los datos descargados)
  const AGG_FROM = { "10m": "5m", "4h": "1h", "3m": "1m" };
  const baseTf = AGG_FROM[tf];
  if (baseTf) {
    const baseMinutes = TF_MINUTES[baseTf] || 5;
    const targetMinutes = TF_MINUTES[tf] || 5;
    const ratio = Math.max(1, Math.round(targetMinutes / baseMinutes));
    const baseFilePath = path.join(DATA_DIR, symbol, `${baseTf}.json`);
    if (fs.existsSync(baseFilePath)) {
      const need = (count > 0 ? count : 2000) * ratio + ratio * 10;
      const baseCandles = loadLocalData(symbol, baseTf, fromTs, toTs, need);
      if (baseCandles && baseCandles.length >= ratio * 2) {
        let agg = aggregate(baseCandles, targetMinutes);
        if (count > 0 && agg.length > count) agg = agg.slice(agg.length - count);
        if (agg.length >= 2) {
          console.log(`📁 Local agregada: ${symbol} ${baseTf} x${ratio} → ${tf} = ${agg.length} velas`);
          sendJson(res, 200, {
            symbol,
            label: symbol,
            timeframe: tf,
            source: `local-agg:${baseTf}`,
            candles: agg,
          });
          return;
        }
      }
    }
  }

  // Fallback to ChartFlow proxy (solo si el par simbolo/tf local no existe)
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
        let data;
        try {
          data = loadYearFileCached(path.join(symDir, f));
        } catch (e) {
          continue;
        }
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

const server = http.createServer(async (req, res) => {
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
    if (url.pathname === "/api/download-excel") {
      // Regenerar el Excel al momento (con el balance real de la sesion) y descargarlo
      const records = loadTradeRecords();
      if (!records.length) {
        sendJson(res, 404, { error: "No hay trades para exportar" });
        return;
      }
      const bal = parseFloat(url.searchParams.get("bal")) || 100000;
      await exportToExcel(records, bal);
      if (fs.existsSync(EXCEL_FILE)) {
        res.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=chartflow-progreso.xlsx",
          "Cache-Control": "no-store"
        });
        fs.createReadStream(EXCEL_FILE).pipe(res);
      } else {
        sendJson(res, 500, { error: "No se pudo generar el Excel" });
      }
      return;
    }
    if (url.pathname === "/api/analyze") {
      // ANALIZADOR: sube un historial MT4/MT5 (xlsx/html/csv) y recibe el
      // analisis completo estilo MI PROGRESO con diagnostico de tu operativa
      const chunks = [];
      let size = 0;
      req.on("data", c => {
        size += c.length;
        if (size > 30 * 1024 * 1024) { req.destroy(); return; }
        chunks.push(c);
      });
      req.on("end", async () => {
        try {
          const buf = Buffer.concat(chunks);
          const fname = url.searchParams.get("name") || "report.xlsx";
          const bal = parseFloat(url.searchParams.get("bal")) || 10000;
          const trades = await analyzer.parseTradesFile(buf, fname);
          if (!trades.length) {
            sendJson(res, 400, { error: "No se detectaron trades cerrados en el archivo. Revisa que sea un historial exportado de MT4/MT5 (Statement, historial de cuenta)." });
            return;
          }
          sendJson(res, 200, analyzer.analyzeTrades(trades, bal));
        } catch (e) {
          sendJson(res, 500, { error: String(e.message || e) });
        }
      });
      return;
    }
    if (url.pathname === "/api/habit-stats") {
      // Estadísticas de hábitos y progreso
      const records = loadTradeRecords();
      const stats = calculateHabitStats(records);
      sendJson(res, 200, stats);
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

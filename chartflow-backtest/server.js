const http = require("http");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const ROOT = __dirname;
const PORT = 8790;
const CHARTFLOW_PORT = 8780;
const DATA_DIR = path.join(ROOT, "historical-data");
const TRADES_FILE = path.join(ROOT, "trade-records.json");
const EXCEL_DIR = path.join(ROOT, "trade-records");
const EXCEL_FILE = path.join(EXCEL_DIR, "trades.xlsx");

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
async function exportToExcel(records) {
  try {
    // Crear directorio si no existe
    if (!fs.existsSync(EXCEL_DIR)) {
      fs.mkdirSync(EXCEL_DIR, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ChartFlow Backtest';
    workbook.created = new Date();

    // Hoja de resumen
    const summarySheet = workbook.addWorksheet('Resumen', {
      properties: { tabColor: { argb: '00D4FF' } }
    });

    // Estilo del encabezado
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '00D4FF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    // Encabezados de resumen
    summarySheet.columns = [
      { header: 'Métrica', key: 'metric', width: 25 },
      { header: 'Valor', key: 'value', width: 20 }
    ];

    // Calcular métricas
    const totalTrades = records.length;
    const wins = records.filter(t => t.pnl > 0);
    const losses = records.filter(t => t.pnl <= 0);
    const winRate = totalTrades > 0 ? (wins.length / totalTrades * 100).toFixed(1) : 0;
    const totalPnL = records.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : avgWin > 0 ? Infinity : 0;
    const expectancy = totalTrades > 0 ? totalPnL / totalTrades : 0;

    // Agregar métricas
    const metrics = [
      { metric: 'Fecha de Exportación', value: new Date().toLocaleString('es-ES') },
      { metric: 'Total de Trades', value: totalTrades },
      { metric: 'Trades Ganadores', value: wins.length },
      { metric: 'Trades Perdedores', value: losses.length },
      { metric: 'Win Rate', value: winRate + '%' },
      { metric: 'P&L Total', value: '$' + totalPnL.toFixed(2) },
      { metric: 'Promedio Ganancia', value: '$' + avgWin.toFixed(2) },
      { metric: 'Promedio Pérdida', value: '$' + avgLoss.toFixed(2) },
      { metric: 'Profit Factor', value: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2) },
      { metric: 'Expectancy', value: '$' + expectancy.toFixed(2) }
    ];

    metrics.forEach(m => summarySheet.addRow(m));

    // Estilo para las métricas
    summarySheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell(cell => {
          cell.font = headerStyle.font;
          cell.fill = headerStyle.fill;
          cell.alignment = headerStyle.alignment;
          cell.border = headerStyle.border;
        });
      } else {
        row.getCell(1).font = { bold: true };
        row.getCell(2).alignment = { horizontal: 'right' };
      }
    });

    // Hoja de todos los trades
    const tradesSheet = workbook.addWorksheet('Todos los Trades', {
      properties: { tabColor: { argb: '00E5A0' } }
    });

    tradesSheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Tipo', key: 'type', width: 10 },
      { header: 'Par', key: 'symbol', width: 12 },
      { header: 'Timeframe', key: 'timeframe', width: 10 },
      { header: 'Precio Entrada', key: 'entryPrice', width: 15 },
      { header: 'Precio Salida', key: 'exitPrice', width: 15 },
      { header: 'Stop Loss', key: 'sl', width: 12 },
      { header: 'Take Profit', key: 'tp', width: 12 },
      { header: 'Tamaño', key: 'size', width: 10 },
      { header: 'P&L ($)', key: 'pnl', width: 12 },
      { header: 'P&L (%)', key: 'pnlPercent', width: 12 },
      { header: 'Razón Cierre', key: 'reason', width: 15 },
      { header: 'Fecha Entrada', key: 'entryTime', width: 20 },
      { header: 'Fecha Salida', key: 'exitTime', width: 20 },
      { header: 'Duración', key: 'duration', width: 15 }
    ];

    // Agregar trades con estilo
    records.forEach(trade => {
      const entryDate = trade.entryTime ? new Date(trade.entryTime) : null;
      const exitDate = trade.exitTime ? new Date(trade.exitTime) : null;
      let duration = '-';
      if (entryDate && exitDate) {
        const diff = exitDate - entryDate;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }

      const pnlPercent = trade.entryPrice > 0 ? ((trade.pnl / (trade.entryPrice * trade.size)) * 100).toFixed(2) : 0;

      tradesSheet.addRow({
        id: trade.id,
        type: trade.type,
        symbol: trade.symbol || '-',
        timeframe: trade.timeframe || '-',
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice || '-',
        sl: trade.sl || '-',
        tp: trade.tp || '-',
        size: trade.size,
        pnl: trade.pnl || 0,
        pnlPercent: pnlPercent + '%',
        reason: trade.reason || '-',
        entryTime: entryDate ? entryDate.toLocaleString('es-ES') : '-',
        exitTime: exitDate ? exitDate.toLocaleString('es-ES') : '-',
        duration: duration
      });
    });

    // Estilo de encabezados para hoja de trades
    tradesSheet.getRow(1).eachCell(cell => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
      cell.alignment = headerStyle.alignment;
      cell.border = headerStyle.border;
    });

    // Colorear filas según P&L
    tradesSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const pnlCell = row.getCell('pnl');
        const pnlValue = pnlCell.value;
        if (pnlValue > 0) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E6FFE6' } };
          });
          pnlCell.font = { color: { argb: '006600' }, bold: true };
        } else if (pnlValue < 0) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6' } };
          });
          pnlCell.font = { color: { argb: 'CC0000' }, bold: true };
        }
      }
    });

    // Hoja de trades ganadores
    const winnersSheet = workbook.addWorksheet('Ganadores', {
      properties: { tabColor: { argb: '00E5A0' } }
    });
    winnersSheet.columns = tradesSheet.columns;
    wins.forEach(trade => winnersSheet.addRow(trade));
    winnersSheet.getRow(1).eachCell(cell => {
      cell.font = headerStyle.font;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00E5A0' } };
      cell.alignment = headerStyle.alignment;
      cell.border = headerStyle.border;
    });

    // Hoja de trades perdedores
    const losersSheet = workbook.addWorksheet('Perdedores', {
      properties: { tabColor: { argb: 'FF3355' } }
    });
    losersSheet.columns = tradesSheet.columns;
    losses.forEach(trade => losersSheet.addRow(trade));
    losersSheet.getRow(1).eachCell(cell => {
      cell.font = headerStyle.font;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3355' } };
      cell.alignment = headerStyle.alignment;
      cell.border = headerStyle.border;
    });

    // Guardar archivo
    await workbook.xlsx.writeFile(EXCEL_FILE);
    console.log(`📊 Excel exportado: ${EXCEL_FILE}`);
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
    if (url.pathname === "/api/download-excel") {
      // Descargar archivo Excel
      if (fs.existsSync(EXCEL_FILE)) {
        res.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=trades-backtest.xlsx",
          "Cache-Control": "no-store"
        });
        fs.createReadStream(EXCEL_FILE).pipe(res);
      } else {
        sendJson(res, 404, { error: "No hay trades para exportar" });
      }
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

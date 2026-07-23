export const REPLAY_SPEEDS = [
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "15s", value: 15000 },
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
  { label: "3m", value: 180000 },
  { label: "5m", value: 300000 },
  { label: "10m", value: 600000 },
];

export const TIMEFRAMES = ["5s", "1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"];

export const ASSETS = ["NAS100USD", "US30USD", "SPX500USD", "EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "BTCUSDT.P", "ETHUSDT.P", "SOLUSDT.P"];

export function generateMockCandles(count = 500, startPrice = 19500) {
  const candles = [];
  let price = startPrice;
  const now = new Date("2026-01-01T00:00:00Z").getTime();

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * price * 0.003;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * price * 0.002;
    const low = Math.min(open, close) - Math.random() * price * 0.002;
    candles.push({
      time: new Date(now + i * 1800000).toISOString(),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(Math.random() * 10000) + 1000,
    });
    price = close;
  }
  return candles;
}

export function filterCandlesByDateRange({ candles, startDate, endDate, startTime, endTime }) {
  const start = new Date(startTime ? `${startDate}T${startTime}:00` : `${startDate}T00:00:00`);
  const end = new Date(endTime ? `${endDate}T${endTime}:00` : `${endDate}T23:59:59`);

  return candles.filter((candle) => {
    const candleTime = new Date(candle.time);
    return candleTime >= start && candleTime <= end;
  });
}

export function validateBacktestDateRange({ startDate, endDate, startTime, endTime }) {
  const start = new Date(startTime ? `${startDate}T${startTime}:00` : `${startDate}T00:00:00`);
  const end = new Date(endTime ? `${endDate}T${endTime}:00` : `${endDate}T23:59:59`);

  if (start >= end) {
    return { valid: false, message: "La fecha inicial debe ser menor que la fecha final." };
  }
  return { valid: true, message: "" };
}

export function calculateBacktestStats(trades) {
  const closedTrades = trades.filter((t) => t.status === "closed");
  const winners = closedTrades.filter((t) => (t.pnl || 0) > 0);
  const losers = closedTrades.filter((t) => (t.pnl || 0) < 0);
  const breakeven = closedTrades.filter((t) => (t.pnl || 0) === 0);

  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossProfit = winners.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + (t.pnl || 0), 0));
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgWin = winners.length > 0 ? grossProfit / winners.length : 0;
  const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0;
  const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

  const buyTrades = closedTrades.filter((t) => t.side === "buy");
  const sellTrades = closedTrades.filter((t) => t.side === "sell");
  const buyWins = buyTrades.filter((t) => (t.pnl || 0) > 0);
  const sellWins = sellTrades.filter((t) => (t.pnl || 0) > 0);

  return {
    totalTrades: closedTrades.length,
    winners: winners.length,
    losers: losers.length,
    breakeven: breakeven.length,
    winRate,
    totalPnl,
    grossProfit,
    grossLoss,
    profitFactor,
    averageWin: avgWin,
    averageLoss: avgLoss,
    expectancy,
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    buyWinRate: buyTrades.length > 0 ? (buyWins.length / buyTrades.length) * 100 : 0,
    sellWinRate: sellTrades.length > 0 ? (sellWins.length / sellTrades.length) * 100 : 0,
  };
}

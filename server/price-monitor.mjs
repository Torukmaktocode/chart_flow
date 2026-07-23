import yahooFinance from 'yahoo-finance2';
import alertManager from './alert-manager.mjs';

// Mapeo de símbolos a Yahoo Finance
const SYMBOL_MAP = {
  // Índices
  'NAS100': '^NDX',
  'NASDAQ': '^NDX',
  'US30': '^DJI',
  'DJI': '^DJI',
  'US500': '^GSPC',
  'SPX': '^GSPC',
  
  // Forex
  'EURUSD': 'EURUSD=X',
  'GBPUSD': 'GBPUSD=X',
  'USDJPY': 'USDJPY=X',
  'USDCLP': 'USDCLP=X',
  
  // Crypto
  'BTC': 'BTC-USD',
  'ETH': 'ETH-USD',
  'SOL': 'SOL-USD',
  
  // Commodities
  'XAUUSD': 'GC=F',
  'GOLD': 'GC=F',
  'SILVER': 'SI=F',
  
  // ETFs y otros
  'SPY': 'SPY',
  'QQQ': 'QQQ',
  'DXY': 'DX-Y.NYB',
  'VIX': '^VIX',
};

// Cache de precios
const priceCache = new Map();
const lastFetchTime = new Map();
const CACHE_TTL = 30000; // 30 segundos

// Obtener precio actual
async function getCurrentPrice(symbol) {
  const now = Date.now();
  const lastFetch = lastFetchTime.get(symbol) || 0;
  
  // Usar cache si está fresco
  if (now - lastFetch < CACHE_TTL && priceCache.has(symbol)) {
    return priceCache.get(symbol);
  }
  
  try {
    const yahooSymbol = SYMBOL_MAP[symbol.toUpperCase()] || symbol;
    const quote = await yahooFinance.quote(yahooSymbol);
    
    if (quote && quote.regularMarketPrice) {
      const priceData = {
        symbol: symbol.toUpperCase(),
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        high: quote.regularMarketDayHigh || quote.regularMarketPrice,
        low: quote.regularMarketDayLow || quote.regularMarketPrice,
        volume: quote.regularMarketVolume || 0,
        timestamp: now,
      };
      
      priceCache.set(symbol, priceData);
      lastFetchTime.set(symbol, now);
      
      return priceData;
    }
  } catch (error) {
    console.error(`Error obteniendo precio de ${symbol}:`, error.message);
  }
  
  return null;
}

// Verificar todas las alertas
async function checkAlerts() {
  const activeAlerts = alertManager.getActiveAlerts();
  
  if (activeAlerts.length === 0) {
    return;
  }
  
  console.log(`🔍 Verificando ${activeAlerts.length} alertas activas...`);
  
  // Agrupar por símbolo para evitar múltiples llamadas
  const alertsBySymbol = {};
  for (const alert of activeAlerts) {
    if (!alertsBySymbol[alert.symbol]) {
      alertsBySymbol[alert.symbol] = [];
    }
    alertsBySymbol[alert.symbol].push(alert);
  }
  
  // Verificar cada símbolo
  for (const [symbol, alerts] of Object.entries(alertsBySymbol)) {
    try {
      const priceData = await getCurrentPrice(symbol);
      
      if (!priceData) {
        console.log(`⚠️ No se pudo obtener precio para ${symbol}`);
        continue;
      }
      
      console.log(`💰 ${symbol}: $${priceData.price} (${priceData.changePercent >= 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%)`);
      
      // Verificar cada alerta para este símbolo
      for (const alert of alerts) {
        if (alertManager.shouldTrigger(alert, priceData.price)) {
          console.log(`🔔 ¡ALERTA ACTIVADA! ${symbol} ${alert.direction === 'above' ? '≥' : '≤'} $${alert.targetPrice}`);
          
          // Formatear mensaje
          const message = alertManager.formatAlertMessage(alert, priceData.price);
          
          // Notificar
          alertManager.notify(alert, priceData.price, message);
          
          // Marcar como activada
          alertManager.markTriggered(alert.id);
        }
      }
    } catch (error) {
      console.error(`Error verificando alertas para ${symbol}:`, error.message);
    }
  }
}

// Iniciar monitoreo de precios
let monitorInterval = null;

function startPriceMonitor(intervalMs = 30000) {
  if (monitorInterval) {
    console.log('⚠️ El monitor de precios ya está ejecutándose');
    return;
  }
  
  console.log(`🚀 Iniciando monitor de precios (cada ${intervalMs / 1000} segundos)`);
  
  // Verificar inmediatamente
  checkAlerts();
  
  // Programar verificaciones periódicas
  monitorInterval = setInterval(checkAlerts, intervalMs);
  
  // Limpiar alertas antiguas al iniciar
  alertManager.cleanOldTriggeredAlerts();
}

// Detener monitoreo de precios
function stopPriceMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('⏹️ Monitor de precios detenido');
  }
}

// Obtener estado del monitor
function getMonitorStatus() {
  return {
    isRunning: monitorInterval !== null,
    activeAlerts: alertManager.getActiveAlerts().length,
    totalAlerts: alertManager.getAllAlerts().length,
    cachedPrices: priceCache.size,
  };
}

export {
  getCurrentPrice,
  checkAlerts,
  startPriceMonitor,
  stopPriceMonitor,
  getMonitorStatus,
  SYMBOL_MAP,
};
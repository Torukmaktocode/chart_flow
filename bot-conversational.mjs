import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ Define TELEGRAM_BOT_TOKEN en .env"); process.exit(1); }

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!CHAT_ID) { console.error("❌ Define TELEGRAM_CHAT_ID en .env"); process.exit(1); }
const ALERTS_FILE = path.join(__dirname, 'data', 'alerts.json');
const DASHBOARD_API = "http://127.0.0.1:8780/api";

console.log('🚀 BOT CONVERSACIONAL - PRECIOS REALES');
console.log('='.repeat(50));

// ============================================
// 💾 ESTADO DEL USUARIO
// ============================================
const userStates = new Map();

const STATES = {
  IDLE: 'idle',
  WAITING_SYMBOL: 'waiting_symbol',
  WAITING_PRICE: 'waiting_price',
  WAITING_DIRECTION: 'waiting_direction',
};

// ============================================
// 📊 SÍMBOLOS
// ============================================
const SYMBOLS = {
  'BTC': { name: 'Bitcoin', emoji: '🪙', api: 'BTC' },
  'BITCOIN': { name: 'Bitcoin', emoji: '🪙', api: 'BTC', symbol: 'BTC' },
  'BTCUSD': { name: 'Bitcoin', emoji: '🪙', api: 'BTC', symbol: 'BTC' },
  'ETH': { name: 'Ethereum', emoji: '💎', api: 'ETHUSDT_P' },
  'ETHEREUM': { name: 'Ethereum', emoji: '💎', api: 'ETHUSDT_P', symbol: 'ETH' },
  'ETHUSDT': { name: 'Ethereum', emoji: '💎', api: 'ETHUSDT_P', symbol: 'ETH' },
  'SOL': { name: 'Solana', emoji: '☀️', api: 'SOLUSDT_P' },
  'SOLANA': { name: 'Solana', emoji: '☀️', api: 'SOLUSDT_P', symbol: 'SOL' },
  'XRP': { name: 'Ripple', emoji: '🌊', api: 'BTC' }, // Placeholder
  'DOGE': { name: 'Dogecoin', emoji: '🐕', api: 'BTC' }, // Placeholder
  'BNB': { name: 'Binance', emoji: '🟡', api: 'BTC' }, // Placeholder
  'NAS100': { name: 'NASDAQ 100', emoji: '🏛️', api: 'NAS100' },
  'NASDAQ': { name: 'NASDAQ 100', emoji: '🏛️', api: 'NAS100', symbol: 'NAS100' },
  'US30': { name: 'Dow Jones', emoji: '🏛️', api: 'US30' },
  'DOW': { name: 'Dow Jones', emoji: '🏛️', api: 'US30', symbol: 'US30' },
  'US500': { name: 'S&P 500', emoji: '🏛️', api: 'US500' },
  'SP500': { name: 'S&P 500', emoji: '🏛️', api: 'US500', symbol: 'US500' },
  'EURUSD': { name: 'Euro/Dólar', emoji: '💱', api: 'EURUSD' },
  'GBPUSD': { name: 'Libra/Dólar', emoji: '💱', api: 'EURUSD' }, // Placeholder
  'USDJPY': { name: 'Dólar/Yen', emoji: '💱', api: 'EURUSD' }, // Placeholder
  'USDCLP': { name: 'Dólar/Peso CL', emoji: '💱', api: 'EURUSD' }, // Placeholder
  'XAUUSD': { name: 'Oro', emoji: '🥇', api: 'XAUUSD' },
  'ORO': { name: 'Oro', emoji: '🥇', api: 'XAUUSD', symbol: 'XAUUSD' },
  'GOLD': { name: 'Oro', emoji: '🥇', api: 'XAUUSD', symbol: 'XAUUSD' },
  'XAGUSD': { name: 'Plata', emoji: '🥈', api: 'XAUUSD' }, // Placeholder
  'PLATA': { name: 'Plata', emoji: '🥈', api: 'XAUUSD', symbol: 'XAGUSD' },
  'DXY': { name: 'Índice Dólar', emoji: '💵', api: 'DXY' },
  'VIX': { name: 'Índice Miedo', emoji: '📉', api: 'VIX' },
};

// ============================================
// 📈 CACHE DE PRECIOS
// ============================================
const priceCache = new Map();
const CACHE_TTL = 60000; // 60 segundos

async function getRealPrice(symbolKey) {
  const now = Date.now();
  
  // Verificar cache
  const cached = priceCache.get(symbolKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  const symbolInfo = SYMBOLS[symbolKey];
  if (!symbolInfo) {
    return null;
  }
  
  const apiSymbol = symbolInfo.api || symbolKey;
  
  try {
    // Obtener datos del servidor NAS100
    const response = await fetch(`${DASHBOARD_API}/chart?tf=1D&symbol=${apiSymbol}&count=10`);
    const data = await response.json();
    
    if (data.candles && data.candles.length > 0) {
      const lastCandle = data.candles[data.candles.length - 1];
      const prevCandle = data.candles.length > 1 ? data.candles[data.candles.length - 2] : null;
      
      // Calcular rango del día
      const todayCandles = data.candles.filter(c => {
        const candleDate = new Date(c.t);
        const today = new Date();
        return candleDate.toDateString() === today.toDateString();
      });
      
      let dayHigh = lastCandle.h;
      let dayLow = lastCandle.l;
      
      if (todayCandles.length > 0) {
        dayHigh = Math.max(...todayCandles.map(c => c.h));
        dayLow = Math.min(...todayCandles.map(c => c.l));
      }
      
      const price = lastCandle.c;
      const prevClose = prevCandle ? prevCandle.c : price;
      const change = price - prevClose;
      const changePercent = prevClose ? (change / prevClose) * 100 : 0;
      
      const priceData = {
        price: price,
        dayHigh: dayHigh,
        dayLow: dayLow,
        change: change,
        changePercent: changePercent,
        timestamp: now,
      };
      
      // Guardar en cache
      priceCache.set(symbolKey, { data: priceData, timestamp: now });
      
      console.log(`📊 ${symbolKey}: $${priceData.price} (High: $${dayHigh}, Low: $${dayLow})`);
      
      return priceData;
    }
  } catch (error) {
    console.error(`Error obteniendo precio de ${symbolKey}:`, error.message);
  }
  
  return null;
}

// Formatear precio
function formatPrice(value) {
  if (value == null || isNaN(value)) return '---';
  if (value < 1) return value.toFixed(4);
  if (value < 10) return value.toFixed(2);
  if (value < 100) return value.toFixed(2);
  if (value < 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ============================================
// 🔍 PARSEO INTELIGENTE
// ============================================
function parseMessage(text) {
  const lower = text.toLowerCase().trim();
  
  let detectedSymbol = null;
  for (const [key, info] of Object.entries(SYMBOLS)) {
    if (lower.includes(key.toLowerCase())) {
      detectedSymbol = {
        key: info.symbol || key,
        ...info,
      };
      break;
    }
  }
  
  let detectedPrice = null;
  const priceMatch = text.match(/\$?\s*(\d[\d,.]*)/);
  if (priceMatch) {
    detectedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
  }
  
  let direction = null;
  if (lower.match(/arriba|suba|sube|supere|supera|encima|sobre/)) direction = 'above';
  if (lower.match(/abajo|baje|baja|debajo|menos|bajo/)) direction = 'below';
  
  let intent = null;
  if (lower.match(/crea|activa|genera|agrega|nueva?|quiero|dame|pon|avisa|notifica/)) intent = 'create';
  if (lower.match(/ver|lista|mostrar|cuales|cuántas|tus/)) intent = 'list';
  if (lower.match(/elimina|borra|cancela|quita|remueve/)) intent = 'delete';
  if (lower.match(/ayuda|help|comando|opciones/)) intent = 'help';
  
  return { detectedSymbol, detectedPrice, direction, intent, raw: text };
}

// ============================================
// 📁 GESTIÓN DE ALERTAS
// ============================================
function loadAlerts() {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  return [];
}

function saveAlerts(alerts) {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
    return true;
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

function createAlert(symbol, targetPrice, direction) {
  const alerts = loadAlerts();
  
  const newAlert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    symbol: symbol,
    targetPrice: parseFloat(targetPrice),
    direction: direction,
    message: `Alerta: ${symbol} ${direction === 'above' ? 'supera' : 'baja de'} $${targetPrice}`,
    chatId: CHAT_ID,
    active: true,
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    repeat: false
  };
  
  alerts.push(newAlert);
  saveAlerts(alerts);
  
  return newAlert;
}

function deleteAlert(alertId) {
  const alerts = loadAlerts();
  const index = alerts.findIndex(a => a.id === alertId || a.id.endsWith(alertId));
  
  if (index !== -1) {
    const deleted = alerts.splice(index, 1)[0];
    saveAlerts(alerts);
    return deleted;
  }
  return null;
}

// ============================================
// 🤖 BOT
// ============================================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Enviar sugerencias con precios REALES
async function sendPriceSuggestions(chatId, symbolKey, symbolInfo) {
  await bot.sendMessage(chatId, `⏳ Obteniendo precio actual de ${symbolInfo.name}...`);
  
  const realPrice = await getRealPrice(symbolKey);
  
  if (!realPrice) {
    await bot.sendMessage(chatId,
      `💰 *¿En qué precio para ${symbolInfo.name}?*\n\nNo pude obtener el precio actual.\nEscribe tu precio:`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const { price, dayHigh, dayLow, change, changePercent } = realPrice;
  
  const arrow = change >= 0 ? '🟢' : '🔴';
  const pctStr = change >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: `📉 Mín: $${formatPrice(dayLow)}`, callback_data: `price:${dayLow}` },
        { text: `📍 Actual: $${formatPrice(price)}`, callback_data: `price:${price}` },
        { text: `📈 Máx: $${formatPrice(dayHigh)}`, callback_data: `price:${dayHigh}` },
      ],
      [
        { text: `✏️ Otro precio`, callback_data: 'custom_price' }
      ]
    ]
  };
  
  await bot.sendMessage(chatId,
    `${symbolInfo.emoji} *${symbolInfo.name}*\n\n` +
    `💰 *Precio actual:* $${formatPrice(price)} ${arrow} ${pctStr}\n\n` +
    `📊 *Rango del día:*\n` +
    `   📉 Mínimo: $${formatPrice(dayLow)}\n` +
    `   📍 Actual: $${formatPrice(price)}\n` +
    `   📈 Máximo: $${formatPrice(dayHigh)}\n\n` +
    `💡 *Elige un nivel o escribe tu precio:*`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

// ============================================
// 💬 INICIO
// ============================================
bot.getMe().then(info => {
  console.log(`✅ Bot: @${info.username}`);
  console.log('\n💬 Ejemplos:');
  console.log('   "activa alerta BTC"');
  console.log('   "crea alerta ETH en 2500"');
  console.log('   "avisa cuando ORO llegue a 3500"');
  console.log('='.repeat(50) + '\n');
});

// ============================================
// 💬 MENSAJES PRINCIPALES
// ============================================
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const message = msg.text;
  const state = userStates.get(userId) || { step: STATES.IDLE };
  
  console.log(`📩 [${userId}] "${message}" | Estado: ${state.step}`);
  
  // ==========================================
  // ESPERANDO PRECIO
  // ==========================================
  if (state.step === STATES.WAITING_PRICE) {
    const priceMatch = message.match(/\$?\s*(\d[\d,.]*)/);
    
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      
      if (price > 0) {
        userStates.set(userId, {
          step: STATES.WAITING_DIRECTION,
          symbol: state.symbol,
          symbolInfo: state.symbolInfo,
          price: price,
        });
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: '📈 Supere (arriba)', callback_data: 'dir:above' },
              { text: '📉 Baje (abajo)', callback_data: 'dir:below' }
            ]
          ]
        };
        
        await bot.sendMessage(chatId,
          `${state.symbolInfo.emoji} *${state.symbolInfo.name}* a *$${formatPrice(price)}*\n\n¿Cuándo quieres la alerta?`,
          {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          }
        );
        return;
      }
    }
    
    await bot.sendMessage(chatId,
      `🤔 No entendí el precio. Escribe un número:\n\n💡 Ejemplos: *59800*, *2500*, *1.08*`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // ==========================================
  // ESPERANDO SÍMBOLO
  // ==========================================
  if (state.step === STATES.WAITING_SYMBOL) {
    const parsed = parseMessage(message);
    
    if (parsed.detectedSymbol) {
      const symbolInfo = parsed.detectedSymbol;
      const symbolKey = symbolInfo.key || symbolInfo.symbol;
      
      userStates.set(userId, {
        step: STATES.WAITING_PRICE,
        symbol: symbolKey,
        symbolInfo: symbolInfo,
      });
      
      await sendPriceSuggestions(chatId, symbolKey, symbolInfo);
      return;
    }
    
    const upper = message.toUpperCase().trim();
    if (SYMBOLS[upper]) {
      const symbolInfo = SYMBOLS[upper];
      const symbolKey = symbolInfo.symbol || upper;
      
      userStates.set(userId, {
        step: STATES.WAITING_PRICE,
        symbol: symbolKey,
        symbolInfo: symbolInfo,
      });
      
      await sendPriceSuggestions(chatId, symbolKey, symbolInfo);
      return;
    }
    
    await bot.sendMessage(chatId,
      `🤔 No encontré "${message}" como activo.\n\n📋 *Activos disponibles:*\n🪙 BTC, ETH, SOL\n🏛️ NAS100, US30, US500\n💱 EURUSD\n🥇 XAUUSD (Oro)\n\nEscribe el nombre:`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // ==========================================
  // ESPERANDO DIRECCIÓN (texto)
  // ==========================================
  if (state.step === STATES.WAITING_DIRECTION) {
    let direction = null;
    const lower = message.toLowerCase();
    
    if (lower.match(/arriba|suba|sube|supere|supera|encima|sobre|above|1/)) {
      direction = 'above';
    } else if (lower.match(/abajo|baje|baja|debajo|menos|bajo|below|2/)) {
      direction = 'below';
    }
    
    if (direction) {
      const newAlert = createAlert(state.symbol, state.price, direction);
      userStates.delete(userId);
      
      const emoji = direction === 'above' ? '📈' : '📉';
      const text = direction === 'above' ? 'supere' : 'baje de';
      
      await bot.sendMessage(chatId,
        `✅ *¡Alerta Creada!*\n\n` +
        `${state.symbolInfo.emoji} *${state.symbolInfo.name}*\n` +
        `${emoji} ${text} *$${formatPrice(state.price)}*\n\n` +
        `📋 ID: \`${newAlert.id}\`\n` +
        `⏰ ${new Date().toLocaleString('es-CL')}\n\n` +
        `🔔 Te notifico cuando llegue ese precio.\n\n` +
        `Crear otra: escribe *"crea alerta"* 🚀`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }
  
  // ==========================================
  // NUEVO MENSAJE - PROCESAR INTENCIÓN
  // ==========================================
  const parsed = parseMessage(message);
  
  if (parsed.intent === 'list') {
    const alerts = loadAlerts().filter(a => a.active);
    
    if (alerts.length === 0) {
      await bot.sendMessage(chatId,
        `📋 *No tienes alertas activas*\n\nEscribe *"crea alerta BTC"* para empezar.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      const lines = [`📋 *Tus Alertas (${alerts.length})*\n`];
      for (const [i, a] of alerts.entries()) {
        const e = a.direction === 'above' ? '📈' : '📉';
        lines.push(`${i+1}. *${a.symbol}* ${e} $${formatPrice(a.targetPrice)}`);
      }
      lines.push('\nEliminar: escribe *"elimina alerta"*');
      await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
    }
    return;
  }
  
  if (parsed.intent === 'help') {
    await bot.sendMessage(chatId,
      `📖 *Cómo usar el bot*\n\n` +
      `💬 *Solo escribe lo que quieras:*\n` +
      `• "crea alerta BTC"\n` +
      `• "activa alerta ETH en 2500"\n` +
      `• "avisa cuando ORO llegue a 3500"\n` +
      `• "notificame si NAS100 baja de 21000"\n\n` +
      `🔄 *El bot te guía paso a paso:*\n` +
      `1. Dices el activo\n` +
      `2. Te muestro precio REAL con rango\n` +
      `3. Eliges nivel o escribes precio\n` +
      `4. Eliges dirección\n` +
      `5. ¡Listo!\n\n` +
      `📋 *Otros comandos:*\n` +
      `• /alertas - Ver alertas\n` +
      `• /cancelar ID - Eliminar`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  if (parsed.intent === 'delete') {
    const alerts = loadAlerts().filter(a => a.active);
    
    if (alerts.length === 0) {
      await bot.sendMessage(chatId, `📋 No tienes alertas activas.`);
      return;
    }
    
    const lines = [`🗑️ *¿Cuál quieres eliminar?*\n`];
    for (const [i, a] of alerts.entries()) {
      const e = a.direction === 'above' ? '📈' : '📉';
      lines.push(`${i+1}. *${a.symbol}* ${e} $${formatPrice(a.targetPrice)}`);
      lines.push(`   ID: \`${a.id}\``);
    }
    lines.push('\nEscribe el *número* o *ID* de la alerta');
    
    await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
    
    userStates.set(userId, {
      step: 'waiting_delete_id',
      alerts: alerts,
    });
    return;
  }
  
  if (state.step === 'waiting_delete_id') {
    const alerts = state.alerts || [];
    let index = parseInt(message) - 1;
    
    if (isNaN(index)) {
      const found = alerts.findIndex(a => a.id === message || a.id.endsWith(message));
      if (found !== -1) index = found;
    }
    
    if (index >= 0 && index < alerts.length) {
      const deleted = deleteAlert(alerts[index].id);
      userStates.delete(userId);
      
      if (deleted) {
        await bot.sendMessage(chatId,
          `✅ *Alerta Eliminada*\n\n${deleted.symbol} $${formatPrice(deleted.targetPrice)}`,
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }
  }
  
  // ==========================================
  // SI DETECTÓ SÍMBOLO DIRECTAMENTE
  // ==========================================
  if (parsed.detectedSymbol && !parsed.intent) {
    const symbolInfo = parsed.detectedSymbol;
    const symbolKey = symbolInfo.key || symbolInfo.symbol;
    
    if (parsed.detectedPrice && parsed.direction) {
      const newAlert = createAlert(symbolKey, parsed.detectedPrice, parsed.direction);
      
      const emoji = parsed.direction === 'above' ? '📈' : '📉';
      const text = parsed.direction === 'above' ? 'supere' : 'baje de';
      
      await bot.sendMessage(chatId,
        `✅ *¡Alerta Creada!*\n\n` +
        `${symbolInfo.emoji} *${symbolInfo.name}*\n` +
        `${emoji} ${text} *$${formatPrice(parsed.detectedPrice)}*\n\n` +
        `📋 ID: \`${newAlert.id}\`\n\n` +
        `🔔 Te notifico cuando llegue.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    if (parsed.detectedPrice && !parsed.direction) {
      userStates.set(userId, {
        step: STATES.WAITING_DIRECTION,
        symbol: symbolKey,
        symbolInfo: symbolInfo,
        price: parsed.detectedPrice,
      });
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📈 Supere (arriba)', callback_data: 'dir:above' },
            { text: '📉 Baje (abajo)', callback_data: 'dir:below' }
          ]
        ]
      };
      
      await bot.sendMessage(chatId,
        `${symbolInfo.emoji} *${symbolInfo.name}* a *$${formatPrice(parsed.detectedPrice)}*\n\n¿Cuándo quieres la alerta?`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      return;
    }
    
    userStates.set(userId, {
      step: STATES.WAITING_PRICE,
      symbol: symbolKey,
      symbolInfo: symbolInfo,
    });
    
    await sendPriceSuggestions(chatId, symbolKey, symbolInfo);
    return;
  }
  
  if (parsed.detectedPrice && !parsed.detectedSymbol) {
    await bot.sendMessage(chatId,
      `💰 Detecté el precio *$${formatPrice(parsed.detectedPrice)}*, pero ¿para qué activo?\n\n📋 Ejemplos: *BTC*, *ETH*, *NAS100*, *ORO*`,
      { parse_mode: 'Markdown' }
    );
    
    userStates.set(userId, { step: STATES.WAITING_SYMBOL });
    return;
  }
  
  // ==========================================
  // POR DEFECTO - INICIAR CONVERSACIÓN
  // ==========================================
  userStates.set(userId, { step: STATES.WAITING_SYMBOL });
  
  await bot.sendMessage(chatId,
    `🔔 *¡Vamos a crear una alerta!*\n\n¿Para qué activo?\n\n🪙 *Crypto:* BTC, ETH, SOL\n🏛️ *Índices:* NAS100, US30, US500\n💱 *Forex:* EURUSD\n🥇 *Oro:* XAUUSD\n\nEscribe el nombre:`,
    { parse_mode: 'Markdown' }
  );
});

// ============================================
// 🖱️ BOTONES INLINE
// ============================================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  
  console.log(`🔘 Callback: ${data} de [${userId}]`);
  
  if (data.startsWith('price:')) {
    const price = parseFloat(data.split(':')[1]);
    const state = userStates.get(userId);
    
    if (state && state.step === STATES.WAITING_PRICE && state.symbolInfo) {
      userStates.set(userId, {
        step: STATES.WAITING_DIRECTION,
        symbol: state.symbol,
        symbolInfo: state.symbolInfo,
        price: price,
      });
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📈 Supere (arriba)', callback_data: 'dir:above' },
            { text: '📉 Baje (abajo)', callback_data: 'dir:below' }
          ]
        ]
      };
      
      await bot.sendMessage(chatId,
        `${state.symbolInfo.emoji} *${state.symbolInfo.name}* a *$${formatPrice(price)}*\n\n¿Cuándo quieres la alerta?`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
    }
    
    await bot.answerCallbackQuery(query.id);
    return;
  }
  
  if (data === 'custom_price') {
    const state = userStates.get(userId);
    
    if (state && state.step === STATES.WAITING_PRICE) {
      await bot.sendMessage(chatId,
        `✏️ *Escribe tu precio:*\n\n💡 Ejemplos: *59800*, *2500*, *1.08*`,
        { parse_mode: 'Markdown' }
      );
    }
    
    await bot.answerCallbackQuery(query.id);
    return;
  }
  
  if (data.startsWith('dir:')) {
    const direction = data.split(':')[1];
    const state = userStates.get(userId);
    
    if (state && state.step === STATES.WAITING_DIRECTION) {
      const newAlert = createAlert(state.symbol, state.price, direction);
      userStates.delete(userId);
      
      const emoji = direction === 'above' ? '📈' : '📉';
      const text = direction === 'above' ? 'supere' : 'baje de';
      
      await bot.sendMessage(chatId,
        `✅ *¡Alerta Creada!*\n\n` +
        `${state.symbolInfo.emoji} *${state.symbolInfo.name}*\n` +
        `${emoji} ${text} *$${formatPrice(state.price)}*\n\n` +
        `📋 ID: \`${newAlert.id}\`\n` +
        `⏰ ${new Date().toLocaleString('es-CL')}\n\n` +
        `🔔 Te notifico cuando llegue ese precio.\n\n` +
        `Crear otra: escribe *"crea alerta"* 🚀`,
        { parse_mode: 'Markdown' }
      );
    }
    
    await bot.answerCallbackQuery(query.id);
    return;
  }
  
  await bot.answerCallbackQuery(query.id);
});

// ============================================
// 📱 COMANDOS
// ============================================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || 'Usuario';
  
  await bot.sendMessage(chatId,
    `🤖 *¡Hola ${userName}!*\n\nSoy tu bot de alertas de trading 📈\n\n` +
    `💬 *Solo escríbeme como hablas:*\n` +
    `• "crea alerta BTC"\n` +
    `• "activa alerta ETH en 2500"\n` +
    `• "avisa cuando ORO llegue a 3500"\n\n` +
    `🔄 *Te muestro precios REALES y te guío paso a paso.*\n\n` +
    `Escribe algo para empezar 🚀`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/alertas$/, async (msg) => {
  const chatId = msg.chat.id;
  const alerts = loadAlerts().filter(a => a.active);
  
  if (alerts.length === 0) {
    await bot.sendMessage(chatId, `📋 No tienes alertas activas.\n\nEscribe *"crea alerta BTC"* para empezar.`);
    return;
  }
  
  const lines = [`📋 *Tus Alertas (${alerts.length})*\n`];
  for (const [i, a] of alerts.entries()) {
    const e = a.direction === 'above' ? '📈' : '📉';
    lines.push(`${i+1}. *${a.symbol}* ${e} $${formatPrice(a.targetPrice)}`);
  }
  lines.push('\nEliminar: escribe *"elimina alerta"*');
  
  await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
});

bot.onText(/\/cancelar (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const alertId = match[1].trim();
  
  const deleted = deleteAlert(alertId);
  
  if (deleted) {
    await bot.sendMessage(chatId,
      `✅ *Alerta Eliminada*\n\n${deleted.symbol} $${formatPrice(deleted.targetPrice)}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await bot.sendMessage(chatId, `❌ No encontré esa alerta.\nUsa /alertas para ver las alertas.`);
  }
});

bot.on('polling_error', (err) => console.error('⚠️ Polling:', err.message));
bot.on('error', (err) => console.error('⚠️ Error:', err.message));

console.log('✅ Bot listo con PRECIOS REALES...\n');

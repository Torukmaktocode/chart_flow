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

console.log('🚀 BOT DE ALERTAS - LENGUAJE NATURAL');
console.log('='.repeat(50));

// ============================================
// 📋 SÍMBOLOS SOPORTADOS
// ============================================
const SYMBOLS = {
  // Crypto
  'BTC': 'BTC', 'BITCOIN': 'BTC', 'BTCUSD': 'BTC',
  'ETH': 'ETH', 'ETHEREUM': 'ETH', 'ETHUSD': 'ETH', 'ETHUSDT': 'ETH',
  'SOL': 'SOL', 'SOLANA': 'SOL', 'SOLUSD': 'SOL',
  'XRP': 'XRP', 'RIPPLE': 'XRP',
  'ADA': 'ADA', 'CARDANO': 'ADA',
  'DOGE': 'DOGE', 'DOGECOIN': 'DOGE',
  'BNB': 'BNB', 'BINANCE': 'BNB',
  
  // Índices
  'NAS100': 'NAS100', 'NASDAQ': 'NAS100', 'NASDAQ100': 'NAS100',
  'US30': 'US30', 'DOW': 'US30', 'DOWJONES': 'US30', 'DJI': 'US30',
  'US500': 'US500', 'SP500': 'US500', 'SPX': 'US500', 'S&P': 'US500',
  
  // Forex
  'EURUSD': 'EURUSD', 'EURO': 'EURUSD',
  'GBPUSD': 'GBPUSD', 'LIBRA': 'GBPUSD',
  'USDJPY': 'USDJPY', 'YEN': 'USDJPY',
  'USDCLP': 'USDCLP', 'PESO': 'USDCLP',
  
  // Commodities
  'XAUUSD': 'XAUUSD', 'ORO': 'XAUUSD', 'GOLD': 'XAUUSD', 'AU': 'XAUUSD',
  'XAGUSD': 'XAGUSD', 'PLATA': 'XAGUSD', 'SILVER': 'XAGUSD',
  
  // Otros
  'DXY': 'DXY', 'DOLAR': 'DXY', 'DOLLAR': 'DXY',
  'VIX': 'VIX', 'MIEDO': 'VIX',
};

// ============================================
// 🔍 PARSER DE LENGUAJE NATURAL
// ============================================
function parseNaturalLanguage(text) {
  const lower = text.toLowerCase().trim();
  
  // Patrones para detectar símbolo
  const symbolPatterns = [
    /(?:alerta|avisa|notifica|crea|activa|genera)\s+(?:en|de|para|sobre)?\s*(?:el|la|los|las)?\s*([a-zA-Z]+)/i,
    /([a-zA-Z]{2,10})\s+(?:en|a|hasta|hacia)?\s*(?:los|las|el|la)?\s*(?:\$?\d+)/i,
    /(?:cuando|cuanto|si)\s+([a-zA-Z]+)\s+(?:llegue|baje|suba|pase)/i,
  ];
  
  // Patrones para detectar precio
  const pricePatterns = [
    /(?:en|a|hasta|hacia|de)?\s*(?:los|las|el|la)?\s*\$?\s*(\d[\d,.]*)/i,
    /(\d[\d,.]*)\s*(?:d[oó]lares|usd|\$)/i,
    /supera?\s+(?:de\s+)?(?:los\s+)?\$?\s*(\d[\d,.]*)/i,
    /baja?\s+(?:de\s+)?(?:los\s+)?\$?\s*(\d[\d,.]*)/i,
  ];
  
  // Patrones para detectar dirección
  const abovePatterns = ['arriba', 'suba', 'sube', 'supere', 'supera', 'pase', 'llegue', 'sobre', 'encima'];
  const belowPatterns = ['abajo', 'baje', 'baja', 'debajo', 'menos', 'bajo'];
  
  let symbol = null;
  let price = null;
  let direction = 'above'; // por defecto
  
  // Buscar símbolo
  for (const pattern of symbolPatterns) {
    const match = text.match(pattern);
    if (match) {
      const rawSymbol = match[1].toUpperCase();
      symbol = SYMBOLS[rawSymbol] || rawSymbol;
      break;
    }
  }
  
  // Buscar precio
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      price = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }
  
  // Detectar dirección
  for (const word of abovePatterns) {
    if (lower.includes(word)) {
      direction = 'above';
      break;
    }
  }
  
  for (const word of belowPatterns) {
    if (lower.includes(word)) {
      direction = 'below';
      break;
    }
  }
  
  // Si menciona "baje de" o "baja de", es below
  if (lower.includes('baje de') || lower.includes('baja de') || lower.includes('abajo de')) {
    direction = 'below';
  }
  
  // Si menciona "suba de" o "sube de" o "supere", es above
  if (lower.includes('suba de') || lower.includes('sube de') || lower.includes('supere') || lower.includes('supera')) {
    direction = 'above';
  }
  
  return { symbol, price, direction };
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
    console.error('Error cargando alertas:', error.message);
  }
  return [];
}

function saveAlerts(alerts) {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando alertas:', error.message);
    return false;
  }
}

function createAlert(symbol, targetPrice, direction = 'above', message = '') {
  const alerts = loadAlerts();
  
  const newAlert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    symbol: symbol.toUpperCase(),
    targetPrice: parseFloat(targetPrice),
    direction: direction.toLowerCase(),
    message: message || `Alerta desde Telegram - ${symbol} ${direction === 'above' ? 'supera' : 'baja de'} $${targetPrice}`,
    chatId: CHAT_ID,
    active: true,
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    repeat: false
  };
  
  alerts.push(newAlert);
  saveAlerts(alerts);
  
  console.log(`✅ Alerta creada: ${newAlert.symbol} ${newAlert.direction === 'above' ? '📈' : '📉'} $${newAlert.targetPrice}`);
  
  return newAlert;
}

function deleteAlert(alertId) {
  const alerts = loadAlerts();
  const index = alerts.findIndex(a => a.id === alertId || a.id.endsWith(alertId));
  
  if (index !== -1) {
    const deleted = alerts.splice(index, 1)[0];
    saveAlerts(alerts);
    console.log(`🗑️ Alerta eliminada: ${deleted.symbol}`);
    return deleted;
  }
  
  return null;
}

// ============================================
// 🤖 BOT DE TELEGRAM
// ============================================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Verificar conexión
bot.getMe().then(info => {
  console.log(`✅ Bot conectado: @${info.username}`);
  console.log(`📊 Chat ID: ${CHAT_ID}`);
  console.log('\n💬 Puedes escribir en lenguaje natural:');
  console.log('   "activa alerta en BTC en 59800"');
  console.log('   "crea alerta ETH 1600"');
  console.log('   "avisa cuando BTC llegue a 60000"');
  console.log('   "alerta ORO en 3500"');
  console.log('='.repeat(50) + '\n');
});

// ============================================
// 📱 COMANDOS DEL BOT
// ============================================

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || 'Usuario';
  
  await bot.sendMessage(chatId,
    `🤖 *¡Hola ${userName}!*

Soy tu *Bot de Alertas de Trading* 📈

📝 *Escribe en lenguaje natural:*

• *"activa alerta BTC en 59800"*
• *"crea alerta ETH 1600"*
• *"avisa cuando NAS100 llegue a 22000"*
• *"alerta ORO en 3500"*
• *"notificame cuando BTC baje de 58000"*

📋 *También puedes usar:*
• /alertas - Ver tus alertas
• /cancelar ID - Eliminar alerta
• /help - Ver ayuda

¡Escribe tu primera alerta! 🚀`,
    { parse_mode: 'Markdown' }
  );
});

// /alertas
bot.onText(/\/alertas$/, async (msg) => {
  const chatId = msg.chat.id;
  const alerts = loadAlerts().filter(a => a.active);
  
  if (alerts.length === 0) {
    await bot.sendMessage(chatId,
      `📋 *No tienes alertas activas*

Escribe algo como:
*"activa alerta BTC en 59800"*`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const lines = [`📋 *Tus Alertas (${alerts.length})*\n`];
  
  alerts.forEach((alert, i) => {
    const emoji = alert.direction === 'above' ? '📈' : '📉';
    const text = alert.direction === 'above' ? 'supere' : 'baje de';
    
    lines.push(`${i + 1}. *${alert.symbol}* ${emoji}`);
    lines.push(`   ${text} $${alert.targetPrice.toLocaleString('en-US')}`);
    lines.push(`   ID: \`${alert.id}\``);
    lines.push('');
  });
  
  lines.push('━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('Eliminar: /cancelar ID');
  
  await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
});

// /cancelar
bot.onText(/\/cancelar (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const alertId = match[1].trim();
  
  const deleted = deleteAlert(alertId);
  
  if (!deleted) {
    await bot.sendMessage(chatId,
      `❌ No encontré esa alerta.

Usa /alertas para ver tus alertas.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  await bot.sendMessage(chatId,
    `✅ *Alerta Eliminada*

${deleted.symbol} $${deleted.targetPrice.toLocaleString('en-US')}`,
    { parse_mode: 'Markdown' }
  );
});

// /test
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(chatId,
    `✅ *¡Bot Funcionando!*

⏰ ${new Date().toLocaleString('es-CL')}

Puedes escribir alertas en lenguaje natural.`,
    { parse_mode: 'Markdown' }
  );
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(chatId,
    `📖 *AYUDA - LENGUAJE NATURAL*

🔔 *Crear alertas (escribe como quieras):*

*"activa alerta BTC en 59800"*
*"crea alerta ETH 1600"*
*"avisa cuando NAS100 llegue a 22000"*
*"alerta ORO en 3500"*
*"notificame cuando BTC baje de 58000"*

💡 *Palabras que entiendo:*
• activa, crea, genera, avisa, notifica
• en, a, hasta, de, sobre
• arriba, suba, sube, supere
• abajo, baje, baja, debajo

📋 *Otros comandos:*
• /alertas - Ver alertas
• /cancelar ID - Eliminar
• /test - Probar bot`,
    { parse_mode: 'Markdown' }
  );
});

// ============================================
// 🧠 PROCESAMIENTO DE MENSAJES NATURALES
// ============================================
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || 'Usuario';
  const message = msg.text;
  
  console.log(`📩 ${userName}: "${message}"`);
  
  // Parsear lenguaje natural
  const parsed = parseNaturalLanguage(message);
  
  console.log(`   → Detectado: Símbolo=${parsed.symbol}, Precio=${parsed.price}, Dirección=${parsed.direction}`);
  
  // Si detectó símbolo y precio, crear alerta
  if (parsed.symbol && parsed.price && parsed.price > 0) {
    const symbol = parsed.symbol;
    const price = parsed.price;
    const direction = parsed.direction;
    
    const newAlert = createAlert(symbol, price, direction);
    
    const emoji = direction === 'above' ? '📈' : '📉';
    const text = direction === 'above' ? 'supere' : 'baje de';
    
    await bot.sendMessage(chatId,
      `✅ *¡Alerta Creada!*

${emoji} *${symbol}* ${text} *$${price.toLocaleString('en-US')}*

📋 ID: \`${newAlert.id}\`
⏰ ${new Date().toLocaleString('es-CL')}

Cuando el precio llegue, te notifico 🔔

Ver alertas: /alertas`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Si detectó solo símbolo sin precio
  if (parsed.symbol && !parsed.price) {
    await bot.sendMessage(chatId,
      `🤔 Entendí que quieres una alerta para *${parsed.symbol}*, pero necesito el precio.

💡 Ejemplo: *"activa alerta ${parsed.symbol} en 50000"*`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Si detectó solo precio sin símbolo
  if (!parsed.symbol && parsed.price) {
    await bot.sendMessage(chatId,
      `🤔 Detecté el precio *$${parsed.price.toLocaleString('en-US')}*, pero necesito saber para qué activo.

💡 Ejemplo: *"activa alerta BTC en ${parsed.price}"*`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // No entendió nada
  await bot.sendMessage(chatId,
    `🤔 No entendí tu mensaje.

💡 *Escribe algo como:*
• "activa alerta BTC en 59800"
• "crea alerta ETH 1600"
• "avisa cuando NAS100 llegue a 22000"

O usa /help para ver todos los comandos.`,
    { parse_mode: 'Markdown' }
  );
});

// ============================================
// ⚠️ MANEJO DE ERRORES
// ============================================
bot.on('polling_error', (err) => {
  console.error('⚠️ Error de polling:', err.message);
});

bot.on('error', (err) => {
  console.error('⚠️ Error general:', err.message);
});

console.log('✅ Bot listo - Escribe en lenguaje natural...\n');

import TelegramBot from "node-telegram-bot-api";
import yahooFinance from "yahoo-finance2";
import { generateChart } from "./chart-generator.mjs";
import alertManager from "./server/alert-manager.mjs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ Define TELEGRAM_BOT_TOKEN en .env");
  process.exit(1);
}

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!CHAT_ID) {
  console.error("❌ Define TELEGRAM_CHAT_ID en .env");
  process.exit(1);
}

const SYMBOLS = [
  { key: "NAS100",    yahoo: "^NDX",      group: "Índices", emoji: "🏛️" },
  { key: "US30",      yahoo: "^DJI",      group: "Índices", emoji: "🏛️" },
  { key: "US500",     yahoo: "^GSPC",     group: "Índices", emoji: "🏛️" },
  { key: "BTC",       yahoo: "BTC-USD",   group: "Crypto",  emoji: "🪙" },
  { key: "ETHUSDT_P", yahoo: "ETH-USD",   group: "Crypto",  emoji: "🪙" },
  { key: "SOLUSDT_P", yahoo: "SOL-USD",   group: "Crypto",  emoji: "🪙" },
  { key: "EURUSD",    yahoo: "EURUSD=X",  group: "Forex",   emoji: "💱" },
  { key: "GBPUSD",    yahoo: "GBPUSD=X",  group: "Forex",   emoji: "💱" },
  { key: "USDJPY",    yahoo: "USDJPY=X",  group: "Forex",   emoji: "💱" },
  { key: "USDCLP",    yahoo: "USDCLP=X",  group: "Forex",   emoji: "💱" },
  { key: "XAUUSD",    yahoo: "GC=F",      group: "Macro",   emoji: "🥇" },
  { key: "DXY",       yahoo: "DX-Y.NYB",  group: "Macro",   emoji: "💵" },
  { key: "VIX",       yahoo: "^VIX",      group: "Macro",   emoji: "📉" },
];

const GROUPS = ["Índices", "Macro", "Forex", "Crypto"];

function fmtPrice(value) {
  if (value == null || isNaN(value)) return "---";
  if (value < 1) return value.toFixed(6);
  if (value < 10) return value.toFixed(4);
  if (value < 1000) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

async function fetchQuotes() {
  const results = [];
  for (const sym of SYMBOLS) {
    try {
      const quote = await yahooFinance.quote(sym.yahoo);
      const price = quote.regularMarketPrice;
      const prev = quote.regularMarketPreviousClose;
      const change = price != null && prev != null ? price - prev : null;
      const changePct = change != null && prev ? (change / prev) * 100 : null;
      results.push({
        ...sym,
        price,
        change,
        changePct,
        high: quote.regularMarketDayHigh,
        low: quote.regularMarketDayLow,
        volume: quote.regularMarketVolume,
      });
    } catch {
      results.push({ ...sym, price: null, change: null, changePct: null, high: null, low: null, volume: null });
    }
  }
  return results;
}

function buildMessage(quotes) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const lines = [];
  lines.push("📊 *PANEL DE MERCADOS*");
  lines.push(`📅 ${escapeMarkdown(dateStr)} — ${escapeMarkdown(timeStr)} UTC`);
  lines.push("");

  for (const group of GROUPS) {
    const groupSymbols = quotes.filter((q) => q.group === group);
    if (groupSymbols.length === 0) continue;
    const groupEmoji = groupSymbols[0].emoji;

    lines.push(`${groupEmoji} *${group}*`);

    for (const q of groupSymbols) {
      if (q.price == null) {
        lines.push(`  ▫️ ${escapeMarkdown(q.key)}  →  \`---\`  ⚪ sin datos`);
        continue;
      }

      let arrow = "⚪";
      if (q.change > 0) arrow = "🟢";
      else if (q.change < 0) arrow = "🔴";

      const priceStr = fmtPrice(q.price);
      const changeStr = q.change != null ? fmtPrice(Math.abs(q.change)) : "";
      const pctStr = q.changePct != null
        ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2).replace(".", ",")}%`
        : "";

      const paddedKey = q.key.padEnd(7);
      lines.push(`  ▫️ \`${escapeMarkdown(paddedKey)}\` →  \`${escapeMarkdown(priceStr)}\`  ${arrow} ${escapeMarkdown(pctStr)}`);
    }
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("🤖 *Bot de Mercados* · /precios para actualizar");

  return lines.join("\n");
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const welcome = [
    "🤖 *Bienvenido al Bot de Mercados*",
    "",
    "Comandos disponibles:",
    "  /precios  —  Ver precios de todos los símbolos",
    "  /precio NAS100  —  Precio de un símbolo específico",
    "  /grupo Indices  —  Ver un grupo (Indices, Forex, Crypto, Macro)",
    "",
    "Ejemplo: /grupo forex",
  ].join("\n");
  await bot.sendMessage(chatId, welcome, { parse_mode: "Markdown" });
});

bot.onText(/\/precios$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, "typing");

  try {
    const quotes = await fetchQuotes();
    const message = buildMessage(quotes);
    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

bot.onText(/\/precio (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const raw = match[1].trim().toUpperCase();

  const sym = SYMBOLS.find((s) => s.key === raw);
  if (!sym) {
    return bot.sendMessage(chatId, `❌ Símbolo "${raw}" no encontrado. Usa: ${SYMBOLS.map((s) => s.key).join(", ")}`);
  }

  await bot.sendChatAction(chatId, "typing");

  try {
    const quote = await yahooFinance.quote(sym.yahoo);
    const price = quote.regularMarketPrice;
    const prev = quote.regularMarketPreviousClose;
    const change = price != null && prev != null ? price - prev : null;
    const changePct = change != null && prev ? (change / prev) * 100 : null;

    if (price == null) {
      return bot.sendMessage(chatId, `❌ ${sym.key}: sin datos disponibles`);
    }

    let arrow = "⚪";
    if (change > 0) arrow = "🟢";
    else if (change < 0) arrow = "🔴";

    const msgLines = [
      `${sym.emoji} *${sym.key}* — ${sym.group}`,
      `━━━━━━━━━━━━━━━━`,
      `Precio:  \`${fmtPrice(price)}\``,
      `Cambio:  ${arrow} \`${fmtPrice(Math.abs(change))}\` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2).replace(".", ",")}%)`,
      `Máx:     \`${fmtPrice(quote.regularMarketDayHigh)}\``,
      `Mín:     \`${fmtPrice(quote.regularMarketDayLow)}\``,
      `Vol:     \`${quote.regularMarketVolume != null ? quote.regularMarketVolume.toLocaleString("en-US") : "---"}\``,
      `Fuente:  ${quote.marketState === "REGULAR" ? "🟢 Mercado abierto" : "🔴 Mercado cerrado"}`,
    ];
    await bot.sendMessage(chatId, msgLines.join("\n"), { parse_mode: "Markdown" });

    await bot.sendChatAction(chatId, "upload_photo");
    try {
      const chartBuf = await generateChart(sym.key, sym.yahoo, "1d", 80);
      if (chartBuf) {
        await bot.sendPhoto(chatId, chartBuf, { caption: `${sym.key} — gráfico diario` });
      }
    } catch (chartErr) {
      console.error(`Error generando chart para ${sym.key}:`, chartErr.message);
    }
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Error al consultar ${sym.key}: ${err.message}`);
  }
});

bot.onText(/\/chart ?(.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  let raw = match[1]?.trim().toUpperCase() || "";
  let sym, tf = "1d";

  const parts = raw.split(/\s+/);
  if (parts.length >= 2) {
    sym = SYMBOLS.find((s) => s.key === parts[0]);
    const validTf = ["1d", "5d", "1w", "1mo", "4h", "1h", "15m"];
    tf = validTf.includes(parts[1].toLowerCase()) ? parts[1].toLowerCase() : "1d";
  } else if (parts.length === 1) {
    sym = SYMBOLS.find((s) => s.key === parts[0]);
  } else {
    return bot.sendMessage(chatId, `❌ Especifica un símbolo. Ej: /chart NAS100 1d`);
  }

  if (!sym) {
    return bot.sendMessage(chatId, `❌ Símbolo no encontrado. Usa: /chart NAS100 1d\nTFs: ${["1d","5d","1w","4h","1h","15m"].join(", ")}`);
  }

  await bot.sendChatAction(chatId, "upload_photo");
  try {
    const chartBuf = await generateChart(sym.key, sym.yahoo, tf, 80);
    if (chartBuf) {
      await bot.sendPhoto(chatId, chartBuf, { caption: `${sym.key} — gráfico ${tf}` });
    } else {
      await bot.sendMessage(chatId, `❌ No se pudieron obtener datos para generar el chart de ${sym.key}`);
    }
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Error generando chart: ${err.message}`);
  }
});

bot.onText(/\/grupo (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const raw = match[1].trim().toLowerCase();
  const groupMap = { indices: "Índices", macro: "Macro", forex: "Forex", crypto: "Crypto" };
  const groupName = groupMap[raw];

  if (!groupName) {
    return bot.sendMessage(chatId, `❌ Grupo no válido. Usa: ${Object.keys(groupMap).join(", ")}`);
  }

  await bot.sendChatAction(chatId, "typing");

  try {
    const allQuotes = await fetchQuotes();
    const filtered = allQuotes.filter((q) => q.group === groupName);

    if (filtered.length === 0) {
      return bot.sendMessage(chatId, `❌ No hay datos para el grupo "${groupName}"`);
    }

    const lines = [];
    lines.push(`${filtered[0].emoji} *${groupName}*`);
    lines.push(`━━━━━━━━━━━━━━━━`);

    for (const q of filtered) {
      if (q.price == null) {
        lines.push(`▫️ ${q.key}  →  \`---\`  ⚪ sin datos`);
        continue;
      }
      let arrow = "⚪";
      if (q.change > 0) arrow = "🟢";
      else if (q.change < 0) arrow = "🔴";
      const pctStr = q.changePct != null
        ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2).replace(".", ",")}%`
        : "";
      lines.push(`▫️ ${q.key}  →  \`${fmtPrice(q.price)}\`  ${arrow} ${pctStr}`);
    }

    await bot.sendMessage(chatId, lines.join("\n"), { parse_mode: "Markdown" });
  } catch (err) {
    await bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// Comando /alerta - Crear nueva alerta
bot.onText(/\/alerta (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);
  
  if (args.length < 2) {
    return bot.sendMessage(chatId, 
      "❌ *Uso incorrecto*\n\n" +
      "Formato: /alerta SIMBOLO PRECIO [above|below]\n\n" +
      "Ejemplos:\n" +
      "  /alerta NAS100 21500 above\n" +
      "  /alerta BTC 100000 below\n" +
      "  /alerta XAUUSD 3500",
      { parse_mode: "Markdown" }
    );
  }
  
  const symbol = args[0].toUpperCase();
  const targetPrice = parseFloat(args[1]);
  const direction = args[2]?.toLowerCase() || 'above';
  
  // Validar símbolo
  const sym = SYMBOLS.find((s) => s.key === symbol);
  if (!sym) {
    return bot.sendMessage(chatId, 
      `❌ Símbolo "${symbol}" no encontrado.\n\nSímbolos disponibles: ${SYMBOLS.map((s) => s.key).join(", ")}`,
      { parse_mode: "Markdown" }
    );
  }
  
  // Validar precio
  if (isNaN(targetPrice) || targetPrice <= 0) {
    return bot.sendMessage(chatId, 
      "❌ El precio debe ser un número mayor a 0",
      { parse_mode: "Markdown" }
    );
  }
  
  // Validar dirección
  if (!['above', 'below'].includes(direction)) {
    return bot.sendMessage(chatId, 
      "❌ Dirección debe ser 'above' o 'below'",
      { parse_mode: "Markdown" }
    );
  }
  
  // Crear alerta
  const alert = alertManager.addAlert({
    symbol,
    targetPrice,
    direction,
    message: `${sym.emoji} Alerta para ${symbol}`,
    chatId,
  });
  
  const directionEmoji = direction === 'above' ? '📈' : '📉';
  const directionText = direction === 'above' ? 'suba de' : 'baje de';
  
  await bot.sendMessage(chatId, 
    `✅ *Alerta Creada*\n\n` +
    `${directionEmoji} ${sym.emoji} *${symbol}* ${directionText} \`$${targetPrice.toLocaleString('en-US')}\`\n\n` +
    `ID: \`${alert.id}\`\n` +
    `Cuando el precio llegue a este nivel, recibirás una notificación.`,
    { parse_mode: "Markdown" }
  );
});

// Comando /alertas - Ver todas las alertas
bot.onText(/\/alertas$/, async (msg) => {
  const chatId = msg.chat.id;
  const alerts = alertManager.getAllAlerts();
  
  if (alerts.length === 0) {
    return bot.sendMessage(chatId, 
      "📋 *No tienes alertas configuradas*\n\n" +
      "Crea una con: /alerta NAS100 21500 above",
      { parse_mode: "Markdown" }
    );
  }
  
  const lines = ["📋 *Tus Alertas*\n"];
  
  for (const alert of alerts) {
    const status = alert.active ? '🟢' : '🔴';
    const direction = alert.direction === 'above' ? '📈' : '📉';
    const triggered = alert.triggeredAt ? `\n   ✅ Activada: ${new Date(alert.triggeredAt).toLocaleString('es-CL')}` : '';
    
    lines.push(`${status} *${alert.symbol}*`);
    lines.push(`   ${direction} $${alert.targetPrice.toLocaleString('en-US')}`);
    lines.push(`   ID: \`${alert.id}\``);
    if (triggered) lines.push(triggered);
    lines.push('');
  }
  
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("Usa /cancelar ID para eliminar una alerta");
  
  await bot.sendMessage(chatId, lines.join("\n"), { parse_mode: "Markdown" });
});

// Comando /cancelar - Eliminar alerta
bot.onText(/\/cancelar (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const alertId = match[1].trim();
  
  const removed = alertManager.removeAlert(alertId);
  
  if (!removed) {
    return bot.sendMessage(chatId, 
      "❌ No se encontró una alerta con ese ID.\n\nUsa /alertas para ver tus alertas.",
      { parse_mode: "Markdown" }
    );
  }
  
  await bot.sendMessage(chatId, 
    `✅ *Alerta Eliminada*\n\n` +
    `${removed.symbol} $${removed.targetPrice.toLocaleString('en-US')}`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/help/, async (msg) => {
  const cmds = [
    "🤖 *Comandos disponibles*",
    "",
    "  /start  —  Mensaje de bienvenida",
    "  /precios  —  Precios de todos los símbolos",
    "  /precio NAS100  —  Precio + gráfico de un símbolo",
    "  /chart NAS100 1d  —  Solo gráfico (tf: 1d, 4h, 1h, 15m)",
    "  /grupo forex  —  Ver grupo (indices, forex, crypto, macro)",
    "",
    "🔔 *Alertas de Precio:*",
    "  /alerta NAS100 21500 above  —  Alerta cuando suba de 21500",
    "  /alerta BTC 100000 below  —  Alerta cuando baje de 100000",
    "  /alertas  —  Ver todas tus alertas",
    "  /cancelar ID  —  Eliminar una alerta",
    "",
    "  /help  —  Esta ayuda",
    "",
    "Símbolos disponibles:",
    SYMBOLS.map((s) => `  ${s.emoji} ${s.key} (${s.yahoo})`).join("\n"),
  ].join("\n");
  await bot.sendMessage(msg.chat.id, cmds, { parse_mode: "Markdown" });
});

bot.on("polling_error", (err) => {
  console.error("⚠️ Polling error:", err.message);
});

console.log(`🤖 Bot de Mercados iniciado`);
console.log(`Símbolos configurados: ${SYMBOLS.length}`);
console.log(`Esperando comandos...`);

if (CHAT_ID) {
  console.log(`📨 Enviando mensaje de inicio a chat ${CHAT_ID}...`);
  try {
    const msg = await bot.sendMessage(CHAT_ID, "🤖 *Bot de Mercados iniciado* — usa /precios para ver datos", { parse_mode: "Markdown" });
    console.log(`✅ Mensaje enviado`);
  } catch (err) {
    console.error(`❌ Error al enviar mensaje de inicio:`, err.message);
  }
}

import TelegramBot from 'node-telegram-bot-api';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ Define TELEGRAM_BOT_TOKEN en .env"); process.exit(1); }

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!CHAT_ID) { console.error("❌ Define TELEGRAM_CHAT_ID en .env"); process.exit(1); }

console.log('🔍 DIAGNÓSTICO DEL BOT DE TELEGRAM');
console.log('='.repeat(50));

// 1. Verificar token
console.log('\n1️⃣ Verificando token...');
try {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
  const data = await response.json();
  
  if (data.ok) {
    console.log('✅ Token válido');
    console.log(`   Bot: @${data.result.username}`);
    console.log(`   Nombre: ${data.result.first_name}`);
    console.log(`   ID: ${data.result.id}`);
  } else {
    console.log('❌ Token inválido:', data.description);
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Error verificando token:', error.message);
  process.exit(1);
}

// 2. Verificar últimos mensajes
console.log('\n2️⃣ Verificando últimos mensajes...');
try {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=5`);
  const data = await response.json();
  
  if (data.ok) {
    console.log(`✅ ${data.result.length} mensajes recientes encontrados`);
    
    if (data.result.length > 0) {
      console.log('\nÚltimos mensajes:');
      data.result.forEach((update, i) => {
        const msg = update.message || update.edited_message;
        if (msg) {
          console.log(`   ${i+1}. De: ${msg.from?.first_name || 'Desconocido'}`);
          console.log(`      Texto: "${msg.text || 'Sin texto'}"`);
          console.log(`      Chat ID: ${msg.chat?.id}`);
          console.log(`      Hora: ${new Date(msg.date * 1000).toLocaleString('es-CL')}`);
        }
      });
    } else {
      console.log('   ℹ️ No hay mensajes recientes');
    }
  }
} catch (error) {
  console.log('❌ Error obteniendo mensajes:', error.message);
}

// 3. Probar envío de mensaje
console.log('\n3️⃣ Probando envío de mensaje...');
try {
  const testMessage = `🧪 *PRUEBA DE DIAGNÓSTICO* 🧪
━━━━━━━━━━━━━━━━━━━━━━

⏰ ${new Date().toLocaleString('es-CL')}

Este es un mensaje de prueba para verificar que el bot puede enviar mensajes.

✅ Si ves este mensaje, ¡el bot funciona correctamente!

━━━━━━━━━━━━━━━━━━━━━━`;

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: testMessage,
      parse_mode: 'Markdown',
    }),
  });
  
  const data = await response.json();
  
  if (data.ok) {
    console.log('✅ Mensaje enviado exitosamente');
    console.log(`   Message ID: ${data.result.message_id}`);
  } else {
    console.log('❌ Error enviando mensaje:', data.description);
  }
} catch (error) {
  console.log('❌ Error en envío:', error.message);
}

// 4. Verificar webhook
console.log('\n4️⃣ Verificando configuración de webhook...');
try {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const data = await response.json();
  
  if (data.ok) {
    const info = data.result;
    if (info.url) {
      console.log(`⚠️ Webhook configurado: ${info.url}`);
      console.log('   Esto puede causar conflictos con el modo polling');
    } else {
      console.log('✅ No hay webhook configurado (modo polling activo)');
    }
    
    if (info.pending_update_count > 0) {
      console.log(`   📬 ${info.pending_update_count} mensajes pendientes`);
    }
  }
} catch (error) {
  console.log('❌ Error verificando webhook:', error.message);
}

console.log('\n' + '='.repeat(50));
console.log('✅ DIAGNÓSTICO COMPLETADO');
console.log('='.repeat(50));

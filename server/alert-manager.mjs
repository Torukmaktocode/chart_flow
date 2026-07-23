import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta al archivo de alertas
const ALERTS_FILE = path.join(__dirname, '..', 'data', 'alerts.json');

// Asegurar que existe la carpeta data
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Clase para gestionar alertas de precio
class AlertManager {
  constructor() {
    this.alerts = this.loadAlerts();
    this.priceCache = new Map();
    this.lastCheck = new Map();
    this.checkInterval = 30000; // 30 segundos
    this.listeners = [];
  }

  // Cargar alertas desde archivo
  loadAlerts() {
    try {
      if (fs.existsSync(ALERTS_FILE)) {
        const data = fs.readFileSync(ALERTS_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error cargando alertas:', error.message);
    }
    return [];
  }

  // Guardar alertas en archivo
  saveAlerts() {
    try {
      fs.writeFileSync(ALERTS_FILE, JSON.stringify(this.alerts, null, 2));
      return true;
    } catch (error) {
      console.error('Error guardando alertas:', error.message);
      return false;
    }
  }

  // Agregar nueva alerta
  addAlert({ symbol, targetPrice, direction = 'above', message = '', chatId = null }) {
    const alert = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      symbol: symbol.toUpperCase(),
      targetPrice: parseFloat(targetPrice),
      direction: direction, // 'above' o 'below'
      message: message || `Alerta para ${symbol}`,
      chatId: chatId,
      active: true,
      createdAt: new Date().toISOString(),
      triggeredAt: null,
      repeat: false, // Si se repite después de activarse
    };

    this.alerts.push(alert);
    this.saveAlerts();
    
    console.log(`✅ Alerta creada: ${alert.symbol} ${alert.direction === 'above' ? '≥' : '≤'} $${alert.targetPrice}`);
    return alert;
  }

  // Eliminar alerta
  removeAlert(alertId) {
    const index = this.alerts.findIndex(a => a.id === alertId);
    if (index !== -1) {
      const removed = this.alerts.splice(index, 1)[0];
      this.saveAlerts();
      console.log(`🗑️ Alerta eliminada: ${removed.symbol}`);
      return removed;
    }
    return null;
  }

  // Actualizar alerta existente
  updateAlert(alertId, updates) {
    const index = this.alerts.findIndex(a => a.id === alertId);
    if (index !== -1) {
      this.alerts[index] = { ...this.alerts[index], ...updates };
      this.saveAlerts();
      console.log(`🔄 Alerta actualizada: ${this.alerts[index].symbol}`);
      return this.alerts[index];
    }
    return null;
  }

  // Activar/desactivar alerta
  toggleAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.active = !alert.active;
      this.saveAlerts();
      console.log(`🔄 Alerta ${alert.active ? 'activada' : 'desactivada'}: ${alert.symbol}`);
      return alert;
    }
    return null;
  }

  // Obtener todas las alertas
  getAllAlerts() {
    return this.alerts;
  }

  // Obtener alertas activas
  getActiveAlerts() {
    return this.alerts.filter(a => a.active);
  }

  // Obtener alertas por símbolo
  getAlertsBySymbol(symbol) {
    return this.alerts.filter(a => a.symbol === symbol.toUpperCase());
  }

  // Verificar si una alerta debe activarse
  shouldTrigger(alert, currentPrice) {
    if (!alert.active) return false;
    
    const { targetPrice, direction } = alert;
    
    if (direction === 'above') {
      return currentPrice >= targetPrice;
    } else {
      return currentPrice <= targetPrice;
    }
  }

  // Marcar alerta como activada
  markTriggered(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.triggeredAt = new Date().toISOString();
      if (!alert.repeat) {
        alert.active = false;
      }
      this.saveAlerts();
    }
  }

  // Registrar listener para notificaciones
  onAlert(callback) {
    this.listeners.push(callback);
  }

  // Notificar a los listeners
  notify(alert, currentPrice) {
    for (const listener of this.listeners) {
      try {
        listener(alert, currentPrice);
      } catch (error) {
        console.error('Error en listener de alerta:', error.message);
      }
    }
  }

  // Formatear mensaje de alerta
  formatAlertMessage(alert, currentPrice) {
    const direction = alert.direction === 'above' ? '📈 SUPERÓ' : '📉 BAJÓ DE';
    const emoji = alert.direction === 'above' ? '🟢' : '🔴';
    
    return `
🔔 *ALERTA DE PRECIO* 🔔
━━━━━━━━━━━━━━━━━━━━━

${emoji} ${alert.symbol} ${direction} $${alert.targetPrice}

💰 *Precio Actual:* $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🎯 *Precio Objetivo:* $${alert.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

📝 *Mensaje:* ${alert.message}
⏰ *Hora:* ${new Date().toLocaleString('es-CL')}

━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert System
    `.trim();
  }

  // Limpiar alertas antiguas activadas (más de 7 días)
  cleanOldTriggeredAlerts() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    this.alerts = this.alerts.filter(alert => {
      if (!alert.active && alert.triggeredAt) {
        const triggeredDate = new Date(alert.triggeredAt);
        return triggeredDate > sevenDaysAgo;
      }
      return true;
    });
    
    this.saveAlerts();
  }
}

// Instancia singleton
const alertManager = new AlertManager();

export default alertManager;
export { AlertManager };
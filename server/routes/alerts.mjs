import express from 'express';
import alertManager from '../alert-manager.mjs';
import { getCurrentPrice, getMonitorStatus, SYMBOL_MAP } from '../price-monitor.mjs';

const router = express.Router();

// GET /api/alerts - Obtener todas las alertas
router.get('/', (req, res) => {
  try {
    const alerts = alertManager.getAllAlerts();
    res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/alerts/active - Obtener alertas activas
router.get('/active', (req, res) => {
  try {
    const alerts = alertManager.getActiveAlerts();
    res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/alerts/symbol/:symbol - Obtener alertas por símbolo
router.get('/symbol/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const alerts = alertManager.getAlertsBySymbol(symbol);
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/alerts - Crear nueva alerta
router.post('/', (req, res) => {
  try {
    const { symbol, targetPrice, direction, message, chatId } = req.body;
    
    // Validaciones
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'El símbolo es requerido',
      });
    }
    
    if (!targetPrice || isNaN(targetPrice)) {
      return res.status(400).json({
        success: false,
        error: 'El precio objetivo debe ser un número',
      });
    }
    
    if (direction && !['above', 'below'].includes(direction)) {
      return res.status(400).json({
        success: false,
        error: 'La dirección debe ser "above" o "below"',
      });
    }
    
    const alert = alertManager.addAlert({
      symbol,
      targetPrice,
      direction: direction || 'above',
      message,
      chatId,
    });
    
    res.status(201).json({
      success: true,
      message: 'Alerta creada exitosamente',
      alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/alerts/sync - Sincronizar múltiples alertas desde el frontend
router.post('/sync', (req, res) => {
  try {
    const { alerts: incomingAlerts } = req.body;
    if (!Array.isArray(incomingAlerts)) {
      return res.status(400).json({ success: false, error: 'Se requiere un array de alertas' });
    }

    let created = 0, updated = 0;
    incomingAlerts.forEach(alert => {
      const existing = alertManager.getAllAlerts().find(a => a.id === alert.id);
      if (existing) {
        // Actualizar existente
        alertManager.updateAlert(alert.id, {
          symbol: alert.symbol?.toUpperCase(),
          targetPrice: parseFloat(alert.targetPrice),
          direction: alert.direction || 'cross',
          message: alert.message,
          active: alert.active !== false,
        });
        updated++;
      } else {
        // Crear nueva
        alertManager.addAlert({
          symbol: alert.symbol,
          targetPrice: alert.targetPrice,
          direction: alert.direction || 'cross',
          message: alert.message,
          chatId: alert.chatId || null,
        });
        // Preservar el ID original
        const all = alertManager.getAllAlerts();
        const last = all[all.length - 1];
        if (last && alert.id) {
          last.id = alert.id;
          last.active = alert.active !== false;
          if (alert.createdAt) last.createdAt = alert.createdAt;
          alertManager.saveAlerts();
        }
        created++;
      }
    });

    res.json({
      success: true,
      message: `${created} creadas, ${updated} actualizadas`,
      total: alertManager.getAllAlerts().length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/alerts/:id - Actualizar alerta individual
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, targetPrice, direction, message, active } = req.body;
    
    // Verificar que existe
    const existing = alertManager.getAllAlerts().find(a => a.id === id);
    if (!existing) {
      // Si no existe, crearla con ese ID
      const alert = alertManager.addAlert({
        symbol: symbol || 'UNKNOWN',
        targetPrice: targetPrice || 0,
        direction: direction || 'cross',
        message,
      });
      // Preservar el ID solicitado
      const all = alertManager.getAllAlerts();
      const last = all[all.length - 1];
      if (last) {
        last.id = id;
        last.active = active !== false;
        alertManager.saveAlerts();
      }
      return res.json({ success: true, message: 'Alerta creada', alert: { ...alert, id } });
    }

    const updated = alertManager.updateAlert(id, {
      symbol: symbol?.toUpperCase(),
      targetPrice: targetPrice !== undefined ? parseFloat(targetPrice) : undefined,
      direction,
      message,
      active: active !== undefined ? active : undefined,
    });

    res.json({
      success: true,
      message: 'Alerta actualizada',
      alert: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/alerts/:id - Eliminar alerta
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const removed = alertManager.removeAlert(id);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Alerta no encontrada',
      });
    }
    
    res.json({
      success: true,
      message: 'Alerta eliminada exitosamente',
      alert: removed,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PATCH /api/alerts/:id/toggle - Activar/desactivar alerta
router.patch('/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const alert = alertManager.toggleAlert(id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alerta no encontrada',
      });
    }
    
    res.json({
      success: true,
      message: `Alerta ${alert.active ? 'activada' : 'desactivada'}`,
      alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/alerts/price/:symbol - Obtener precio actual de un símbolo
router.get('/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const priceData = await getCurrentPrice(symbol);
    
    if (!priceData) {
      return res.status(404).json({
        success: false,
        error: `No se pudo obtener precio para ${symbol}`,
      });
    }
    
    res.json({
      success: true,
      price: priceData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/alerts/symbols - Obtener lista de símbolos disponibles
router.get('/symbols', (req, res) => {
  try {
    const symbols = Object.entries(SYMBOL_MAP).map(([key, value]) => ({
      symbol: key,
      yahooSymbol: value,
    }));
    
    res.json({
      success: true,
      count: symbols.length,
      symbols,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/alerts/status - Obtener estado del monitor
router.get('/status', (req, res) => {
  try {
    const status = getMonitorStatus();
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
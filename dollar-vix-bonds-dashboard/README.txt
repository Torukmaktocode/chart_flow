DOLLAR / VIX / US10Y DASHBOARD
===============================

Panel estilo TradingView con:
  - DXY: Indice del dolar de EE. UU. en velas
  - VIX: linea roja
  - US10Y: rendimiento del bono publico EE. UU. a 10 anos en velas Heikin Ashi

DATOS
-----
Fuente: Yahoo Chart via servidor local/proxy.
Simbolos:
  - DXY: DX-Y.NYB
  - VIX: ^VIX
  - US10Y: ^TNX, rendimiento en porcentaje

USO
---
Ejecuta:
  powershell -ExecutionPolicy Bypass -File launch.ps1

Luego abre:
  http://127.0.0.1:8770/dashboard.html

CONTROLES
---------
  - Rueda sobre el grafico: zoom horizontal
  - Rueda sobre la escala derecha: zoom vertical/precio
  - Doble clic: reset de zoom
  - Actualiza automaticamente cada 30 segundos

REQUISITO
---------
Usa el Node.js incluido en Codex si existe; si no, intenta usar node del sistema.

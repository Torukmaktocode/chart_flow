# Ampliar historial de backtesting (EURUSD y XAUUSD con anios de datos)

Yahoo limita 5m/15m/30m a ~60 dias. Para ANOS completos de esos timeframes
se usa HistData.com (gratis, sin API key) para EURUSD y XAUUSD (oro spot).
Para crypto ya hay anos completos via Binance (`download-history.js`).

## Como correr (procedimiento asistido por navegador)

1. Levantar el navegador de prueba:
   ```
   agent-browser --session chartflow-test open https://www.histdata.com
   ```
   (aceptar el aviso de cookies si aparece)

2. Ir a la pagina anual del par:
   `https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/<pair>/<year>`

3. En el navegador, fijar `window.__hdPair=<pair>` y pegar el contenido de
   `hd-browser-fn.js` (define `window.__hdFetch(year)`).

4. Por cada ano:
   ```
   agent-browser eval "window.__hdFetch(2022); 'ok'"
   agent-browser eval "String(window.__hdState)"   # espera "ZIP-OK-<year> <bytes>"
   ```
   Extraer `window.__hdZip` (base64) por slices de 300k y decodificar a .zip
   (ver `histdata-yearly.ps1`, automatiza pasos 3 y 4 completos).

5. Merge al historial del backtest:
   ```
   node tools/merge-histdata.js <csv-descomprimido> <SYMBOL>
   ```
   Agrega 5m/15m/30m/1h deduplicado contra los JSON existentes.

Par de oro en HistData: `xauusd` — EURUSD: `eurusd`.
Los indices (NAS100/US500/US30) no existen en HistData: sus velas de 5m/15m/30m
quedan limitadas a ~60 dias (Yahoo) hasta integrar Polygon o Dukascopy ticks.

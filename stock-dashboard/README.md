# Stock Dashboard

Dashboard local para acciones NASDAQ con estilo TradingView.

## URL

```text
http://127.0.0.1:8765/dashboard.html
```

## Simbolos

- NVDA
- AAPL
- MSFT
- AMZN
- GOOGL
- GOOG
- META
- TSLA

## Uso

Desde esta carpeta:

```powershell
powershell -ExecutionPolicy Bypass -File ".\launch.ps1"
```

O desde la carpeta raiz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File ".\start-all.ps1"
```

## Datos

- Historico intradia: Yahoo Chart, con pre-market y post-market cuando la fuente lo entrega.
- Precio vivo: Massive/Polygon si existe una clave local.
- Fallback: Yahoo Chart cuando la fuente real-time no autoriza el dato.

## Configuracion local

Opciones para la clave real-time:

```powershell
$env:MASSIVE_API_KEY = "tu_clave"
```

Tambien puede usarse:

```powershell
$env:POLYGON_API_KEY = "tu_clave"
```

Como alternativa local, el servidor lee `polygon_key.txt` dentro de esta carpeta.
Ese archivo queda ignorado por Git.

# Dollar / VIX / US10Y Dashboard

Dashboard macro local con tres paneles estilo TradingView.

## URL

```text
http://127.0.0.1:8770/dashboard.html
```

## Instrumentos

- DXY: indice del dolar de EE. UU. en velas.
- VIX: indice de volatilidad en linea roja.
- US10Y: rendimiento del bono publico de EE. UU. a 10 anos en velas Heikin Ashi.

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

Fuente: Yahoo Chart via servidor local/proxy.

Simbolos usados:

- DXY: `DX-Y.NYB`
- VIX: `^VIX`
- US10Y: `^TNX`

## Controles

- Rueda sobre el grafico: zoom horizontal.
- Rueda sobre la escala derecha: zoom vertical/precio.
- Doble clic: reset de zoom.
- Refresco completo cada 30 segundos.

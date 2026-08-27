import os
import sys
import yfinance as yf
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.patches as mpatches
from matplotlib.ticker import FuncFormatter
import requests
from datetime import datetime
import numpy as np

# Configuración de Telegram
BOT_TOKEN = "8798093524:AAGon-9SrOKqLefgncEfjL5f1K8H3ZGYmIU"
CHAT_ID = "6954214949"

# Mapeo de símbolos de Yahoo Finance
SYMBOLS = {
    "NAS100": {"yahoo": "^NDX", "label": "NASDAQ 100"},
    "NASDAQ": {"yahoo": "^NDX", "label": "NASDAQ 100"},
    "US30": {"yahoo": "^DJI", "label": "DOW JONES"},
    "DJI": {"yahoo": "^DJI", "label": "DOW JONES"},
    "US500": {"yahoo": "^GSPC", "label": "S&P 500"},
    "SPX": {"yahoo": "^GSPC", "label": "S&P 500"},
    "EURUSD": {"yahoo": "EURUSD=X", "label": "EUR/USD"},
    "GBPUSD": {"yahoo": "GBPUSD=X", "label": "GBP/USD"},
    "USDJPY": {"yahoo": "USDJPY=X", "label": "USD/JPY"},
    "BTC": {"yahoo": "BTC-USD", "label": "BTC/USD"},
    "ETH": {"yahoo": "ETH-USD", "label": "ETH/USD"},
    "SOL": {"yahoo": "SOL-USD", "label": "SOL/USD"},
    "XAUUSD": {"yahoo": "GC=F", "label": "GOLD"},
    "GOLD": {"yahoo": "GC=F", "label": "GOLD"},
    "AAPL": {"yahoo": "AAPL", "label": "APPLE"},
    "TSLA": {"yahoo": "TSLA", "label": "TESLA"},
    "NVDA": {"yahoo": "NVDA", "label": "NVIDIA"},
}

# Timeframes de Yahoo Finance
TIMEFRAMES = {
    "1m": {"period": "1d", "interval": "1m"},
    "5m": {"period": "5d", "interval": "5m"},
    "15m": {"period": "5d", "interval": "15m"},
    "1h": {"period": "1mo", "interval": "60m"},
    "4h": {"period": "3mo", "interval": "60m"},
    "1d": {"period": "1y", "interval": "1d"},
    "1w": {"period": "5y", "interval": "1wk"},
}

def send_photo(image_path, caption):
    """Enviar foto por Telegram"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    with open(image_path, "rb") as photo:
        files = {"photo": photo}
        data = {"chat_id": CHAT_ID, "caption": caption}
        response = requests.post(url, files=files, data=data)
    return response.json()

def calculate_indicators(df):
    """Calcular indicadores técnicos"""
    # Moving Averages
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['MA50'] = df['Close'].rolling(window=50).mean()
    
    # RSI
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    return df

def generate_chart(symbol_key, tf="1d"):
    """Generar gráfico con datos reales de Yahoo Finance"""
    # Obtener información del símbolo
    if symbol_key not in SYMBOLS:
        print(f"Símbolo no encontrado: {symbol_key}")
        sys.exit(1)
    
    symbol_info = SYMBOLS[symbol_key]
    yahoo_symbol = symbol_info["yahoo"]
    label = symbol_info["label"]
    
    # Obtener configuración del timeframe
    if tf not in TIMEFRAMES:
        print(f"Timeframe no encontrado: {tf}")
        sys.exit(1)
    
    tf_config = TIMEFRAMES[tf]
    
    print(f"Obteniendo datos de {label} ({yahoo_symbol})...")
    
    # Descargar datos
    ticker = yf.Ticker(yahoo_symbol)
    df = ticker.history(period=tf_config["period"], interval=tf_config["interval"])
    
    if df.empty:
        print("No se pudieron obtener datos")
        sys.exit(1)
    
    # Calcular indicadores
    df = calculate_indicators(df)
    
    # Crear gráfico con subplots (2 en lugar de 3, sin MACD)
    fig = plt.figure(figsize=(14, 8))
    
    # Grid para los gráficos
    gs = fig.add_gridspec(2, 1, height_ratios=[4, 1], hspace=0.05)
    
    # Gráfico de velas japonesas
    ax1 = fig.add_subplot(gs[0])
    
    # Dibujar velas japonesas
    width = 0.6
    width2 = 0.05
    
    # Colores: verde para alcista, rojo para bajista
    color_up = "#00e5a0"
    color_down = "#ff3355"
    
    # Determinar dirección de las velas
    up = df[df.Close >= df.Open]
    down = df[df.Open > df.Close]
    
    # Dibujar velas alcistas (cuerpo verde)
    ax1.bar(up.index, up.Close - up.Open, width, bottom=up.Open, color=color_up, edgecolor=color_up, linewidth=0.5)
    ax1.bar(up.index, up.High - up.Close, width2, bottom=up.Close, color=color_up, linewidth=0.5)
    ax1.bar(up.index, up.Low - up.Open, width2, bottom=up.Open, color=color_up, linewidth=0.5)
    
    # Dibujar velas bajistas (cuerpo rojo)
    ax1.bar(down.index, down.Close - down.Open, width, bottom=down.Open, color=color_down, edgecolor=color_down, linewidth=0.5)
    ax1.bar(down.index, down.High - down.Open, width2, bottom=down.Open, color=color_down, linewidth=0.5)
    ax1.bar(down.index, down.Low - down.Close, width2, bottom=down.Close, color=color_down, linewidth=0.5)
    
    # Medias móviles
    ax1.plot(df.index, df["MA20"], color="#FFD700", linewidth=1, alpha=0.8, label="MA20")
    ax1.plot(df.index, df["MA50"], color="#FF6B6B", linewidth=1, alpha=0.8, label="MA50")
    
    # Calcular cambios
    last_price = df["Close"].iloc[-1]
    first_price = df["Close"].iloc[0]
    change = last_price - first_price
    change_pct = (change / first_price) * 100
    
    # Configurar gráfico de precio
    ax1.set_title(f"{label} ({yahoo_symbol}) - {last_price:.2f} USD", fontsize=14, fontweight="bold")
    ax1.set_ylabel("Precio (USD)")
    ax1.grid(True, alpha=0.3)
    ax1.legend(loc="upper left")
    
    # Gráfico de volumen
    ax2 = fig.add_subplot(gs[1], sharex=ax1)
    colors = [color_up if close >= open else color_down for close, open in zip(df["Close"], df["Open"])]
    ax2.bar(df.index, df["Volume"], color=colors, alpha=0.6)
    ax2.set_ylabel("Volumen")
    ax2.grid(True, alpha=0.3)
    
    # Configurar eje X en ax2 (barra de volumen) y ocultar en ax1
    ax1.tick_params(axis='x', which='both', bottom=False, top=False, labelbottom=False)
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%d %b %H:%M"))
    ax2.tick_params(axis='x', rotation=45, which='both')
    
    # Formatear eje Y de precio con separador de miles
    ax1.yaxis.set_major_formatter(FuncFormatter(lambda x, p: f"{x:,.2f}"))
    
    # Guardar gráfico
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(output_dir, f"{symbol_key}_{tf}_chart.png")
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    
    print(f"Gráfico guardado: {output_path}")
    
    # Preparar datos para el caption
    date_str = df.index[-1].strftime("%d/%m/%Y %H:%M")
    
    # Obtener valores de indicadores
    rsi = df["RSI"].iloc[-1]
    
    # Determinar tendencia RSI
    if rsi > 70:
        rsi_signal = "Sobrecomprado"
    elif rsi < 30:
        rsi_signal = "Sobrevendido"
    else:
        rsi_signal = "Neutral"
    
    caption = f"""📊 {label} ({yahoo_symbol}) - {last_price:.2f} USD

💰 Precio: ${last_price:,.2f}
📈 Cambio: {change_pct:+.2f}%
📅 Periodo: {tf_config['period']} | Intervalo: {tf_config['interval']}

📉 Indicadores:
• RSI: {rsi:.1f} ({rsi_signal})
• MA20: ${df['MA20'].iloc[-1]:,.2f}
• MA50: ${df['MA50'].iloc[-1]:,.2f}

🕐 {date_str}"""
    
    return output_path, caption

def main():
    # Parsear argumentos
    args = sys.argv[1:]
    if len(args) < 1:
        print("Uso: python send-chart.py <SÍMBOLO> [TIMEFRAME]")
        print("Ejemplo: python send-chart.py BTC 15m")
        sys.exit(1)
    
    symbol = args[0].upper()
    tf = args[1] if len(args) > 1 else "1d"
    
    # Generar gráfico
    chart_path, caption = generate_chart(symbol, tf)
    
    # Enviar por Telegram
    print("Enviando gráfico por Telegram...")
    result = send_photo(chart_path, caption)
    
    if result.get("ok"):
        print("OK: Gráfico enviado")
    else:
        print(f"Error: {result.get('description', 'Error desconocido')}")
        sys.exit(1)
    
    # Eliminar archivo temporal
    os.remove(chart_path)

if __name__ == "__main__":
    main()

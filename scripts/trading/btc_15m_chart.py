import os, yfinance as yf
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.ticker import FuncFormatter

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "btc_15m_chart.png")

ticker = yf.Ticker("BTC-USD")
df = ticker.history(period="5d", interval="15m")

fig, ax = plt.subplots(figsize=(14, 7))
ax.plot(df.index, df["Close"], color="#F7931A", linewidth=1.5)
ax.fill_between(df.index, df["Close"], alpha=0.1, color="#F7931A")

ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b\n%H:%M"))
ax.yaxis.set_major_formatter(FuncFormatter(lambda x, p: f"${x:,.0f}"))
ax.set_title("Bitcoin (BTC-USD) - 15 minutos", fontsize=14, fontweight="bold")
ax.set_xlabel("")
ax.set_ylabel("Precio (USD)")
ax.grid(True, alpha=0.3)
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(out, dpi=150)

last = df["Close"].iloc[-1]
first = df["Close"].iloc[0]
change = ((last / first) - 1) * 100
date = df.index[-1].strftime("%Y-%m-%d %H:%M")
print(f"Chart saved: {out}")
print(f"Last close: ${last:,.2f} on {date}")
print(f"Change: {change:+.2f}% over period")
print(f"Bars: {len(df)}")

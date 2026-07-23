import yfinance as yf
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.ticker import FuncFormatter

ticker = yf.Ticker("^NDX")
df = ticker.history(period="6mo")

fig, ax = plt.subplots(figsize=(12, 6))
ax.plot(df.index, df["Close"], color="#2196F3", linewidth=2)
ax.fill_between(df.index, df["Close"], alpha=0.1, color="#2196F3")

ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
ax.yaxis.set_major_formatter(FuncFormatter(lambda x, p: f"{x:,.0f}"))
ax.set_title("NASDAQ 100 (^NDX) - Ultimos 6 Meses", fontsize=14, fontweight="bold")
ax.set_xlabel("")
ax.set_ylabel("Precio (USD)")
ax.grid(True, alpha=0.3)
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig("nas100_chart.png", dpi=150)

last = df["Close"][-1]
first = df["Close"][0]
change = ((last / first) - 1) * 100
date = df.index[-1].strftime("%Y-%m-%d")
print(f"Chart saved. Last close: {last:,.2f} on {date}")
print(f"Change: {change:+.2f}% over period")

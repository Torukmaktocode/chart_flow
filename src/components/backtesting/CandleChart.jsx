import { useEffect, useMemo, useRef, useState } from "react";

export default function CandleChart({ candles, trades, currentIndex }) {
  const chartRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { visibleCandles, priceMin, priceMax, candleWidth, pathD } = useMemo(() => {
    if (!candles.length) return { visibleCandles: [], priceMin: 0, priceMax: 0, candleWidth: 0, pathD: "" };

    const visible = candles.slice(0, currentIndex + 1);
    if (!visible.length) return { visibleCandles: [], priceMin: 0, priceMax: 0, candleWidth: 0, pathD: "" };

    const prices = visible.flatMap((c) => [c.high, c.low]);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    const pad = (max - min) * 0.08 || 1;
    min -= pad;
    max += pad;

    const w = dimensions.width;
    const h = dimensions.height;
    const cw = Math.max(2, Math.min(w / visible.length - 1, 12));

    let path = "";
    if (visible.length > 1) {
      path = visible.map((c, i) => {
        const x = (i / (visible.length - 1)) * w;
        const y = h - ((c.close - min) / (max - min)) * h;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(" ");
    }

    return { visibleCandles: visible, priceMin: min, priceMax: max, candleWidth: cw, pathD: path };
  }, [candles, currentIndex, dimensions]);

  if (!visibleCandles.length) {
    return <div className="bt-chart" ref={chartRef}><div className="bt-chart-empty">No data</div></div>;
  }

  const w = dimensions.width;
  const h = dimensions.height;
  const range = priceMax - priceMin || 1;
  const yScale = (price) => h - ((price - priceMin) / range) * h;

  return (
    <div className="bt-chart" ref={chartRef}>
      <svg width={w} height={h} className="bt-chart-svg">
        {visibleCandles.map((c, i) => {
          const x = (i / Math.max(visibleCandles.length - 1, 1)) * w;
          const cw = candleWidth;
          const bodyTop = yScale(Math.max(c.open, c.close));
          const bodyBottom = yScale(Math.min(c.open, c.close));
          const bodyH = Math.max(bodyBottom - bodyTop, 1);
          const wickTop = yScale(c.high);
          const wickBottom = yScale(c.low);
          const isUp = c.close >= c.open;
          const color = isUp ? "#86efac" : "#fca5a5";

          return (
            <g key={i}>
              <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={color} strokeWidth={0.8} />
              <rect x={x - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={color} opacity={isUp ? 0.85 : 0.7} />
            </g>
          );
        })}

        <path d={pathD} fill="none" stroke="#67e8f9" strokeWidth="1.5" opacity="0.4" />

        {trades.filter((t) => t.status === "open" || t.status === "closed").map((t) => {
          const entryY = yScale(t.entryPrice);
          const entryX = (() => {
            const idx = visibleCandles.findIndex((c) => c.time === t.entryTime);
            if (idx >= 0) return (idx / Math.max(visibleCandles.length - 1, 1)) * w;
            return 0;
          })();
          return (
            <g key={t.id}>
              <line x1={0} y1={entryY} x2={w} y2={entryY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
              {t.stopLoss && (
                <line x1={0} y1={yScale(t.stopLoss)} x2={w} y2={yScale(t.stopLoss)} stroke="#f87171" strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
              )}
              {t.takeProfit && (
                <line x1={0} y1={yScale(t.takeProfit)} x2={w} y2={yScale(t.takeProfit)} stroke="#4ade80" strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
              )}
              <circle cx={entryX} cy={entryY} r={4} fill={t.side === "buy" ? "#22c55e" : "#ef4444"} />
            </g>
          );
        })}
      </svg>

      <div className="bt-chart-price-labels">
        <span>{priceMax.toFixed(2)}</span>
        <span>{((priceMax + priceMin) / 2).toFixed(2)}</span>
        <span>{priceMin.toFixed(2)}</span>
      </div>
    </div>
  );
}

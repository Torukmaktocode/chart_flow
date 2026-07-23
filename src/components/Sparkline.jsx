import { useMemo } from "react";

export default function Sparkline({ rows }) {
  const path = useMemo(() => {
    if (!rows?.length) return "";
    const width = 720;
    const height = 180;
    const values = rows.map((row) => row.close);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(max - min, 1);
    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width;
        const y = height - ((value - min) / spread) * height;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [rows]);

  return (
    <svg className="sparkline" viewBox="0 0 720 180" role="img" aria-label="Serie de precio">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L 720 180 L 0 180 Z`} fill="url(#lineFill)" />
      <path d={path} fill="none" stroke="#67e8f9" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

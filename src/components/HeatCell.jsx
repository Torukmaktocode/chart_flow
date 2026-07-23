import { formatNumber } from "../utils/constants";

export default function HeatCell({ label, value }) {
  const intensity = Math.min(Math.abs(value), 1);
  const positive = value >= 0;
  return (
    <div
      className="heat-cell"
      style={{
        "--heat": positive ? "34, 197, 94" : "239, 68, 68",
        "--alpha": 0.18 + intensity * 0.58
      }}
    >
      <span>{label}</span>
      <strong>{formatNumber(value * 100, 1)}%</strong>
    </div>
  );
}

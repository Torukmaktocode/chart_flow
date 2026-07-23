export default function Stat({ label, value, trend }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {trend && <em className={trend.startsWith("-") ? "down" : "up"}>{trend}</em>}
    </div>
  );
}

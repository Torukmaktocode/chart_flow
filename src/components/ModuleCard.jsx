export default function ModuleCard({ module, active, onClick }) {
  const Icon = module.icon;
  return (
    <button className={`module-card ${active ? "active" : ""}`} onClick={() => onClick(module.id)}>
      <span className="module-icon" style={{ "--accent": module.color }}>
        <Icon size={23} strokeWidth={2.2} />
      </span>
      <span className="module-copy">
        <strong>{module.title}</strong>
        <span>{module.text}</span>
      </span>
    </button>
  );
}

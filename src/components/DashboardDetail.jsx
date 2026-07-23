import Stat from "./Stat";
import HeatCell from "./HeatCell";
import { formatNumber, compact } from "../utils/constants";

export default function DashboardDetail({ active, data }) {
  const metrics = data?.metrics || {};
  const options = data?.options || {};
  const contracts = options.highestOi || [];

  if (active === "exposure") {
    return (
      <section className="detail-grid">
        <Stat label="GEX proxy" value={compact(metrics.gexProxy, 0)} />
        <Stat label="DEX proxy" value={compact(metrics.dexProxy, 0)} />
        <Stat label="VEX proxy" value={formatNumber(metrics.vannaProxy * 100, 1) + "%"} />
        <Stat label="CHEX proxy" value={formatNumber(metrics.charmProxy * 100, 1) + "%"} />
      </section>
    );
  }

  if (active === "flow") {
    return (
      <section className="heatmap">
        <HeatCell label="Flujo neto" value={metrics.flowScore || 0} />
        <HeatCell label="Call / Put vol" value={(1 / (options.putCallVolumeRatio || 1) - 1) || 0} />
        <HeatCell label="Volumen relativo" value={metrics.darkPoolProxy || 0} />
        <HeatCell label="Sesgo OI" value={Math.tanh((metrics.gexProxy || 0) / 100000)} />
      </section>
    );
  }

  if (active === "interest" || active === "stats") {
    return (
      <section className="table-wrap">
        <div className="table-head">
          <span>Contrato</span>
          <span>Tipo</span>
          <span>Strike</span>
          <span>Vol.</span>
          <span>OI</span>
        </div>
        {contracts.map((item) => (
          <div className="table-row" key={item.contractSymbol}>
            <span>{item.contractSymbol}</span>
            <span className={item.type === "CALL" ? "tag call" : "tag put"}>{item.type}</span>
            <span>{formatNumber(item.strike)}</span>
            <span>{compact(item.volume, 0)}</span>
            <span>{compact(item.openInterest, 0)}</span>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="detail-grid">
      <Stat label="Precio" value={`$${formatNumber(metrics.price)}`} trend={`${formatNumber(metrics.changePct, 2)}%`} />
      <Stat label="Volatilidad realizada" value={`${formatNumber(metrics.realizedVol, 2)}%`} />
      <Stat label="Volumen" value={compact(metrics.volume, 0)} />
      <Stat label="Dark proxy" value={`${formatNumber((metrics.darkPoolProxy || 0) * 100, 1)}%`} />
    </section>
  );
}

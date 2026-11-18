import Countdown from "./Countdown";
import { usdFmt, amtFmt, dateFmt, short } from "./parts";
import { EXPLORER } from "../lib/fetchers";

export function Summary({ v }) {
  return (
      <section className="card">
        <div className="label">Total Vault value</div>
        <div className="big">{usdFmt.format(v.totalUsd)}</div>
        {v.unpriced ? <p className="sub small">Some assets have no price yet and are not counted.</p> : null}
        <div className="row3">
          <div className="mini">
            <div className="l">Stocks</div>
            <div className="v">{v.stockCount}</div>
          </div>
          <div className="mini">
            <div className="l">Buys</div>
            <div className="v">{v.purchases.length}</div>
          </div>
          <div className="mini">
            <div className="l">ETH to deploy</div>
            <div className="v">{amtFmt.format(v.ethAmount)}</div>
          </div>
        </div>
        {v.totalUsd > 0 ? (
          <div className="bar" aria-hidden="true">
            {v.holdings
              .filter((h) => h.usd)
              .map((h, i) => (
                <span key={h.address} style={{ width: `${(h.usd / v.totalUsd) * 100}%`, opacity: Math.max(0.35, 1 - i * 0.2) }} />
              ))}
          </div>
        ) : null}
      </section>
  );
}

export function NextBuy({ v }) {
  return (
      <section className="card next">
        <div>
          <div className="label">Next Friday Buy</div>
          <div className="count">
            <Countdown />
          </div>
          <div className="sub small">Every Friday, 13:00 UTC</div>
        </div>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#C6FF3A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </section>
  );
}

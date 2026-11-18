import Countdown from "./Countdown";
import { usdFmt, amtFmt, dateFmt, short } from "./parts";
import { EXPLORER } from "../lib/fetchers";

export function Holdings({ v }) {
  return (
      <section className="card">
        <div className="label">Vault holdings</div>
        {v.holdings.length === 0 ? (
          <p className="sub empty">The Vault is empty for now. Holdings appear here once the first fees arrive.</p>
        ) : (
          <ul className="list">
            {v.holdings.map((h) => (
              <li className="hold" key={h.address}>
                {h.logo ? <img className="tk" src={h.logo} alt="" /> : <div className="tk">{h.symbol.slice(0, 4)}</div>}
                <div className="n">
                  <div>{h.isStock ? `${h.symbol} · ${h.name}` : h.name}</div>
                  <div>
                    {amtFmt.format(h.amount)} {h.symbol}
                  </div>
                </div>
                <div className="r">
                  <div>{h.usd != null ? usdFmt.format(h.usd) : "—"}</div>
                  <div>{h.usd != null && v.totalUsd > 0 ? `${Math.round((h.usd / v.totalUsd) * 100)}%` : ""}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
  );
}

export function Purchases({ v }) {
  return (
      <section className="card">
        <div className="label">Buy history</div>
        {v.purchases.length === 0 ? (
          <p className="sub empty">No stock buys yet. The first Friday Buy will show up here.</p>
        ) : (
          <ul className="list">
            {v.purchases.map((p, i) => (
              <li className="tx" key={`${p.tx}-${i}`}>
                <div>
                  <div>
                    Bought {amtFmt.format(p.amount)} {p.symbol}
                  </div>
                  <div className="d">{p.time ? dateFmt.format(new Date(p.time)) : ""}</div>
                </div>
                {p.tx ? (
                  <a className="lnk" href={`${EXPLORER}/tx/${p.tx}`} target="_blank" rel="noopener noreferrer">
                    Explorer ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
  );
}

export function AddressCard({ v }) {
  return (
      <section className="card">
        <div className="label">Vault address</div>
        <a className="addr" href={`${EXPLORER}/address/${v.address}`} target="_blank" rel="noopener noreferrer">
          {short(v.address)} ↗
        </a>
        <p className="sub small mono-full">{v.address}</p>
        <p className="sub small">Dedicated Vault wallet. Funds only move for Friday Buys, and every transaction is announced.</p>
      </section>
  );
}

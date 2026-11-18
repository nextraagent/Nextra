"use client";

import { useEffect, useRef, useState } from "react";
import "./agent-stats.css";

const EXPLORER = "https://robinhoodchain.blockscout.com";

function useCount(target, ms = 1200) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (now) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (target - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function Stat({ label, value, decimals = 0, suffix = "" }) {
  const v = useCount(value);
  return (
    <div className="as-stat">
      <b>
        {value == null ? "–" : v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        {suffix ? <small>{suffix}</small> : null}
      </b>
      <span>{label}</span>
    </div>
  );
}

export default function AgentStats() {
  const [s, setS] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/stats", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => alive && !d.error && setS(d))
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="as" aria-label="Agent activity">
      <div className="as-head">
        <span className="as-live">
          <i /> Agents at work
        </span>
        <span className="as-sub">Live totals from every Nextra agent, on-chain.</span>
      </div>
      <div className="as-grid">
        <Stat label="Trades executed" value={s?.trades} />
        <Stat label="Volume traded" value={s?.volumeEth} decimals={3} suffix=" ETH" />
        <Stat label="Agents launched" value={s?.agents} />
        <Stat label="Traders" value={s?.traders} />
      </div>
      {s?.recent?.length ? (
        <ul className="as-feed">
          {s.recent.map((r) => (
            <li key={r.tx}>
              <span className={`as-tag ${r.agent.toLowerCase()}`}>{r.agent}</span>
              <span className="as-what">
                <b>{r.side}</b> {r.token}
              </span>
              <span className="as-eth">{r.eth.toLocaleString("en-US", { maximumFractionDigits: 4 })} ETH</span>
              <span className="as-time">{ago(r.at)}</span>
              <a href={`${EXPLORER}/tx/${r.tx}`} target="_blank" rel="noopener noreferrer" aria-label="View transaction">
                tx ↗
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

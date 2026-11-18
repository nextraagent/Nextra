"use client";

import { useEffect, useRef, useState } from "react";
import "./token-card.css";

const CA = (process.env.NEXT_PUBLIC_NEXTRA_TOKEN || "0xe56cc0f5719dbf00e114990e65d2a1697b7b3fc1").toLowerCase();
const EXPLORER = "https://robinhoodchain.blockscout.com";
const TFS = ["5m", "1h", "1d"];

// $0.0₅4785 style for tiny prices
function Price({ v }) {
  if (v == null) return <>–</>;
  if (v >= 0.01) return <>${v.toLocaleString("en-US", { maximumFractionDigits: 4 })}</>;
  const s = v.toFixed(20).split(".")[1];
  const zeros = s.match(/^0*/)[0].length;
  const digits = s.slice(zeros, zeros + 4).replace(/0+$/, "") || "0";
  return (
    <>
      $0.0<sub>{zeros}</sub>
      {digits}
    </>
  );
}
const usd = (v) =>
  v == null ? "–" : `$${v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : v.toFixed(0)}`;
const tinyFmt = (p) => {
  if (!Number.isFinite(p) || p === 0) return "0";
  if (p >= 0.01) return p.toFixed(4);
  const e = Math.floor(Math.log10(Math.abs(p)));
  return p.toFixed(Math.min(18, -e + 3));
};

function Chart({ tf }) {
  const box = useRef(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let chart, series, alive = true, timer;
    (async () => {
      const lc = await import("lightweight-charts");
      if (!alive || !box.current) return;
      chart = lc.createChart(box.current, {
        autoSize: true,
        layout: { background: { type: "solid", color: "transparent" }, textColor: "#9a9585", fontFamily: "JetBrains Mono, ui-monospace, monospace", fontSize: 10, attributionLogo: false },
        grid: { vertLines: { color: "rgba(244,239,228,.05)" }, horzLines: { color: "rgba(244,239,228,.06)" } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
        timeScale: { borderVisible: false, timeVisible: tf !== "1d", secondsVisible: false, rightOffset: 3 },
        crosshair: { vertLine: { color: "rgba(138,209,26,.35)", labelBackgroundColor: "#2c2c27" }, horzLine: { color: "rgba(138,209,26,.35)", labelBackgroundColor: "#2c2c27" } },
        handleScale: { axisPressedMouseMove: false },
      });
      series = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#8ad11a",
        downColor: "#e5484d",
        borderVisible: false,
        wickUpColor: "#8ad11a",
        wickDownColor: "#e5484d",
        priceFormat: { type: "custom", minMove: 1e-12, formatter: tinyFmt },
      });
      const load = async () => {
        try {
          const r = await fetch(`/api/nextra/candles?tf=${tf}`, { cache: "no-store" });
          const d = await r.json();
          if (!alive) return;
          if (!d.candles?.length) return setState("empty");
          series.setData(d.candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
          setState("ok");
        } catch {
          alive && setState("error");
        }
      };
      await load();
      chart.timeScale().fitContent();
      timer = setInterval(load, 30000);
    })();
    return () => {
      alive = false;
      clearInterval(timer);
      chart?.remove();
    };
  }, [tf]);
  return (
    <div className="tc-chart">
      <div ref={box} className="tc-chart-box" />
      {state !== "ok" ? <div className="tc-chart-msg">{state === "loading" ? "Loading chart…" : state === "empty" ? "Not enough trades yet" : "Chart unavailable"}</div> : null}
    </div>
  );
}

export default function TokenCard() {
  const [s, setS] = useState(null);
  const [holders, setHolders] = useState(null);
  const [tf, setTf] = useState("5m");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/nextra", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => alive && !d.error && setS(d))
        .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    // holders fallback straight from the explorer
    fetch(`${EXPLORER}/api/v2/tokens/${CA}/counters`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.token_holders_count && setHolders(Number(d.token_holders_count)))
      .catch(() => {});
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const copy = () => {
    navigator.clipboard?.writeText(CA);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const ch = s?.change24h;
  const h = s?.holders ?? holders;

  return (
    <section className="tc" aria-label="$NEXTRA token">
      <div className="tc-top">
        <div className="tc-id">
          <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
            <rect x="7" y="7" width="31" height="31" rx="9" fill="none" stroke="#f4efe4" strokeWidth="7" />
            <rect x="26" y="26" width="31" height="31" rx="9" fill="none" stroke="#8ad11a" strokeWidth="7" />
          </svg>
          <div>
            <strong>$NEXTRA</strong>
            <span>
              <i className="tc-live" /> Robinhood Chain
            </span>
          </div>
        </div>
        {ch != null ? <span className={`tc-chg ${ch >= 0 ? "up" : "down"}`}>{`${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(1)}%`}</span> : null}
      </div>

      <div className="tc-stats">
        <div>
          <span>Price</span>
          <b>
            <Price v={s?.price} />
          </b>
        </div>
        <div>
          <span>Market cap</span>
          <b>{usd(s?.marketCap)}</b>
        </div>
        <div>
          <span>Holders</span>
          <b>{h != null ? h.toLocaleString("en-US") : "–"}</b>
        </div>
      </div>

      <div className="tc-tf" role="tablist" aria-label="Chart timeframe">
        {TFS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tf === t} className={tf === t ? "on" : ""} onClick={() => setTf(t)}>
            {t.toUpperCase()}
          </button>
        ))}
        {s?.burned ? <span className="tc-burn">{`${Math.round(s.burned).toLocaleString("en-US")} burned`}</span> : null}
      </div>
      <Chart key={tf} tf={tf} />

      <div className="tc-perf" aria-hidden="true" />

      <div className="tc-ca">
        <div>
          <span>Contract</span>
          <code title={CA}>{`${CA.slice(0, 8)}…${CA.slice(-6)}`}</code>
        </div>
        <button type="button" onClick={copy} className={copied ? "done" : ""}>
          {copied ? "Copied ✓" : "Copy CA"}
        </button>
      </div>
      <a className="tc-trade" href="/agents?token=NEXTRA">
        <span>
          <b>Trade with Sentry</b>
          <small>Buy now, auto-exit at your take-profit or stop-loss</small>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </a>
    </section>
  );
}

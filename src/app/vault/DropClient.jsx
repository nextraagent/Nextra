"use client";

import { useEffect, useState } from "react";
import { nextDrop } from "../../lib/rounds";
import { voteMessage } from "../../lib/voteMessage";

const SHARE = 0.1; // 10% of creator fees
const MIN = 1_000_000;
const pad = (n) => String(n).padStart(2, "0");
const fmt = (n, d = 4) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: d }) : "—");
const niceDay = (k) =>
  new Date(`${k}T14:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function DropCountdown() {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, nextDrop().getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const s = left == null ? null : Math.floor(left / 1000);
  const d = s == null ? 0 : Math.floor(s / 86400);
  const parts =
    s == null
      ? ["--", "--", "--"]
      : [pad(Math.floor((s % 86400) / 3600)), pad(Math.floor((s % 3600) / 60)), pad(s % 60)];
  const cells = d ? [[String(d), "days"], [parts[0], "hrs"], [parts[1], "min"]] : [[parts[0], "hrs"], [parts[1], "min"], [parts[2], "sec"]];
  return (
    <div className="vd-count" aria-live="off">
      {cells.map(([n, u]) => (
        <div key={u} className="vd-count-cell">
          <span className="vd-count-n">{n}</span>
          <span className="vd-count-u">{u}</span>
        </div>
      ))}
    </div>
  );
}

export function NextStock() {
  const [s, setS] = useState(null);
  useEffect(() => {
    fetch("/api/vote")
      .then((r) => r.json())
      .then((j) => setS(j?.next?.winner || null))
      .catch(() => {});
  }, []);
  return <strong>{s || "Voted by holders"}</strong>;
}

export function DropCalculator() {
  const [fees, setFees] = useState("1");
  const [bal, setBal] = useState("1000000");
  const [supply, setSupply] = useState("1000000000");

  const f = Number(fees);
  const b = Number(bal);
  const sup = Number(supply);
  const budget = f > 0 ? f * SHARE : 0;
  const eligible = b >= MIN;
  const share = eligible && sup > 0 ? Math.min(b / sup, 1) : 0;
  const mine = budget * share;

  return (
    <div className="vd-calc">
      <div className="vd-calc-in">
        <label>
          <span>Creator fees since last drop</span>
          <div className="vd-input">
            <input type="number" inputMode="decimal" min="0" step="any" value={fees} onChange={(e) => setFees(e.target.value)} />
            <em>ETH</em>
          </div>
        </label>
        <label>
          <span>Your $NEXTRA</span>
          <div className="vd-input">
            <input type="number" inputMode="decimal" min="0" step="any" value={bal} onChange={(e) => setBal(e.target.value)} />
          </div>
        </label>
        <label>
          <span>Eligible supply (holders with 1M+)</span>
          <div className="vd-input">
            <input type="number" inputMode="decimal" min="0" step="any" value={supply} onChange={(e) => setSupply(e.target.value)} />
          </div>
        </label>
      </div>
      <div className="vd-calc-out">
        <div>
          <span>Vault buys (10%)</span>
          <strong>{fmt(budget)} ETH</strong>
        </div>
        <div>
          <span>Your share of the drop</span>
          <strong>{eligible ? `${fmt(share * 100, 4)}%` : "—"}</strong>
        </div>
        <div className="hl">
          <span>You receive (in stock)</span>
          <strong>{eligible ? `≈ ${fmt(mine, 6)} ETH` : "Hold 1M+ to qualify"}</strong>
        </div>
      </div>
      <p className="vd-fine">Estimate only. Real numbers come from the chain at drop time and change with fees, price and supply.</p>
    </div>
  );
}

function toHex(str) {
  return "0x" + Array.from(new TextEncoder().encode(str), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function VoteBox({ candidates: initial }) {
  const [data, setData] = useState(null);
  const [addr, setAddr] = useState(null);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch("/api/vote", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ live: false }));
  useEffect(() => {
    load();
  }, []);

  const live = Boolean(data?.live && data?.open);
  const candidates = data?.candidates || initial;
  const counts = data?.open?.counts || {};
  const total = data?.open?.total || 0;
  const max = Math.max(1, ...Object.values(counts));

  async function connect() {
    setMsg("");
    const eth = typeof window !== "undefined" ? window.ethereum : null;
    if (!eth) {
      setMsg("No wallet found. Open this page in your wallet's browser (Robinhood Wallet, MetaMask, Trust…).");
      return null;
    }
    try {
      const [a] = await eth.request({ method: "eth_requestAccounts" });
      setAddr(a);
      return a;
    } catch {
      setMsg("Wallet connection was cancelled.");
      return null;
    }
  }

  async function vote() {
    if (!pick || !live) return;
    setBusy(true);
    setMsg("");
    try {
      const a = addr || (await connect());
      if (!a) return;
      const round = data.open.round;
      const signature = await window.ethereum.request({ method: "personal_sign", params: [toHex(voteMessage(round, a, pick)), a] });
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: a, symbol: pick, round, signature }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Vote failed.");
      setMsg(`Vote saved: ${pick}. You can change it until the round closes.`);
      setData((d) => ({ ...d, open: j.tally }));
    } catch (e) {
      setMsg(e?.message?.includes("rejected") ? "Signature cancelled." : e?.message || "Vote failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vd-votebox">
      {live ? (
        <p className="vd-round">
          Voting for the drop on <b>{niceDay(data.open.round)}</b> · {total} vote{total === 1 ? "" : "s"}
          {data?.next?.winner ? (
            <>
              {" "}
              · Next drop: <b>{data.next.winner}</b>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="vd-vote">
        {candidates.map((c) => {
          const n = counts[c] || 0;
          return (
            <button
              type="button"
              key={c}
              className={`vd-vote-item${pick === c ? " on" : ""}`}
              onClick={() => live && setPick(c)}
              disabled={!live}
              aria-pressed={pick === c}
            >
              <span className="vd-tk">{c}</span>
              <span className="vd-vote-bar" aria-hidden="true">
                <i style={{ width: `${live ? (n / max) * 100 : 0}%` }} />
              </span>
              <span className="vd-vote-n">{live ? n : "—"}</span>
            </button>
          );
        })}
      </div>
      {live ? (
        <div className="vd-vote-act">
          <button type="button" className="btn lime" onClick={vote} disabled={!pick || busy}>
            {busy ? "Signing…" : pick ? `Vote ${pick}` : "Pick a stock"}
          </button>
          {addr ? <span className="vd-fine">Wallet {addr.slice(0, 6)}…{addr.slice(-4)}</span> : null}
        </div>
      ) : null}
      <p className="vd-fine">
        {live
          ? "1 wallet = 1 vote. You need 1,000,000+ $NEXTRA. Signing is free — no transaction."
          : "Voting opens at launch. 1 wallet = 1 vote, 1,000,000+ $NEXTRA to vote."}
      </p>
      {msg ? (
        <p className="vd-msg" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

export function DropPreview() {
  const [p, setP] = useState(null);
  useEffect(() => {
    fetch("/api/drop", { cache: "no-store" })
      .then((r) => r.json())
      .then(setP)
      .catch(() => {});
  }, []);
  if (!p || (!p.stock && !p.reason)) return null;
  return (
    <div className="vd-preview">
      <div>
        <span>Next stock</span>
        <strong>{p.stock || "—"}</strong>
      </div>
      <div>
        <span>In the Vault</span>
        <strong>{p.vaultBalance ? `${fmt(Number(p.vaultBalance), 6)} ${p.stock}` : "—"}</strong>
      </div>
      <div>
        <span>Eligible holders</span>
        <strong>{p.eligible ?? "—"}</strong>
      </div>
      {p.reason ? <p className="vd-fine">{p.reason}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets, useSigners } from "@privy-io/react-auth";
import { createPublicClient, http, formatEther } from "viem";
import AgentIcon from "../AgentIcon";
import TokenLogo from "../TokenLogo";
import { SENTRY_TOKENS } from "../../lib/stocks";

const SENTRY_OPTIONS = ["NEXTRA", ...SENTRY_TOKENS];
import { robinhoodChain } from "./Providers";

const rpc = createPublicClient({ chain: robinhoodChain, transport: http() });
const SIGNER_ID = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID || "";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

function AccountBar({ ready, authenticated, login, logout, address, user }) {
  const [bal, setBal] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!address) return setBal(null);
    let live = true;
    const load = () =>
      rpc
        .getBalance({ address })
        .then((b) => live && setBal(Number(formatEther(b))))
        .catch(() => live && setBal(null));
    load();
    const id = setInterval(load, 20000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [address]);

  if (!ready) return <div className="ag-acct"><span className="ag-acct-muted">Loading account…</span></div>;
  if (!authenticated)
    return (
      <div className="ag-acct">
        <div>
          <strong>Log in to use the agents</strong>
          <span className="ag-acct-muted">Email, Google, X or your own wallet. You get a Robinhood Chain wallet automatically.</span>
        </div>
        <button type="button" className="btn primary" onClick={login}>
          Log in
        </button>
      </div>
    );
  const who = user?.email?.address || user?.google?.email || (user?.twitter?.username ? `@${user.twitter.username}` : null);
  return (
    <div className="ag-acct on">
      <div className="ag-acct-id">
        <span className="ag-acct-dot" />
        <div>
          <strong>{who || "Logged in"}</strong>
          <span className="ag-acct-muted">
            {address ? (
              <button
                type="button"
                className="ag-copy"
                onClick={() => {
                  navigator.clipboard?.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : shortAddr(address)}
              </button>
            ) : (
              "Creating your wallet…"
            )}
            {bal != null ? ` · ${bal.toLocaleString("en-US", { maximumFractionDigits: 5 })} ETH` : ""}
          </span>
        </div>
      </div>
      <button type="button" className="btn ghost" onClick={logout}>
        Log out
      </button>
    </div>
  );
}

const TOKENS = ["NVDA", "TSLA", "AAPL", "AMZN", "META", "GOOGL", "MSFT", "COIN", "HOOD", "NEXTRA"];

const AGENTS = [
  {
    id: "sentry",
    name: "Sentry",
    role: "TP/SL Agent",
    icon: "target",
    tagline: "Guards every exit.",
    text: "Buy a token and set take-profit and stop-loss. Sentry watches the price and exits for you.",
    defaults: { token: "NVDA", amount: "0.1", tp: "20", sl: "10", trailing: false },
  },
  {
    id: "tempo",
    name: "Tempo",
    role: "Interval Agent",
    icon: "clock",
    tagline: "Steady buys, steady sells.",
    text: "Buy in slowly (DCA) or sell a position in steps (TWAP) on a fixed schedule.",
    defaults: { mode: "DCA", token: "TSLA", perOrder: "0.01", every: "5", unit: "min", budget: "0.2" },
  },
  {
    id: "perch",
    name: "Perch",
    role: "Limit Order Agent",
    icon: "flag",
    tagline: "Waits for your price.",
    text: "Set the price you want. Perch waits and fills the order when the market gets there.",
    defaults: { side: "Buy", token: "NVDA", offset: "5", budget: "0.25", expiry: "24h", slippage: "1" },
  },
  {
    id: "echo",
    name: "Echo",
    role: "Copy Agent",
    icon: "copy",
    tagline: "Your favorite wallets, mirrored.",
    text: "Pick wallets to follow. When they trade, Echo mirrors it at the size you choose.",
    defaults: { wallets: [], sizeMode: "fixed", size: "0.02", cap: "0.1" },
  },
];

const STORE_KEY = "nextra.agents.v1";
const isAddr = (a) => /^0x[a-fA-F0-9]{40}$/.test(a.trim());
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const pos = (v) => Number(v) > 0;

function describe(id, c) {
  switch (id) {
    case "sentry":
      return `Buy ${c.amount} ETH of ${c.token === "NEXTRA" ? "$NEXTRA" : c.token}. Sell everything at +${c.tp}% profit or −${c.sl}% loss${
        c.trailing ? ", with a trailing stop that follows the price up" : ""
      }.`;
    case "tempo":
      return `${c.mode === "DCA" ? "Buy" : "Sell"} ${c.perOrder} ETH of ${c.token} every ${c.every} ${
        c.unit === "sec" ? "seconds" : "minutes"
      } until ${c.budget} ETH in total is ${c.mode === "DCA" ? "spent" : "sold"}.`;
    case "perch":
      return `${c.side} ${c.token} with ${c.budget} ETH when the price is ${c.offset}% ${
        c.side === "Buy" ? "below" : "above"
      } today's market. Max slippage ${c.slippage}%. Cancels after ${c.expiry}.`;
    case "echo":
      return c.wallets.length
        ? `Copy every trade from ${c.wallets.length} wallet${c.wallets.length > 1 ? "s" : ""} at ${
            c.sizeMode === "fixed" ? `${c.size} ETH per trade` : `${c.size}% of their trade size`
          }. Spend at most ${c.cap} ETH per wallet per day.`
        : "Add at least one wallet to follow.";
    default:
      return "";
  }
}

function validate(id, c) {
  if (id === "sentry") return pos(c.amount) && Number(c.tp) >= 0.5 && Number(c.sl) >= 0.5 && Number(c.sl) < 100;
  if (id === "tempo") {
    const e = Number(c.every);
    const okEvery = c.unit === "sec" ? e >= 10 && e <= 60 : e >= 1 && e <= 10;
    return okEvery && pos(c.perOrder) && pos(c.budget) && Number(c.budget) >= Number(c.perOrder);
  }
  if (id === "perch") return pos(c.offset) && Number(c.offset) < 100 && pos(c.budget) && pos(c.slippage);
  if (id === "echo") return c.wallets.length > 0 && pos(c.size) && pos(c.cap);
  return false;
}

function Field({ label, hint, children }) {
  return (
    <label className="ag-field">
      <span className="ag-label">{label}</span>
      {children}
      {hint ? <span className="ag-hint">{hint}</span> : null}
    </label>
  );
}

function Num({ value, onChange, suffix, step = "any" }) {
  return (
    <div className="ag-input">
      <input type="number" inputMode="decimal" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
      {suffix ? <span>{suffix}</span> : null}
    </div>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div className="ag-seg" role="radiogroup">
      {options.map((o) => (
        <button type="button" key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function TokenSelect({ value, onChange, options = TOKENS, logo = false }) {
  return (
    <div className="ag-input">
      {logo ? <TokenLogo symbol={value} size={26} /> : null}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((t) => (
          <option key={t} value={t}>
            {t === "NEXTRA" ? "$NEXTRA" : t}
          </option>
        ))}
      </select>
    </div>
  );
}

function SentryForm({ c, set }) {
  return (
    <>
      <Field label="Token" hint={c.token === "NEXTRA" ? "Trades on the Pons curve. Early buys may pay Pons' snipe tax." : undefined}>
        <TokenSelect value={c.token} onChange={(v) => set("token", v)} options={SENTRY_OPTIONS} logo />
      </Field>
      <Field label="Buy amount" hint="Keep a little extra ETH in your wallet for gas.">
        <Num value={c.amount} onChange={(v) => set("amount", v)} suffix="ETH" />
      </Field>
      <div className="ag-two">
        <Field label="Take-profit">
          <Num value={c.tp} onChange={(v) => set("tp", v)} suffix="%" />
        </Field>
        <Field label="Stop-loss">
          <Num value={c.sl} onChange={(v) => set("sl", v)} suffix="%" />
        </Field>
      </div>
      <label className="ag-check">
        <input type="checkbox" checked={c.trailing} onChange={(e) => set("trailing", e.target.checked)} />
        <span>Trailing stop — move the stop-loss up as the price rises</span>
      </label>
    </>
  );
}

function TempoForm({ c, set }) {
  return (
    <>
      <Field label="Mode">
        <Seg options={[{ v: "DCA", l: "DCA · buy slowly" }, { v: "TWAP", l: "TWAP · sell in steps" }]} value={c.mode} onChange={(v) => set("mode", v)} />
      </Field>
      <Field label="Token">
        <TokenSelect value={c.token} onChange={(v) => set("token", v)} />
      </Field>
      <div className="ag-two">
        <Field label="Amount per order">
          <Num value={c.perOrder} onChange={(v) => set("perOrder", v)} suffix="ETH" />
        </Field>
        <Field label="Total budget">
          <Num value={c.budget} onChange={(v) => set("budget", v)} suffix="ETH" />
        </Field>
      </div>
      <Field label="Every" hint={c.unit === "sec" ? "10–60 seconds" : "1–10 minutes"}>
        <div className="ag-row">
          <Num value={c.every} onChange={(v) => set("every", v)} step="1" />
          <Seg options={[{ v: "sec", l: "sec" }, { v: "min", l: "min" }]} value={c.unit} onChange={(v) => set("unit", v)} />
        </div>
      </Field>
    </>
  );
}

function PerchForm({ c, set }) {
  return (
    <>
      <Field label="Side">
        <Seg options={[{ v: "Buy", l: "Buy below" }, { v: "Sell", l: "Sell above" }]} value={c.side} onChange={(v) => set("side", v)} />
      </Field>
      <Field label="Token">
        <TokenSelect value={c.token} onChange={(v) => set("token", v)} />
      </Field>
      <div className="ag-two">
        <Field label={c.side === "Buy" ? "Below market" : "Above market"}>
          <Num value={c.offset} onChange={(v) => set("offset", v)} suffix="%" />
        </Field>
        <Field label="Budget">
          <Num value={c.budget} onChange={(v) => set("budget", v)} suffix="ETH" />
        </Field>
      </div>
      <div className="ag-two">
        <Field label="Expires after">
          <Seg options={[{ v: "1h", l: "1h" }, { v: "24h", l: "24h" }, { v: "7d", l: "7d" }]} value={c.expiry} onChange={(v) => set("expiry", v)} />
        </Field>
        <Field label="Max slippage">
          <Num value={c.slippage} onChange={(v) => set("slippage", v)} suffix="%" />
        </Field>
      </div>
    </>
  );
}

function EchoForm({ c, set }) {
  const [draft, setDraft] = useState("");
  const ok = isAddr(draft) && !c.wallets.includes(draft.trim().toLowerCase());
  const add = () => {
    if (!ok) return;
    set("wallets", [...c.wallets, draft.trim().toLowerCase()]);
    setDraft("");
  };
  return (
    <>
      <Field label="Wallets to follow" hint={draft && !isAddr(draft) ? "Paste a full 0x… address" : null}>
        <div className="ag-row">
          <div className="ag-input grow">
            <input
              type="text"
              placeholder="0x…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <button type="button" className="btn ghost ag-add" onClick={add} disabled={!ok}>
            Add
          </button>
        </div>
      </Field>
      {c.wallets.length ? (
        <ul className="ag-wallets">
          {c.wallets.map((w) => (
            <li key={w}>
              <code>{short(w)}</code>
              <button type="button" aria-label={`Remove ${w}`} onClick={() => set("wallets", c.wallets.filter((x) => x !== w))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Field label="Trade size">
        <Seg options={[{ v: "fixed", l: "Fixed ETH" }, { v: "pct", l: "% of their trade" }]} value={c.sizeMode} onChange={(v) => set("sizeMode", v)} />
      </Field>
      <div className="ag-two">
        <Field label={c.sizeMode === "fixed" ? "Per trade" : "Copy size"}>
          <Num value={c.size} onChange={(v) => set("size", v)} suffix={c.sizeMode === "fixed" ? "ETH" : "%"} />
        </Field>
        <Field label="Daily cap per wallet">
          <Num value={c.cap} onChange={(v) => set("cap", v)} suffix="ETH" />
        </Field>
      </div>
    </>
  );
}

const FORMS = { sentry: SentryForm, tempo: TempoForm, perch: PerchForm, echo: EchoForm };

const fmtEth = (wei) => (wei ? Number(formatEther(BigInt(wei))).toLocaleString("en-US", { maximumFractionDigits: 5 }) : "–");
const STATUS = {
  pending: "Starting",
  buying: "Buying",
  holding: "Watching",
  selling: "Selling",
  closed: "Closed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function SentryJob({ j, act, busy }) {
  const pnl = j.status === "closed" ? j.exitWei : j.valueWei;
  const pct = pnl && j.entryWei ? (Number(BigInt(pnl) - BigInt(j.entryWei)) / Number(BigInt(j.entryWei))) * 100 : null;
  const live = ["pending", "buying", "holding", "selling"].includes(j.status);
  return (
    <li className="card ag-job">
      <div className="ag-li-top">
        <strong className="ag-job-title">
          <TokenLogo symbol={j.token} size={30} />
          Sentry · {j.token === "NEXTRA" ? "$NEXTRA" : j.token}
        </strong>
        <span className={`chip${live && !j.paused ? " live" : ""}`}>{j.paused ? "Paused" : STATUS[j.status] || j.status}</span>
      </div>
      <p className="sub">
        {j.amount} ETH of {j.token === "NEXTRA" ? "$NEXTRA" : j.token}
        {j.venue === "pons" ? " on Pons" : ""}. Exit at +{j.tp}% or −{j.sl}%{j.trailing ? " (trailing)" : ""}.
      </p>
      {j.entryWei ? (
        <div className="ag-job-nums">
          <div>
            <span>In</span>
            <b>{fmtEth(j.entryWei)} ETH</b>
          </div>
          <div>
            <span>{j.status === "closed" ? "Out" : "Now"}</span>
            <b>{fmtEth(pnl)} ETH</b>
          </div>
          <div>
            <span>P/L</span>
            <b className={pct == null ? "" : pct >= 0 ? "up" : "down"}>{pct == null ? "–" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}</b>
          </div>
        </div>
      ) : null}
      {j.note || j.error ? <p className="ag-job-note">{j.note || j.error}</p> : null}
      <div className="ag-job-links">
        {j.buyTx ? (
          <a href={`${EXPLORER}/tx/${j.buyTx}`} target="_blank" rel="noopener noreferrer">
            Buy tx ↗
          </a>
        ) : null}
        {j.sellTx ? (
          <a href={`${EXPLORER}/tx/${j.sellTx}`} target="_blank" rel="noopener noreferrer">
            Sell tx ↗
          </a>
        ) : null}
        {j.exitReason ? <span>Exit: {j.exitReason}</span> : null}
      </div>
      <div className="ag-li-act">
        {live && j.status !== "selling" ? (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => act(j.id, j.paused ? "resume" : "pause")}>
            {j.paused ? "Resume" : "Pause"}
          </button>
        ) : null}
        {j.status === "holding" && !j.closeRequested ? (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => act(j.id, "close")}>
            Sell now
          </button>
        ) : null}
        {j.status === "pending" ? (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => act(j.id, "close")}>
            Cancel
          </button>
        ) : null}
        {!live ? (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => act(j.id, "delete")}>
            Remove
          </button>
        ) : null}
      </div>
    </li>
  );
}

export default function AgentConsole() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { addSigners } = useSigners();
  const embedded = wallets.find((w) => w.walletClientType === "privy");
  const wallet = embedded || wallets[0];
  const address = wallet?.address || user?.wallet?.address || null;
  const delegated = !!(user?.linkedAccounts || []).find((a) => a.type === "wallet" && a.walletClientType === "privy" && a.delegated);
  const storeKey = user?.id ? `${STORE_KEY}.${user.id}` : null;
  const [active, setActive] = useState("sentry");
  const [configs, setConfigs] = useState(() => Object.fromEntries(AGENTS.map((a) => [a.id, { ...a.defaults }])));
  const [mine, setMine] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);

  // deep link from the homepage token card: /agents?token=NEXTRA
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token")?.toUpperCase();
    if (t && SENTRY_OPTIONS.includes(t)) {
      setActive("sentry");
      setConfigs((c) => ({ ...c, sentry: { ...c.sentry, token: t } }));
    }
  }, []);

  useEffect(() => {
    setLoaded(false);
    if (!storeKey) {
      setMine([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storeKey);
      setMine(raw ? JSON.parse(raw) : []);
    } catch {
      setMine([]);
    }
    setLoaded(true);
  }, [storeKey]);

  useEffect(() => {
    if (!loaded || !storeKey) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(mine));
    } catch {}
  }, [mine, loaded, storeKey]);

  const api = async (method, body) => {
    const t = await getAccessToken();
    const r = await fetch("/api/agents", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Something went wrong. Try again.");
    return d;
  };

  const loadJobs = async () => {
    try {
      const d = await api("GET");
      setJobs(d.jobs || []);
    } catch {}
  };

  useEffect(() => {
    if (!authenticated) {
      setJobs([]);
      return;
    }
    loadJobs();
    const id = setInterval(loadJobs, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const agent = AGENTS.find((a) => a.id === active);
  const c = configs[active];
  const Form = FORMS[active];
  const valid = useMemo(() => validate(active, c), [active, c]);
  const summary = describe(active, c);
  const isSentry = active === "sentry";

  const set = (k, v) => setConfigs((s) => ({ ...s, [active]: { ...s[active], [k]: v } }));

  const say = (m, ms = 5000) => {
    setFlash(m);
    setTimeout(() => setFlash(""), ms);
  };

  const startSentry = async () => {
    setBusy(true);
    try {
      if (!SIGNER_ID) throw new Error("Sentry is being switched on. Please try again in a bit.");
      if (!embedded) throw new Error("Sentry runs on your Nextra wallet. Log in with email, Google or X to get one.");
      if (!delegated) await addSigners({ address: embedded.address, signers: [{ signerId: SIGNER_ID, policyIds: [] }] });
      await api("POST", { agent: "sentry", ...c });
      say("Sentry is live. It buys within about a minute, then watches your exit.", 7000);
      loadJobs();
    } catch (e) {
      say(e?.message || "Could not start Sentry.", 7000);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!authenticated) return login();
    if (!valid) return;
    if (isSentry) return startSentry();
    setMine((m) => [{ uid: Date.now().toString(36), agent: active, summary, status: "Queued", at: new Date().toISOString() }, ...m]);
    say(`${agent.name} saved. It will start once ${agent.name} goes live.`, 3500);
  };

  const act = async (id, action) => {
    setBusy(true);
    try {
      await api("PATCH", { id, action });
      await loadJobs();
    } catch (e) {
      say(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (uid) => setMine((m) => m.map((x) => (x.uid === uid ? { ...x, status: x.status === "Paused" ? "Queued" : "Paused" } : x)));
  const remove = (uid) => setMine((m) => m.filter((x) => x.uid !== uid));

  return (
    <>
      <section className="sec ag-head">
        <span className="eyebrow">Agents</span>
        <h1 className="ag-title">Pick an agent. Set your rules.</h1>
        <p className="lead">Four agents, one wallet. Each one does a single job — choose the one that fits how you trade.</p>
        <div className="ag-note">
          <span className="chip">Sentry live</span>
          <span>Sentry trades for real from your wallet. Tempo, Perch and Echo are in preview — set them up now, they start later.</span>
        </div>
      </section>

      <AccountBar ready={ready} authenticated={authenticated} login={login} logout={logout} address={address} user={user} />

      <section className="ag-pick" aria-label="Choose an agent">
        {AGENTS.map((a) => (
          <button type="button" key={a.id} className={`ag-tile${active === a.id ? " on" : ""}`} onClick={() => setActive(a.id)} aria-pressed={active === a.id}>
            <span className="ag-ico">
              <AgentIcon
                id={a.id}
                size={24}
                accent={active === a.id ? "#161613" : "#5DA000"}
                fill={active === a.id ? "rgba(255,255,255,.22)" : "rgba(93,160,0,.16)"}
              />
            </span>
            <span className="ag-name">
              {a.name}
              {a.id === "sentry" ? <i className="ag-live-dot" aria-label="live" /> : null}
            </span>
            <span className="ag-role">{a.role}</span>
          </button>
        ))}
      </section>

      <section className="ag-panel">
        <div className="ag-form card">
          <div className="ag-form-head">
            <div>
              <h2>{agent.name}</h2>
              <p className="ag-tag">
                {agent.role} · {agent.tagline}
              </p>
            </div>
          </div>
          <p className="sub">{agent.text}</p>
          <div className="ag-fields">
            <Form c={c} set={set} />
          </div>
        </div>

        <aside className="ag-sum">
          <span className="ag-label light">What {agent.name} will do</span>
          <p className="ag-sentence">{summary}</p>
          <ul className="ag-rules">
            <li>Trades only from your own wallet</li>
            <li>Never goes past the limits you set</li>
            <li>Pause or sell any time</li>
            {isSentry ? <li>Swaps on Uniswap, checks the price every minute</li> : null}
          </ul>
          <button type="button" className="btn lime ag-go" onClick={save} disabled={busy || (authenticated && !valid)}>
            {!authenticated ? `Log in to ${isSentry ? "start" : "save"} ${agent.name}` : busy ? "Working…" : isSentry ? "Start Sentry" : `Save ${agent.name}`}
          </button>
          {isSentry && authenticated && !delegated ? (
            <span className="ag-hint light">First time: approve once so Sentry can trade while you're away. You can revoke it any time.</span>
          ) : null}
          {authenticated && !valid ? <span className="ag-hint light">Check the numbers above.</span> : null}
          {flash ? <span className="ag-flash" role="status">{flash}</span> : null}
        </aside>
      </section>

      <section className="sec ag-mine">
        <span className="eyebrow">My agents</span>
        <h2>Your agents</h2>
        {!authenticated ? (
          <p className="sub">Log in to see your agents.</p>
        ) : jobs.length === 0 && mine.length === 0 ? (
          <p className="sub">Nothing yet. Start Sentry above and it will show here.</p>
        ) : (
          <ul className="ag-list">
            {jobs.map((j) => (
              <SentryJob key={j.id} j={j} act={act} busy={busy} />
            ))}
            {mine.map((m) => {
              const a = AGENTS.find((x) => x.id === m.agent);
              return (
                <li key={m.uid} className="card">
                  <div className="ag-li-top">
                    <strong>{a?.name}</strong>
                    <span className="chip">{m.status === "Paused" ? "Paused" : "Preview"}</span>
                  </div>
                  <p className="sub">{m.summary}</p>
                  <div className="ag-li-act">
                    <button type="button" className="btn ghost" onClick={() => toggle(m.uid)}>
                      {m.status === "Paused" ? "Resume" : "Pause"}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => remove(m.uid)}>
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

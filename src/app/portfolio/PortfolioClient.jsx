"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { encodeFunctionData, formatEther, formatUnits, parseAbi, parseEther, parseUnits } from "viem";
import { robinhoodChain } from "../agents/Providers";
import TokenLogo from "../TokenLogo";

const EXPLORER = "https://robinhoodchain.blockscout.com";
const GAS_RESERVE = parseEther("0.0002");
const erc20 = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test((a || "").trim());
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const fmt = (wei, max = 5) =>
  wei == null ? "–" : Number(formatEther(BigInt(wei))).toLocaleString("en-US", { maximumFractionDigits: max });

function Mono({ children }) {
  return <span className="pf-mono">{children}</span>;
}

function SendPanel({ assets, initial, onClose, onSent, from }) {
  const { sendTransaction } = useSendTransaction();
  const [asset, setAsset] = useState(initial || "ETH");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [hash, setHash] = useState("");

  const a = assets.find((x) => x.symbol === asset) || assets[0];
  const balance = BigInt(a?.balance || "0");
  const maxWei = asset === "ETH" ? (balance > GAS_RESERVE ? balance - GAS_RESERVE : 0n) : balance;
  let amountWei = 0n;
  try {
    amountWei = amount ? parseUnits(amount, 18) : 0n;
  } catch {}
  const toOk = isAddr(to) && to.trim().toLowerCase() !== (from || "").toLowerCase();
  const ok = toOk && amountWei > 0n && amountWei <= maxWei && !busy;

  const send = async () => {
    if (!ok) return;
    setBusy(true);
    setMsg("");
    try {
      const target = to.trim();
      const tx =
        asset === "ETH"
          ? { to: target, value: amountWei, chainId: robinhoodChain.id }
          : {
              to: a.address,
              value: 0n,
              chainId: robinhoodChain.id,
              data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [target, amountWei] }),
            };
      const r = await sendTransaction(tx, { address: from });
      setHash(r?.hash || r?.transactionHash || "");
      onSent?.();
    } catch (e) {
      const m = String(e?.message || e);
      setMsg(/reject|denied|cancel/i.test(m) ? "Cancelled." : m.slice(0, 160));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pf-sheet" role="dialog" aria-label="Send">
      <div className="pf-sheet-in card">
        <div className="pf-sheet-head">
          <h2>Send</h2>
          <button type="button" className="pf-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {hash ? (
          <div className="pf-done">
            <span className="pf-done-dot" />
            <strong>Sent</strong>
            <p className="sub">
              {amount} {asset} to <Mono>{short(to.trim())}</Mono>
            </p>
            <a className="btn ghost" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
              View transaction ↗
            </a>
            <button type="button" className="btn primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div className="ag-fields">
            <label className="ag-field">
              <span className="ag-label">Asset</span>
              <div className="ag-input">
                <select value={asset} onChange={(e) => (setAsset(e.target.value), setAmount(""))}>
                  {assets.map((x) => (
                    <option key={x.symbol} value={x.symbol}>
                      {x.symbol} · {fmt(x.balance, 6)}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="ag-field">
              <span className="ag-label">To address</span>
              <div className="ag-input">
                <input
                  type="text"
                  placeholder="0x…"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {to && !isAddr(to) ? <span className="ag-hint">Paste a full 0x… address on Robinhood Chain.</span> : null}
            </label>
            <label className="ag-field">
              <span className="ag-label">Amount</span>
              <div className="ag-input">
                <input type="number" inputMode="decimal" min="0" step="any" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button type="button" className="pf-max" onClick={() => setAmount(formatUnits(maxWei, 18))}>
                  Max
                </button>
                <span>{asset}</span>
              </div>
              {amountWei > maxWei ? (
                <span className="ag-hint">{asset === "ETH" ? "More than your balance (a little ETH is kept for gas)." : "More than your balance."}</span>
              ) : null}
            </label>
            <p className="pf-warn">Double-check the address. Transfers on-chain can't be undone.</p>
            <button type="button" className="btn lime ag-go" disabled={!ok} onClick={send}>
              {busy ? "Sending…" : `Send ${asset}`}
            </button>
            {msg ? <span className="ag-hint">{msg}</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortfolioClient() {
  const { ready, authenticated, login, logout, user, exportWallet } = usePrivy();
  const { wallets } = useWallets();
  const embedded = wallets.find((w) => w.walletClientType === "privy");
  const address = embedded?.address || user?.wallet?.address || null;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [send, setSend] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/portfolio?address=${address}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load portfolio");
      setData(d);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const assets = useMemo(() => {
    if (!data) return [{ symbol: "ETH", balance: "0" }];
    return [
      { symbol: "ETH", balance: data.eth, valueWei: data.eth },
      ...data.tokens.filter((t) => BigInt(t.balance) > 0n),
    ];
  }, [data]);

  const copy = () => {
    navigator.clipboard?.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const doExport = async () => {
    if (typeof exportWallet !== "function") return setErr("Export is not available right now.");
    try {
      await exportWallet({ address: embedded.address });
    } catch {}
  };

  if (!ready) return <section className="sec"><p className="sub">Loading…</p></section>;

  if (!authenticated)
    return (
      <section className="sec pf-head">
        <span className="eyebrow">Portfolio</span>
        <h1 className="ag-title">Your wallet, in one place.</h1>
        <p className="lead">Log in to see your ETH and stock tokens, send funds, or export your key.</p>
        <button type="button" className="btn primary" onClick={login}>
          Log in
        </button>
      </section>
    );

  const stocks = assets.filter((x) => x.symbol !== "ETH");

  return (
    <>
      <section className="sec pf-head">
        <span className="eyebrow">Portfolio</span>
        <div className="pf-total">
          <span className="ag-label">Total value</span>
          <strong>
            {data ? fmt(data.totalWei, 5) : "…"} <small>ETH</small>
          </strong>
          <span className="pf-sub">
            ETH + stock tokens, valued at Uniswap prices{loading ? " · updating…" : ""}
          </span>
        </div>

        <div className="pf-acct card">
          <div className="pf-acct-id">
            <span className="ag-acct-dot" />
            <div>
              <span className="ag-label">Your Nextra wallet · Robinhood Chain</span>
              <button type="button" className="pf-addr" onClick={copy} title={address}>
                {copied ? "Copied" : short(address)}
              </button>
            </div>
          </div>
          <div className="pf-actions">
            <button type="button" className="btn lime" disabled={!embedded} onClick={() => setSend("ETH")}>
              Send
            </button>
            <button type="button" className="btn ghost" onClick={copy}>
              {copied ? "Copied" : "Receive"}
            </button>
            <button type="button" className="btn ghost" disabled={!embedded} onClick={doExport}>
              Export key
            </button>
          </div>
          {!embedded ? (
            <p className="pf-note">You logged in with an outside wallet. Send and export from that wallet's own app.</p>
          ) : (
            <p className="pf-note">
              Export shows your wallet's private key in a secure Privy window. Anyone with it controls your funds — never share it.
              Nextra will never ask for it.
            </p>
          )}
        </div>
        {err ? <p className="warn">{err}</p> : null}
      </section>

      <section className="sec pf-hold">
        <h2>Holdings</h2>
        <ul className="pf-list">
          <li className="card">
            <span className="pf-tok eth">Ξ</span>
            <div className="pf-name">
              <strong>ETH</strong>
              <span>Ether</span>
            </div>
            <div className="pf-amt">
              <strong>{data ? fmt(data.eth, 6) : "…"}</strong>
              <span>ETH</span>
            </div>
            <button type="button" className="btn ghost pf-row-send" disabled={!embedded || !data} onClick={() => setSend("ETH")}>
              Send
            </button>
          </li>
          {stocks.map((t) => (
            <li key={t.symbol} className="card">
              <TokenLogo symbol={t.symbol} size={44} />
              <div className="pf-name">
                <strong>{t.symbol}</strong>
                <a href={`${EXPLORER}/token/${t.address}`} target="_blank" rel="noopener noreferrer">
                  Stock token ↗
                </a>
              </div>
              <div className="pf-amt">
                <strong>{fmt(t.balance, 6)}</strong>
                <span>≈ {fmt(t.valueWei, 5)} ETH</span>
              </div>
              <button type="button" className="btn ghost pf-row-send" disabled={!embedded} onClick={() => setSend(t.symbol)}>
                Send
              </button>
            </li>
          ))}
        </ul>
        {data && !stocks.length ? (
          <p className="sub pf-empty">
            No stock tokens yet. Start <a href="/agents">Sentry</a> to buy one with your own take-profit and stop-loss.
          </p>
        ) : null}
        <p className="pf-foot">
          <a href={`${EXPLORER}/address/${address}`} target="_blank" rel="noopener noreferrer">
            View wallet on explorer ↗
          </a>
          <button type="button" className="pf-linkbtn" onClick={logout}>
            Log out
          </button>
        </p>
      </section>

      {send ? <SendPanel assets={assets} initial={send} from={embedded?.address} onClose={() => setSend(null)} onSent={load} /> : null}
    </>
  );
}

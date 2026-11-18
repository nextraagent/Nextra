// Public, anonymous totals across every Nextra agent, from a permanent ledger. No wallet addresses are exposed.
// Totals come from a permanent ledger (agents/stats/ledger.json), so trades stay counted
// even after a user removes a finished agent from their list.
import { list, put } from "@vercel/blob";
import { listJobs } from "./sentry";
import { listTempo } from "./tempo";
import { listPerch } from "./perch";

const LEDGER = "agents/stats/ledger.json";
// Totals published before the ledger existed (snapshot at T0); used once to seed it.
const T0 = "2026-11-18T19:04:50.000Z";
const SNAPSHOT = { trades: 53, volumeWei: 9161n * 10n ** 12n, agents: 7 };

const big = (v) => {
  try {
    return BigInt(v || "0");
  } catch {
    return 0n;
  }
};
const eth = (wei) => Number(big(wei) / 10n ** 12n) / 1e6;
const label = (t) => (t === "NEXTRA" ? "$NEXTRA" : t);
const isTrade = (m) => /^(Bought|Sold)/.test(m || "");

async function readLedger() {
  const r = await list({ prefix: LEDGER, limit: 1 });
  if (!r.blobs.length) return null;
  const res = await fetch(`${r.blobs[0].url}?t=${Date.now()}`, { cache: "no-store" });
  return res.ok ? res.json() : null;
}

// What the jobs that still exist had contributed by T0 (so the snapshot is not double counted).
function contributionAtT0(sentry, tempo) {
  let trades = 0;
  let wei = 0n;
  let agents = 0;
  for (const j of sentry) {
    if (j.createdAt <= T0) agents++;
    if (j.buyTx && j.boughtAt && j.boughtAt <= T0) (trades++, (wei += big(j.entryWei || j.amountWei)));
    if (j.sellTx && j.closedAt && j.closedAt <= T0) (trades++, (wei += big(j.exitWei)));
  }
  for (const j of tempo) {
    if (j.createdAt <= T0) agents++;
    const k = (j.log || []).filter((l) => isTrade(l.msg) && l.at <= T0).length;
    trades += k;
    wei += BigInt(k) * big(j.perOrderWei);
  }
  return { trades, wei, agents };
}

export async function agentStats() {
  const [sentry, tempo, perch, stored] = await Promise.all([
    listJobs(),
    listTempo(),
    listPerch().catch(() => []),
    readLedger().catch(() => null),
  ]);

  const ledger = stored || { v: 1, events: {}, agentIds: [], users: [] };
  if (!stored) {
    const c = contributionAtT0(sentry, tempo);
    const lw = SNAPSHOT.volumeWei - c.wei;
    ledger.legacy = {
      trades: Math.max(0, SNAPSHOT.trades - c.trades),
      volumeWei: (lw > 0n ? lw : 0n).toString(),
      agents: Math.max(0, SNAPSHOT.agents - c.agents),
    };
  }
  const before = JSON.stringify(ledger);
  const ev = ledger.events;
  const agentIds = new Set(ledger.agentIds);
  const users = new Set(ledger.users);
  const upsert = (key, e) => {
    const old = ev[key];
    if (!old || (e.n || 1) > (old.n || 1) || e.at > old.at) ev[key] = e;
  };

  for (const j of sentry) {
    agentIds.add(j.id);
    if (j.userId) users.add(j.userId);
    if (j.tokenAmount && j.buyTx)
      upsert(`s:${j.id}:buy`, { agent: "Sentry", side: "Buy", token: label(j.token), wei: String(j.entryWei || j.amountWei), at: j.boughtAt, tx: j.buyTx });
    if (j.status === "closed" && j.sellTx)
      upsert(`s:${j.id}:sell`, {
        agent: "Sentry",
        side: j.exitReason === "take-profit" ? "Take-profit" : j.exitReason === "stop-loss" ? "Stop-loss" : "Sell",
        token: label(j.token),
        wei: String(j.exitWei || "0"),
        at: j.closedAt,
        tx: j.sellTx,
      });
  }
  for (const j of tempo) {
    agentIds.add(j.id);
    if (j.userId) users.add(j.userId);
    const n = Number(j.orders || 0);
    if (n > 0) upsert(`t:${j.id}`, { agent: "Tempo", side: j.mode === "TWAP" ? "Sell" : "Buy", token: label(j.token), wei: String(j.filledWei || "0"), n, at: j.updatedAt, tx: j.lastTx });
  }
  for (const j of perch) {
    agentIds.add(j.id);
    if (j.userId) users.add(j.userId);
    if (j.status === "filled" && j.fillTx)
      upsert(`p:${j.id}`, { agent: "Perch", side: j.side === "Buy" ? "Limit buy" : "Limit sell", token: label(j.token), wei: String(j.filledEthWei || "0"), at: j.filledAt, tx: j.fillTx });
  }
  ledger.agentIds = [...agentIds];
  ledger.users = [...users];

  if (JSON.stringify(ledger) !== before) {
    await put(LEDGER, JSON.stringify(ledger), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    }).catch(() => {});
  }

  let trades = ledger.legacy?.trades || 0;
  let volume = big(ledger.legacy?.volumeWei);
  for (const e of Object.values(ev)) {
    trades += e.n || 1;
    volume += big(e.wei);
  }
  const recent = Object.values(ev)
    .filter((e) => e.at && e.tx)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 6)
    .map((e) => ({ agent: e.agent, side: e.side, token: e.token, eth: e.n ? eth(e.wei) / e.n : eth(e.wei), at: e.at, tx: e.tx }));

  return {
    trades,
    volumeEth: eth(volume),
    agents: (ledger.legacy?.agents || 0) + agentIds.size,
    active:
      sentry.filter((j) => ["pending", "buying", "holding", "selling"].includes(j.status)).length +
      tempo.filter((j) => j.status === "running").length +
      perch.filter((j) => ["waiting", "filling"].includes(j.status)).length,
    traders: users.size,
    recent,
    at: new Date().toISOString(),
  };
}

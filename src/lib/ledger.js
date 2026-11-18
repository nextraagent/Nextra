// Public, anonymous totals across every Nextra agent. Kept as one small ledger in Redis
// (stats:ledger) that only changes when an agent is created or a trade fills, so removed
// agents keep counting and the homepage reads a single key. No wallet addresses are stored.
import { activeCount, redis } from "./store";

const KEY = "stats:ledger";
// Totals published before the move to Redis; used once to seed the ledger.
const SEED = { trades: 57, volumeWei: "9361000000000000", agents: 8, traders: 2 };

const big = (v) => {
  try {
    return BigInt(v || "0");
  } catch {
    return 0n;
  }
};
const eth = (wei) => Number(big(wei) / 10n ** 12n) / 1e6;
const label = (t) => (t === "NEXTRA" ? "$NEXTRA" : t);

async function read() {
  const s = await redis("GET", KEY);
  try {
    if (s) return JSON.parse(s);
  } catch {}
  return { ...SEED, users: [], recent: [], seen: {} };
}
const write = (l) => redis("SET", KEY, JSON.stringify(l));

export async function recordAgentCreated(userId) {
  const l = await read();
  l.agents = (l.agents || 0) + 1;
  if (userId && !l.users.includes(userId)) l.users.push(userId);
  await write(l);
}

// Trade events a job has produced so far: [{ key, n, wei, ...display }]
function eventsOf(agent, j) {
  const out = [];
  if (agent === "sentry") {
    if (j.tokenAmount && j.buyTx) out.push({ key: `s:${j.id}:b`, n: 1, wei: j.entryWei || j.amountWei, agent: "Sentry", side: "Buy", token: label(j.token), at: j.boughtAt, tx: j.buyTx });
    if (j.status === "closed" && j.sellTx)
      out.push({
        key: `s:${j.id}:s`,
        n: 1,
        wei: j.exitWei,
        agent: "Sentry",
        side: j.exitReason === "take-profit" ? "Take-profit" : j.exitReason === "stop-loss" ? "Stop-loss" : "Sell",
        token: label(j.token),
        at: j.closedAt,
        tx: j.sellTx,
      });
  } else if (agent === "tempo") {
    const n = Number(j.orders || 0);
    if (n > 0) out.push({ key: `t:${j.id}`, n, wei: j.filledWei, agent: "Tempo", side: j.mode === "TWAP" ? "Sell" : "Buy", token: label(j.token), at: j.updatedAt || new Date().toISOString(), tx: j.lastTx });
  } else if (agent === "perch") {
    if (j.status === "filled" && j.fillTx)
      out.push({ key: `p:${j.id}`, n: 1, wei: j.filledEthWei, agent: "Perch", side: j.side === "Buy" ? "Limit buy" : "Limit sell", token: label(j.token), at: j.filledAt, tx: j.fillTx });
  }
  return out;
}

// Cheap fingerprint of a job's trade progress, so the tick only touches the ledger when it moved.
export function tradeMark(agent, j) {
  return eventsOf(agent, j)
    .map((e) => `${e.key}:${e.n}`)
    .join("|");
}

export async function recordTrades(jobsByAgent) {
  const l = await read();
  let changed = false;
  for (const [agent, jobs] of Object.entries(jobsByAgent)) {
    for (const j of jobs) {
      for (const e of eventsOf(agent, j)) {
        const seen = l.seen[e.key] || { n: 0, wei: "0" };
        if (e.n <= seen.n) continue;
        l.trades += e.n - seen.n;
        l.volumeWei = (big(l.volumeWei) + big(e.wei) - big(seen.wei)).toString();
        l.seen[e.key] = { n: e.n, wei: String(e.wei || "0") };
        const per = e.n > 1 ? (big(e.wei) - big(seen.wei)) / BigInt(e.n - seen.n) : big(e.wei);
        l.recent = [{ agent: e.agent, side: e.side, token: e.token, wei: per.toString(), at: e.at, tx: e.tx }, ...(l.recent || [])].slice(0, 12);
        changed = true;
      }
    }
  }
  if (changed) await write(l);
}

export async function agentStats() {
  const [l, active] = await Promise.all([read(), activeCount().catch(() => 0)]);
  return {
    trades: l.trades,
    volumeEth: eth(l.volumeWei),
    agents: l.agents,
    active,
    traders: Math.max(l.traders || 0, l.users?.length || 0),
    recent: (l.recent || []).slice(0, 6).map((r) => ({ agent: r.agent, side: r.side, token: r.token, eth: eth(r.wei), at: r.at, tx: r.tx })),
    at: new Date().toISOString(),
  };
}

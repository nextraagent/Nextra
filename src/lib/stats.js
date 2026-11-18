// Public, anonymous totals across every Sentry and Tempo agent. No wallet addresses are exposed.
import { listJobs } from "./sentry";
import { listTempo } from "./tempo";
import { listPerch } from "./perch";

const big = (v) => {
  try {
    return BigInt(v || "0");
  } catch {
    return 0n;
  }
};
const eth = (wei) => Number(wei / 10n ** 12n) / 1e6;
const label = (t) => (t === "NEXTRA" ? "$NEXTRA" : t);

export async function agentStats() {
  const [sentry, tempo, perch] = await Promise.all([listJobs(), listTempo(), listPerch().catch(() => [])]);
  let trades = 0;
  let volume = 0n;
  const users = new Set();
  const recent = [];

  for (const j of sentry) {
    if (j.userId) users.add(j.userId);
    if (j.tokenAmount && j.buyTx) {
      trades++;
      volume += big(j.entryWei || j.amountWei);
      recent.push({ agent: "Sentry", side: "Buy", token: label(j.token), eth: eth(big(j.entryWei || j.amountWei)), at: j.boughtAt, tx: j.buyTx });
    }
    if (j.status === "closed" && j.sellTx) {
      trades++;
      volume += big(j.exitWei);
      recent.push({ agent: "Sentry", side: j.exitReason === "take-profit" ? "Take-profit" : j.exitReason === "stop-loss" ? "Stop-loss" : "Sell", token: label(j.token), eth: eth(big(j.exitWei)), at: j.closedAt, tx: j.sellTx });
    }
  }
  for (const j of tempo) {
    if (j.userId) users.add(j.userId);
    const n = Number(j.orders || 0);
    if (n > 0) {
      trades += n;
      volume += big(j.filledWei);
      if (j.lastTx) recent.push({ agent: "Tempo", side: j.mode === "TWAP" ? "Sell" : "Buy", token: label(j.token), eth: eth(big(j.filledWei)) / n, at: j.updatedAt, tx: j.lastTx });
    }
  }
  for (const j of perch) {
    if (j.userId) users.add(j.userId);
    if (j.status === "filled" && j.fillTx) {
      trades++;
      volume += big(j.filledEthWei);
      recent.push({ agent: "Perch", side: j.side === "Buy" ? "Limit buy" : "Limit sell", token: label(j.token), eth: eth(big(j.filledEthWei)), at: j.filledAt, tx: j.fillTx });
    }
  }
  const all = [...sentry, ...tempo, ...perch];
  return {
    trades,
    volumeEth: eth(volume),
    agents: all.length,
    active:
      sentry.filter((j) => ["pending", "buying", "holding", "selling"].includes(j.status)).length +
      tempo.filter((j) => j.status === "running").length +
      perch.filter((j) => ["waiting", "filling"].includes(j.status)).length,
    traders: users.size,
    recent: recent.filter((r) => r.at).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6),
    at: new Date().toISOString(),
  };
}

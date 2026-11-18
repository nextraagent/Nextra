// Sentry engine: buy once, then watch the position and exit at take-profit or stop-loss.
// Jobs live in Vercel Blob as agents/sentry/<id>.json. The tick runs every minute.
import { del, list, put } from "@vercel/blob";
import { toEventSelector } from "viem";
import { publicClient } from "./chain";
import {
  approveCall,
  bestRoute,
  buyCall,
  getWeth,
  quote,
  ROUTER,
  sellCall,
  sendFromWallet,
  tokenAllowance,
  tokenBalance,
  GAS_BUFFER,
} from "./swap";
import { ponsBuyCall, ponsSellCall, quoteBuy, quoteSell } from "./pons";

const P = "agents/sentry/";
const LOCK = `${P}_lock.json`;
export const ACTIVE = ["pending", "buying", "holding", "selling"];
const SLIPPAGE_BPS = Number(process.env.SENTRY_SLIPPAGE_BPS || 150);
// memecoin curves move faster than stock pools, so Pons trades get a wider default
const PONS_SLIPPAGE_BPS = Number(process.env.SENTRY_PONS_SLIPPAGE_BPS || 300);

async function readBlob(url) {
  const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
  return r.ok ? r.json() : null;
}

async function listAll(prefix) {
  const blobs = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function listJobs() {
  const blobs = (await listAll(P)).filter((b) => !b.pathname.slice(P.length).startsWith("_"));
  const jobs = await Promise.all(blobs.map((b) => readBlob(b.url).catch(() => null)));
  return jobs.filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getJob(id) {
  const r = await list({ prefix: `${P}${id}.json`, limit: 1 });
  return r.blobs.length ? readBlob(r.blobs[0].url) : null;
}

export async function saveJob(job) {
  job.updatedAt = new Date().toISOString();
  await put(`${P}${job.id}.json`, JSON.stringify(job), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  return job;
}

export async function deleteJob(id) {
  const r = await list({ prefix: `${P}${id}.json`, limit: 1 });
  if (r.blobs.length) await del(r.blobs[0].url);
}

const log = (job, msg) => {
  job.log = [...(job.log || []), { at: new Date().toISOString(), msg }].slice(-20);
};

async function receipt(hash) {
  try {
    return await publicClient.getTransactionReceipt({ hash });
  } catch {
    return null;
  }
}

const spender = (job) => job.curve || ROUTER;

// ETH actually spent by a buy: value sent minus any CurveBuyRefunded refund
const REFUNDED = toEventSelector("event CurveBuyRefunded(address indexed buyer, uint256 refund)");
async function paidEth(rc, wallet) {
  try {
    const tx = await publicClient.getTransaction({ hash: rc.transactionHash });
    let refund = 0n;
    for (const l of rc.logs) {
      if (l.topics?.[0] === REFUNDED && l.topics?.[1]?.toLowerCase().endsWith(wallet.slice(2).toLowerCase())) refund += BigInt(l.data);
    }
    return tx.value - refund;
  } catch {
    return null;
  }
}

const bps = (pct) => BigInt(Math.round(Number(pct) * 100));

async function step(job) {
  const weth = await getWeth();
  const wallet = job.address;

  if (job.status === "pending") {
    if (job.paused) return;
    const amountIn = BigInt(job.amountWei);
    const bal = await publicClient.getBalance({ address: wallet });
    if (bal < amountIn + GAS_BUFFER) {
      job.note = "Waiting for ETH: add funds to your wallet to start.";
      return;
    }
    let tx;
    if (job.curve) {
      const q = await quoteBuy(job.curve, amountIn, wallet);
      if (!q) {
        job.note = "The Pons curve is closed or too thin right now. Retrying.";
        return;
      }
      tx = ponsBuyCall({ curve: job.curve, quoteIn: amountIn, q, recipient: wallet, slippageBps: PONS_SLIPPAGE_BPS });
    } else {
      const route = await bestRoute(weth, job.tokenAddress, amountIn);
      if (!route) {
        job.note = "No Uniswap route for this token right now. Retrying.";
        return;
      }
      tx = buyCall({ route, amountIn, recipient: wallet, slippageBps: SLIPPAGE_BPS });
      job.route = { tokens: [...route.tokens].reverse(), fees: [...route.fees].reverse() };
    }
    job.balBefore = (await tokenBalance(job.tokenAddress, wallet)).toString();
    job.buyTx = await sendFromWallet({ walletId: job.walletId, from: wallet, ...tx });
    job.status = "buying";
    job.note = null;
    job.sentAt = Date.now();
    log(job, `Buy sent: ${job.amount} ETH → ${job.token}`);
    return;
  }

  if (job.status === "buying") {
    const rc = await receipt(job.buyTx);
    if (!rc) {
      if (Date.now() - (job.sentAt || 0) > 15 * 60_000) {
        job.status = "failed";
        job.note = "Buy was not confirmed. Nothing was bought.";
      }
      return;
    }
    if (rc.status !== "success") {
      job.status = "failed";
      job.note = "Buy failed on-chain (price moved too much). Your ETH stayed in your wallet.";
      log(job, "Buy reverted");
      return;
    }
    const after = await tokenBalance(job.tokenAddress, wallet);
    const got = after - BigInt(job.balBefore || "0");
    // a buy that fills the curve refunds unspent ETH, so value the entry at what was really paid
    if (job.curve) {
      const paid = await paidEth(rc, wallet);
      if (paid && paid < BigInt(job.amountWei)) job.amountWei = paid.toString();
    }
    if (got <= 0n) {
      job.status = "failed";
      job.note = "Buy confirmed but no tokens arrived.";
      return;
    }
    job.tokenAmount = got.toString();
    job.entryWei = job.amountWei;
    job.peakWei = job.amountWei;
    job.status = "holding";
    job.boughtAt = new Date().toISOString();
    log(job, `Bought ${job.token}`);
    try {
      job.approveTx = await sendFromWallet({ walletId: job.walletId, from: wallet, ...approveCall(job.tokenAddress, got, spender(job)) });
    } catch (e) {
      log(job, `Approve will retry: ${e.message.slice(0, 80)}`);
    }
    return;
  }

  if (job.status === "holding") {
    if (job.paused && !job.closeRequested) return;
    const amount = BigInt(job.tokenAmount);
    const value = job.curve ? await quoteSell(job.curve, amount).catch(() => null) : await quote(job.route.tokens, job.route.fees, amount);
    if (value) {
      job.valueWei = value.toString();
      if (value > BigInt(job.peakWei || "0")) job.peakWei = value.toString();
    }
    job.checkedAt = new Date().toISOString();
    const entry = BigInt(job.entryWei);
    const tpLevel = (entry * (10000n + bps(job.tp))) / 10000n;
    const slBase = job.trailing ? BigInt(job.peakWei || job.entryWei) : entry;
    const slLevel = (slBase * (10000n - bps(job.sl))) / 10000n;
    const reason = job.closeRequested
      ? "manual"
      : value && value >= tpLevel
        ? "take-profit"
        : value && value <= slLevel
          ? "stop-loss"
          : null;
    if (!reason) return;

    const allowance = await tokenAllowance(job.tokenAddress, wallet, spender(job));
    if (allowance < amount) {
      if (job.approveTx && !(await receipt(job.approveTx))) return; // approval still pending
      job.approveTx = await sendFromWallet({ walletId: job.walletId, from: wallet, ...approveCall(job.tokenAddress, amount, spender(job)) });
      job.note = "Approving sale…";
      return;
    }
    const base = job.curve ? PONS_SLIPPAGE_BPS : SLIPPAGE_BPS;
    const slip = reason === "stop-loss" ? base * 2 : base;
    let tx, out;
    if (job.curve) {
      out = await quoteSell(job.curve, amount);
      if (!out) {
        job.note = "The Pons curve is closed (graduating). Sell from your wallet on Pons.";
        return;
      }
      tx = ponsSellCall({ curve: job.curve, tokensIn: amount, quoteOut: out, recipient: wallet, slippageBps: slip });
    } else {
      const route = await bestRoute(job.tokenAddress, weth, amount);
      if (!route) {
        job.note = "No route to sell right now. Retrying.";
        return;
      }
      out = route.amountOut;
      tx = sellCall({ route, amountIn: amount, recipient: wallet, slippageBps: slip });
    }
    job.sellTx = await sendFromWallet({ walletId: job.walletId, from: wallet, ...tx });
    job.exitQuoteWei = out.toString();
    job.exitReason = reason;
    job.status = "selling";
    job.sentAt = Date.now();
    job.note = null;
    log(job, `Sell sent (${reason})`);
    return;
  }

  if (job.status === "selling") {
    const rc = await receipt(job.sellTx);
    if (!rc) {
      if (Date.now() - (job.sentAt || 0) > 15 * 60_000) {
        job.status = "holding";
        job.sellTx = null;
      }
      return;
    }
    if (rc.status !== "success") {
      job.status = "holding";
      job.sellTx = null;
      job.note = "Sell failed (price moved). Retrying next minute.";
      log(job, "Sell reverted, retrying");
      return;
    }
    job.status = "closed";
    job.exitWei = job.exitQuoteWei;
    job.closedAt = new Date().toISOString();
    log(job, `Closed (${job.exitReason})`);
  }
}

export async function tick() {
  const started = Date.now();
  const lockList = await list({ prefix: LOCK, limit: 1 });
  if (lockList.blobs.length) {
    const lock = await readBlob(lockList.blobs[0].url).catch(() => null);
    if (lock?.at && started - lock.at < 55_000) return { skipped: "locked" };
  }
  await put(LOCK, JSON.stringify({ at: started }), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });

  const jobs = (await listJobs()).filter((j) => ACTIVE.includes(j.status));
  const results = [];
  for (const job of jobs) {
    if (Date.now() - started > 45_000) break;
    const before = JSON.stringify(job);
    try {
      await step(job);
      job.error = null;
    } catch (e) {
      job.error = String(e?.shortMessage || e?.message || e).slice(0, 200);
      job.errors = (job.errors || 0) + 1;
      if (job.status === "pending" && job.errors >= 10) job.status = "failed";
    }
    if (JSON.stringify(job) !== before) await saveJob(job);
    results.push({ id: job.id, status: job.status, error: job.error || undefined });
  }
  await put(LOCK, JSON.stringify({ at: 0 }), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
  return { processed: results.length, results, ms: Date.now() - started };
}

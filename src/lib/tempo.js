// Tempo engine: DCA (buy a fixed ETH amount on a schedule) or TWAP (sell in fixed ETH-sized steps).
// Jobs live in Upstash Redis (see store.js) and advance on the same minute tick as Sentry.
// $NEXTRA trades on its Pons curve; stock tokens trade on Uniswap.
import { deleteAgentJob, getAgentJob, persistAfterStep, saveAgentJob } from "./store";
import { publicClient } from "./chain";
import { approveCall, bestRoute, buyCall, getWeth, ROUTER, sellCall, sendFromWallet, tokenAllowance, tokenBalance, GAS_BUFFER } from "./swap";
import { ponsBuyCall, ponsSellCall, quoteBuy, quoteSell } from "./pons";

export const TEMPO_ACTIVE = ["running"];
const SLIP = Number(process.env.SENTRY_SLIPPAGE_BPS || 150);
const PONS_SLIP = Number(process.env.SENTRY_PONS_SLIPPAGE_BPS || 300);

export async function getTempo(id) {
  return getAgentJob("tempo", id);
}

export async function saveTempo(job) {
  return saveAgentJob("tempo", job, TEMPO_ACTIVE.includes(job.status));
}

export async function deleteTempo(job) {
  return deleteAgentJob("tempo", job);
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
const min = (a, b) => (a < b ? a : b);

function finish(job, msg) {
  job.status = "done";
  job.pending = null;
  job.nextAt = null;
  job.doneAt = new Date().toISOString();
  job.note = msg;
  log(job, msg);
}

async function settle(job) {
  const p = job.pending;
  const rc = await receipt(p.hash);
  if (!rc) {
    if (Date.now() - p.at > 10 * 60_000) {
      job.pending = null;
      job.note = "Last order was not confirmed. Trying again.";
    }
    return false;
  }
  job.pending = null;
  if (p.kind === "approve") return true;
  if (rc.status !== "success") {
    job.fails = (job.fails || 0) + 1;
    job.note = "Order reverted (price moved). Retrying next interval.";
    log(job, "Order reverted");
    if (job.fails >= 5) {
      job.status = "failed";
      job.note = "Stopped after 5 failed orders in a row.";
    }
    return true;
  }
  job.fails = 0;
  job.orders = (job.orders || 0) + 1;
  job.lastTx = p.hash;
  if (job.mode === "DCA") {
    const bal = await tokenBalance(job.tokenAddress, job.address);
    const got = bal - BigInt(p.balBefore || "0");
    job.filledWei = (BigInt(job.filledWei || "0") + BigInt(p.eth)).toString();
    job.tokensWei = (BigInt(job.tokensWei || "0") + (got > 0n ? got : 0n)).toString();
    log(job, `Bought for ${Number(BigInt(p.eth)) / 1e18} ETH`);
  } else {
    job.filledWei = (BigInt(job.filledWei || "0") + BigInt(p.eth)).toString();
    job.tokensWei = (BigInt(job.tokensWei || "0") + BigInt(p.tokens)).toString();
    log(job, `Sold for ~${(Number(BigInt(p.eth)) / 1e18).toFixed(6)} ETH`);
  }
  job.note = null;
  if (BigInt(job.filledWei) * 100n >= BigInt(job.budgetWei) * 99n) finish(job, job.mode === "DCA" ? "Budget spent. Done." : "Target sold. Done.");
  return true;
}

async function step(job) {
  const wallet = job.address;
  if (job.pending) {
    await settle(job);
    return;
  }
  if (job.paused || job.status !== "running") return;
  if (job.nextAt && Date.now() < job.nextAt - 5000) return;

  const left = BigInt(job.budgetWei) - BigInt(job.filledWei || "0");
  if (left <= 0n) return finish(job, "Done.");
  const size = min(BigInt(job.perOrderWei), left);

  if (job.mode === "DCA") {
    const eth = await publicClient.getBalance({ address: wallet });
    if (eth < size + GAS_BUFFER) {
      job.note = "Waiting for ETH: add funds to your wallet to continue.";
      return;
    }
    let tx;
    if (job.curve) {
      const q = await quoteBuy(job.curve, size, wallet);
      if (!q) return void (job.note = "The Pons curve is closed right now. Retrying.");
      tx = ponsBuyCall({ curve: job.curve, quoteIn: size, q, recipient: wallet, slippageBps: PONS_SLIP });
    } else {
      const route = await bestRoute(await getWeth(), job.tokenAddress, size);
      if (!route) return void (job.note = "No Uniswap route right now. Retrying.");
      tx = buyCall({ route, amountIn: size, recipient: wallet, slippageBps: SLIP });
    }
    const balBefore = (await tokenBalance(job.tokenAddress, wallet)).toString();
    const hash = await sendFromWallet({ walletId: job.walletId, from: wallet, ...tx });
    job.pending = { kind: "trade", hash, at: Date.now(), eth: size.toString(), balBefore };
    job.nextAt = Date.now() + job.everyMs;
    return;
  }

  // TWAP: sell tokens worth `size` ETH
  const bal = await tokenBalance(job.tokenAddress, wallet);
  if (bal === 0n) return finish(job, "No tokens left to sell. Done.");
  const valueAll = job.curve
    ? await quoteSell(job.curve, bal)
    : (await bestRoute(job.tokenAddress, await getWeth(), bal))?.amountOut;
  if (!valueAll) return void (job.note = job.curve ? "The Pons curve is closed right now. Retrying." : "No route to sell right now. Retrying.");
  const tokensIn = valueAll <= size ? bal : (bal * size) / valueAll;
  if (tokensIn === 0n) return finish(job, "Position too small to sell further. Done.");

  const allowance = await tokenAllowance(job.tokenAddress, wallet, spender(job));
  if (allowance < tokensIn) {
    const hash = await sendFromWallet({ walletId: job.walletId, from: wallet, ...approveCall(job.tokenAddress, bal, spender(job)) });
    job.pending = { kind: "approve", hash, at: Date.now() };
    job.note = "Approving sale…";
    return;
  }
  let tx, out;
  if (job.curve) {
    out = await quoteSell(job.curve, tokensIn);
    if (!out) return void (job.note = "The Pons curve is closed right now. Retrying.");
    tx = ponsSellCall({ curve: job.curve, tokensIn, quoteOut: out, recipient: wallet, slippageBps: PONS_SLIP });
  } else {
    const route = await bestRoute(job.tokenAddress, await getWeth(), tokensIn);
    if (!route) return void (job.note = "No route to sell right now. Retrying.");
    out = route.amountOut;
    tx = sellCall({ route, amountIn: tokensIn, recipient: wallet, slippageBps: SLIP });
  }
  const hash = await sendFromWallet({ walletId: job.walletId, from: wallet, ...tx });
  job.pending = { kind: "trade", hash, at: Date.now(), eth: out.toString(), tokens: tokensIn.toString() };
  job.nextAt = Date.now() + job.everyMs;
}

export async function tickTempo(jobs = [], deadline = Date.now() + 40_000) {
  const results = [];
  for (const job of jobs) {
    if (Date.now() > deadline) break;
    const before = JSON.stringify(job);
    try {
      await step(job);
      job.error = null;
    } catch (e) {
      job.error = String(e?.shortMessage || e?.message || e).slice(0, 200);
      job.errors = (job.errors || 0) + 1;
      if (job.errors >= 20 && !job.orders) job.status = "failed";
    }
    await persistAfterStep("tempo", job, before, TEMPO_ACTIVE.includes(job.status));
    results.push({ id: job.id, status: job.status, error: job.error || undefined });
  }
  return { processed: results.length, results };
}

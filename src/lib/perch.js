// Perch engine: limit orders. Buy when the price drops X% below the price at creation,
// or sell when it rises X% above. Checks every minute on the shared tick; cancels at expiry.
// Prices are measured with real quotes at the order's own size, so price impact is included.
// $NEXTRA trades on its Pons curve; stock tokens trade on Uniswap.
import { deleteAgentJob, getAgentJob, persistAfterStep, saveAgentJob } from "./store";
import { publicClient } from "./chain";
import { approveCall, bestRoute, buyCall, getWeth, ROUTER, sellCall, sendFromWallet, tokenAllowance, tokenBalance, GAS_BUFFER } from "./swap";
import { ponsBuyCall, ponsSellCall, quoteBuy, quoteSell } from "./pons";

export const PERCH_ACTIVE = ["waiting", "filling"];
export async function getPerch(id) {
  return getAgentJob("perch", id);
}

export async function savePerch(job) {
  return saveAgentJob("perch", job, PERCH_ACTIVE.includes(job.status));
}

export async function deletePerch(job) {
  return deleteAgentJob("perch", job);
}

const log = (job, msg) => {
  job.log = [...(job.log || []), { at: new Date().toISOString(), msg }].slice(-20);
};
const spender = (job) => job.curve || ROUTER;

async function receipt(hash) {
  try {
    return await publicClient.getTransactionReceipt({ hash });
  } catch {
    return null;
  }
}

// tokens out for `eth` in (buy side)
export async function buyQuote({ curve, tokenAddress }, eth, wallet) {
  if (curve) return (await quoteBuy(curve, eth, wallet))?.tokensOut ?? null;
  return (await bestRoute(await getWeth(), tokenAddress, eth))?.amountOut ?? null;
}
// eth out for `tokens` in (sell side)
export async function sellQuote({ curve, tokenAddress }, tokens) {
  if (curve) return (await quoteSell(curve, tokens)) ?? null;
  return (await bestRoute(tokenAddress, await getWeth(), tokens))?.amountOut ?? null;
}

// Order setup at creation: reference quote and, for sells, the token amount to sell.
export async function perchReference(job) {
  const budget = BigInt(job.budgetWei);
  if (job.side === "Buy") {
    const tokens = await buyQuote(job, budget, job.address);
    if (!tokens) throw new Error("No price for this token right now. Try again in a minute.");
    return { refTokens: tokens.toString() };
  }
  const bal = await tokenBalance(job.tokenAddress, job.address);
  if (bal === 0n) throw new Error(`You don't hold any ${job.token === "NEXTRA" ? "$NEXTRA" : job.token} to sell.`);
  const valueAll = await sellQuote(job, bal);
  if (!valueAll) throw new Error("No price for this token right now. Try again in a minute.");
  const tokensIn = valueAll <= budget ? bal : (bal * budget) / valueAll;
  const refEth = valueAll <= budget ? valueAll : await sellQuote(job, tokensIn);
  return { tokensIn: tokensIn.toString(), refEthWei: (refEth || budget).toString() };
}

const bps = (pct) => BigInt(Math.round(Number(pct) * 100));

async function step(job) {
  const wallet = job.address;
  const now = Date.now();

  if (job.status === "filling") {
    const rc = await receipt(job.pending.hash);
    if (!rc) {
      if (now - job.pending.at > 10 * 60_000) {
        job.status = "waiting";
        job.pending = null;
        job.note = "Order was not confirmed. Watching again.";
      }
      return;
    }
    if (rc.status !== "success") {
      job.fails = (job.fails || 0) + 1;
      job.status = job.fails >= 3 ? "failed" : "waiting";
      job.pending = null;
      job.note = job.fails >= 3 ? "Stopped after 3 failed fills (price moved too fast)." : "Fill reverted (price moved). Watching again.";
      log(job, "Fill reverted");
      return;
    }
    job.status = "filled";
    job.fillTx = job.pending.hash;
    job.filledEthWei = job.pending.eth;
    job.filledAt = new Date().toISOString();
    job.pending = null;
    job.note = null;
    log(job, `Filled: ${job.side === "Buy" ? "bought" : "sold"} ${job.token}`);
    return;
  }

  // waiting
  if (now > job.expiresAt) {
    job.status = "expired";
    job.note = "Expired before the price was reached.";
    log(job, "Expired");
    return;
  }
  if (job.paused) return;

  // sells: approve early so the fill is not delayed when the price hits
  if (job.side === "Sell" && !job.approved) {
    const need = BigInt(job.tokensIn);
    const allowance = await tokenAllowance(job.tokenAddress, wallet, spender(job));
    if (allowance >= need) job.approved = true;
    else if (!job.approveTx || (await receipt(job.approveTx))) {
      job.approveTx = await sendFromWallet({ walletId: job.walletId, from: wallet, ...approveCall(job.tokenAddress, need, spender(job)) });
      return;
    } else return;
  }

  const off = bps(job.offset);
  const slip = Number(bps(job.slippage));
  job.checkedAt = new Date().toISOString();

  if (job.side === "Buy") {
    const budget = BigInt(job.budgetWei);
    const ref = BigInt(job.refTokens);
    const q = job.curve ? await quoteBuy(job.curve, budget, wallet) : null;
    const route = job.curve ? null : await bestRoute(await getWeth(), job.tokenAddress, budget);
    const tokens = job.curve ? q?.tokensOut : route?.amountOut;
    if (!tokens) return void (job.note = "No price right now. Retrying.");
    // price change vs creation: ref/tokens - 1 (negative = cheaper)
    job.movePct = Number(((ref * 1_000_000n) / tokens) - 1_000_000n) / 10_000;
    const target = (ref * 10000n) / (10000n - off);
    if (tokens < target) return void (job.note = null);
    const eth = await publicClient.getBalance({ address: wallet });
    if (eth < budget + GAS_BUFFER) return void (job.note = "Price reached, but not enough ETH in your wallet.");
    const tx = job.curve
      ? ponsBuyCall({ curve: job.curve, quoteIn: budget, q, recipient: wallet, slippageBps: slip })
      : buyCall({ route, amountIn: budget, recipient: wallet, slippageBps: slip });
    const hash = await sendFromWallet({ walletId: job.walletId, from: wallet, ...tx });
    job.pending = { hash, at: now, eth: budget.toString() };
    job.status = "filling";
    log(job, `Price hit (${job.movePct.toFixed(2)}%). Buying.`);
    return;
  }

  // Sell
  let amount = BigInt(job.tokensIn);
  const refEth = BigInt(job.refEthWei);
  const route = job.curve ? null : await bestRoute(job.tokenAddress, await getWeth(), amount);
  const out = job.curve ? await quoteSell(job.curve, amount) : route?.amountOut;
  if (!out) return void (job.note = "No price right now. Retrying.");
  job.movePct = Number(((out * 1_000_000n) / refEth) - 1_000_000n) / 10_000;
  const target = (refEth * (10000n + off)) / 10000n;
  if (out < target) return void (job.note = null);
  const bal = await tokenBalance(job.tokenAddress, wallet);
  if (bal < amount) {
    if (bal === 0n) {
      job.status = "failed";
      job.note = "Price reached, but the tokens are no longer in your wallet.";
      return;
    }
    amount = bal;
  }
  const tx = job.curve
    ? ponsSellCall({ curve: job.curve, tokensIn: amount, quoteOut: out, recipient: wallet, slippageBps: slip })
    : sellCall({ route, amountIn: amount, recipient: wallet, slippageBps: slip });
  const hash = await sendFromWallet({ walletId: job.walletId, from: wallet, ...tx });
  job.pending = { hash, at: now, eth: out.toString() };
  job.status = "filling";
  log(job, `Price hit (+${job.movePct.toFixed(2)}%). Selling.`);
}

export async function tickPerch(jobs = [], deadline = Date.now() + 50_000) {
  const results = [];
  for (const job of jobs) {
    if (Date.now() > deadline) break;
    const before = JSON.stringify(job);
    try {
      await step(job);
      job.error = null;
    } catch (e) {
      job.error = String(e?.shortMessage || e?.message || e).slice(0, 200);
    }
    await persistAfterStep("perch", job, before, PERCH_ACTIVE.includes(job.status));
    results.push({ id: job.id, status: job.status, error: job.error || undefined });
  }
  return { processed: results.length, results };
}

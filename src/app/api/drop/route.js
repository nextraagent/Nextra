import { NextResponse } from "next/server";
import { createWalletClient, http, formatEther, formatUnits, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { cfg, eligibleHolders, erc20, publicClient, robinhood, split } from "../../../lib/chain";
import { dayKey, isTradingDay, upcomingRound } from "../../../lib/rounds";
import { getDropLog, saveDropLog, tally, winner } from "../../../lib/votes";
import { bestRoute, buyCall, getWeth } from "../../../lib/swap";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const json = (data, status = 200) =>
  NextResponse.json(JSON.parse(JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v))), { status });

// ETH the Vault keeps for gas (the buy plus one transfer per holder). Everything above it buys the stock.
const GAS_KEEP = parseEther("0.001");
const MIN_BUY = parseEther("0.0001");
const spendable = (eth) => (eth > GAS_KEEP ? eth - GAS_KEEP : 0n);

// Today's winning stock for a round.
async function pick(round, c = cfg()) {
  const t = await tally(round, c.candidates).catch(() => ({ counts: {}, total: 0 }));
  const stock = winner(t, c.defaultStock);
  return { votes: t, stock, stockToken: c.stocks[stock] || null };
}

// Turns the Vault's spare ETH into the winning stock (Uniswap, best route incl. USDG).
async function buyStock(wallet, vault, stockToken) {
  const amountIn = spendable(await publicClient.getBalance({ address: vault }));
  if (amountIn < MIN_BUY) return null;
  const route = await bestRoute(await getWeth(), stockToken, amountIn);
  if (!route) throw new Error("No Uniswap route for this stock right now.");
  const call = buyCall({ route, amountIn, recipient: vault, slippageBps: 300 });
  const hash = await wallet.sendTransaction({ to: call.to, data: call.data, value: call.value });
  const rc = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (rc.status !== "success") throw new Error(`Buy reverted (${hash}).`);
  return { hash, ethSpent: formatEther(amountIn) };
}

// Works out today's drop: which stock, how much the Vault holds, and each holder's share.
async function plan(round) {
  const c = cfg();
  if (!c.token) return { ready: false, reason: "Token address not set yet." };
  let holders;
  try {
    holders = await eligibleHolders(c);
  } catch (e) {
    return { ready: false, reason: `Holder list unavailable (${String(e?.message || e).slice(0, 80)}).` };
  }
  if (!c.vault) return { ready: false, reason: "Vault address not set yet.", eligible: holders.length };
  const { votes: t, stock, stockToken } = await pick(round, c);
  const ethBal = await publicClient.getBalance({ address: c.vault });
  const base = { ready: false, round, stock, votes: t, eligible: holders.length, vaultEth: formatEther(ethBal), ethToBuy: formatEther(spendable(ethBal)) };
  if (!stockToken) return { ...base, reason: `No contract address set for ${stock}.` };
  const bal = await publicClient.readContract({ address: stockToken, abi: erc20, functionName: "balanceOf", args: [c.vault] });
  const shares = split(bal, holders);
  return {
    ...base,
    ready: bal > 0n && shares.length > 0,
    reason:
      bal === 0n
        ? spendable(ethBal) >= MIN_BUY
          ? `Buys ${stock} with ${formatEther(spendable(ethBal))} ETH at drop time.`
          : `The Vault holds no ${stock} or spare ETH yet.`
        : shares.length
          ? null
          : "No eligible holders.",
    stockToken,
    vaultBalance: formatUnits(bal, 18),
    shares: shares.map((s) => ({ address: s.address, amount: formatUnits(s.amount, 18), raw: s.amount })),
  };
}

export async function GET(req) {
  const isCron = process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const now = new Date();

  // Public preview: what the next drop would send right now.
  if (!isCron) {
    try {
      const p = await plan(upcomingRound(now));
      if (p.shares) p.shares = p.shares.slice(0, 50).map(({ raw, ...s }) => s);
      return json({ preview: true, ...p });
    } catch (e) {
      return json({ preview: true, ready: false, reason: "Preview unavailable." }, 503);
    }
  }

  const date = dayKey(now);
  if (!isTradingDay(now)) return json({ skipped: "Not a trading day." });
  if (!cfg().enabled) return json({ skipped: "Drops are switched off (DROPS_ENABLED)." });
  if (await getDropLog(date)) return json({ skipped: "Already dropped today." });

  const pk = process.env.VAULT_PRIVATE_KEY;
  if (!pk) return json({ error: "VAULT_PRIVATE_KEY missing." }, 500);
  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  if (!cfg().vault || account.address.toLowerCase() !== cfg().vault.toLowerCase()) return json({ error: "Key does not match VAULT_ADDRESS." }, 500);
  const wallet = createWalletClient({ account, chain: robinhood, transport: http() });

  // 1) Buy today's winning stock with the Vault's ETH (10% of creator fees, sent in by the team).
  let buy = null;
  const today = await pick(date);
  if (today.stockToken) {
    try {
      buy = await buyStock(wallet, account.address, today.stockToken);
    } catch (e) {
      buy = { error: String(e?.shortMessage || e?.message || e).slice(0, 200) };
    }
  }

  // 2) Drop everything the Vault now holds of that stock to eligible holders.
  const p = await plan(date);
  if (!p.ready) {
    await saveDropLog(date, { date, status: "skipped", reason: p.reason, stock: p.stock, buy, at: now.toISOString() });
    return json({ skipped: p.reason, buy });
  }

  const sent = [];
  const failed = [];
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  try {
    for (const s of p.shares) {
      try {
        const hash = await wallet.writeContract({
          address: p.stockToken,
          abi: erc20,
          functionName: "transfer",
          args: [s.address, s.raw],
          nonce,
        });
        nonce++;
        sent.push({ to: s.address, amount: s.amount, hash });
      } catch (e) {
        failed.push({ to: s.address, amount: s.amount, error: String(e?.shortMessage || e?.message || e).slice(0, 200) });
      }
    }
  } finally {
    await saveDropLog(date, {
      date,
      status: failed.length ? "partial" : "done",
      stock: p.stock,
      stockToken: p.stockToken,
      vaultBalance: p.vaultBalance,
      buy,
      recipients: sent.length,
      sent,
      failed,
      at: now.toISOString(),
    });
  }
  return json({ done: true, stock: p.stock, buy, recipients: sent.length, failed: failed.length });
}

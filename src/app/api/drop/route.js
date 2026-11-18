import { NextResponse } from "next/server";
import { createWalletClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { cfg, eligibleHolders, erc20, publicClient, robinhood, split } from "../../../lib/chain";
import { dayKey, isTradingDay, upcomingRound } from "../../../lib/rounds";
import { getDropLog, saveDropLog, tally, winner } from "../../../lib/votes";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const json = (data, status = 200) =>
  NextResponse.json(JSON.parse(JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v))), { status });

// Works out today's drop: which stock, how much the Vault holds, and each holder's share.
async function plan(round) {
  const c = cfg();
  if (!c.token || !c.vault) return { ready: false, reason: "Token or Vault address not set yet." };
  const t = await tally(round, c.candidates).catch(() => ({ counts: {}, total: 0 }));
  const stock = winner(t, c.defaultStock);
  const stockToken = c.stocks[stock];
  const holders = await eligibleHolders(c);
  const base = { ready: false, round, stock, votes: t, eligible: holders.length };
  if (!stockToken) return { ...base, reason: `No contract address set for ${stock}.` };
  const bal = await publicClient.readContract({ address: stockToken, abi: erc20, functionName: "balanceOf", args: [c.vault] });
  const shares = split(bal, holders);
  return {
    ...base,
    ready: bal > 0n && shares.length > 0,
    reason: bal === 0n ? `The Vault holds no ${stock} yet.` : shares.length ? null : "No eligible holders.",
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

  const p = await plan(date);
  if (!p.ready) {
    await saveDropLog(date, { date, status: "skipped", reason: p.reason, stock: p.stock, at: now.toISOString() });
    return json({ skipped: p.reason });
  }

  const pk = process.env.VAULT_PRIVATE_KEY;
  if (!pk) return json({ error: "VAULT_PRIVATE_KEY missing." }, 500);
  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  if (account.address.toLowerCase() !== cfg().vault.toLowerCase()) return json({ error: "Key does not match VAULT_ADDRESS." }, 500);
  const wallet = createWalletClient({ account, chain: robinhood, transport: http() });

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
      recipients: sent.length,
      sent,
      failed,
      at: now.toISOString(),
    });
  }
  return json({ done: true, stock: p.stock, recipients: sent.length, failed: failed.length });
}

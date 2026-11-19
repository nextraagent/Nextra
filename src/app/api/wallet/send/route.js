// Sends ETH, $NEXTRA or a stock token from the user's own Nextra wallet, signed server-side
// with the same Privy signer the agents use. Privy's in-browser pop-up stalls on Robinhood Chain fees.
import { NextResponse } from "next/server";
import { encodeFunctionData, getAddress, isAddress, parseAbi } from "viem";
import { embeddedWallet, getPrivyUser, verifyAccessToken } from "../../../../lib/privyServer";
import { sendFromWallet } from "../../../../lib/swap";
import { STOCKS } from "../../../../lib/stocks";
import { NEXTRA } from "../../../../lib/nextra";
import { publicClient } from "../../../../lib/chain";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const err = (error, status = 400) => NextResponse.json({ error }, { status });
const erc20 = parseAbi(["function transfer(address to, uint256 amount) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const TOKENS = new Set([NEXTRA, ...Object.values(STOCKS)].map((a) => a.toLowerCase()));

export async function POST(req) {
  let did;
  try {
    did = await verifyAccessToken((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  } catch {
    return err("Please log in again.", 401);
  }
  const b = await req.json().catch(() => ({}));
  const to = String(b.to || "").trim();
  const token = String(b.token || "ETH").toLowerCase();
  let amount;
  try {
    amount = BigInt(String(b.amount || "0"));
  } catch {
    return err("Enter a valid amount.");
  }
  if (!isAddress(to)) return err("Paste a full 0x… address on Robinhood Chain.");
  if (amount <= 0n) return err("Enter an amount above zero.");
  if (token !== "eth" && !TOKENS.has(token)) return err("This token can't be sent from here.");

  const user = await getPrivyUser(did).catch(() => null);
  const w = embeddedWallet(user);
  if (!w?.id) return err("Send works with your Nextra wallet (email, Google or X login).");
  if (!w.delegated) return err("Approve the Nextra signer first, then try again.", 403);
  const from = getAddress(w.address);
  if (getAddress(to) === from) return err("That's your own address.");

  try {
    let hash;
    if (token === "eth") {
      hash = await sendFromWallet({ walletId: w.id, from, to: getAddress(to), value: amount });
    } else {
      const bal = await publicClient.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [from] });
      if (bal < amount) return err("More than your balance.");
      const data = encodeFunctionData({ abi: erc20, functionName: "transfer", args: [getAddress(to), amount] });
      hash = await sendFromWallet({ walletId: w.id, from, to: getAddress(token), data });
    }
    return NextResponse.json({ hash });
  } catch (e) {
    const m = String(e?.shortMessage || e?.message || e);
    return err(/not enough eth|insufficient funds/i.test(m) ? "Not enough ETH to pay the network fee. Keep a little ETH in this wallet." : m.slice(0, 200), 500);
  }
}

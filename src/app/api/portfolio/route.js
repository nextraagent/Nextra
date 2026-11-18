import { NextResponse } from "next/server";
import { publicClient } from "../../../lib/chain";
import { bestRoute, getWeth, tokenBalance } from "../../../lib/swap";
import { SENTRY_TOKENS, stockAddress } from "../../../lib/stocks";
import { NEXTRA } from "../../../lib/nextra";
import { curveFor, quoteSell } from "../../../lib/pons";

export const dynamic = "force-dynamic";

// Public read-only view of a wallet: ETH, $NEXTRA (valued on the Pons curve) and stock tokens (valued via Uniswap).
export async function GET(req) {
  const address = new URL(req.url).searchParams.get("address") || "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: "Bad address" }, { status: 400 });
  try {
    const [eth, weth] = await Promise.all([publicClient.getBalance({ address }), getWeth()]);
    const tokens = await Promise.all(
      ["NEXTRA", ...SENTRY_TOKENS].map(async (symbol) => {
        const token = symbol === "NEXTRA" ? NEXTRA : stockAddress(symbol);
        const balance = await tokenBalance(token, address).catch(() => 0n);
        let valueWei = null;
        if (balance > 0n) {
          const curve = curveFor(token);
          if (curve) valueWei = await quoteSell(curve, balance).catch(() => null);
          else valueWei = (await bestRoute(token, weth, balance).catch(() => null))?.amountOut ?? null;
        }
        return { symbol, address: token, balance: balance.toString(), valueWei: valueWei == null ? null : valueWei.toString() };
      })
    );
    const total = tokens.reduce((s, t) => s + BigInt(t.valueWei || "0"), eth);
    return NextResponse.json({ address, eth: eth.toString(), tokens, totalWei: total.toString(), at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e?.shortMessage || e?.message || e).slice(0, 200) }, { status: 500 });
  }
}

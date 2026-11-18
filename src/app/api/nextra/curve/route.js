import { NextResponse } from "next/server";
import { parseEther } from "viem";
import { NEXTRA } from "../../../../lib/nextra";
import { curveAbi, curveFor, curveState, quoteBuy, quoteSell } from "../../../../lib/pons";
import { publicClient } from "../../../../lib/chain";

export const dynamic = "force-dynamic";

const s = (v) => (typeof v === "bigint" ? v.toString() : v);

// Read-only view of the $NEXTRA Pons curve: state plus sample quotes (0.001 ETH buy, 1M token sell).
export async function GET() {
  const curve = curveFor(NEXTRA);
  try {
    const [token, native, st, buy, sell] = await Promise.all([
      publicClient.readContract({ address: curve, abi: curveAbi, functionName: "token" }),
      publicClient.readContract({ address: curve, abi: curveAbi, functionName: "isNativeQuote" }),
      curveState(curve),
      quoteBuy(curve, parseEther("0.001"), "0x000000000000000000000000000000000000dEaD"),
      quoteSell(curve, parseEther("1000000")),
    ]);
    return NextResponse.json(
      {
        curve,
        token: token.toLowerCase(),
        matches: token.toLowerCase() === NEXTRA,
        nativeQuote: native,
        state: Object.fromEntries(Object.entries(st).map(([k, v]) => [k, s(v)])),
        buy0001Eth: buy ? { tokensOut: s(buy.tokensOut), spent: s(buy.spent) } : null,
        sell1M: s(sell),
      },
      { headers: { "cache-control": "public, s-maxage=15" } },
    );
  } catch (e) {
    return NextResponse.json({ curve, error: String(e?.shortMessage || e?.message || e).slice(0, 300) }, { status: 502 });
  }
}

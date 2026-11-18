import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { cfg, erc20, minHoldUnits, publicClient } from "../../../lib/chain";
import { openRound, upcomingRound } from "../../../lib/rounds";
import { castVote, tally, winner } from "../../../lib/votes";
import { voteMessage } from "../../../lib/voteMessage";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = cfg();
  const open = openRound();
  const next = upcomingRound();
  try {
    const [o, n] = await Promise.all([tally(open, c.candidates), tally(next, c.candidates)]);
    return NextResponse.json({
      open: o,
      next: { ...n, winner: winner(n, c.defaultStock) },
      candidates: c.candidates,
      live: Boolean(c.token),
    }, { headers: { "cache-control": "public, s-maxage=20, stale-while-revalidate=60" } });
  } catch (e) {
    return NextResponse.json({ error: "Votes are not available yet.", candidates: c.candidates, live: false }, { status: 503 });
  }
}

export async function POST(req) {
  const c = cfg();
  if (!c.token) return NextResponse.json({ error: "Voting opens at launch." }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { address, symbol, round, signature } = body || {};
  if (!isAddress(address || "") || typeof signature !== "string") return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const sym = String(symbol || "").toUpperCase();
  if (!c.candidates.includes(sym)) return NextResponse.json({ error: "Unknown stock." }, { status: 400 });
  if (round !== openRound()) return NextResponse.json({ error: "This round is closed. Refresh and try again." }, { status: 409 });

  const wallet = getAddress(address);
  if (c.exclude.has(wallet.toLowerCase())) return NextResponse.json({ error: "This wallet can't vote." }, { status: 403 });

  const ok = await publicClient
    .verifyMessage({ address: wallet, message: voteMessage(round, wallet, sym), signature })
    .catch(() => false);
  if (!ok) return NextResponse.json({ error: "Signature check failed." }, { status: 401 });

  const [bal, min] = await Promise.all([
    publicClient.readContract({ address: c.token, abi: erc20, functionName: "balanceOf", args: [wallet] }),
    minHoldUnits(c.token),
  ]);
  if (bal < min) return NextResponse.json({ error: "You need at least 1,000,000 $NEXTRA to vote." }, { status: 403 });

  await castVote(round, wallet, sym);
  return NextResponse.json({ ok: true, round, symbol: sym, tally: await tally(round, c.candidates) });
}

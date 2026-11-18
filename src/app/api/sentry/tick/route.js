import { NextResponse } from "next/server";
import { tick } from "../../../../lib/sentry";
import { tickTempo } from "../../../../lib/tempo";
import { tickPerch } from "../../../../lib/perch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called every minute by an external scheduler (cron-job.org): GET /api/sentry/tick
// Advances Sentry (TP/SL), Tempo (DCA/TWAP) and Perch (limit order) agents.
// Safe to call publicly: it only moves agents forward by their own saved rules, at most once per minute.
// Set SENTRY_TICK_KEY to require ?key=<value>.
export async function GET(req) {
  const secret = process.env.SENTRY_TICK_KEY;
  const key = new URL(req.url).searchParams.get("key");
  const ok = !secret || key === secret || req.headers.get("authorization") === `Bearer ${secret}`;
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.PRIVY_AUTHORIZATION_KEY) return NextResponse.json({ error: "PRIVY_AUTHORIZATION_KEY not set" }, { status: 503 });
  try {
    const started = Date.now();
    const sentry = await tick();
    const tempo = await tickTempo(started + 42_000).catch((e) => ({ error: String(e?.message || e).slice(0, 200) }));
    const perch = await tickPerch(started + 53_000).catch((e) => ({ error: String(e?.message || e).slice(0, 200) }));
    return NextResponse.json({ ...sentry, tempo, perch });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}

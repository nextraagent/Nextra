import { NextResponse } from "next/server";
import { tick } from "../../../../lib/sentry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called every minute by an external scheduler (cron-job.org): GET /api/sentry/tick
// Safe to call publicly: it only moves agents forward by their own saved rules, at most once per minute.
// Set SENTRY_TICK_KEY to require ?key=<value>.
export async function GET(req) {
  const secret = process.env.SENTRY_TICK_KEY;
  const key = new URL(req.url).searchParams.get("key");
  const ok = !secret || key === secret || req.headers.get("authorization") === `Bearer ${secret}`;
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.PRIVY_AUTHORIZATION_KEY) return NextResponse.json({ error: "PRIVY_AUTHORIZATION_KEY not set" }, { status: 503 });
  try {
    return NextResponse.json(await tick());
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}

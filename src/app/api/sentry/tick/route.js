import { NextResponse } from "next/server";
import { tick } from "../../../../lib/sentry";
import { tickTempo } from "../../../../lib/tempo";
import { tickPerch } from "../../../../lib/perch";
import { acquireLock, loadActive } from "../../../../lib/store";
import { recordTrades, tradeMark } from "../../../../lib/ledger";

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
    if (!(await acquireLock("tick", 50))) return NextResponse.json({ skipped: "locked" });
    const started = Date.now();
    const jobs = await loadActive();
    const marks = Object.fromEntries(Object.entries(jobs).map(([a, js]) => [a, js.map((j) => tradeMark(a, j))]));
    const fail = (e) => ({ error: String(e?.message || e).slice(0, 200) });
    const sentry = await tick(jobs.sentry, started + 30_000).catch(fail);
    const tempo = await tickTempo(jobs.tempo, started + 42_000).catch(fail);
    const perch = await tickPerch(jobs.perch, started + 52_000).catch(fail);
    const moved = Object.entries(jobs).some(([a, js]) => js.some((j, i) => tradeMark(a, j) !== marks[a][i]));
    if (moved) await recordTrades(jobs).catch(() => {});
    return NextResponse.json({ sentry, tempo, perch, ms: Date.now() - started });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}

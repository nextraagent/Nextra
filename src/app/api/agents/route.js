import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { parseEther } from "viem";
import { embeddedWallet, getPrivyUser, verifyAccessToken } from "../../../lib/privyServer";
import { ACTIVE, deleteJob, getJob, listJobs, saveJob } from "../../../lib/sentry";
import { TEMPO_ACTIVE, deleteTempo, getTempo, listTempo, saveTempo } from "../../../lib/tempo";
import { stockAddress } from "../../../lib/stocks";
import { curveFor } from "../../../lib/pons";
import { NEXTRA } from "../../../lib/nextra";

export const dynamic = "force-dynamic";

const err = (error, status = 400) => NextResponse.json({ error }, { status });

async function auth(req) {
  const h = req.headers.get("authorization") || "";
  return verifyAccessToken(h.replace(/^Bearer\s+/i, ""));
}

const publicJob = ({ userId, walletId, balBefore, ...j }) => {
  if (j.pending) j.pending = { kind: j.pending.kind, hash: j.pending.hash };
  return j;
};

export async function GET(req) {
  let did;
  try {
    did = await auth(req);
  } catch (e) {
    return err(e.message, 401);
  }
  const [s, t] = await Promise.all([listJobs(), listTempo()]);
  const jobs = [...s.map((j) => ({ agent: "sentry", ...j })), ...t]
    .filter((j) => j.userId === did)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(publicJob);
  return NextResponse.json({ jobs });
}

function pickToken(raw) {
  const token = String(raw || "").toUpperCase();
  const tokenAddress = token === "NEXTRA" ? NEXTRA : stockAddress(token);
  const curve = token === "NEXTRA" ? curveFor(NEXTRA) : null;
  return { token, tokenAddress, curve, venue: curve ? "pons" : "uniswap" };
}

async function wallet(did) {
  const user = await getPrivyUser(did).catch(() => null);
  const w = embeddedWallet(user);
  if (!w) return { error: "Agents run on your Nextra wallet. Log in with email, Google or X to get one." };
  if (!w.delegated) return { error: "Give the agent permission first (the approval popup), then try again." };
  if (!w.id) return { error: "Your wallet is missing an ID at Privy. Log out and in again, then retry." };
  return { w };
}

export async function POST(req) {
  let did;
  try {
    did = await auth(req);
  } catch (e) {
    return err(e.message, 401);
  }
  const b = await req.json().catch(() => ({}));
  if (b.agent !== "sentry" && b.agent !== "tempo") return err("Only Sentry and Tempo are live right now.");
  const t = pickToken(b.token);
  if (!t.tokenAddress) return err("Pick a supported token.");
  const now = new Date().toISOString();

  if (b.agent === "tempo") {
    const mode = b.mode === "TWAP" ? "TWAP" : "DCA";
    const perOrder = Number(b.perOrder);
    const budget = Number(b.budget);
    const every = Number(b.every);
    if (!(perOrder > 0) || perOrder > 50) return err("Amount per order must be between 0 and 50 ETH.");
    if (!(budget >= perOrder) || budget > 500) return err("Total budget must be at least one order and at most 500 ETH.");
    if (!(Number.isInteger(every) && every >= 1 && every <= 60)) return err("Interval must be 1–60 minutes.");
    const { w, error } = await wallet(did);
    if (error) return err(error);
    const mine = (await listTempo()).filter((j) => j.userId === did && TEMPO_ACTIVE.includes(j.status));
    if (mine.length >= 10) return err("You can run up to 10 Tempo agents at once.");
    const job = await saveTempo({
      id: randomUUID(),
      agent: "tempo",
      userId: did,
      walletId: w.id,
      address: w.address,
      ...t,
      mode,
      perOrder: String(perOrder),
      budget: String(budget),
      every,
      perOrderWei: parseEther(String(perOrder)).toString(),
      budgetWei: parseEther(String(budget)).toString(),
      everyMs: every * 60_000,
      filledWei: "0",
      tokensWei: "0",
      orders: 0,
      status: "running",
      paused: false,
      nextAt: Date.now(),
      createdAt: now,
      log: [{ at: now, msg: `Created. First ${mode === "DCA" ? "buy" : "sell"} within a minute.` }],
    });
    return NextResponse.json({ job: publicJob(job) });
  }

  const amount = Number(b.amount);
  const tp = Number(b.tp);
  const sl = Number(b.sl);
  if (!(amount > 0) || amount > 100) return err("Buy amount must be between 0 and 100 ETH.");
  if (!(tp >= 0.5 && tp <= 1000)) return err("Take-profit must be between 0.5% and 1000%.");
  if (!(sl >= 0.5 && sl < 100)) return err("Stop-loss must be between 0.5% and 99%.");
  const { w, error } = await wallet(did);
  if (error) return err(error);

  const mine = (await listJobs()).filter((j) => j.userId === did && ACTIVE.includes(j.status));
  if (mine.length >= 10) return err("You can run up to 10 Sentry agents at once.");

  const job = await saveJob({
    id: randomUUID(),
    agent: "sentry",
    userId: did,
    walletId: w.id,
    address: w.address,
    ...t,
    amount: String(amount),
    amountWei: parseEther(String(amount)).toString(),
    tp,
    sl,
    trailing: !!b.trailing,
    status: "pending",
    paused: false,
    createdAt: now,
    log: [{ at: now, msg: "Created. Buying within a minute." }],
  });
  return NextResponse.json({ job: publicJob(job) });
}

export async function PATCH(req) {
  let did;
  try {
    did = await auth(req);
  } catch (e) {
    return err(e.message, 401);
  }
  const { id, action } = await req.json().catch(() => ({}));
  if (!id) return err("Agent not found.", 404);
  let job = await getJob(id);
  const isTempo = !job;
  if (isTempo) job = await getTempo(id);
  if (!job || job.userId !== did) return err("Agent not found.", 404);

  if (isTempo) {
    if (action === "pause") job.paused = true;
    else if (action === "resume") job.paused = false;
    else if (action === "close") {
      if (job.status !== "running") return err("This agent already stopped.");
      job.status = "cancelled";
      job.nextAt = null;
      job.note = job.pending ? "Stopped. The last order already sent may still fill." : "Stopped.";
      job.pending = null;
    } else if (action === "delete") {
      if (TEMPO_ACTIVE.includes(job.status)) return err("Stop the agent before deleting.");
      await deleteTempo(job.id);
      return NextResponse.json({ ok: true });
    } else return err("Unknown action.");
    await saveTempo(job);
    return NextResponse.json({ job: publicJob(job) });
  }

  if (action === "pause") job.paused = true;
  else if (action === "resume") job.paused = false;
  else if (action === "close") {
    if (job.status === "pending") job.status = "cancelled";
    else if (job.status === "holding") job.closeRequested = true;
    else return err("This agent can't be closed right now.");
  } else if (action === "delete") {
    if (ACTIVE.includes(job.status)) return err("Close the position before deleting.");
    await deleteJob(job.id);
    return NextResponse.json({ ok: true });
  } else return err("Unknown action.");

  await saveJob(job);
  return NextResponse.json({ job: publicJob(job) });
}

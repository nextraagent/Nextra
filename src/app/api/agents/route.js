import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { parseEther } from "viem";
import { embeddedWallet, getPrivyUser, verifyAccessToken } from "../../../lib/privyServer";
import { ACTIVE, deleteJob, getJob, listJobs, saveJob } from "../../../lib/sentry";
import { stockAddress } from "../../../lib/stocks";
import { curveFor } from "../../../lib/pons";
import { NEXTRA } from "../../../lib/nextra";

export const dynamic = "force-dynamic";

const err = (error, status = 400) => NextResponse.json({ error }, { status });

async function auth(req) {
  const h = req.headers.get("authorization") || "";
  return verifyAccessToken(h.replace(/^Bearer\s+/i, ""));
}

const publicJob = ({ userId, walletId, balBefore, ...j }) => j;

export async function GET(req) {
  let did;
  try {
    did = await auth(req);
  } catch (e) {
    return err(e.message, 401);
  }
  const jobs = (await listJobs()).filter((j) => j.userId === did).map(publicJob);
  return NextResponse.json({ jobs });
}

export async function POST(req) {
  let did;
  try {
    did = await auth(req);
  } catch (e) {
    return err(e.message, 401);
  }
  const b = await req.json().catch(() => ({}));
  if (b.agent !== "sentry") return err("Only Sentry is live right now.");
  const token = String(b.token || "").toUpperCase();
  const tokenAddress = token === "NEXTRA" ? NEXTRA : stockAddress(token);
  const curve = token === "NEXTRA" ? curveFor(NEXTRA) : null;
  const amount = Number(b.amount);
  const tp = Number(b.tp);
  const sl = Number(b.sl);
  if (!tokenAddress) return err("Pick a supported token.");
  if (!(amount > 0) || amount > 100) return err("Buy amount must be between 0 and 100 ETH.");
  if (!(tp >= 0.5 && tp <= 1000)) return err("Take-profit must be between 0.5% and 1000%.");
  if (!(sl >= 0.5 && sl < 100)) return err("Stop-loss must be between 0.5% and 99%.");

  const user = await getPrivyUser(did).catch(() => null);
  const w = embeddedWallet(user);
  if (!w) return err("Sentry runs on your Nextra wallet. Log in with email, Google or X to get one.");
  if (!w.delegated) return err("Give Sentry permission first (the approval popup), then try again.");
  if (!w.id) return err("Your wallet is missing an ID at Privy. Log out and in again, then retry.");

  const mine = (await listJobs()).filter((j) => j.userId === did && ACTIVE.includes(j.status));
  if (mine.length >= 10) return err("You can run up to 10 Sentry agents at once.");

  const job = await saveJob({
    id: randomUUID(),
    agent: "sentry",
    userId: did,
    walletId: w.id,
    address: w.address,
    token,
    tokenAddress,
    curve,
    venue: curve ? "pons" : "uniswap",
    amount: String(amount),
    amountWei: parseEther(String(amount)).toString(),
    tp,
    sl,
    trailing: !!b.trailing,
    status: "pending",
    paused: false,
    createdAt: new Date().toISOString(),
    log: [{ at: new Date().toISOString(), msg: "Created. Buying within a minute." }],
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
  const job = id ? await getJob(id) : null;
  if (!job || job.userId !== did) return err("Agent not found.", 404);

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

import { NextResponse } from "next/server";
import { agentStats } from "../../../lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await agentStats(), { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (e) {
    return NextResponse.json({ error: "Stats unavailable" }, { status: 503 });
  }
}

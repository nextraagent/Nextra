import { NextResponse } from "next/server";
import { nextraStats } from "../../../lib/nextra";

export const revalidate = 20;

export async function GET() {
  try {
    return NextResponse.json(await nextraStats(), { headers: { "cache-control": "public, s-maxage=20, stale-while-revalidate=60" } });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 502 });
  }
}

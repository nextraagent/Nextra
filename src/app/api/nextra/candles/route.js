import { NextResponse } from "next/server";
import { nextraCandles } from "../../../../lib/nextra";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const tf = new URL(req.url).searchParams.get("tf") || "5m";
  try {
    const candles = await nextraCandles(tf);
    return NextResponse.json({ tf, candles }, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" } });
  } catch (e) {
    return NextResponse.json({ tf, candles: [], error: String(e?.message || e).slice(0, 200) }, { status: 502 });
  }
}

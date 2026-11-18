import { list, put, del } from "@vercel/blob";

// One file per wallet per round: votes/<round>/<address>--<SYMBOL>
const prefix = (round) => `votes/${round}/`;

async function listAll(p) {
  const blobs = [];
  let cursor;
  do {
    const r = await list({ prefix: p, cursor, limit: 1000 });
    blobs.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function castVote(round, address, symbol) {
  const mine = await listAll(`${prefix(round)}${address.toLowerCase()}--`);
  if (mine.length) await del(mine.map((b) => b.url));
  await put(`${prefix(round)}${address.toLowerCase()}--${symbol}`, symbol, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "text/plain",
  });
}

export async function tally(round, candidates = []) {
  const counts = Object.fromEntries(candidates.map((c) => [c, 0]));
  const blobs = await listAll(prefix(round));
  for (const b of blobs) {
    const sym = b.pathname.split("--").pop();
    if (sym) counts[sym] = (counts[sym] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { round, counts, total };
}

// Most votes wins; ties go alphabetically; no votes falls back to the default stock.
export function winner(t, fallback) {
  const ranked = Object.entries(t.counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.length && ranked[0][1] > 0 ? ranked[0][0] : fallback;
}

export async function saveDropLog(date, data) {
  await put(`drops/${date}.json`, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function getDropLog(date) {
  const r = await list({ prefix: `drops/${date}.json`, limit: 1 });
  if (!r.blobs.length) return null;
  const res = await fetch(r.blobs[0].url, { cache: "no-store" });
  return res.ok ? res.json() : null;
}

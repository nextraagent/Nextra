import { redis } from "./store";

// One hash per round: votes:<round> → { <address>: <SYMBOL> }. Re-voting just overwrites.
const key = (round) => `votes:${round}`;

export async function castVote(round, address, symbol) {
  await redis("HSET", key(round), address.toLowerCase(), symbol);
}

export async function tally(round, candidates = []) {
  const counts = Object.fromEntries(candidates.map((c) => [c, 0]));
  const flat = (await redis("HGETALL", key(round))) || [];
  for (let i = 1; i < flat.length; i += 2) {
    const sym = flat[i];
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
  await redis("SET", `drops:${date}`, JSON.stringify(data));
}

export async function getDropLog(date) {
  const s = await redis("GET", `drops:${date}`);
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

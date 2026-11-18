// Drop schedule: 14:00 UTC on trading days (Mon–Fri).
// Votes for drop day D close when the drop of the trading day before D happens,
// so the stock for every drop is known ~24h in advance (time to buy it).
export const DROP_HOUR_UTC = 14;

export const isTradingDay = (d) => {
  const w = d.getUTCDay();
  return w >= 1 && w <= 5;
};

export const dayKey = (d) => d.toISOString().slice(0, 10);

function at14(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DROP_HOUR_UTC, 0, 0));
}

function nextTradingDay(d) {
  const t = new Date(d);
  do {
    t.setUTCDate(t.getUTCDate() + 1);
  } while (!isTradingDay(t));
  return at14(t);
}

// Next drop time strictly after `now`.
export function nextDrop(now = new Date()) {
  const today = at14(now);
  if (isTradingDay(today) && now < today) return today;
  return nextTradingDay(today);
}

// Round whose vote is currently open (the drop after the next drop).
export function openRound(now = new Date()) {
  return dayKey(nextTradingDay(nextDrop(now)));
}

// Round already closed whose stock is dropped next.
export function upcomingRound(now = new Date()) {
  return dayKey(nextDrop(now));
}

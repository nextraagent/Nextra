"use client";
import { useEffect, useState } from "react";

// Next Friday 13:00 UTC.
function nextFridayBuy(now) {
  const d = new Date(now);
  d.setUTCHours(13, 0, 0, 0);
  const add = (5 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 7);
  return d.getTime();
}

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const days = Math.floor(s / 86400);
  const sec = s % 60;
  return days > 0 ? `${days}d ${h}h ${m}m` : `${h}h ${m}m ${sec}s`;
}

export default function Countdown() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return <span>—</span>;
  return <span>{fmt(nextFridayBuy(now) - now)}</span>;
}

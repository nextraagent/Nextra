"use client";

import { useEffect, useState } from "react";

// Company icons via Google's public favicon service (the company's own site icon).
// Falls back to a two-letter badge if an icon can't load.
const DOMAINS = {
  NVDA: "nvidia.com",
  TSLA: "tesla.com",
  AAPL: "apple.com",
  AMZN: "amazon.com",
  META: "meta.com",
  GOOGL: "google.com",
  MSFT: "microsoft.com",
  COIN: "coinbase.com",
  SPY: "ssga.com",
  HOOD: "robinhood.com",
};

export default function TokenLogo({ symbol, size = 40 }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [symbol]);
  const domain = DOMAINS[symbol];
  const style = { width: size, height: size, flex: `0 0 ${size}px`, fontSize: Math.round(size * 0.34) };
  if (domain && !broken)
    return (
      <img
        key={symbol}
        className="tk-logo"
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt={`${symbol} logo`}
        width={size}
        height={size}
        style={{ ...style, objectFit: "contain", padding: Math.round(size * 0.12), boxSizing: "border-box" }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  return (
    <span className="tk-logo tk-fallback" style={style} aria-hidden="true">
      {(symbol || "?").slice(0, 2)}
    </span>
  );
}

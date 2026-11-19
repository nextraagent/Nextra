"use client";

import { useEffect, useState } from "react";

// Company icons via Google's public favicon service (the company's own site icon).
// Falls back to a two-letter badge if an icon can't load.
const DOMAINS = {
  ETH: "ethereum.org",
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
  QQQ: "invesco.com",
  PLTR: "palantir.com",
  AMD: "amd.com",
  NFLX: "netflix.com",
  AVGO: "broadcom.com",
  MU: "micron.com",
  INTC: "intel.com",
  CRCL: "circle.com",
  RIVN: "rivian.com",
  USAR: "usare.com",
  SPCX: "spacex.com",
};

export default function TokenLogo({ symbol, size = 40 }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [symbol]);
  const domain = DOMAINS[symbol];
  if (symbol === "NEXTRA")
    return (
      <span className="tk-logo" style={{ width: size, height: size, flex: `0 0 ${size}px`, display: "inline-grid", placeItems: "center", background: "#161613", borderRadius: "50%" }}>
        <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 64 64" aria-label="$NEXTRA logo">
          <rect x="7" y="7" width="31" height="31" rx="9" fill="none" stroke="#f4efe4" strokeWidth="7" />
          <rect x="26" y="26" width="31" height="31" rx="9" fill="none" stroke="#8ad11a" strokeWidth="7" />
        </svg>
      </span>
    );
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

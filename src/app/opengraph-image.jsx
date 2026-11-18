import { ImageResponse } from "next/og";

// Link preview card for X, Telegram, Discord etc. (1200×630)
export const alt = "Nextra: trading agents and daily stock drops on Robinhood Chain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#161613";
const CREAM = "#F4EFE4";
const GREEN = "#5DA000";
const LIME = "#8ad11a";

function Mark({ s = 64 }) {
  const box = s * 0.52;
  const bw = s * 0.11;
  return (
    <div style={{ display: "flex", position: "relative", width: s, height: s }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: box, height: box, border: `${bw}px solid ${INK}`, borderRadius: s * 0.15 }} />
      <div style={{ position: "absolute", left: s - box, top: s - box, width: box, height: box, border: `${bw}px solid ${GREEN}`, borderRadius: s * 0.15 }} />
    </div>
  );
}

function Chip({ children, dark, green }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 20px",
        borderRadius: 999,
        fontSize: 24,
        fontWeight: 700,
        background: green ? GREEN : dark ? INK : "transparent",
        color: green || dark ? "#fff" : INK,
        border: green || dark ? "none" : `3px solid ${INK}`,
      }}
    >
      {children}
    </div>
  );
}

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: CREAM,
          backgroundImage: "radial-gradient(circle at 82% 30%, rgba(93,160,0,.28), rgba(93,160,0,0) 45%)",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          color: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Mark s={64} />
            <div style={{ display: "flex", fontSize: 50, fontWeight: 800, letterSpacing: -2 }}>
              ne<span style={{ color: "#3d6a00" }}>x</span>tra
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
              <span>Agents that trade</span>
              <span style={{ display: "flex" }}>
                <span style={{ background: "rgba(93,160,0,.45)", padding: "0 8px", borderRadius: 6 }}>your rules.</span>
              </span>
            </div>
            <div style={{ display: "flex", fontSize: 30, color: "#4a473f", lineHeight: 1.3 }}>
              A Vault that drops tokenized stocks to $NEXTRA holders every trading day.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Chip dark>Robinhood Chain</Chip>
            <Chip green>$NEXTRA</Chip>
            <Chip>nextra-agent.xyz</Chip>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, marginLeft: "auto", width: 330 }}>
          {[
            ["SENTRY", "Take-profit & stop-loss", "LIVE"],
            ["TEMPO", "DCA & TWAP on schedule", "LIVE"],
            ["VAULT", "Daily stock drops", "1M+ HOLDERS"],
          ].map(([k, t, s]) => (
            <div
              key={k}
              style={{ display: "flex", flexDirection: "column", gap: 8, background: INK, color: CREAM, borderRadius: 24, padding: "22px 24px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, letterSpacing: 2 }}>
                <span style={{ color: LIME }}>{k}</span>
                <span style={{ color: "#9a9585" }}>{s}</span>
              </div>
              <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

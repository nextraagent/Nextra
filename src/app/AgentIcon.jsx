// Custom duotone icons for the four Nextra agents.
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

const ICONS = {
  // shield guarding an exit: take-profit up, stop-loss down
  sentry: (
    <>
      <path d="M12 2.8l7.2 2.9v5.5c0 4.5-3.1 8.4-7.2 9.6-4.1-1.2-7.2-5.1-7.2-9.6V5.7z" fill="var(--ai-fill)" stroke="none" />
      <path d="M12 2.8l7.2 2.9v5.5c0 4.5-3.1 8.4-7.2 9.6-4.1-1.2-7.2-5.1-7.2-9.6V5.7z" {...P} />
      <path d="M9 10.2l3-3 3 3" {...P} stroke="var(--ai-accent)" />
      <path d="M9 13.4l3 3 3-3" {...P} />
    </>
  ),
  // metronome: steady rhythm, scheduled orders
  tempo: (
    <>
      <path d="M7.4 20.5L10.2 3.5h3.6l2.8 17z" fill="var(--ai-fill)" stroke="none" />
      <path d="M7.4 20.5L10.2 3.5h3.6l2.8 17z" {...P} />
      <path d="M5.5 20.5h13" {...P} />
      <path d="M12 17l2.6-8.6" {...P} stroke="var(--ai-accent)" />
      <circle cx="14.1" cy="10.2" r="1.6" fill="var(--ai-accent)" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
    </>
  ),
  // bird perched on a price line, waiting
  perch: (
    <>
      <path d="M8.3 15.6c0-3.6 2.7-6.4 6.2-6.6l3.9-.2v4.3c0 1.4-1.1 2.5-2.5 2.5z" fill="var(--ai-fill)" stroke="none" />
      <path d="M14.5 9c-3.5.2-6.2 3-6.2 6.6h7.6c1.4 0 2.5-1.1 2.5-2.5V8.6" {...P} />
      <circle cx="16.4" cy="7.4" r="2.3" {...P} />
      <path d="M18.6 6.6l2.4.7-2.3.9" {...P} />
      <path d="M8.3 15.6L4.8 17" {...P} />
      <path d="M11.8 15.6v3.4M14.6 15.6v3.4" {...P} />
      <path d="M3 19.4h18" {...P} stroke="var(--ai-accent)" strokeDasharray="0.1 3.2" strokeWidth="2.2" />
    </>
  ),
  // signal echoing outward: copy the wallets you follow
  echo: (
    <>
      <circle cx="6.5" cy="12" r="3.2" fill="var(--ai-fill)" />
      <circle cx="6.5" cy="12" r="2" fill="var(--ai-accent)" />
      <path d="M11.2 8.4a5.2 5.2 0 0 1 0 7.2" {...P} />
      <path d="M14.4 5.6a9 9 0 0 1 0 12.8" {...P} opacity=".7" />
      <path d="M17.6 2.9a12.8 12.8 0 0 1 0 18.2" {...P} opacity=".4" />
    </>
  ),
};

export default function AgentIcon({ id, size = 22, accent = "#5DA000", fill = "rgba(93,160,0,.16)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ "--ai-accent": accent, "--ai-fill": fill }}>
      {ICONS[id] || null}
    </svg>
  );
}

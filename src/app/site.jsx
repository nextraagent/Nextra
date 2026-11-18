export const X_URL = "https://x.com/NextraAgent";

export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="7" y="7" width="31" height="31" rx="9" fill="none" stroke="#161613" strokeWidth="7" />
      <rect x="26" y="26" width="31" height="31" rx="9" fill="none" stroke="#5DA000" strokeWidth="7" />
    </svg>
  );
}

export function SiteHeader({ active }) {
  const links = [
    { href: "/#agents", label: "Agents", key: "agents" },
    { href: "/vault", label: "Vault", key: "vault" },
    { href: "/#roadmap", label: "Roadmap", key: "roadmap" },
    { href: "/#faq", label: "FAQ", key: "faq" },
    { href: X_URL, label: "X", key: "x", ext: true },
  ];
  return (
    <header className="site-top">
      <div className="in">
        <a className="brand" href="/" aria-label="Nextra home">
          <Logo />
          <span>
            ne<b>x</b>tra
          </span>
        </a>
        <nav className="links" aria-label="Main">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              className={active === l.key ? "on" : ""}
              aria-current={active === l.key ? "page" : undefined}
              {...(l.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="top-cta">
          <a className="btn primary" href="/agents">
            Open app
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="in">
        <div>
          <a className="brand" href="/">
            <Logo />
            <span>
              ne<b>x</b>tra
            </span>
          </a>
          <p className="sub small">Trading agents and a stock-stacking Vault, built on Robinhood Chain.</p>
        </div>
        <div>
          <h4>Product</h4>
          <a href="/agents">Agents</a>
          <a href="/vault">Vault</a>
          <a href="/#roadmap">Roadmap</a>
        </div>
        <div>
          <h4>Community</h4>
          <a href={X_URL} target="_blank" rel="noopener noreferrer">
            X (Twitter)
          </a>
          <a href="/#faq">FAQ</a>
        </div>
        <p className="legal">Nextra is a utility token powering trading agents and the Vault on Robinhood Chain.</p>
      </div>
    </footer>
  );
}

const PATHS = {
  target: "M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  copy: "M8 8h11v11H8zM5 16V5h11",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  chain: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
};

export function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

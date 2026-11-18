import { EXPLORER } from "../lib/fetchers";


export const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const amtFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
export const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function short(a) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function Mark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="7" y="7" width="31" height="31" rx="9" fill="none" stroke="#F4F5F0" strokeWidth="7" />
      <rect x="26" y="26" width="31" height="31" rx="9" fill="none" stroke="#C6FF3A" strokeWidth="7" />
    </svg>
  );
}

export function Header() {
  const pons = process.env.PONS_URL;
  return (
    <header className="top">
      <a className="brand" href="/" aria-label="Nextra Vault, home">
        <Mark />
        <span>
          ne<b>x</b>tra
        </span>
      </a>
      {pons ? (
        <a className="btn" href={pons} target="_blank" rel="noopener noreferrer">
          Buy on Pons
        </a>
      ) : null}
    </header>
  );
}

export function Setup() {
  return (
    <main className="wrap">
      <Header />
      <h1>Nextra Vault</h1>
      <p className="sub">Vault address not set yet.</p>
      <section className="card">
        <div className="label">How to activate</div>
        <ol className="steps">
          <li>Create a new wallet dedicated to the Vault on Robinhood Chain.</li>
          <li>
            In Vercel, open this project → Settings → Environment Variables and add <code>VAULT_ADDRESS</code> with that
            wallet address. Optional: <code>PONS_URL</code> for the &ldquo;Buy on Pons&rdquo; button.
          </li>
          <li>Redeploy. This page reads the wallet straight from the chain.</li>
        </ol>
        <p className="sub small">
          To preview with any wallet, add <code>?address=0x…</code> to the end of the link.
        </p>
      </section>
      <Footer />
    </main>
  );
}

export function Footer({ updatedAt }) {
  return (
    <footer className="note">
      <p>
        <a className="xlink" href="https://x.com/NextraAgent" target="_blank" rel="noopener noreferrer">Follow @NextraAgent on X ↗</a>
      </p>
      <p>Nextra is a memecoin. The Vault is not a dividend and promises no returns. Not financial advice.</p>
    </footer>
  );
}


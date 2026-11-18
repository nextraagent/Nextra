import { getVault } from "../../lib/vault";
import { isAddress } from "../../lib/fetchers";
import Nav from "../Nav";
import Footer from "../Footer";
import { Summary } from "../sections1";
import { Holdings, Purchases } from "../sections2";
import { DropCountdown, DropCalculator, NextStock, VoteBox, DropPreview } from "./DropClient";
import { cfg } from "../../lib/chain";
import "./vault-new.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Nextra Vault — Daily stock drops for $NEXTRA holders",
  description:
    "Every trading day at 14:00 UTC, 10% of $NEXTRA creator fees buys a tokenized stock and sends it straight to holders with 1M+ $NEXTRA. No claiming. Holders vote on the next stock.",
};

const STEPS = [
  { t: "Fees come in", d: "Every $NEXTRA trade on Pons pays creator fees into the creator wallet." },
  { t: "10% buys a stock", d: "Every trading day (Mon–Fri) at 14:00 UTC, 10% of those fees buys the stock holders voted for." },
  { t: "Dropped to holders", d: "The Vault sends it straight to every wallet holding 1,000,000+ $NEXTRA. No claim button — it just arrives." },
  { t: "Hold more, get more", d: "Your cut matches your share of $NEXTRA. Twice the bag, twice the drop." },
];

export default async function VaultPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const address = isAddress(sp.address) ? sp.address : process.env.VAULT_ADDRESS;
  const v = isAddress(address) ? await getVault(address) : null;
  const { candidates } = cfg();

  return (
    <>
      <Nav active="vault" />
      <main className="wrap">
        <section className="vd-head">
          <span className="eyebrow">Nextra Vault</span>
          <h1>
            A stock drop, <em>every trading day</em>.
          </h1>
          <p className="lead">
            10% of $NEXTRA creator fees buys a tokenized stock every trading day and sends it straight to holders. No claiming. You
            vote on what comes next.
          </p>
          {v?.errors?.length ? (
            <p className="warn" role="status">
              Some data could not be loaded ({v.errors.join(", ")}). Please refresh in a moment.
            </p>
          ) : null}
        </section>

        <section className="vd-hero">
          <div className="vd-next">
            <span className="vd-label">Next drop · Mon–Fri 14:00 UTC</span>
            <DropCountdown />
            <div className="vd-next-meta">
              <div>
                <span>Stock</span>
                <NextStock />
              </div>
              <div>
                <span>Budget</span>
                <strong>10% of creator fees</strong>
              </div>
              <div>
                <span>Who gets it</span>
                <strong>1M+ $NEXTRA, auto</strong>
              </div>
            </div>
            <DropPreview />
          </div>
        </section>

        <section className="sec">
          <span className="eyebrow">How it works</span>
          <h2>Fees in. Stocks out.</h2>
          <ol className="vd-steps">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <span className="vd-step-n">{i + 1}</span>
                <h3>{s.t}</h3>
                <p className="sub">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="sec" id="calculator">
          <span className="eyebrow">Drop calculator</span>
          <h2>What would you get?</h2>
          <p className="lead">Plug in the numbers to see the Vault's daily buy and your cut.</p>
          <DropCalculator />
        </section>

        <section className="sec" id="vote">
          <span className="eyebrow">Vote</span>
          <h2>Pick the next stock.</h2>
          <p className="lead">Holders vote on which stock the Vault drops next. Most votes wins the round — the result is locked one trading day ahead.</p>
          <VoteBox candidates={candidates} />
        </section>

        {v ? (
          <section className="sec">
            <span className="eyebrow">On-chain</span>
            <h2>Inside the Vault</h2>
            <div className="vault-cols">
              <div>
                <Summary v={v} />
              </div>
              <div>
                <Holdings v={v} />
                <Purchases v={v} />
              </div>
            </div>
          </section>
        ) : (
          <section className="card vd-addr">
            <div className="label">Vault address</div>
            <p className="sub">Published here on launch day, so anyone can check every buy and every drop on-chain.</p>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

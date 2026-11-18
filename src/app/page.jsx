import { Icon } from "./site";
import Nav from "./Nav";
import AgentIcon from "./AgentIcon";
import Footer from "./Footer";
import Logo3D from "./Logo3D";
import TokenCard from "./TokenCard";
import AgentStats from "./AgentStats";
import "./home-new.css";

const AGENTS = [
  {
    n: "01",
    icon: "target",
    name: "Sentry",
    role: "TP/SL Agent",
    text: "Buy a token and set take-profit and stop-loss. Sentry watches the price and exits for you.",
    opts: ["Take-profit in % or price", "Stop-loss in % or price", "Optional trailing stop"],
  },
  {
    n: "02",
    icon: "clock",
    name: "Tempo",
    role: "Interval Agent",
    text: "Buy in slowly (DCA) or sell a position in steps (TWAP) on a fixed schedule.",
    opts: ["Every 1–60 minutes", "$NEXTRA or stock tokens", "Amount per order and total budget"],
  },
  {
    n: "03",
    icon: "flag",
    name: "Perch",
    role: "Limit Order Agent",
    text: "Set the price you want. Perch waits and fills the order when the market gets there.",
    opts: ["Buy below or sell above a target", "Expiry time", "Max slippage"],
  },
  {
    n: "04",
    icon: "copy",
    name: "Echo",
    role: "Copy Agent",
    text: "Pick wallets to follow. When they trade, Echo mirrors it at the size you choose.",
    opts: ["Follow several wallets", "Fixed size or % of their trade", "Daily spend cap per wallet"],
  },
];

const ROADMAP = [
  { status: "Live", title: "Vault dashboard", text: "Public page that reads the Vault straight from Robinhood Chain." },
  { status: "Live", title: "Sentry", text: "TP/SL agent for $NEXTRA (Pons curve) and stock tokens (Uniswap). Exits for you, from your own wallet." },
  { status: "Live", title: "Perch", text: "Limit buys below and sells above the market, for $NEXTRA and stock tokens." },
  { status: "Live", title: "Tempo", text: "Scheduled DCA buys and TWAP sells for $NEXTRA and stock tokens." },
  { status: "Building", title: "Echo", text: "Mirror trades from wallets you choose." },
];

const FAQ = [
  {
    q: "What is Nextra?",
    a: "A memecoin on Robinhood Chain with two utilities: trading agents that work inside limits you set, and a Vault that drops tokenized stocks to holders every trading day.",
  },
  {
    q: "Do agents hold my funds?",
    a: "No. Agents trade from your own wallet, created with Privy when you log in. You set the limits — tokens, amounts, daily cap — and you can pause or withdraw any time.",
  },
  {
    q: "How does the daily stock drop work?",
    a: "Every trading day (Mon–Fri) at 14:00 UTC, 10% of the creator fees from $NEXTRA trading on Pons buys the stock holders voted for. The Vault then sends it straight to every wallet holding 1,000,000+ $NEXTRA. There is nothing to claim.",
  },
  {
    q: "How much will I get?",
    a: "You need at least 1,000,000 $NEXTRA. Your cut then matches your share among eligible holders. The total depends on trading fees, so it changes daily and can be zero on quiet days. Nothing is guaranteed.",
  },
  {
    q: "Who picks the stock?",
    a: "Holders do. Every wallet with 1,000,000+ $NEXTRA gets one vote on the Vault page; the stock with the most votes wins the round.",
  },
];

function VaultBand() {
  return (
    <section className="sec" id="vault">
      <span className="eyebrow">Vault</span>
      <h2>The meme that drops stocks.</h2>
      <div className="vault-band">
        <div>
          <h3>Nextra Vault</h3>
          <p className="sub">
            Every trading day, 10% of $NEXTRA creator fees buys a tokenized stock and sends it straight to holders with 1M+ $NEXTRA.
            Hold more, get more. No claiming.
          </p>
          <div className="ctas">
            <a className="btn lime" href="/vault">
              Open the Vault
            </a>
          </div>
        </div>
        <ol className="steps3">
          <li>Trades on Pons generate creator fees.</li>
          <li>Mon–Fri at 14:00 UTC, 10% buys the stock holders voted for.</li>
          <li>The Vault drops it to every 1M+ holder, by share. No claim.</li>
        </ol>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="sec narrow" id="faq">
      <span className="eyebrow">FAQ</span>
      <h2>Questions</h2>
      <div className="faq">
        {FAQ.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="nx-hero">
      <div className="nx-hero-text">
        <h1>
          Agents that trade <em>your rules</em>. A Vault that stacks stocks.
        </h1>
        <p className="lead">
          Set the limits once — take-profit, stop-loss, limit price, schedule or wallets to copy. Nextra agents handle the rest,
          from your own wallet.
        </p>
        <div className="nx-trust">
          <span>
            <Icon name="shield" size={18} /> Your wallet, your limits
          </span>
          <span>
            <Icon name="bolt" size={18} /> Runs 24/7
          </span>
          <span>
            <Icon name="chain" size={18} /> Vault on-chain
          </span>
        </div>
      </div>
      <div className="nx-hero-art">
        <Logo3D />
        <TokenCard />
      </div>
    </section>
  );
}

function Agents() {
  return (
    <section className="sec" id="agents">
      <span className="eyebrow">Agents</span>
      <h2>Four agents, one wallet.</h2>
      <p className="lead">Each agent does one job well. Mix them however you trade.</p>
      <div className="nx-agents">
        {AGENTS.map((a) => (
          <a className="nx-agent" href="/agents" key={a.n}>
            <div className="nx-agent-top">
              <span className="nx-agent-ico">
                <AgentIcon id={a.name.toLowerCase()} size={26} accent="#8ad11a" fill="rgba(138,209,26,.2)" />
              </span>
              <span className="nx-agent-n">{a.n}</span>
            </div>
            <h3>{a.name}</h3>
            <span className="nx-agent-role">{a.role}</span>
            <p className="sub">{a.text}</p>
            <ul className="opts">
              {a.opts.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <span className="nx-agent-go">Set up {a.name} →</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function Roadmap() {
  return (
    <section className="sec" id="roadmap">
      <span className="eyebrow">Roadmap</span>
      <h2>Shipping in the open.</h2>
      <ol className="nx-road">
        {ROADMAP.map((r) => (
          <li key={r.title} className={`nx-road-item s-${r.status.toLowerCase()}`}>
            <span className="nx-road-dot" aria-hidden="true" />
            <div>
              <span className={`chip${r.status === "Live" ? " live" : ""}`}>{r.status}</span>
              <h3>{r.title}</h3>
              <p className="sub">{r.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Nav />
      <main className="wrap">
        <Hero />
        <AgentStats />
        <Agents />
        <VaultBand />
        <Roadmap />
        <Faq />
      </main>
      <Footer />
    </>
  );
}

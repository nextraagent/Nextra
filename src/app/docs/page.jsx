import Nav from "../Nav";
import Footer from "../Footer";
import AgentIcon from "../AgentIcon";
import "./docs.css";

export const metadata = {
  title: "Nextra Docs — Agents, Vault and daily stock drops",
  description:
    "How Nextra works: the four trading agents (Sentry, Tempo, Perch, Echo), the Vault, daily tokenized stock drops for $NEXTRA holders, voting and eligibility.",
};

const TOC = [
  ["overview", "Overview"],
  ["token", "$NEXTRA"],
  ["account", "Account & wallet"],
  ["agents", "Agents"],
  ["sentry", "Sentry", 1],
  ["tempo", "Tempo", 1],
  ["perch", "Perch", 1],
  ["echo", "Echo", 1],
  ["vault", "Vault & daily drops"],
  ["eligibility", "Who gets a drop"],
  ["voting", "Voting"],
  ["schedule", "Schedule"],
  ["transparency", "Transparency"],
  ["safety", "Safety & risks"],
  ["glossary", "Glossary"],
];

function Callout({ tone = "info", title, children }) {
  return (
    <div className={`dc-callout ${tone}`}>
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

function AgentDoc({ id, name, role, what, settings, example }) {
  return (
    <section id={id} className="dc-agent">
      <div className="dc-agent-head">
        <span className="dc-agent-ico">
          <AgentIcon id={id} size={26} accent="#8ad11a" fill="rgba(138,209,26,.2)" />
        </span>
        <h3>{name}</h3>
        <span className="dc-tag">{role}</span>
      </div>
      <p>{what}</p>
      <table className="dc-table">
        <thead>
          <tr>
            <th>Setting</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          {settings.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dc-example">
        <span>Example</span>
        {example}
      </p>
    </section>
  );
}

export default function DocsPage() {
  return (
    <>
      <Nav active="docs" />
      <div className="dc-wrap">
        <aside className="dc-side" aria-label="On this page">
          <span className="dc-side-title">Documentation</span>
          <nav>
            {TOC.map(([id, label, sub]) => (
              <a key={id} href={`#${id}`} className={sub ? "sub" : ""}>
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="dc-main">
          <div className="dc-chips" aria-label="Jump to">
            {TOC.filter((t) => !t[2]).map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </div>

          <header className="dc-hero" id="overview">
            <span className="eyebrow">Docs</span>
            <h1>How Nextra works</h1>
            <p className="dc-lead">
              Nextra is a memecoin on Robinhood Chain with two utilities: <b>trading agents</b> that follow rules you set, and a{" "}
              <b>Vault</b> that turns trading fees into tokenized stocks and drops them to holders every trading day.
            </p>
            <div className="dc-cards">
              <a href="#agents" className="dc-card">
                <span className="dc-card-k">01</span>
                <strong>Agents</strong>
                <span>Sentry, Tempo, Perch and Echo trade inside your limits, from your own wallet.</span>
              </a>
              <a href="#vault" className="dc-card">
                <span className="dc-card-k">02</span>
                <strong>Vault</strong>
                <span>10% of creator fees buys a tokenized stock and drops it to 1M+ holders, Mon–Fri.</span>
              </a>
              <a href="#voting" className="dc-card">
                <span className="dc-card-k">03</span>
                <strong>Voting</strong>
                <span>Holders pick the next stock. 1 wallet = 1 vote, most votes wins.</span>
              </a>
            </div>
            <Callout tone="note" title="Status">
              Sentry and Tempo are live and trade from your own wallet. Perch and Echo can be set up today and start later; voting and drops switch on at launch.
            </Callout>
          </header>

          <section id="token">
            <h2>$NEXTRA</h2>
            <p>
              $NEXTRA launches on <a href="https://x.com/ponsdotfamily" target="_blank" rel="noopener noreferrer">Pons</a>, a
              launchpad on Robinhood Chain. Every trade pays a creator fee; a share of those fees powers the Vault.
            </p>
            <ul>
              <li>
                <b>Chain:</b> Robinhood Chain (chain ID 4663)
              </li>
              <li>
                <b>Contract address:</b> published on this page and on X at launch. Only trust the address from official channels.
              </li>
              <li>
                <b>Utility:</b> access to daily stock drops (1,000,000+ $NEXTRA) and a vote on the next stock.
              </li>
            </ul>
          </section>

          <section id="account">
            <h2>Account & wallet</h2>
            <p>
              Open the app and tap <b>Log in</b>. You can sign in with email, Google, X or an existing wallet. If you don't have a
              wallet, one is created for you on Robinhood Chain automatically.
            </p>
            <ol className="dc-steps">
              <li>Go to <a href="/agents">nextra-agent.xyz/agents</a> and tap <b>Log in</b>.</li>
              <li>Choose a sign-in method and confirm.</li>
              <li>Your wallet address and ETH balance appear at the top. Tap the address to copy it.</li>
              <li>Fund the wallet with ETH on Robinhood Chain to use the agents.</li>
            </ol>
            <Callout title="Your keys stay yours">
              Agents trade from your own wallet. Nextra never holds your funds, and you can pause or delete any agent at any time.
            </Callout>
          </section>

          <section id="agents">
            <h2>Agents</h2>
            <p>
              Each agent does one job. Pick one, set your limits, and it runs 24/7 inside those limits. Every agent shows a plain
              summary of exactly what it will do before you save it.
            </p>
            <AgentDoc
              id="sentry"
              name="Sentry"
              role="TP/SL Agent"
              what="Buys a token and exits for you at your take-profit or stop-loss."
              settings={[
                ["Token", "$NEXTRA (bought and sold on its Pons bonding curve) or a Robinhood stock token like NVDA, TSLA or AAPL (swapped on Uniswap)."],
                ["Buy amount", "How much ETH to spend."],
                ["Take-profit", "Sell everything when the price is up this %."],
                ["Stop-loss", "Sell everything when the price is down this %."],
                ["Trailing stop", "Optional: moves the stop-loss up as the price rises."],
              ]}
              example="Buy 0.1 ETH of NVDA. Sell at +20% or −10%."
            />
            <Callout title="How Sentry runs">
              The first time you start Sentry you approve one permission, so it can trade from your wallet while you're away. It buys
              within about a minute, checks the price every minute, and sells everything back to ETH when your take-profit or
              stop-loss is hit. You can pause it or press <b>Sell now</b> any time.
            </Callout>
            <AgentDoc
              id="tempo"
              name="Tempo"
              role="Interval Agent"
              what="Buys slowly (DCA) or sells a position in steps (TWAP) on a fixed schedule."
              settings={[
                ["Mode", "DCA to buy in, TWAP to sell out."],
                ["Token", "$NEXTRA (on its Pons curve) or a stock token (on Uniswap)."],
                ["Amount per order", "ETH per buy, or the ETH value of tokens per sell."],
                ["Every", "1–60 minutes."],
                ["Total budget", "The agent stops once this is reached."],
              ]}
              example="Buy 0.01 ETH of $NEXTRA every 5 minutes until 0.1 ETH is spent."
            />
            <AgentDoc
              id="perch"
              name="Perch"
              role="Limit Order Agent"
              what="Waits for your price and fills the order when the market gets there."
              settings={[
                ["Side", "Buy below or sell above the market."],
                ["Distance", "How far from today's price, in %."],
                ["Budget", "ETH to use."],
                ["Expiry", "1 hour, 24 hours or 7 days."],
                ["Max slippage", "The worst price you accept, in %."],
              ]}
              example="Buy NVDA with 0.25 ETH when it's 5% below today's price. Cancel after 24h."
            />
            <AgentDoc
              id="echo"
              name="Echo"
              role="Copy Agent"
              what="Mirrors trades from wallets you choose, at the size you choose."
              settings={[
                ["Wallets", "One or more 0x addresses to follow."],
                ["Trade size", "A fixed ETH amount or a % of their trade."],
                ["Daily cap", "Maximum ETH spent per followed wallet per day."],
              ]}
              example="Copy 2 wallets at 0.02 ETH per trade, max 0.1 ETH per wallet per day."
            />
          </section>

          <section id="vault">
            <h2>Vault & daily drops</h2>
            <p>The Vault turns $NEXTRA trading activity into tokenized stocks for holders.</p>
            <div className="dc-flow">
              <div>
                <span>1</span>
                <strong>Fees come in</strong>
                <p>Every $NEXTRA trade on Pons pays a creator fee.</p>
              </div>
              <div>
                <span>2</span>
                <strong>10% buys a stock</strong>
                <p>10% of creator fees buys the stock holders voted for.</p>
              </div>
              <div>
                <span>3</span>
                <strong>Dropped to holders</strong>
                <p>The Vault sends it to every eligible wallet. No claim needed.</p>
              </div>
            </div>
            <p>
              Your share is proportional to your balance among eligible holders: <code>your drop = Vault buy × (your $NEXTRA ÷ eligible
              supply)</code>. Try the numbers in the <a href="/vault#calculator">drop calculator</a>.
            </p>
          </section>

          <section id="eligibility">
            <h2>Who gets a drop</h2>
            <ul>
              <li>Wallets holding <b>1,000,000 $NEXTRA or more</b> at drop time.</li>
              <li>Excluded: the dev wallet, the Vault itself, and contracts such as liquidity pools.</li>
              <li>Balances are read from the chain at the moment of the drop. No sign-up or claim.</li>
            </ul>
          </section>

          <section id="voting">
            <h2>Voting</h2>
            <p>Holders decide which stock the Vault drops next.</p>
            <ul>
              <li>
                <b>1 wallet = 1 vote.</b> You need 1,000,000+ $NEXTRA to vote.
              </li>
              <li>Voting is a free wallet signature. No transaction, no gas.</li>
              <li>You can change your vote until the round closes. The stock with the most votes wins.</li>
              <li>
                Each round closes one trading day before its drop, so the Vault knows what to buy in time. Vote on the{" "}
                <a href="/vault#vote">Vault page</a>.
              </li>
            </ul>
          </section>

          <section id="schedule">
            <h2>Schedule</h2>
            <table className="dc-table">
              <tbody>
                <tr>
                  <td>Drop days</td>
                  <td>Monday to Friday (trading days)</td>
                </tr>
                <tr>
                  <td>Drop time</td>
                  <td>14:00 UTC (21:00 WIB)</td>
                </tr>
                <tr>
                  <td>Vote closes</td>
                  <td>At the previous trading day's drop</td>
                </tr>
                <tr>
                  <td>No stock bought</td>
                  <td>That day's drop is skipped</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section id="transparency">
            <h2>Transparency</h2>
            <p>
              The Vault address is published on the <a href="/vault">Vault page</a> at launch. Every buy and every drop is an on-chain
              transaction you can check on the{" "}
              <a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noopener noreferrer">
                Robinhood Chain explorer
              </a>
              . Each day's drop is also logged with its recipients and transaction hashes.
            </p>
          </section>

          <section id="safety">
            <h2>Safety & risks</h2>
            <Callout tone="warn" title="Please read">
              $NEXTRA is a memecoin and can lose value. Drops depend on trading fees, so they change every day and can be zero.
              Nothing here is a promise of returns or financial advice. Only use money you can afford to lose.
            </Callout>
            <ul>
              <li>Only trust links and contract addresses from nextra-agent.xyz and @NextraAgent.</li>
              <li>Nextra will never DM you first or ask for your seed phrase or private key.</li>
              <li>Agents only act within the limits you set. Review the summary before saving.</li>
            </ul>
          </section>

          <section id="glossary">
            <h2>Glossary</h2>
            <dl className="dc-gloss">
              <dt>TP / SL</dt>
              <dd>Take-profit and stop-loss: automatic exit prices.</dd>
              <dt>DCA</dt>
              <dd>Dollar-cost averaging: buying in small amounts over time.</dd>
              <dt>TWAP</dt>
              <dd>Time-weighted average price: selling in small steps over time.</dd>
              <dt>Slippage</dt>
              <dd>The difference between the expected and the filled price.</dd>
              <dt>Tokenized stock</dt>
              <dd>A token on Robinhood Chain that tracks a real stock, such as NVDA or TSLA.</dd>
              <dt>Creator fee</dt>
              <dd>The share of each $NEXTRA trade on Pons that goes to the creator wallet.</dd>
            </dl>
          </section>
        </main>
      </div>
      <Footer />
    </>
  );
}

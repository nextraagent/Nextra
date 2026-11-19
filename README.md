# Nextra

**Agents that trade your rules. A Vault that drops stocks.**

Nextra ($NEXTRA) is a utility token on [Robinhood Chain](https://robinhoodchain.blockscout.com) with two utilities:

- **Trading agents** that follow rules you set and trade from your own wallet.
- **The Vault**, which turns $NEXTRA creator fees into tokenized stocks and drops them to holders every trading day.

Website: [nextra-agent.xyz](https://www.nextra-agent.xyz) · Docs: [nextra-agent.xyz/docs](https://www.nextra-agent.xyz/docs) · X: [@NextraAgent](https://x.com/NextraAgent) · Launchpad: [Pons](https://x.com/ponsdotfamily)

---

## Features

### Agents

| Agent  | Job                                                        | Status      |
| ------ | ---------------------------------------------------------- | ----------- |
| Sentry | Buy a stock token, exit at your take-profit or stop-loss   | **Live**    |
| Tempo  | DCA buys or TWAP sells on a fixed schedule                 | **Live**    |
| Perch  | Limit orders that wait for your price                      | **Live**    |
| Echo   | Copy trades from wallets you follow                        | Coming soon |

**How Sentry works**

1. The user logs in with [Privy](https://privy.io) (email, Google, X or a wallet). Users without a wallet get an embedded wallet on Robinhood Chain.
2. On first use, the user approves a one-time **signer** permission, so Nextra's server can sign trades for that wallet.
3. A scheduler calls `/api/sentry/tick` every minute. Each tick:
   - buys the chosen stock token with ETH on **Uniswap v3** (best route across fee tiers),
   - approves the router for the exact amount bought,
   - quotes the position's value every minute,
   - sells everything back to ETH when take-profit, stop-loss (optionally trailing) or a manual "Sell now" is hit.
4. Funds never leave the user's wallet. Users can pause, sell or cancel at any time.

### Portfolio

The portfolio page shows ETH and stock-token balances valued at Uniswap prices. It also lets users send ETH or tokens and export their wallet's private key through Privy's secure window.

### Vault & daily stock drops

- Every trading day (Mon–Fri) at **14:00 UTC**, 10% of $NEXTRA creator fees buys the stock holders voted for.
- The Vault sends it straight to every wallet holding **1,000,000+ $NEXTRA**, pro rata. Nobody has to claim.
- Excluded wallets: dev wallet, the Vault itself, and contracts such as liquidity pools.

### Voting

- 1 wallet = 1 vote, for wallets holding at least 1,000,000 $NEXTRA.
- A vote is a free signature (no gas). Each round closes one trading day before its drop.

---

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- [Privy](https://privy.io) for login, embedded wallets and server-side signers
- [viem](https://viem.sh) for chain reads, Uniswap quotes and transaction building
- [Upstash Redis](https://upstash.com) (REST, free tier) for agent jobs, votes and public stats
- Robinhood Chain (chain ID `4663`), Uniswap v3 (SwapRouter02 + QuoterV2)

## Project structure

```
src/
  app/
    page.jsx              Home
    agents/               Agent console (Sentry live, others in preview)
    portfolio/            Wallet balances, send, export key
    vault/                Vault dashboard, drop calculator, voting
    docs/                 Documentation page
    api/
      agents/             Create / list / pause / close Sentry jobs (Privy auth)
      sentry/tick/        Runs every minute: buys, watches and sells
      portfolio/          Wallet balances valued in ETH
      vote/               Holder voting
      drop/               Daily Vault drop (cron, off until launch)
  lib/
    privyServer.js        Privy token verification and request signing (no SDK)
    swap.js               Uniswap v3 routes, quotes and swap calldata
    sentry.js             Sentry engine and job storage
    stocks.js             Stock token addresses on Robinhood Chain
    chain.js, votes.js, rounds.js, vault.js, fetchers.js
```

## Getting started

```bash
git clone https://github.com/nextraagent/Nextra.git
cd Nextra
npm install
cp .env.example .env.local   # fill in your own values
npm run dev
```

Open http://localhost:3000.

## Environment variables

See [`.env.example`](.env.example) for the full list. Secrets are **never** committed. Set them in your hosting provider (for example Vercel → Settings → Environment Variables, type *Sensitive*).

| Variable | Secret | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | no | Privy app ID |
| `NEXT_PUBLIC_PRIVY_SIGNER_ID` | no | Privy authorization key ID used as Sentry's signer |
| `PRIVY_APP_SECRET` | **yes** | Privy app secret |
| `PRIVY_AUTHORIZATION_KEY` | **yes** | Privy authorization private key (`wallet-auth:…`) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | **yes** | Upstash Redis REST URL and token (added for you when you connect Upstash on Vercel) |
| `CRON_SECRET` | **yes** | Protects the daily drop cron |
| `VAULT_PRIVATE_KEY` | **yes** | Vault wallet key for daily drops (after launch) |
| `SENTRY_TICK_KEY` | optional | If set, `/api/sentry/tick` requires `?key=` |
| `NEXTRA_TOKEN`, `VAULT_ADDRESS`, `EXCLUDE_WALLETS`, `STOCK_TOKENS`, `DEFAULT_STOCK`, `DROPS_ENABLED` | no | Vault and drop settings |
| `USDG_ADDRESS`, `SENTRY_SLIPPAGE_BPS`, `RPC_URL`, `PRIVY_VERIFICATION_KEY` | no | Optional overrides |

## Scheduling

- **Sentry:** call `GET https://www.nextra-agent.xyz/api/sentry/tick` every minute (for example with [cron-job.org](https://cron-job.org)). Use the `www` host, because the bare domain redirects.
- **Daily drop:** `vercel.json` runs `/api/drop` at `0 14 * * 1-5`. It does nothing until `DROPS_ENABLED=true`.

## Security

- Never commit `.env*` files or private keys. `.gitignore` blocks them.
- `PRIVY_AUTHORIZATION_KEY` can sign for every wallet that granted Sentry permission. Keep it in your host's secret store only, and rotate it at once if it leaks.
- Nextra will never DM you first or ask for your seed phrase or private key.
- Found a vulnerability? Please report it privately to [@NextraAgent](https://x.com/NextraAgent) on X instead of opening a public issue.

## Disclaimer

Agents trade real funds from the user's own wallet, inside the limits the user sets. This code is provided as is, without warranty.

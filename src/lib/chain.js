import { createPublicClient, defineChain, http, getAddress, isAddress, parseAbi } from "viem";
import { STOCKS } from "./stocks";

// Stocks holders can vote on for the daily drop. Every one has a real Robinhood token and a Uniswap route.
const VOTE_STOCKS = ["NVDA", "TSLA", "AAPL", "AMZN", "META", "GOOGL", "MSFT", "PLTR"];

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

export const EXPLORER = "https://robinhoodchain.blockscout.com";
export const MIN_HOLD = 1_000_000n; // whole $NEXTRA tokens needed to vote and receive drops

export const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export const publicClient = createPublicClient({ chain: robinhood, transport: http() });

export function cfg() {
  const addr = (v) => (v && isAddress(v.trim()) ? getAddress(v.trim()) : null);
  let stocks = Object.fromEntries(Object.entries(STOCKS).map(([k, v]) => [k, addr(v)]));
  try {
    const raw = JSON.parse(process.env.STOCK_TOKENS || "{}");
    for (const [k, v] of Object.entries(raw)) if (addr(v)) stocks[k.toUpperCase()] = addr(v);
  } catch {}
  const exclude = new Set(
    (process.env.EXCLUDE_WALLETS || "")
      .split(/[\s,]+/)
      .map(addr)
      .filter(Boolean)
      .map((a) => a.toLowerCase()),
  );
  const vault = addr(process.env.VAULT_ADDRESS);
  if (vault) exclude.add(vault.toLowerCase());
  return {
    token: addr(process.env.NEXTRA_TOKEN),
    vault,
    stocks,
    candidates: (process.env.VOTE_STOCKS ? process.env.VOTE_STOCKS.split(/[\s,]+/).map((x) => x.toUpperCase()) : VOTE_STOCKS).filter((x) => stocks[x]),
    defaultStock: (process.env.DEFAULT_STOCK || "NVDA").toUpperCase(),
    exclude,
    enabled: process.env.DROPS_ENABLED === "true",
  };
}

let decCache = null;
export async function tokenDecimals(token) {
  if (decCache == null) decCache = Number(await publicClient.readContract({ address: token, abi: erc20, functionName: "decimals" }));
  return decCache;
}

export async function minHoldUnits(token) {
  return MIN_HOLD * 10n ** BigInt(await tokenDecimals(token));
}

// All holders of the token from Blockscout, as { address, balance(bigint), isContract }.
export async function fetchHolders(token) {
  const out = [];
  let params = "";
  for (let page = 0; page < 200; page++) {
    const res = await fetch(`${EXPLORER}/api/v2/tokens/${token}/holders${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`holders ${res.status}`);
    const j = await res.json();
    for (const it of j.items || []) {
      out.push({
        address: getAddress(it.address.hash),
        balance: BigInt(it.value),
        isContract: Boolean(it.address.is_contract),
      });
    }
    if (!j.next_page_params) break;
    params = "?" + new URLSearchParams(j.next_page_params).toString();
  }
  return out;
}

// Holders who qualify for a drop: >= MIN_HOLD, not a contract (pools/LP), not excluded.
export async function eligibleHolders(c = cfg()) {
  const min = await minHoldUnits(c.token);
  const all = await fetchHolders(c.token);
  return all.filter((h) => h.balance >= min && !h.isContract && !c.exclude.has(h.address.toLowerCase()));
}

export function split(amount, holders) {
  const total = holders.reduce((s, h) => s + h.balance, 0n);
  if (total === 0n) return [];
  return holders
    .map((h) => ({ address: h.address, balance: h.balance, amount: (amount * h.balance) / total }))
    .filter((r) => r.amount > 0n);
}

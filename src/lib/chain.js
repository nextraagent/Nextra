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

// All holders of the token, rebuilt from its Transfer events straight from the chain RPC
// (Blockscout's API blocks server requests). Returns [{ address, balance(bigint), isContract }].
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x" + "0".repeat(64);
const SPAN = 9_999_999n; // the RPC allows up to 10M blocks per log query
const NOT_HOLDERS = new Set(["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"]);

export async function fetchHolders(token, minBalance = 0n) {
  const latest = await publicClient.getBlockNumber();
  const logs = [];
  // Walk back from the newest block until the mint (Transfer from 0x0) is found.
  for (let to = latest, i = 0; to > 0n && i < 30; to -= SPAN + 1n, i++) {
    const from = to > SPAN ? to - SPAN : 0n;
    const chunk = await publicClient.request({
      method: "eth_getLogs",
      params: [{ address: token, topics: [TRANSFER], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
    });
    logs.push(...chunk);
    if (chunk.some((l) => l.topics[1] === ZERO_TOPIC)) break;
  }
  const bal = new Map();
  const add = (a, v) => bal.set(a, (bal.get(a) || 0n) + v);
  for (const l of logs) {
    const v = BigInt(l.data);
    add(`0x${l.topics[1].slice(26)}`, -v);
    add(`0x${l.topics[2].slice(26)}`, v);
  }
  const rows = [...bal].filter(([a, v]) => v > 0n && v >= minBalance && !NOT_HOLDERS.has(a));
  return Promise.all(
    rows.map(async ([a, v]) => {
      const code = await publicClient.getCode({ address: a }).catch(() => null);
      return { address: getAddress(a), balance: v, isContract: Boolean(code && code !== "0x") };
    }),
  );
}

// Holders who qualify for a drop: >= MIN_HOLD, not a contract (pools/LP), not excluded.
export async function eligibleHolders(c = cfg()) {
  const min = await minHoldUnits(c.token);
  const all = await fetchHolders(c.token, min);
  return all.filter((h) => h.balance >= min && !h.isContract && !c.exclude.has(h.address.toLowerCase()));
}

export function split(amount, holders) {
  const total = holders.reduce((s, h) => s + h.balance, 0n);
  if (total === 0n) return [];
  return holders
    .map((h) => ({ address: h.address, balance: h.balance, amount: (amount * h.balance) / total }))
    .filter((r) => r.amount > 0n);
}

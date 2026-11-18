// $NEXTRA market data. Pons has no public API, so trades are read from the chain:
// on-chain supply/burns via RPC, and price/candles from GeckoTerminal's on-chain index of the Pons curve.
import { parseAbi } from "viem";
import { publicClient } from "./chain";

export const NEXTRA = (process.env.NEXT_PUBLIC_NEXTRA_TOKEN || "0xe56cc0f5719dbf00e114990e65d2a1697b7b3fc1").toLowerCase();
export const NEXTRA_POOL = (process.env.NEXTRA_POOL || "0x917dada241d15fc8fbe814ed1183f6c705051059").toLowerCase();
const DEAD = "0x000000000000000000000000000000000000dEaD";
const GT = "https://api.geckoterminal.com/api/v2/networks/robinhood";
const erc20 = parseAbi(["function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)"]);

async function gt(path, revalidate) {
  const r = await fetch(`${GT}${path}`, { headers: { accept: "application/json" }, next: { revalidate } });
  if (!r.ok) throw new Error(`GeckoTerminal ${r.status}`);
  return r.json();
}

const n = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export async function nextraStats() {
  const [supply, burned, pool, info] = await Promise.all([
    publicClient.readContract({ address: NEXTRA, abi: erc20, functionName: "totalSupply" }).catch(() => null),
    publicClient.readContract({ address: NEXTRA, abi: erc20, functionName: "balanceOf", args: [DEAD] }).catch(() => 0n),
    gt(`/pools/${NEXTRA_POOL}`, 20).catch(() => null),
    gt(`/tokens/${NEXTRA}/info`, 300).catch(() => null),
  ]);
  const a = pool?.data?.attributes || {};
  const price = n(a.base_token_price_usd);
  const total = supply != null ? Number(supply) / 1e18 : null;
  const burnt = burned != null ? Number(burned) / 1e18 : 0;
  const circ = total != null ? total - burnt : null;
  const holders = n(info?.data?.attributes?.holders?.count);
  return {
    token: NEXTRA,
    pool: NEXTRA_POOL,
    price,
    priceEth: n(a.base_token_price_native_currency),
    change24h: n(a.price_change_percentage?.h24),
    volume24h: n(a.volume_usd?.h24),
    supply: total,
    burned: burnt,
    marketCap: price != null && circ != null ? price * circ : null,
    holders,
    at: new Date().toISOString(),
  };
}

const TF = {
  "5m": { path: "minute", aggregate: 5, limit: 288 },
  "1h": { path: "hour", aggregate: 1, limit: 336 },
  "1d": { path: "day", aggregate: 1, limit: 365 },
};

export async function nextraCandles(tf = "5m") {
  const t = TF[tf] || TF["5m"];
  const d = await gt(`/pools/${NEXTRA_POOL}/ohlcv/${t.path}?aggregate=${t.aggregate}&limit=${t.limit}&currency=usd&token=base`, 30);
  const list = d?.data?.attributes?.ohlcv_list || [];
  return list
    .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
    .sort((x, y) => x.time - y.time);
}

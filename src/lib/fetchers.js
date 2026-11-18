// Reads the Nextra Vault wallet straight from Robinhood Chain.
// Balances & transfers: Blockscout API. Stock list & prices: Robinhood Stock Token API.

export const CHAIN_ID = 4663;
export const BLOCKSCOUT = "https://robinhoodchain.blockscout.com/api/v2";
const RH_API = "https://api.robinhood.com/rhj";
export const EXPLORER = "https://robinhoodchain.blockscout.com";

// Non-stock tokens worth showing (anything else is ignored to hide airdrop spam).
export const KNOWN = {
  "0x0bd7d308f8e1639fab988df18a8011f41eacad73": { symbol: "WETH", name: "Wrapped Ether" },
  "0x5fc5360d0400a0fd4f2af552add042d716f1d168": { symbol: "USDG", name: "Global Dollar", usd: 1 },
};

export function isAddress(a) {
  return typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function getJson(url, revalidate = 60) {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; NextraVault/1.0; +https://nextra-vault.vercel.app)" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export const lower = (s) => (s || "").toLowerCase();
export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function stockAssets() {
  const data = await getJson(`${RH_API}/assets`, 3600);
  const map = {};
  for (const a of data.assets || []) {
    for (const d of a.deployments || []) {
      if (Number(d.chainId) === CHAIN_ID && d.contractAddress) {
        map[lower(d.contractAddress)] = {
          symbol: a.tokenSymbol,
          name: a.tokenName,
          multiplier: num(a.currentMultiplier) || 1,
          logo: a.logoUrl || null,
        };
      }
    }
  }
  return map;
}

export async function stockPrice(symbol) {
  const tries = [symbol];
  if (/^X[A-Z]/.test(symbol)) tries.push(symbol.slice(1));
  for (const s of tries) {
    try {
      const data = await getJson(`${RH_API}/prices/${encodeURIComponent(s)}`, 30);
      const q = (data.quotes || [])[0];
      if (!q) continue;
      const bid = num(q.bid), ask = num(q.ask);
      const mid = bid && ask ? (bid + ask) / 2 : bid || ask;
      if (mid) return mid;
    } catch {}
  }
  return null;
}


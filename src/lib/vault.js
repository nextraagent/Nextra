import { BLOCKSCOUT, KNOWN, lower, num, stockAssets, stockPrice, getJson } from "./fetchers";

export async function getVault(address) {
  const addr = lower(address);
  const [infoR, balR, xferR, assetsR] = await Promise.allSettled([
    getJson(`${BLOCKSCOUT}/addresses/${address}`),
    getJson(`${BLOCKSCOUT}/addresses/${address}/token-balances`),
    getJson(`${BLOCKSCOUT}/addresses/${address}/token-transfers?type=ERC-20`),
    stockAssets(),
  ]);

  const errors = [];
  const info = infoR.status === "fulfilled" ? infoR.value : (errors.push("address"), {});
  const balances = balR.status === "fulfilled" ? balR.value : (errors.push("token balances"), []);
  const transfers = xferR.status === "fulfilled" ? xferR.value : (errors.push("history"), { items: [] });
  const stocks = assetsR.status === "fulfilled" ? assetsR.value : (errors.push("stock list"), {});

  const ethPrice = num(info.exchange_rate);
  const ethAmount = (num(info.coin_balance) || 0) / 1e18;

  const holdings = [];
  const list = Array.isArray(balances) ? balances : balances.items || [];
  for (const b of list) {
    const t = b.token || {};
    const tAddr = lower(t.address_hash || t.address);
    const stock = stocks[tAddr];
    const known = KNOWN[tAddr];
    if (!stock && !known) continue;
    const decimals = num(t.decimals) ?? 18;
    const amount = (num(b.value) || 0) / 10 ** decimals;
    if (amount <= 0) continue;
    holdings.push({
      address: tAddr,
      symbol: stock?.symbol || known.symbol || t.symbol,
      name: stock?.name || known.name || t.name,
      logo: stock?.logo || t.icon_url || null,
      isStock: !!stock,
      multiplier: stock?.multiplier || 1,
      amount,
      fallbackPrice: known?.usd ?? (tAddr === "0x0bd7d308f8e1639fab988df18a8011f41eacad73" ? ethPrice : num(t.exchange_rate)),
    });
  }

  await Promise.all(
    holdings.map(async (h) => {
      let price = null;
      if (h.isStock) {
        const raw = await stockPrice(h.symbol);
        if (raw) price = raw * h.multiplier;
      }
      h.price = price ?? h.fallbackPrice ?? null;
      h.usd = h.price != null ? h.price * h.amount : null;
    })
  );

  if (ethAmount > 0) {
    holdings.push({
      address: "eth",
      symbol: "ETH",
      name: "Awaiting next buy",
      isStock: false,
      amount: ethAmount,
      price: ethPrice,
      usd: ethPrice != null ? ethPrice * ethAmount : null,
    });
  }

  holdings.sort((a, b) => (b.usd || 0) - (a.usd || 0));
  const totalUsd = holdings.reduce((s, h) => s + (h.usd || 0), 0);
  const unpriced = holdings.some((h) => h.usd == null);

  // Purchases = stock tokens that arrived in the vault.
  const purchases = [];
  for (const x of transfers.items || []) {
    const t = x.token || {};
    const tAddr = lower(t.address_hash || t.address);
    const stock = stocks[tAddr];
    if (!stock || lower(x.to?.hash) !== addr) continue;
    const decimals = num(x.total?.decimals ?? t.decimals) ?? 18;
    purchases.push({
      symbol: stock.symbol,
      amount: (num(x.total?.value) || 0) / 10 ** decimals,
      time: x.timestamp,
      tx: x.transaction_hash || x.tx_hash,
    });
  }

  return {
    address,
    holdings,
    totalUsd,
    unpriced,
    ethAmount,
    stockCount: holdings.filter((h) => h.isStock).length,
    purchases: purchases.slice(0, 10),
    errors,
    updatedAt: new Date().toISOString(),
  };
}

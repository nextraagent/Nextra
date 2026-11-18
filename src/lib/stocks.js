// Robinhood stock tokens on Robinhood Chain (chain 4663). All use 18 decimals.
// Server can override or extend with the STOCK_TOKENS env var (JSON: {"SYMBOL":"0x..."}).
export const STOCKS = {
  NVDA: "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec",
  TSLA: "0x322f0929c4625ed5bad873c95208d54e1c003b2d",
  AAPL: "0xaf3d76f1834a1d425780943c99ea8a608f8a93f9",
  AMZN: "0x12f190a9f9d7d37a250758b26824b97ce941bf54",
  META: "0xc0d6457c16cc70d6790dd43521c899c87ce02f35",
  GOOGL: "0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3",
  MSFT: "0xe93237c50d904957cf27e7b1133b510c669c2e74",
  COIN: "0x6330d8c3178a418788df01a47479c0ce7ccf450b",
  SPY: "0x117cc2133c37b721f49de2a7a74833232b3b4c0c",
};

export const SENTRY_TOKENS = Object.keys(STOCKS);

export function stockAddress(symbol) {
  let extra = {};
  try {
    extra = JSON.parse(process.env.STOCK_TOKENS || "{}");
  } catch {}
  return extra[symbol] || STOCKS[symbol] || null;
}

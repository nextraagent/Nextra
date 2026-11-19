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
  QQQ: "0xd5f3879160bc7c32ebb4dc785f8a4f505888de68",
  PLTR: "0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a",
  AMD: "0x86923f96303d656e4aa86d9d42d1e57ad2023fdc",
  NFLX: "0xe0444ef8bf4ed74f74fd73686e2ddf4c1c5591e8",
  AVGO: "0x156e175dd063a8ce274c50654ef40e0032b3fbcf",
  MU: "0xff080c8ce2e5feadaca0da81314ae59d232d4afd",
  INTC: "0xc72b96e0e48ecd4dc75e1e45396e26300bc39681",
  CRCL: "0xdf0992e440dd0be65bd8439b609d6d4366bf1cb5",
  RIVN: "0xb1bf26c1d20ff267a4f93550d1e0d06ac40a114b",
  USAR: "0xd917b029c761d264c6a312bbbcda868658ef86a6",
  SPCX: "0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea",
};

export const SENTRY_TOKENS = Object.keys(STOCKS);

export function stockAddress(symbol) {
  let extra = {};
  try {
    extra = JSON.parse(process.env.STOCK_TOKENS || "{}");
  } catch {}
  return extra[symbol] || STOCKS[symbol] || null;
}

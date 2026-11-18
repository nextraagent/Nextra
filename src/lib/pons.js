// Pons V2 bonding curve on Robinhood Chain: quotes and buy/sell calldata.
// Each Pons launch trades against its own curve contract until it graduates to Uniswap v4.
// Quote math mirrors the curve: fees (+ creator tax, + snipe tax on early buys) come off the
// ETH side, then a constant-product swap against the curve's virtual reserves.
import { encodeFunctionData, parseAbi } from "viem";
import { publicClient } from "./chain";

export const curveAbi = parseAbi([
  "function token() view returns (address)",
  "function isNativeQuote() view returns (bool)",
  "function graduated() view returns (bool)",
  "function readyToGraduate() view returns (bool)",
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function sellableTokens() view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function currentSnipeTaxBps(address recipient) view returns (uint256)",
  "function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)",
  "function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)",
]);

const BPS = 10_000n;
const read = (address, functionName, args) => publicClient.readContract({ address, abi: curveAbi, functionName, args });

// Curves known by token address. NEXTRA_POOL is the $NEXTRA curve.
export function curveFor(token) {
  const t = String(token || "").toLowerCase();
  const nextra = (process.env.NEXT_PUBLIC_NEXTRA_TOKEN || "0xe56cc0f5719dbf00e114990e65d2a1697b7b3fc1").toLowerCase();
  if (t === nextra) return (process.env.NEXTRA_POOL || "0x917dada241d15fc8fbe814ed1183f6c705051059").toLowerCase();
  return null;
}

export async function curveState(curve, recipient) {
  const [[quoteReserve, tokenReserve], sellable, feeBps, creatorTaxBps, graduated, ready, snipeBps] = await Promise.all([
    read(curve, "getReserves"),
    read(curve, "sellableTokens"),
    read(curve, "feeBps"),
    read(curve, "creatorTaxBps"),
    read(curve, "graduated"),
    read(curve, "readyToGraduate"),
    recipient ? read(curve, "currentSnipeTaxBps", [recipient]).catch(() => 0n) : 0n,
  ]);
  return { quoteReserve, tokenReserve, sellable, feeBps, creatorTaxBps, snipeBps, open: !graduated && !ready && sellable > 0n };
}

const amountOut = (amountIn, rIn, rOut) => (amountIn * rOut) / (rIn + amountIn);

// ETH in → tokens out. Returns null when the curve is closed or the trade rounds to zero.
export async function quoteBuy(curve, quoteIn, recipient) {
  const s = await curveState(curve, recipient);
  if (!s.open || quoteIn <= 0n) return null;
  let snipe = s.snipeBps;
  const maxSnipe = BPS - s.feeBps - s.creatorTaxBps - 100n;
  if (snipe > maxSnipe) snipe = maxSnipe > 0n ? maxSnipe : 0n;
  const net = quoteIn - (quoteIn * s.feeBps) / BPS - (quoteIn * s.creatorTaxBps) / BPS - (quoteIn * snipe) / BPS;
  if (net <= 0n) return null;
  let tokensOut = amountOut(net, s.quoteReserve, s.tokenReserve);
  let spent = quoteIn;
  if (tokensOut > s.sellable) {
    // the buy would finish the curve: only part of the ETH is spent, the rest is refunded
    tokensOut = s.sellable;
    const netNeeded = (s.sellable * s.quoteReserve) / (s.tokenReserve - s.sellable) + 1n;
    const totalBps = s.feeBps + s.creatorTaxBps + snipe;
    const grossed = (netNeeded * BPS + (BPS - totalBps) - 1n) / (BPS - totalBps);
    if (grossed < quoteIn) spent = grossed;
  }
  return tokensOut > 0n ? { tokensOut, spent, snipeBps: snipe } : null;
}

// Tokens in → ETH out, after fees.
export async function quoteSell(curve, tokensIn) {
  const s = await curveState(curve);
  if (!s.open || tokensIn <= 0n) return null;
  const gross = amountOut(tokensIn, s.tokenReserve, s.quoteReserve);
  const out = gross - (gross * s.feeBps) / BPS - (gross * s.creatorTaxBps) / BPS;
  return out > 0n ? out : null;
}

export function ponsBuyCall({ curve, quoteIn, q, recipient, slippageBps }) {
  // the curve checks the fill rate (tokensOut / spent), so scale min-out to the full quoteIn
  const minTokensOut = (quoteIn * q.tokensOut * (BPS - BigInt(slippageBps))) / (q.spent * BPS);
  return {
    to: curve,
    value: quoteIn,
    data: encodeFunctionData({ abi: curveAbi, functionName: "buy", args: [quoteIn, minTokensOut, recipient] }),
  };
}

export function ponsSellCall({ curve, tokensIn, quoteOut, recipient, slippageBps }) {
  const minQuoteOut = (quoteOut * (BPS - BigInt(slippageBps))) / BPS;
  return {
    to: curve,
    value: 0n,
    data: encodeFunctionData({ abi: curveAbi, functionName: "sell", args: [tokensIn, minQuoteOut, recipient] }),
  };
}

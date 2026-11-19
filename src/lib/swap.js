// Uniswap v3 on Robinhood Chain: quotes and swap calldata (SwapRouter02 + QuoterV2).
import { decodeFunctionResult, encodeFunctionData, encodePacked, parseAbi, parseEther } from "viem";
import { publicClient, robinhood } from "./chain";
import { signTransaction } from "./privyServer";

export const ROUTER = "0xcaf681a66d020601342297493863e78c959e5cb2";
export const QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7";
const ADDRESS_THIS = "0x0000000000000000000000000000000000000002"; // SwapRouter02: keep output in the router
const FEES = [500, 3000, 10000, 100];

const routerAbi = parseAbi([
  "function WETH9() view returns (address)",
  "function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params) payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) payable",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);
const quoterAbi = parseAbi([
  "function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
]);
export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

let weth = null;
export async function getWeth() {
  if (!weth) weth = (await publicClient.readContract({ address: ROUTER, abi: routerAbi, functionName: "WETH9" })).toLowerCase();
  return weth;
}

export function encodePath(tokens, fees) {
  const types = [];
  const vals = [];
  tokens.forEach((t, i) => {
    types.push("address");
    vals.push(t);
    if (i < fees.length) {
      types.push("uint24");
      vals.push(fees[i]);
    }
  });
  return encodePacked(types, vals);
}

export async function quote(tokens, fees, amountIn) {
  try {
    const data = encodeFunctionData({ abi: quoterAbi, functionName: "quoteExactInput", args: [encodePath(tokens, fees), amountIn] });
    const r = await publicClient.call({ to: QUOTER, data });
    if (!r?.data) return null;
    const [out] = decodeFunctionResult({ abi: quoterAbi, functionName: "quoteExactInput", data: r.data });
    return out > 0n ? out : null;
  } catch {
    return null;
  }
}

// Best route between two tokens: direct pools at every fee tier, plus via USDG (most stock tokens trade against it).
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
export async function bestRoute(tokenIn, tokenOut, amountIn) {
  const a = tokenIn.toLowerCase();
  const b = tokenOut.toLowerCase();
  const cands = FEES.map((f) => ({ tokens: [a, b], fees: [f] }));
  const mid = (process.env.USDG_ADDRESS || USDG).toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(mid) && mid !== a && mid !== b) {
    for (const f1 of FEES) for (const f2 of FEES) cands.push({ tokens: [a, mid, b], fees: [f1, f2] });
  }
  const outs = await Promise.all(cands.map((c) => quote(c.tokens, c.fees, amountIn)));
  let best = null;
  outs.forEach((o, i) => {
    if (o && (!best || o > best.amountOut)) best = { ...cands[i], amountOut: o };
  });
  return best;
}

const minOut = (amount, slippageBps) => (amount * BigInt(10000 - slippageBps)) / 10000n;
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 300);

export function buyCall({ route, amountIn, recipient, slippageBps }) {
  const swap = encodeFunctionData({
    abi: routerAbi,
    functionName: "exactInput",
    args: [{ path: encodePath(route.tokens, route.fees), recipient, amountIn, amountOutMinimum: minOut(route.amountOut, slippageBps) }],
  });
  return { to: ROUTER, value: amountIn, data: encodeFunctionData({ abi: routerAbi, functionName: "multicall", args: [deadline(), [swap]] }) };
}

export function sellCall({ route, amountIn, recipient, slippageBps }) {
  const min = minOut(route.amountOut, slippageBps);
  const swap = encodeFunctionData({
    abi: routerAbi,
    functionName: "exactInput",
    args: [{ path: encodePath(route.tokens, route.fees), recipient: ADDRESS_THIS, amountIn, amountOutMinimum: min }],
  });
  const unwrap = encodeFunctionData({ abi: routerAbi, functionName: "unwrapWETH9", args: [min, recipient] });
  return { to: ROUTER, value: 0n, data: encodeFunctionData({ abi: routerAbi, functionName: "multicall", args: [deadline(), [swap, unwrap]] }) };
}

export function approveCall(token, amount, spender = ROUTER) {
  return { to: token, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] }) };
}

export const tokenBalance = (token, owner) => publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
export const tokenAllowance = (token, owner, spender = ROUTER) =>
  publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });

const hex = (n) => "0x" + BigInt(n).toString(16);

// Builds, signs (through Privy) and broadcasts a transaction from the user's embedded wallet.
export async function sendFromWallet({ walletId, from, to, data, value = 0n, gas }) {
  const [nonce, fees, balance] = await Promise.all([
    publicClient.getTransactionCount({ address: from, blockTag: "pending" }),
    publicClient.estimateFeesPerGas(),
    publicClient.getBalance({ address: from }),
  ]);
  const gasLimit = gas ?? ((await publicClient.estimateGas({ account: from, to, data, value })) * 13n) / 10n;
  const maxFee = fees.maxFeePerGas * 2n;
  const priority = fees.maxPriorityFeePerGas ?? 0n;
  if (balance < value + gasLimit * maxFee) throw new Error("Not enough ETH in the wallet for this trade plus gas");
  const signed = await signTransaction(walletId, {
    from,
    to,
    data,
    value: hex(value),
    chain_id: robinhood.id,
    nonce,
    type: 2,
    gas_limit: hex(gasLimit),
    max_fee_per_gas: hex(maxFee),
    max_priority_fee_per_gas: hex(priority > maxFee ? maxFee : priority),
  });
  return publicClient.sendRawTransaction({ serializedTransaction: signed });
}

export const GAS_BUFFER = parseEther("0.0003");

import {
  encodeFunctionData,
  formatUnits,
  toFunctionSelector,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import {
  EXACT_INPUT_SINGLE_SELECTOR,
  MAX_PRICE_IMPACT_BPS,
  MULTICALL_DEADLINE_SELECTOR,
  QUOTE_DEADLINE_SEC,
  QUOTE_EXACT_INPUT_SINGLE_SELECTOR,
  UNISWAP,
  USDG,
  WETH,
  type StockToken,
} from "@/config";
import {
  exactInputSingleAbi,
  factoryAbi,
  multicallDeadlineAbi,
  poolAbi,
  quoterExactInputSingleAbi,
} from "@/lib/abis";

export type QuoteOk = {
  ok: true;
  amountIn: bigint;
  amountOut: bigint;
  amountOutMinimum: bigint;
  fee: number;
  slippageBps: number;
  priceImpactBps: number | null;
  tokenUsd: number | null;
  ethUsd: number | null;
  routeLabel: string;
  blockedReason: string | null;
};

export type QuoteErr = {
  ok: false;
  error: string;
};

export type QuoteResult = QuoteOk | QuoteErr;

function assertSelectors() {
  const swap = toFunctionSelector(exactInputSingleAbi[0]);
  const multi = toFunctionSelector(multicallDeadlineAbi[0]);
  const quote = toFunctionSelector(quoterExactInputSingleAbi[0]);
  if (swap !== EXACT_INPUT_SINGLE_SELECTOR) {
    throw new Error("exactInputSingle selector mismatch: " + swap);
  }
  if (multi !== MULTICALL_DEADLINE_SELECTOR) {
    throw new Error("multicall selector mismatch: " + multi);
  }
  if (quote !== QUOTE_EXACT_INPUT_SINGLE_SELECTOR) {
    throw new Error("quoteExactInputSingle selector mismatch: " + quote);
  }
}

assertSelectors();

function sqrtPriceToPrice(
  sqrtPriceX96: bigint,
  dec0: number,
  dec1: number,
): number {
  const shift = BigInt(48);
  const x = Number(sqrtPriceX96 >> shift) / 2 ** (96 - 48);
  return x * x * 10 ** (dec0 - dec1);
}

async function readPool(
  client: PublicClient,
  tokenA: Address,
  tokenB: Address,
  fee: number,
) {
  const pool = await client.readContract({
    address: UNISWAP.factory,
    abi: factoryAbi,
    functionName: "getPool",
    args: [tokenA, tokenB, fee],
  });
  if (pool === zeroAddress) return null;
  const [liquidity, slot0, token0] = await Promise.all([
    client.readContract({ address: pool, abi: poolAbi, functionName: "liquidity" }),
    client.readContract({ address: pool, abi: poolAbi, functionName: "slot0" }),
    client.readContract({ address: pool, abi: poolAbi, functionName: "token0" }),
  ]);
  if (liquidity === BigInt(0)) return null;
  return { pool, liquidity, sqrtPriceX96: slot0[0], token0 };
}

export async function readEthUsd(client: PublicClient): Promise<number | null> {
  for (const fee of [500, 100, 3000, 10000] as const) {
    const pool = await readPool(client, WETH, USDG, fee);
    if (!pool) continue;
    const wethIs0 = pool.token0.toLowerCase() === WETH.toLowerCase();
    const price1per0 = sqrtPriceToPrice(pool.sqrtPriceX96, 18, 6);
    const ethUsd = wethIs0 ? price1per0 : 1 / price1per0;
    if (Number.isFinite(ethUsd) && ethUsd > 0) return ethUsd;
  }
  return null;
}

function tokenUsdFromSpot(
  pool: { sqrtPriceX96: bigint; token0: Address },
  token: Address,
  ethUsd: number | null,
): number | null {
  const tokenIs0 = pool.token0.toLowerCase() === token.toLowerCase();
  const price1per0 = sqrtPriceToPrice(pool.sqrtPriceX96, 18, 18);
  const ethPerToken = tokenIs0 ? price1per0 : 1 / price1per0;
  if (!Number.isFinite(ethPerToken) || ethPerToken <= 0) return null;
  if (ethUsd && ethUsd > 0) return ethPerToken * ethUsd;
  return null;
}

function ethPerTokenFromSpot(pool: { sqrtPriceX96: bigint; token0: Address }, token: Address): number | null {
  const tokenIs0 = pool.token0.toLowerCase() === token.toLowerCase();
  const price1per0 = sqrtPriceToPrice(pool.sqrtPriceX96, 18, 18);
  const ethPerToken = tokenIs0 ? price1per0 : 1 / price1per0;
  if (!Number.isFinite(ethPerToken) || ethPerToken <= 0) return null;
  return ethPerToken;
}

export async function quoteGift(
  client: PublicClient,
  token: StockToken,
  usdAmount: number,
): Promise<QuoteResult> {
  if (!token.tradeable) {
    return { ok: false, error: "No liquidity" };
  }
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return { ok: false, error: "Enter an amount" };
  }

  const [ethUsd, pool] = await Promise.all([
    readEthUsd(client),
    readPool(client, WETH, token.address, token.fee),
  ]);

  if (!pool) {
    return { ok: false, error: "No Uniswap v3 pool with liquidity for this share." };
  }
  if (!ethUsd) {
    return { ok: false, error: "Could not read a live ETH price. No quote." };
  }

  const usdMicros = BigInt(Math.round(usdAmount * 1_000_000));
  const ethUsdMicros = BigInt(Math.round(ethUsd * 1_000_000));
  if (ethUsdMicros === BigInt(0)) {
    return { ok: false, error: "Could not read a live ETH price. No quote." };
  }
  const amountIn = (usdMicros * BigInt(10) ** BigInt(18)) / ethUsdMicros;
  if (amountIn === BigInt(0)) {
    return { ok: false, error: "Amount is too small to quote." };
  }

  let amountOut: bigint;
  try {
    const sim = await client.simulateContract({
      address: UNISWAP.quoterV2,
      abi: quoterExactInputSingleAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: WETH,
          tokenOut: token.address,
          amountIn,
          fee: token.fee,
          sqrtPriceLimitX96: BigInt(0),
        },
      ],
    });
    amountOut = sim.result[0];
  } catch {
    return { ok: false, error: "QuoterV2 has no fill for this size. No live quote." };
  }

  if (amountOut === BigInt(0)) {
    return { ok: false, error: "QuoterV2 returned zero. No live quote." };
  }

  const amountOutMinimum = (amountOut * BigInt(10000 - token.slippageBps)) / BigInt(10000);
  if (amountOutMinimum === BigInt(0)) {
    return { ok: false, error: "Minimum out would be zero. Amount is too small." };
  }

  const execEthPerToken = Number(amountIn) / Number(amountOut);
  const spotEthPerToken = ethPerTokenFromSpot(pool, token.address);
  let priceImpactBps: number | null = null;
  if (spotEthPerToken && spotEthPerToken > 0 && Number.isFinite(execEthPerToken)) {
    priceImpactBps = ((execEthPerToken - spotEthPerToken) / spotEthPerToken) * 10_000;
  }

  const tokenUsd = tokenUsdFromSpot(pool, token.address, ethUsd);

  let blockedReason: string | null = null;
  if (priceImpactBps !== null && priceImpactBps > MAX_PRICE_IMPACT_BPS) {
    blockedReason = "Price impact is too high to send.";
  }

  return {
    ok: true,
    amountIn,
    amountOut,
    amountOutMinimum,
    fee: token.fee,
    slippageBps: token.slippageBps,
    priceImpactBps,
    tokenUsd,
    ethUsd,
    routeLabel: "ETH → " + token.symbol + "  ·  " + (token.fee / 10000).toFixed(2) + "%",
    blockedReason,
  };
}

export function encodeCreateGiftCalldata(args: {
  token: StockToken;
  gift: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  deadline?: bigint;
}): { data: Hex; value: bigint } {
  if (args.amountOutMinimum === BigInt(0)) {
    throw new Error("amountOutMinimum must not be zero");
  }
  const inner = encodeFunctionData({
    abi: exactInputSingleAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: WETH,
        tokenOut: args.token.address,
        fee: args.token.fee,
        recipient: args.gift,
        amountIn: args.amountIn,
        amountOutMinimum: args.amountOutMinimum,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });
  const deadline =
    args.deadline ?? BigInt(Math.floor(Date.now() / 1000) + QUOTE_DEADLINE_SEC);
  const data = encodeFunctionData({
    abi: multicallDeadlineAbi,
    functionName: "multicall",
    args: [deadline, [inner]],
  });
  return { data, value: args.amountIn };
}

export function sharesFromAmount(amountOut: bigint): number {
  return Number(formatUnits(amountOut, 18));
}

export function ethFromWei(amount: bigint): number {
  return Number(formatUnits(amount, 18));
}

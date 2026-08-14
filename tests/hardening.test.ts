import { decodeFunctionData, toFunctionSelector, zeroAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import {
  EXACT_INPUT_SINGLE_SELECTOR,
  MULTICALL_DEADLINE_SELECTOR,
  QUOTE_EXACT_INPUT_SINGLE_SELECTOR,
  STOCKS,
  UNISWAP,
  USDG,
  USDG_DECIMALS,
  WETH,
} from "@/config";
import {
  exactInputSingleAbi,
  multicallDeadlineAbi,
  quoterExactInputSingleAbi,
} from "@/lib/abis";
import {
  OFFICIAL_NAME,
  OFFICIAL_NAME_SUFFIX,
  hasOfficialStockTokenName,
  isOfficialStockToken,
  officialNameFor,
} from "@/lib/allowlist";
import { parseClaimKey } from "@/lib/gift";
import { encodeCreateGiftCalldata } from "@/lib/uniswap";

const VERIFIED = {
  NVDA: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
  TSLA: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
  AAPL: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  MSFT: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
  GOOGL: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",
  META: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",
  SPY: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
  QQQ: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68",
  WETH: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  quoterV2: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7",
  swapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2",
  universalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
} as const;

const LOOKALIKE_NVDA = "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EE0" as Address;
const RANDOM_CA = "0x1111111111111111111111111111111111111111" as Address;
const GIFT = "0x3333333333333333333333333333333333333333" as Address;
const SENDER = "0x4444444444444444444444444444444444444444" as Address;

function stock(symbol: keyof typeof VERIFIED) {
  const token = STOCKS.find((row) => row.symbol === symbol);
  if (!token) throw new Error("missing stock " + symbol);
  return token;
}

describe("verified chain addresses", () => {
  it("matches the 8 stock CAs plus WETH and Uniswap factory/quoter/router", () => {
    expect(STOCKS).toHaveLength(8);
    for (const symbol of ["NVDA", "TSLA", "AAPL", "MSFT", "GOOGL", "META", "SPY", "QQQ"] as const) {
      expect(stock(symbol).address).toBe(VERIFIED[symbol]);
    }
    expect(WETH).toBe(VERIFIED.WETH);
    expect(UNISWAP.factory).toBe(VERIFIED.factory);
    expect(UNISWAP.quoterV2).toBe(VERIFIED.quoterV2);
    expect(UNISWAP.swapRouter02).toBe(VERIFIED.swapRouter02);
    expect(UNISWAP.universalRouter).toBe(VERIFIED.universalRouter);
  });

  it("lists USDG as the 6-decimal USD stable, not USDC", () => {
    expect(USDG).toBe("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
    expect(USDG_DECIMALS).toBe(6);
  });
});

describe("Uniswap ABI selectors", () => {
  it("derives exactInputSingle / multicall / quoteExactInputSingle from the ABIs", () => {
    expect(toFunctionSelector(exactInputSingleAbi[0])).toBe("0x04e45aaf");
    expect(toFunctionSelector(multicallDeadlineAbi[0])).toBe("0x5ae401dc");
    expect(toFunctionSelector(quoterExactInputSingleAbi[0])).toBe("0xc6a5026a");
    expect(toFunctionSelector(exactInputSingleAbi[0])).toBe(EXACT_INPUT_SINGLE_SELECTOR);
    expect(toFunctionSelector(multicallDeadlineAbi[0])).toBe(MULTICALL_DEADLINE_SELECTOR);
    expect(toFunctionSelector(quoterExactInputSingleAbi[0])).toBe(QUOTE_EXACT_INPUT_SINGLE_SELECTOR);
  });

  it("keeps deadline off the exactInputSingle struct", () => {
    const names = exactInputSingleAbi[0].inputs[0].components.map((c) => c.name);
    expect(names).toEqual([
      "tokenIn",
      "tokenOut",
      "fee",
      "recipient",
      "amountIn",
      "amountOutMinimum",
      "sqrtPriceLimitX96",
    ]);
    expect(names).not.toContain("deadline");
  });
});

describe("tradeable flags", () => {
  it("disables MSFT and GOOGL", () => {
    expect(stock("MSFT").tradeable).toBe(false);
    expect(stock("GOOGL").tradeable).toBe(false);
    // RPC 2026-08-14: GOOGL's only WETH v3 pool is fee 500 / zero liquidity.
    expect(stock("GOOGL").fee).toBe(500);
    expect(stock("MSFT").fee).toBe(3000);
  });
});

describe("encodeCreateGiftCalldata", () => {
  const amountIn = BigInt(10) ** BigInt(16);
  const amountOutMinimum = BigInt(10) ** BigInt(15);

  it("throws if amountOutMinimum is 0", () => {
    expect(() =>
      encodeCreateGiftCalldata({
        token: stock("NVDA"),
        gift: GIFT,
        amountIn,
        amountOutMinimum: BigInt(0),
      }),
    ).toThrow(/amountOutMinimum/);
  });

  it("throws if tokenOut is not an official stock CA", () => {
    expect(() =>
      encodeCreateGiftCalldata({
        token: { ...stock("NVDA"), address: LOOKALIKE_NVDA },
        gift: GIFT,
        amountIn,
        amountOutMinimum,
      }),
    ).toThrow(/official stock token/);
  });

  it("sets tokenIn=WETH, recipient=gift, fee from the token, sqrtPriceLimitX96=0, value=amountIn", () => {
    const token = stock("TSLA");
    const { data, value } = encodeCreateGiftCalldata({
      token,
      gift: GIFT,
      amountIn,
      amountOutMinimum,
      deadline: BigInt(1_700_000_000),
    });

    expect(value).toBe(amountIn);
    expect(data.slice(0, 10)).toBe("0x5ae401dc");

    const outer = decodeFunctionData({ abi: multicallDeadlineAbi, data });
    expect(outer.functionName).toBe("multicall");
    expect(outer.args[0]).toBe(BigInt(1_700_000_000));

    const innerData = outer.args[1][0];
    expect(innerData.slice(0, 10)).toBe("0x04e45aaf");

    const inner = decodeFunctionData({ abi: exactInputSingleAbi, data: innerData });
    const params = inner.args[0];
    expect(params.tokenIn.toLowerCase()).toBe(WETH.toLowerCase());
    expect(params.tokenOut.toLowerCase()).toBe(token.address.toLowerCase());
    expect(Number(params.fee)).toBe(token.fee);
    expect(params.recipient.toLowerCase()).toBe(GIFT.toLowerCase());
    expect(params.recipient.toLowerCase()).not.toBe(zeroAddress);
    expect(params.recipient.toLowerCase()).not.toBe(SENDER.toLowerCase());
    expect(params.amountIn).toBe(amountIn);
    expect(params.amountOutMinimum).toBe(amountOutMinimum);
    expect(params.sqrtPriceLimitX96).toBe(BigInt(0));
  });
});

describe("parseClaimKey", () => {
  const hex64 = "ab".repeat(32);
  const key = ("0x" + hex64) as Hex;

  it("accepts 0x + 64 hex and #hash forms", () => {
    expect(parseClaimKey(key)).toBe(key);
    expect(parseClaimKey("#" + key)).toBe(key);
    expect(parseClaimKey("#" + hex64)).toBe(key);
    expect(parseClaimKey(hex64)).toBe(key);
  });

  it("rejects short or garbage keys", () => {
    expect(parseClaimKey("")).toBeNull();
    expect(parseClaimKey("#")).toBeNull();
    expect(parseClaimKey("garbage")).toBeNull();
    expect(parseClaimKey("0x" + "ab".repeat(31))).toBeNull();
    expect(parseClaimKey("0x" + "ab".repeat(33))).toBeNull();
    expect(parseClaimKey("0x" + "zz".repeat(32))).toBeNull();
    expect(parseClaimKey("#0xnotakey")).toBeNull();
  });
});

describe("isOfficialStockToken", () => {
  it("accepts every allowlisted stock CA, case-insensitively", () => {
    for (const token of STOCKS) {
      expect(isOfficialStockToken(token.address)).toBe(true);
      expect(isOfficialStockToken(token.address.toLowerCase())).toBe(true);
      expect(isOfficialStockToken(token.address.toUpperCase())).toBe(true);
      expect(officialNameFor(token.address)).toBe(OFFICIAL_NAME[token.symbol as keyof typeof OFFICIAL_NAME]);
      expect(hasOfficialStockTokenName(OFFICIAL_NAME[token.symbol as keyof typeof OFFICIAL_NAME])).toBe(true);
    }
  });

  it("rejects a random address and a lookalike ticker CA", () => {
    expect(isOfficialStockToken(RANDOM_CA)).toBe(false);
    expect(isOfficialStockToken(LOOKALIKE_NVDA)).toBe(false);
    expect(isOfficialStockToken(WETH)).toBe(false);
    expect(isOfficialStockToken(USDG)).toBe(false);
    expect(isOfficialStockToken(zeroAddress)).toBe(false);
    expect(isOfficialStockToken("not-an-address")).toBe(false);
    expect(isOfficialStockToken("")).toBe(false);
    expect(officialNameFor(LOOKALIKE_NVDA)).toBeUndefined();
  });

  it("treats official names as suffix-checked, not ticker-checked", () => {
    expect(hasOfficialStockTokenName("NVIDIA • Robinhood Token")).toBe(true);
    expect(hasOfficialStockTokenName("NVIDIA")).toBe(false);
    expect(OFFICIAL_NAME_SUFFIX).toBe(" • Robinhood Token");
  });
});

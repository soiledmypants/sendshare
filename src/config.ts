import { defineChain, type Address, type Hex } from "viem";

/**
 * Canonical Robinhood Chain constants.
 *
 * Sources (verified 2026-08-14):
 * - Stock token CAs: https://docs.robinhood.com/chain/contracts
 *   and GET https://api.robinhood.com/rhj/assets
 * - Uniswap v3 / periphery: https://github.com/Uniswap/contracts/blob/main/deployments/4663.md
 *
 * Stock Tokens are not available to US persons. This app does not geo-bypass
 * that restriction.
 *
 * There is no official USDC on this chain. USDG
 * (0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168, 6 decimals) is the USD stable.
 *
 * Official on-chain ERC-20 names end with " • Robinhood Token"
 * (e.g. "NVIDIA • Robinhood Token", "Alphabet Class A • Robinhood Token").
 * A matching ticker at any other address is fake — only the hardcoded
 * allowlist CAs are official. See isOfficialStockToken().
 */
export const ROBINHOOD_CHAIN_ID = 4663;
export const DEFAULT_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const EXPLORER_URL = "https://robinhoodchain.blockscout.com";

export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL;
export const twitterUrl = process.env.NEXT_PUBLIC_TWITTER_URL || "";
export const contractAddress = process.env.NEXT_PUBLIC_CA || "";
export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: "Blockscout", url: EXPLORER_URL } },
});

export const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const;
/** USDG — 6 decimals. Not USDC; there is no official USDC on chain 4663. */
export const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;
export const USDG_DECIMALS = 6;

export const UNISWAP = {
  factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA" as Address,
  quoterV2: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7" as Address,
  swapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2" as Address,
  /** Listed only. v1 does not encode Universal Router execute. */
  universalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904" as Address,
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
} as const;

export const EXACT_INPUT_SINGLE_SELECTOR = "0x04e45aaf" as Hex;
export const MULTICALL_DEADLINE_SELECTOR = "0x5ae401dc" as Hex;
export const QUOTE_EXACT_INPUT_SINGLE_SELECTOR = "0xc6a5026a" as Hex;

export const FEE_TIERS = [100, 500, 3000, 10000] as const;
export type FeeTier = (typeof FEE_TIERS)[number];

export const DEFAULT_SLIPPAGE_BPS = 100;
export const MAX_PRICE_IMPACT_BPS = 800;
export const QUOTE_DEADLINE_SEC = 20 * 60;
export const CLAIM_GAS_LIMIT = BigInt(150000);

export type StockToken = {
  symbol: string;
  name: string;
  address: Address;
  icon: string;
  decimals: 18;
  fee: FeeTier;
  slippageBps: number;
  tradeable: boolean;
};

export const STOCKS: StockToken[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    icon: "https://cdn.robinhood.com/ncw_assets/logos/0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec.png",
    decimals: 18,
    fee: 500,
    slippageBps: 100,
    tradeable: true,
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
    icon: "https://cdn.robinhood.com/ncw_assets/logos/0x322f0929c4625ed5bad873c95208d54e1c003b2d.png",
    decimals: 18,
    fee: 3000,
    slippageBps: 200,
    tradeable: true,
  },
  {
    symbol: "AAPL",
    name: "Apple",
    address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    icon: "https://cdn.robinhood.com/ncw_assets/logos/0xaf3d76f1834a1d425780943c99ea8a608f8a93f9.png",
    decimals: 18,
    fee: 500,
    slippageBps: 100,
    tradeable: true,
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
    icon: "https://cdn.robinhood.com/ncw_assets/logos/0xe93237c50d904957cf27e7b1133b510c669c2e74.png",
    decimals: 18,
    fee: 3000,
    slippageBps: 100,
    tradeable: false,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",
    icon: "https://cdn.robinhood.com/ncw_assets/logos/0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3.png",
    decimals: 18,
    // Only WETH v3 pool on 4663 is fee 500 with zero liquidity (RPC 2026-08-14).
    // Keep disabled; fee 500 so a later enable hits the real pool, not 3000.
    fee: 500,
    slippageBps: 100,
    tradeable: false,
  },
  {
    symbol: "META",
    name: "Meta",
    address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",
    icon: "https://cdn.robinhood.com/ncw_assets/logos/0xc0d6457c16cc70d6790dd43521c899c87ce02f35.png",
    decimals: 18,
    fee: 3000,
    slippageBps: 100,
    tradeable: true,
  },
  {
    symbol: "SPY",
    name: "SPDR S&P 500",
    address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
    icon: "https://cdn.robinhood.com/ncw_assets/logos/0x117cc2133c37b721f49de2a7a74833232b3b4c0c.png",
    decimals: 18,
    fee: 500,
    slippageBps: 100,
    tradeable: true,
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ",
    address: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68",
    icon: "https://cdn.robinhood.com/ncw_assets/logos/0xd5f3879160bc7c32ebb4dc785f8a4f505888de68.png",
    decimals: 18,
    fee: 3000,
    slippageBps: 100,
    tradeable: true,
  },
];

export const AMOUNT_PRESETS = [10, 25, 50, 100] as const;

export function tokenExplorer(address: Address) {
  return EXPLORER_URL + "/token/" + address;
}

export function txExplorer(hash: Hex) {
  return EXPLORER_URL + "/tx/" + hash;
}

export function addressExplorer(address: Address) {
  return EXPLORER_URL + "/address/" + address;
}

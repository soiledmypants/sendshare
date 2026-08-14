import { type Address, type PublicClient } from "viem";
import { STOCKS } from "@/config";
import { erc20Abi } from "@/lib/abis";

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;

function normalizeAddress(address: string): string | null {
  const normalized = address.trim().toLowerCase();
  if (!ADDRESS_RE.test(normalized)) return null;
  return normalized;
}

/** Official on-chain ERC-20 names end with this suffix. */
export const OFFICIAL_NAME_SUFFIX = " • Robinhood Token";

/**
 * On-chain `name()` for each allowlisted stock token CA.
 * UI-facing `StockToken.name` stays short (Shop / ClaimView); this map is not displayed.
 */
export const OFFICIAL_NAME = {
  NVDA: "NVIDIA • Robinhood Token",
  TSLA: "Tesla • Robinhood Token",
  AAPL: "Apple • Robinhood Token",
  MSFT: "Microsoft • Robinhood Token",
  GOOGL: "Alphabet Class A • Robinhood Token",
  META: "Meta Platforms • Robinhood Token",
  SPY: "SPDR S&P 500 ETF Trust • Robinhood Token",
  QQQ: "Invesco QQQ • Robinhood Token",
} as const;

const OFFICIAL_STOCK_ADDRESSES = new Set(
  STOCKS.map((token) => token.address.toLowerCase()),
);

const OFFICIAL_NAME_BY_ADDRESS = new Map(
  STOCKS.map((token) => [
    token.address.toLowerCase(),
    OFFICIAL_NAME[token.symbol as keyof typeof OFFICIAL_NAME],
  ]),
);

/**
 * True only if `address` is a hardcoded official stock-token CA.
 * Case-insensitive. A matching ticker at any other address is fake.
 */
export function isOfficialStockToken(address: string): boolean {
  const normalized = normalizeAddress(address);
  if (!normalized) return false;
  return OFFICIAL_STOCK_ADDRESSES.has(normalized);
}

export function officialNameFor(address: string): string | undefined {
  const normalized = normalizeAddress(address);
  if (!normalized) return undefined;
  return OFFICIAL_NAME_BY_ADDRESS.get(normalized);
}

export function hasOfficialStockTokenName(name: string): boolean {
  return name.endsWith(OFFICIAL_NAME_SUFFIX);
}

export async function readTokenName(
  client: PublicClient,
  address: Address,
): Promise<string> {
  return client.readContract({
    address,
    abi: erc20Abi,
    functionName: "name",
  });
}

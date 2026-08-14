import {
  createWalletClient,
  http,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  CLAIM_GAS_LIMIT,
  robinhoodChain,
  rpcUrl,
  UNISWAP,
  type StockToken,
} from "@/config";
import { erc20Abi } from "@/lib/abis";
import { encodeCreateGiftCalldata, type QuoteOk } from "@/lib/uniswap";

export type CreatedGift = {
  privateKey: Hex;
  giftAddress: Address;
  claimUrl: string;
  swapHash: Hex;
  stipendHash: Hex | null;
  stipendFailed: boolean;
};

export async function estimateStipendWei(client: PublicClient): Promise<bigint> {
  const gasPrice = await client.getGasPrice();
  const stipend = (gasPrice * CLAIM_GAS_LIMIT * BigInt(12)) / BigInt(10);
  const floor = BigInt(10) ** BigInt(14);
  return stipend > floor ? stipend : floor;
}

export async function createGift(args: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  token: StockToken;
  quote: QuoteOk;
  origin: string;
}): Promise<CreatedGift> {
  const privateKey = generatePrivateKey();
  const gift = privateKeyToAccount(privateKey);
  const { data, value } = encodeCreateGiftCalldata({
    token: args.token,
    gift: gift.address,
    amountIn: args.quote.amountIn,
    amountOutMinimum: args.quote.amountOutMinimum,
  });

  const swapHash = await args.walletClient.sendTransaction({
    account: args.account,
    chain: robinhoodChain,
    to: UNISWAP.swapRouter02,
    data,
    value,
  });
  await args.publicClient.waitForTransactionReceipt({ hash: swapHash });

  const stipend = await estimateStipendWei(args.publicClient);
  let stipendHash: Hex | null = null;
  let stipendFailed = false;
  try {
    stipendHash = await args.walletClient.sendTransaction({
      account: args.account,
      chain: robinhoodChain,
      to: gift.address,
      value: stipend,
    });
    await args.publicClient.waitForTransactionReceipt({ hash: stipendHash });
  } catch {
    stipendFailed = true;
  }

  return {
    privateKey,
    giftAddress: gift.address,
    claimUrl: args.origin + "/claim#" + privateKey,
    swapHash,
    stipendHash,
    stipendFailed,
  };
}

export function parseClaimKey(hash: string): Hex | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const key = (raw.startsWith("0x") ? raw : "0x" + raw) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return key;
}

export type GiftHolding = {
  token: StockToken;
  balance: bigint;
};

export async function readGiftHoldings(
  client: PublicClient,
  gift: Address,
  tokens: StockToken[],
): Promise<GiftHolding[]> {
  const balances = await Promise.all(
    tokens.map((token) =>
      client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [gift],
      }),
    ),
  );
  return tokens
    .map((token, i) => ({ token, balance: balances[i] }))
    .filter((row) => row.balance > BigInt(0));
}

export async function topUpGiftGas(args: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  gift: Address;
}): Promise<Hex> {
  const stipend = await estimateStipendWei(args.publicClient);
  const hash = await args.walletClient.sendTransaction({
    account: args.account,
    chain: robinhoodChain,
    to: args.gift,
    value: stipend,
  });
  await args.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function claimHoldings(args: {
  publicClient: PublicClient;
  privateKey: Hex;
  recipient: Address;
  holdings: GiftHolding[];
}): Promise<Hex[]> {
  const account: Account = privateKeyToAccount(args.privateKey);
  const wallet = createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(rpcUrl),
  });
  const hashes: Hex[] = [];
  for (const row of args.holdings) {
    if (row.balance === BigInt(0)) continue;
    const hash = await wallet.writeContract({
      address: row.token.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [args.recipient, row.balance],
    });
    await args.publicClient.waitForTransactionReceipt({ hash });
    hashes.push(hash);
  }
  return hashes;
}

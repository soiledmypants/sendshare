# Sendshare

Send a Robinhood Chain stock token as a link. Unofficial. Not affiliated with Robinhood.

Pick a share, choose a USD amount, pay ETH.
Quotes Uniswap v3 and sends tokens to a browser-generated gift address.
Claim URL keeps the private key in the hash. Never posted to a server.

Stock Tokens are not available to US persons.

## Run locally

Copy .env.example to .env.local, install dependencies, then start the Next.js dev server.

## Environment

NEXT_PUBLIC_TWITTER_URL — optional Twitter link
NEXT_PUBLIC_CA — optional contract address
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — optional, injected wallets work without it
NEXT_PUBLIC_RPC_URL — optional, defaults to the public Robinhood Chain RPC

## Deploy on Vercel

Import as a Next.js project. Set the env vars in the Vercel dashboard. vercel.json pins the framework.

## Add Robinhood Chain to MetaMask

Network name: Robinhood Chain
Chain ID: 4663
Currency: ETH
RPC: https://rpc.mainnet.chain.robinhood.com
Explorer: https://robinhoodchain.blockscout.com

Connect will also ask the wallet to add this chain when you switch.

## How a gift is created

1. QuoterV2 quoteExactInputSingle via eth_call. amountOutMinimum is never zero.
2. SwapRouter02 exactInputSingle (no deadline in the struct) wrapped in multicall(uint256, bytes[]).
3. msg.value is the ETH input. Tokens go to the gift EOA, not the sender.
4. A small ETH stipend (about 150k gas) is sent so claim can transfer.
5. If the gift has no ETH on claim, the connected wallet tops it up first.

MSFT and GOOGL are listed but disabled: WETH v3 pools exist with zero liquidity.

Unofficial. Not Robinhood. Stock Tokens are not available to US persons.

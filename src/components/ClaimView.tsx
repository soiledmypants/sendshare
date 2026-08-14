"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ROBINHOOD_CHAIN_ID, STOCKS } from "@/config";
import { ConnectButton } from "@/components/ConnectButton";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import {
  claimHoldings,
  parseClaimKey,
  readGiftHoldings,
  topUpGiftGas,
  type GiftHolding,
} from "@/lib/gift";
import { formatShares, truncateAddress } from "@/lib/format";

export function ClaimView() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID });
  const { data: walletClient } = useWalletClient();
  const [key, setKey] = useState<`0x${string}` | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [gift, setGift] = useState<`0x${string}` | null>(null);
  const [holdings, setHoldings] = useState<GiftHolding[] | null>(null);
  const [ethBal, setEthBal] = useState<bigint | null>(null);
  const [status, setStatus] = useState("Reading the gift…");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [imgFail, setImgFail] = useState(false);

  useEffect(() => {
    const parsed = parseClaimKey(window.location.hash);
    if (!parsed) {
      setInvalid(true);
      setStatus("This claim link is missing or invalid.");
      return;
    }
    setKey(parsed);
    try {
      setGift(privateKeyToAccount(parsed).address);
    } catch {
      setInvalid(true);
      setStatus("This claim link is missing or invalid.");
    }
  }, []);

  useEffect(() => {
    if (!publicClient || !gift) return;
    let alive = true;
    void Promise.all([
      readGiftHoldings(publicClient, gift, STOCKS),
      publicClient.getBalance({ address: gift }),
    ]).then(([rows, bal]) => {
      if (!alive) return;
      setHoldings(rows);
      setEthBal(bal);
      if (rows.length === 0) setStatus("Nothing left to claim.");
      else if (bal === BigInt(0)) setStatus("Gift address needs a little ETH for gas. Your wallet can send it, then the share moves.");
      else setStatus("Connect a wallet and claim to it. The same link reclaims.");
    });
    return () => { alive = false; };
  }, [publicClient, gift, done]);

  const primary = holdings?.[0];
  const canClaim = isConnected && chainId === ROBINHOOD_CHAIN_ID && !!address && !!key && !!gift && !!primary && !busy && !done;

  async function onClaim() {
    if (!publicClient || !walletClient || !address || !key || !gift || !holdings || holdings.length === 0) return;
    setBusy(true);
    try {
      const bal = await publicClient.getBalance({ address: gift });
      if (bal === BigInt(0)) {
        setStatus("Sending a little ETH for claim gas…");
        await topUpGiftGas({ publicClient, walletClient, account: address, gift });
      }
      setStatus("Moving the share to your wallet…");
      await claimHoldings({ publicClient, privateKey: key, recipient: address, holdings });
      setDone(true);
      setStatus("Claimed. The share is in your wallet.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed.";
      setStatus(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="page">
        <p className="label kicker">Claim</p>
        <h1>Someone sent you a share.</h1>
        <p className="lede">Connect the wallet that should receive it. The same page reclaims if you sent it.</p>

        <section className="card">
          {invalid ? (
            <p className="quote-err">This claim link is missing or invalid. The key stays in the URL hash and is never sent to a server.</p>
          ) : !primary ? (
            <p className="quote-empty">{holdings ? "Nothing left to claim." : "Reading the gift address…"}</p>
          ) : (
            <div className="wallet-row" style={{ alignItems: "flex-start" }}>
              <div>
                <p className="label">{primary.token.symbol}</p>
                <p className="claim-amt">{formatShares(Number(formatUnits(primary.balance, 18)), primary.token.symbol)}</p>
                <p className="claim-sub">{primary.token.name}</p>
                {gift ? <p className="claim-sub">Gift {truncateAddress(gift, 8, 6)}</p> : null}
                {ethBal === BigInt(0) ? <p className="warn" style={{ marginTop: 10 }}>Gift address needs a little ETH for gas.</p> : null}
              </div>
              {imgFail ? (
                <span className="stock-icon-fallback">{primary.token.symbol.slice(0, 2)}</span>
              ) : (
                <Image className="stock-icon" src={primary.token.icon} alt="" width={40} height={40} onError={() => setImgFail(true)} />
              )}
            </div>
          )}
        </section>

        <section className="card">
          <p className="label card-head">Wallet</p>
          <div className="wallet-row">
            <p className="wallet-note">{isConnected && address ? truncateAddress(address, 8, 6) : "Connect to receive"}</p>
            <ConnectButton />
          </div>
        </section>

        <button className="cta" type="button" disabled={!canClaim} onClick={() => void onClaim()}>
          Claim to my wallet
        </button>
        <p className="cta-note">{status}</p>
      </main>
      <Footer />
    </>
  );
}

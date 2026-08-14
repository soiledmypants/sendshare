"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import {
  AMOUNT_PRESETS,
  ROBINHOOD_CHAIN_ID,
  STOCKS,
  type StockToken,
} from "@/config";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { ConnectButton } from "@/components/ConnectButton";
import { createGift, type CreatedGift } from "@/lib/gift";
import {
  formatEth,
  formatFee,
  formatImpact,
  formatShares,
  formatUsd,
  parseUsdInput,
  truncateAddress,
} from "@/lib/format";
import { ethFromWei, quoteGift, sharesFromAmount, type QuoteResult } from "@/lib/uniswap";

export function Shop() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID });
  const { data: walletClient } = useWalletClient();
  const firstLive = STOCKS.find((s) => s.tradeable) ?? STOCKS[0];
  const [token, setToken] = useState<StockToken>(firstLive);
  const [preset, setPreset] = useState<number | "custom">(25);
  const [custom, setCustom] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [gift, setGift] = useState<CreatedGift | null>(null);
  const [copied, setCopied] = useState(false);
  const [imgFail, setImgFail] = useState<Record<string, boolean>>({});

  const usd = useMemo(() => {
    if (preset === "custom") return parseUsdInput(custom);
    return preset;
  }, [preset, custom]);

  useEffect(() => {
    if (!publicClient || !token.tradeable || !usd) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    let alive = true;
    setQuoting(true);
    const t = window.setTimeout(() => {
      void quoteGift(publicClient, token, usd).then((q) => {
        if (!alive) return;
        setQuote(q);
        setQuoting(false);
      });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [publicClient, token, usd]);

  const onCreate = useCallback(async () => {
    if (!publicClient || !walletClient || !address || !quote || !quote.ok || quote.blockedReason) return;
    setBusy("Swapping ETH for the share…");
    try {
      const created = await createGift({
        publicClient,
        walletClient,
        account: address,
        token,
        quote,
        origin: window.location.origin,
      });
      setGift(created);
      setBusy(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "The swap failed.";
      setBusy(null);
      setQuote({ ok: false, error: msg });
    }
  }, [publicClient, walletClient, address, quote, token]);

  const ready =
    isConnected &&
    chainId === ROBINHOOD_CHAIN_ID &&
    !!quote &&
    quote.ok &&
    !quote.blockedReason &&
    !quoting &&
    !busy &&
    !gift;

  let note = "Connect a wallet to send.";
  if (gift) note = "Gift link is ready.";
  else if (busy) note = busy;
  else if (!isConnected) note = "Connect a wallet to send.";
  else if (chainId !== ROBINHOOD_CHAIN_ID) note = "Switch to Robinhood Chain to send.";
  else if (!token.tradeable) note = "No liquidity for this share.";
  else if (!usd) note = "Choose an amount.";
  else if (quoting) note = "Quoting…";
  else if (quote && !quote.ok) note = quote.error;
  else if (quote && quote.ok && quote.blockedReason) note = quote.blockedReason;
  else if (ready) note = "You will sign two transactions: the swap, then a small ETH stipend for claim gas.";

  return (
    <>
      <Nav />
      <main className="page">
        <p className="label kicker">The gift shop</p>
        <h1>Send a share</h1>
        <p className="lede">Pick one, choose an amount, get a link back. Whoever opens it claims the share.</p>

        <section className="card">
          <p className="label card-head">Wallet</p>
          <div className="wallet-row">
            <div>
              {isConnected && address ? (
                <>
                  <p className="wallet-addr">{truncateAddress(address, 8, 6)}</p>
                  {chainId !== ROBINHOOD_CHAIN_ID ? (
                    <p className="wallet-note">Wrong network</p>
                  ) : null}
                </>
              ) : (
                <p className="wallet-note">Not connected</p>
              )}
            </div>
            <ConnectButton />
          </div>
        </section>

        <section className="card">
          <p className="label card-head">Which share</p>
          <div className="grid">
            {STOCKS.map((s) => {
              const on = token.symbol === s.symbol;
              return (
                <button
                  key={s.symbol}
                  type="button"
                  className={"stock" + (on ? " is-on" : "") + (!s.tradeable ? " is-off" : "")}
                  disabled={!s.tradeable}
                  aria-pressed={on}
                  onClick={() => { setToken(s); setGift(null); }}
                >
                  {imgFail[s.symbol] ? (
                    <span className="stock-icon-fallback">{s.symbol.slice(0, 2)}</span>
                  ) : (
                    <Image
                      className="stock-icon"
                      src={s.icon}
                      alt=""
                      width={28}
                      height={28}
                      onError={() => setImgFail((m) => ({ ...m, [s.symbol]: true }))}
                    />
                  )}
                  <span>
                    <span className="stock-sym">{s.symbol}</span>
                    <span className="stock-name">{s.name}</span>
                    {!s.tradeable ? <span className="stock-liq">No liquidity</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card">
          <p className="label card-head">How much</p>
          <div className="amounts">
            {AMOUNT_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className={"preset" + (preset === n ? " is-on" : "")}
                onClick={() => { setPreset(n); setGift(null); }}
              >
                {"$" + n}
              </button>
            ))}
          </div>
          <label className={"custom" + (preset === "custom" ? " is-on" : "")}>
            <span>$</span>
            <input
              inputMode="decimal"
              placeholder="Custom"
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setPreset("custom"); setGift(null); }}
              aria-label="Custom dollar amount"
            />
          </label>
        </section>

        <section className="card" aria-live="polite">
          <p className="label card-head">Before you commit</p>
          {!token.tradeable ? (
            <p className="quote-err">No liquidity. This share cannot be sent.</p>
          ) : quoting || !quote ? (
            <p className="quote-empty">{quoting ? "Quoting the live pool…" : "Pick a share and an amount for a live quote."}</p>
          ) : !quote.ok ? (
            <p className="quote-err">{quote.error}</p>
          ) : (
            <dl className="rows">
              <div className="row"><dt>Token USD price</dt><dd>{formatUsd(quote.tokenUsd)}</dd></div>
              <div className="row"><dt>You pay</dt><dd>{formatEth(ethFromWei(quote.amountIn))}</dd></div>
              <div className="row"><dt>They receive</dt><dd>{formatShares(sharesFromAmount(quote.amountOut), token.symbol)}</dd></div>
              <div className="row"><dt>Price impact</dt><dd className={quote.blockedReason ? "impact-bad" : undefined}>{formatImpact(quote.priceImpactBps)}</dd></div>
              <div className="row"><dt>Route</dt><dd>{quote.routeLabel}</dd></div>
              <div className="row"><dt>Fee</dt><dd>{formatFee(quote.fee)}</dd></div>
            </dl>
          )}
        </section>

        <button className="cta" type="button" disabled={!ready} onClick={() => void onCreate()}>
          Create the gift link
        </button>
        <p className="cta-note">{note}</p>

        {gift ? (
          <section className="card">
            <p className="label card-head">Your gift link</p>
            <p className="success-url">{gift.claimUrl}</p>
            <div className="copy-row">
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(gift.claimUrl);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <button className="ghost" type="button" onClick={() => setGift(null)}>Send another</button>
            </div>
            <p className="warn" style={{ marginTop: 12 }}>
              This link is the gift. Anyone who opens it can take the share. Do not post it publicly.
            </p>
            {gift.stipendFailed ? (
              <p className="warn" style={{ marginTop: 8 }}>
                The share is on the gift address, but the gas stipend failed. The claim page can top it up from the connected wallet.
              </p>
            ) : null}
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}

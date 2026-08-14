"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ROBINHOOD_CHAIN_ID } from "@/config";
import { truncateAddress } from "@/lib/format";

export function ConnectButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const wrong = isConnected && chainId !== ROBINHOOD_CHAIN_ID;

  if (isConnected && address && !wrong) {
    return (
      <div ref={wrap} style={{ position: "relative" }}>
        <button className={compact ? "connect is-on" : "ghost"} type="button" onClick={() => setOpen((v) => !v)}>
          {truncateAddress(address)}
        </button>
        {open ? (
          <div className="menu">
            <button type="button" onClick={() => { void navigator.clipboard.writeText(address); setOpen(false); }}>Copy address</button>
            <button type="button" onClick={() => { disconnect(); setOpen(false); }}>Disconnect</button>
          </div>
        ) : null}
      </div>
    );
  }

  if (wrong) {
    return (
      <button className="connect" type="button" disabled={isSwitching} onClick={() => switchChain({ chainId: ROBINHOOD_CHAIN_ID })}>
        {isSwitching ? "Switching" : "Switch network"}
      </button>
    );
  }

  const injected = connectors.find((c) => c.id === "injected" || c.type === "injected") ?? connectors[0];

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <button
        className="connect"
        type="button"
        disabled={isPending}
        onClick={() => {
          if (connectors.length > 1) setOpen((v) => !v);
          else if (injected) connect({ connector: injected });
        }}
      >
        {isPending ? "Connecting" : "Connect"}
      </button>
      {open ? (
        <div className="menu">
          {connectors.map((c) => (
            <button key={c.uid} type="button" onClick={() => { connect({ connector: c }); setOpen(false); }}>
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

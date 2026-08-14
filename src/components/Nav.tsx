"use client";

import Link from "next/link";
import { contractAddress, twitterUrl } from "@/config";
import { truncateAddress } from "@/lib/format";
import { ConnectButton } from "@/components/ConnectButton";

export function Nav() {
  return (
    <header className="nav">
      <Link className="wordmark" href="/">Sendshare</Link>
      <div className="nav-right">
        {twitterUrl ? (
          <a className="nav-link" href={twitterUrl} target="_blank" rel="noreferrer">
            Twitter
          </a>
        ) : (
          <span className="nav-muted">Twitter</span>
        )}
        {contractAddress ? (
          <button
            className="nav-ca"
            type="button"
            onClick={() => void navigator.clipboard.writeText(contractAddress)}
            title="Copy address"
          >
            CA {truncateAddress(contractAddress)}
          </button>
        ) : (
          <span className="nav-muted">CA</span>
        )}
        <ConnectButton compact />
      </div>
    </header>
  );
}

import { contractAddress, STOCKS, tokenExplorer, twitterUrl } from "@/config";
import { truncateAddress } from "@/lib/format";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-links">
        {twitterUrl ? (
          <a href={twitterUrl} target="_blank" rel="noreferrer">Twitter</a>
        ) : (
          <span>Twitter</span>
        )}
        {contractAddress ? (
          <span>CA {truncateAddress(contractAddress)}</span>
        ) : (
          <span>CA</span>
        )}
      </div>
      <p>Sendshare is unofficial and is not affiliated with, endorsed by, or sponsored by Robinhood Markets, Inc. or its affiliates.</p>
      <p style={{ marginTop: 8 }}>Stock Tokens are not available to US persons. This site does not bypass geographic or eligibility restrictions.</p>
      <div className="token-links">
        {STOCKS.map((s) => (
          <a key={s.symbol} href={tokenExplorer(s.address)} target="_blank" rel="noreferrer">
            {s.symbol}
          </a>
        ))}
      </div>
    </footer>
  );
}

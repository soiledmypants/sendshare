export function truncateAddress(address: string, left = 6, right = 4): string {
  if (address.length <= left + right + 2) return address;
  return address.slice(0, left) + "..." + address.slice(-right);
}

export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 1000) {
    return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (value >= 1) {
    return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function formatEth(value: number | null, digits = 6): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0 ETH";
  if (value < 0.000001) return "<0.000001 ETH";
  return value.toFixed(digits).replace(/\.?0+$/, "") + " ETH";
}

export function formatShares(value: number | null, symbol: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0 " + symbol;
  if (value < 0.0001) return "<0.0001 " + symbol;
  const digits = value >= 1 ? 4 : 6;
  return value.toFixed(digits).replace(/\.?0+$/, "") + " " + symbol;
}

export function formatImpact(bps: number | null): string {
  if (bps === null || !Number.isFinite(bps)) return "—";
  const pct = bps / 100;
  const sign = pct > 0 ? "+" : "";
  return sign + pct.toFixed(2) + "%";
}

export function formatFee(fee: number): string {
  return (fee / 10000).toFixed(2).replace(/\.?0+$/, "") + "%";
}

export function parseUsdInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

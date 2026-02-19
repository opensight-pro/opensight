export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function fmtPct01(v01: number): string {
  return `${(clamp01(v01) * 100).toFixed(1)}%`;
}

export function fmtCoin(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return v.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d+?)0+$/, "$1");
}

export function shortId(id: string): string {
  if (!id) return "-";
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

// Explorer URL configuration from environment variable
// Set VITE_EXPLORER_URL in your .env file
// Examples:
//   VITE_EXPLORER_URL=https://explorer.monad.xyz
//   VITE_EXPLORER_URL=https://etherscan.io
//   VITE_EXPLORER_URL=http://localhost:3000
const EXPLORER_URL = (import.meta.env.VITE_EXPLORER_URL as string) || "https://explorer.monad.xyz";

/**
 * Get the explorer URL for a transaction hash
 * Uses VITE_EXPLORER_URL from environment, defaults to Monad explorer
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

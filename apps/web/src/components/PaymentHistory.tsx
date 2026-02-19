import React from "react";

import { usePaymentHistory } from "../hooks/usePaymentHistory";
import { fmtCoin, shortId, getExplorerTxUrl } from "../lib/format";
import type { Payment, PaymentStatus, PaymentDirection } from "../types";

import { Icon } from "./Icon";

function StatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, { bg: string; text: string; border: string }> = {
    PENDING: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      border: "border-yellow-500/40"
    },
    CONFIRMED: {
      bg: "bg-neon-green/10",
      text: "text-neon-green",
      border: "border-neon-green/20"
    },
    SENT: {
      bg: "bg-neon-green/10",
      text: "text-neon-green",
      border: "border-neon-green/20"
    },
    FAILED: {
      bg: "bg-neon-red/10",
      text: "text-neon-red",
      border: "border-neon-red/20"
    }
  };

  const s = styles[status];

  return (
    <span
      className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border uppercase tracking-widest font-mono ${s.bg} ${s.text} ${s.border}`}
    >
      {status}
    </span>
  );
}

function TypeBadge({ direction }: { direction: PaymentDirection }) {
  const isDeposit = direction === "DEPOSIT";
  return (
    <span className={`text-xs font-mono ${isDeposit ? "text-neon-green" : "text-neon-red"}`}>
      {isDeposit ? "+" : "-"} {direction}
    </span>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function PaymentHistory(props: { apiKey: string }) {
  const { history, loading, error, refresh } = usePaymentHistory(props.apiKey);

  const payments = history?.payments ?? [];

  // Sort by date (newest first)
  const sortedPayments = React.useMemo(() => {
    return [...payments].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [payments]);

  return (
    <div className="flex flex-col rounded border border-white/10 bg-black overflow-hidden">
      <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between bg-surface-dark">
        <h3 className="text-white text-sm font-bold font-mono uppercase tracking-wider flex items-center gap-2">
          <span className="size-2 bg-primary rounded-full shadow-glow" />
          Payment_History
        </h3>
        <div className="flex items-center gap-2">
          {loading && <span className="text-[10px] text-text-muted font-mono">Loading…</span>}
          <button
            className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-white transition-colors"
            onClick={() => void refresh()}
            title="refresh"
            disabled={loading}
          >
            <Icon name="refresh" className="text-[18px]" />
          </button>
        </div>
      </div>

      {!props.apiKey ? (
        <div className="p-6 text-text-muted font-mono text-sm">
          Connect an agent to see payment history.
        </div>
      ) : error ? (
        <div className="p-6 text-red-400 font-mono text-sm">{error}</div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse font-mono">
            <thead>
              <tr className="bg-black text-text-muted/60 text-[10px] uppercase tracking-widest border-b border-white/5">
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Amount (Coin)</th>
                <th className="px-6 py-3 text-right">Amount (BNB)</th>
                <th className="px-6 py-3">Transaction</th>
                <th className="px-6 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {sortedPayments.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-text-muted text-center" colSpan={6}>
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="receipt_long" className="text-2xl text-text-muted/40" />
                      <span>No transactions yet</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedPayments.map((p: Payment) => (
                  <tr key={p.id} className="hover:bg-surface-terminal/60 transition-colors">
                    <td className="px-6 py-4">
                      <TypeBadge direction={p.direction} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-6 py-4 text-right text-white">
                      {fmtCoin(p.coinAmount)}
                    </td>
                    <td className="px-6 py-4 text-right text-text-muted">
                      {p.bnbAmount}
                    </td>
                    <td className="px-6 py-4">
                      {p.txHash ? (
                        <a
                          href={getExplorerTxUrl(p.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-white transition-colors flex items-center gap-1"
                        >
                          <span className="font-mono">{shortId(p.txHash)}</span>
                          <Icon name="open_in_new" className="text-[14px]" />
                        </a>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-text-muted">
                      {formatDate(p.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

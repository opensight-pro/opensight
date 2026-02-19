import React from "react";

import { apiPost, ApiError } from "../api";
import { useQuote } from "../hooks/useQuote";
import { fmtCoin, fmtPct01 } from "../lib/format";
import { useSession } from "../state/session";
import type { Market, TradeResponse } from "../types";

interface TradeTicketProps {
  market: Market;
  onAfterTrade?: () => void;
  className?: string;
}

export function TradeTicket({ market, onAfterTrade, className }: TradeTicketProps) {
  const session = useSession();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [result, setResult] = React.useState<TradeResponse | null>(null);
  const [pendingRefresh, setPendingRefresh] = React.useState(false);

  const [outcome, setOutcome] = React.useState<"YES" | "NO">("YES");
  const [coin, setCoin] = React.useState<number>(10);

  const quoteQ = useQuote({
    marketId: market.status === "OPEN" ? market.id : null,
    outcome,
    collateralCoin: coin,
    enabled: market.status === "OPEN"
  });

  async function onTrade() {
    if (market.status !== "OPEN") return;
    if (!session.apiKey) {
      setError("Please connect your wallet to trade");
      return;
    }

    const c = Number.isFinite(coin) ? Math.max(1, Math.floor(coin)) : 0;
    if (c <= 0) {
      setError("Trade amount must be at least 1 Coin");
      return;
    }

    setBusy(true);
    setError("");
    setPendingRefresh(false);
    
    try {
      const tradeResult = await apiPost<TradeResponse>(
        "/trades",
        {
          marketId: market.id,
          outcome,
          collateralCoin: c
        },
        { apiKey: session.apiKey }
      );
      
      // Show modal first, delay the refresh
      setResult(tradeResult);
      setModalOpen(true);
      setPendingRefresh(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  const closeModal = () => {
    setModalOpen(false);
    // Trigger refresh AFTER modal is closed
    if (pendingRefresh) {
      setTimeout(() => {
        onAfterTrade?.();
        setPendingRefresh(false);
        setResult(null);
      }, 300);
    }
  };

  const isOpen = market.status === "OPEN";
  const showModal = modalOpen && result !== null;

  return (
    <>
      <div className={`bg-surface rounded-lg border border-border overflow-hidden ${className}`}>
        {/* Header */}
        <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${!isOpen ? 'bg-danger/10' : ''}`}>
          <h3 className={`text-sm font-semibold ${!isOpen ? 'text-danger' : 'text-text-main'}`}>
            {!isOpen ? '⚠ Trading Closed' : 'Trade'}
          </h3>
          {isOpen && <span className="text-xs text-text-secondary">Fee: 1%</span>}
        </div>

        <div className="p-4 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded">
              {error}
            </div>
          )}

          {/* Outcome Selection */}
          <div className="space-y-2">
            <label className="text-xs text-text-secondary uppercase font-medium">Outcome</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOutcome("YES")}
                disabled={busy || !isOpen}
                className={`py-3 px-4 rounded-lg font-semibold text-sm transition-colors ${
                  outcome === "YES"
                    ? "bg-success text-bg-main"
                    : "bg-bg-secondary text-text-secondary hover:text-text-main border border-border"
                }`}
              >
                YES
              </button>
              <button
                onClick={() => setOutcome("NO")}
                disabled={busy || !isOpen}
                className={`py-3 px-4 rounded-lg font-semibold text-sm transition-colors ${
                  outcome === "NO"
                    ? "bg-danger text-white"
                    : "bg-bg-secondary text-text-secondary hover:text-text-main border border-border"
                }`}
              >
                NO
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-xs text-text-secondary uppercase font-medium">Amount (Coin)</label>
            <div className="relative">
              <input
                type="number"
                min={1}
                step={1}
                value={coin}
                onChange={(e) => setCoin(Number(e.target.value))}
                disabled={busy || !isOpen}
                className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-lg text-text-main focus:border-primary focus:outline-none transition-colors font-mono"
                placeholder="Enter amount"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">C</span>
            </div>
          </div>

          {/* Quote Preview */}
          <div className="bg-bg-secondary rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary uppercase">Quote</span>
              <span className="text-text-secondary">
                {quoteQ.loading ? "Loading…" : quoteQ.quote ? "Ready" : "—"}
              </span>
            </div>

            {quoteQ.error && (
              <div className="text-danger text-sm">{quoteQ.error}</div>
            )}

            {quoteQ.quote ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Est. Shares</span>
                  <span className="text-text-main font-mono">{fmtCoin(quoteQ.quote.sharesOutCoin)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Fee</span>
                  <span className="text-danger font-mono">{fmtCoin(quoteQ.quote.feeCoin)} C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">YES Price</span>
                  <span className="text-text-main font-mono">
                    {fmtPct01(quoteQ.quote.priceYesBefore)} → {fmtPct01(quoteQ.quote.priceYesAfter)}
                  </span>
                </div>
              </div>
            ) : (
              <div className={`text-sm ${!isOpen ? 'text-danger font-medium text-center py-2' : 'text-text-secondary'}`}>
                {!isOpen ? (
                  <>
                    <div className="text-lg mb-1">🏁</div>
                    <div>This market has been resolved.</div>
                    <div className="text-xs text-text-secondary mt-1">Positions have been settled.</div>
                  </>
                ) : "Enter amount to see quote"}
              </div>
            )}
          </div>

          {/* Trade Button */}
          <button
            onClick={() => void onTrade()}
            disabled={busy || !isOpen}
            className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
              !isOpen
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : outcome === "YES"
                  ? "bg-success hover:bg-success/90 text-bg-main"
                  : "bg-danger hover:bg-danger/90 text-white"
            }`}
          >
            {!isOpen ? "Market Resolved" : busy ? "Processing…" : `Buy ${outcome}`}
          </button>

          {!session.apiKey && (
            <p className="text-center text-xs text-text-secondary">
              Connect wallet to trade
            </p>
          )}
        </div>
      </div>

      {/* SUCCESS MODAL - PORTAL TO BODY */}
      {showModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={closeModal}
        >
          <div 
            className="w-full max-w-md bg-surface rounded-xl border border-border shadow-2xl"
            style={{ maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-success/10">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-white font-semibold">Trade Executed</h3>
              </div>
              <button
                onClick={closeModal}
                className="text-text-secondary hover:text-text-main transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Trade Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-secondary rounded-lg p-3">
                  <p className="text-text-tertiary text-xs uppercase mb-1">Outcome</p>
                  <p className={`text-sm font-bold ${outcome === "YES" ? "text-success" : "text-danger"}`}>
                    {outcome}
                  </p>
                </div>
                <div className="bg-bg-secondary rounded-lg p-3">
                  <p className="text-text-tertiary text-xs uppercase mb-1">Amount</p>
                  <p className="text-sm font-bold text-text-main">{fmtCoin(coin)} C</p>
                </div>
                <div className="bg-bg-secondary rounded-lg p-3">
                  <p className="text-text-tertiary text-xs uppercase mb-1">Shares</p>
                  <p className="text-sm font-bold text-text-main">{fmtCoin(result?.sharesOutCoin ?? 0)}</p>
                </div>
                <div className="bg-bg-secondary rounded-lg p-3">
                  <p className="text-text-tertiary text-xs uppercase mb-1">Fee</p>
                  <p className="text-sm font-bold text-danger">{fmtCoin(result?.feeCoin ?? 0)} C</p>
                </div>
              </div>

              {/* New Balance */}
              <div className="bg-success/5 border border-success/20 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-sm">New Balance</span>
                  <span className="text-xl font-bold text-success font-mono">
                    {fmtCoin(result?.balanceCoin ?? 0)} C
                  </span>
                </div>
              </div>

              {/* Position */}
              <div className="bg-bg-secondary rounded-lg p-4">
                <p className="text-text-tertiary text-xs uppercase mb-2">Position Update</p>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">YES Shares</span>
                  <span className="text-text-main font-mono">{fmtCoin(result?.position.yesSharesCoin ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-text-secondary">NO Shares</span>
                  <span className="text-text-main font-mono">{fmtCoin(result?.position.noSharesCoin ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-bg-secondary">
              <button
                onClick={closeModal}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-bg-main font-semibold rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import React from "react";

import { useMarkets } from "../hooks/useMarkets";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { usePortfolio } from "../hooks/usePortfolio";
import { fmtCoin, shortId } from "../lib/format";
import { Link } from "../router";
import { useSession } from "../state/session";

import { TopNavigation } from "../components/TopNavigation";
import { DepositModal } from "../components/DepositModal";
import { WithdrawModal } from "../components/WithdrawModal";
import { PaymentHistory } from "../components/PaymentHistory";

function rankForAccount(rows: Array<{ id: string }>, accountId: string): number | null {
  if (!accountId) return null;
  const idx = rows.findIndex((r) => r.id === accountId);
  if (idx < 0) return null;
  return idx + 1;
}

function pnlTextClass(pnlCoin: number): string {
  if (!Number.isFinite(pnlCoin) || pnlCoin === 0) return "text-text-secondary";
  return pnlCoin > 0 ? "text-success" : "text-danger";
}

export function DashboardPage() {
  const session = useSession();
  const marketsQ = useMarkets();
  const leaderboardQ = useLeaderboard({ sort: "balance" });
  const portfolioQ = usePortfolio(session.apiKey);

  const [isDepositOpen, setIsDepositOpen] = React.useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = React.useState(false);

  const selfAccountId = session.isHuman ? session.userId : session.agentId;
  const profileTo = session.isHuman ? `/user/${session.userId}` : `/agent/${session.agentId}`;

  const rank = rankForAccount(leaderboardQ.rows, selfAccountId);
  const totalAgents = leaderboardQ.rows.length;

  const totalEquity = portfolioQ.portfolio?.totalEquityCoin ?? portfolioQ.portfolio?.balanceCoin ?? 0;
  const balance = portfolioQ.portfolio?.balanceCoin ?? 0;
  const unrealizedPnl = portfolioQ.portfolio?.positions.reduce((sum, p) => sum + p.unrealizedPnlCoin, 0) ?? 0;

  return (
    <div className="min-h-screen bg-bg-main">
      <TopNavigation activePath="/dashboard" />

      <main className="max-w-[1600px] mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-text-main">
              {session.isLoggedIn 
                ? (session.isHuman ? "My Portfolio" : "Agent Dashboard")
                : "Dashboard"
              }
            </h1>
            {session.isLoggedIn && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded">
                {session.isHuman ? "HUMAN" : "AGENT"}
              </span>
            )}
          </div>
          <p className="text-text-secondary text-sm">
            Manage your portfolio, track positions, and monitor performance
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Equity */}
          <div className="bg-surface rounded-lg p-4 border border-border">
            <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Total Equity</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-text-main">{fmtCoin(totalEquity).split(".")[0]}</span>
              <span className="text-sm text-text-secondary">C</span>
            </div>
            <p className="text-text-tertiary text-xs mt-1">Balance + Positions</p>
          </div>

          {/* Available Balance */}
          <div className="bg-surface rounded-lg p-4 border border-border">
            <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Available Balance</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-text-main">{fmtCoin(balance).split(".")[0]}</span>
              <span className="text-sm text-text-secondary">C</span>
            </div>
            <div className="flex gap-2 mt-2">
              {session.isHuman && (
                <>
                  <button
                    onClick={() => setIsDepositOpen(true)}
                    className="px-3 py-1 bg-primary hover:bg-primary-hover text-bg-main text-xs font-semibold rounded transition-colors"
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => setIsWithdrawOpen(true)}
                    className="px-3 py-1 border border-border hover:border-text-secondary text-text-secondary hover:text-text-main text-xs font-semibold rounded transition-colors"
                  >
                    Withdraw
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Global Rank */}
          <div className="bg-surface rounded-lg p-4 border border-border">
            <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Global Rank</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-primary">
                {rank ? `#${String(rank).padStart(4, "0")}` : "—"}
              </span>
            </div>
            <p className="text-text-tertiary text-xs mt-1">of {totalAgents || "—"} traders</p>
          </div>

          {/* Unrealized PnL */}
          <div className="bg-surface rounded-lg p-4 border border-border">
            <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Unrealized PnL</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${pnlTextClass(unrealizedPnl)}`}>
                {unrealizedPnl > 0 ? "+" : ""}{fmtCoin(unrealizedPnl)}
              </span>
              <span className="text-sm text-text-secondary">C</span>
            </div>
            <p className="text-text-tertiary text-xs mt-1">From open positions</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Positions & History */}
          <div className="xl:col-span-2 space-y-6">
            {/* Active Positions */}
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-main">Active Positions</h2>
                <button
                  onClick={() => void portfolioQ.refresh()}
                  className="p-1.5 text-text-secondary hover:text-text-main hover:bg-surface-hover rounded transition-colors"
                  title="Refresh"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {!session.apiKey ? (
                <div className="p-8 text-center">
                  <p className="text-text-secondary text-sm">Connect your wallet to view positions</p>
                  <Link
                    to="/login"
                    className="inline-block mt-3 px-4 py-2 bg-primary hover:bg-primary-hover text-bg-main text-sm font-semibold rounded transition-colors"
                  >
                    Connect Wallet
                  </Link>
                </div>
              ) : portfolioQ.loading ? (
                <div className="p-8 text-center text-text-secondary text-sm">Loading positions…</div>
              ) : portfolioQ.error ? (
                <div className="p-8 text-center text-danger text-sm">{portfolioQ.error}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-bg-secondary text-text-secondary text-xs uppercase">
                        <th className="px-4 py-3 text-left font-medium">Market</th>
                        <th className="px-4 py-3 text-right font-medium">YES Shares</th>
                        <th className="px-4 py-3 text-right font-medium">NO Shares</th>
                        <th className="px-4 py-3 text-right font-medium">Cost</th>
                        <th className="px-4 py-3 text-right font-medium">Value</th>
                        <th className="px-4 py-3 text-right font-medium">PnL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(portfolioQ.portfolio?.positions ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-text-secondary text-sm">
                            No open positions
                          </td>
                        </tr>
                      ) : (
                        portfolioQ.portfolio!.positions.map((p) => (
                          <tr key={p.marketId} className="hover:bg-surface-hover/50 transition-colors">
                            <td className="px-4 py-3">
                              <Link
                                to={`/market/${p.marketId}`}
                                className="text-text-main font-medium hover:text-primary transition-colors"
                              >
                                {p.title}
                              </Link>
                              <span className="text-text-tertiary text-xs ml-2">{shortId(p.marketId)}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-success font-mono">{fmtCoin(p.yesSharesCoin)}</td>
                            <td className="px-4 py-3 text-right text-danger font-mono">{fmtCoin(p.noSharesCoin)}</td>
                            <td className="px-4 py-3 text-right text-text-secondary font-mono">{fmtCoin(p.costBasisCoin)}</td>
                            <td className="px-4 py-3 text-right text-text-main font-mono">{fmtCoin(p.markToMarketCoin)}</td>
                            <td className={`px-4 py-3 text-right font-mono ${pnlTextClass(p.unrealizedPnlCoin)}`}>
                              {p.unrealizedPnlCoin > 0 ? "+" : ""}{fmtCoin(p.unrealizedPnlCoin)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Position History */}
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-text-main">Position History</h2>
              </div>

              {!session.apiKey ? (
                <div className="p-8 text-center text-text-secondary text-sm">
                  Connect wallet to view history
                </div>
              ) : portfolioQ.loading ? (
                <div className="p-8 text-center text-text-secondary text-sm">Loading…</div>
              ) : portfolioQ.error ? (
                <div className="p-8 text-center text-danger text-sm">{portfolioQ.error}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-bg-secondary text-text-secondary text-xs uppercase">
                        <th className="px-4 py-3 text-left font-medium">Market</th>
                        <th className="px-4 py-3 text-center font-medium">Outcome</th>
                        <th className="px-4 py-3 text-right font-medium">Payout</th>
                        <th className="px-4 py-3 text-right font-medium">Cost</th>
                        <th className="px-4 py-3 text-right font-medium">Realized PnL</th>
                        <th className="px-4 py-3 text-center font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(portfolioQ.portfolio?.history ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-text-secondary text-sm">
                            No resolved positions
                          </td>
                        </tr>
                      ) : (
                        portfolioQ.portfolio!.history.map((h) => (
                          <tr key={h.marketId} className="hover:bg-surface-hover/50 transition-colors">
                            <td className="px-4 py-3">
                              <Link
                                to={`/market/${h.marketId}`}
                                className="text-text-main font-medium hover:text-primary transition-colors"
                              >
                                {h.title}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={h.outcome === "YES" ? "text-success" : "text-danger"}>
                                {h.outcome}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-text-main font-mono">{fmtCoin(h.payoutCoin)}</td>
                            <td className="px-4 py-3 text-right text-text-secondary font-mono">{fmtCoin(h.costBasisCoin)}</td>
                            <td className={`px-4 py-3 text-right font-mono ${pnlTextClass(h.realizedPnlCoin)}`}>
                              {h.realizedPnlCoin > 0 ? "+" : ""}{fmtCoin(h.realizedPnlCoin)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${
                                  h.result === "WIN"
                                    ? "bg-success/10 text-success"
                                    : "bg-danger/10 text-danger"
                                }`}
                              >
                                {h.result}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment History - Only for humans */}
            {session.isHuman && (
              <PaymentHistory apiKey={session.apiKey} />
            )}
          </div>

          {/* Right Column - Quick Markets & Account */}
          <div className="space-y-6">
            {/* Quick Markets */}
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-main">Trending Markets</h2>
                <Link
                  to="/markets"
                  className="text-xs text-primary hover:text-primary-hover font-medium"
                >
                  View All →
                </Link>
              </div>
              <div className="p-3 space-y-2">
                {marketsQ.loading ? (
                  <div className="p-4 text-center text-text-secondary text-sm">Loading markets…</div>
                ) : marketsQ.error ? (
                  <div className="p-4 text-center text-danger text-sm">{marketsQ.error}</div>
                ) : (
                  marketsQ.markets.slice(0, 5).map((m) => (
                    <Link
                      key={m.id}
                      to={`/market/${m.id}`}
                      className="block p-3 rounded bg-bg-secondary hover:bg-surface-hover border border-transparent hover:border-border transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-text-main text-sm font-medium truncate">{m.title}</p>
                          <p className="text-text-tertiary text-xs mt-0.5">
                            YES {Math.round(m.priceYes * 100)}¢ · NO {Math.round(m.priceNo * 100)}¢
                          </p>
                        </div>
                        <span className="text-success text-xs font-semibold">OPEN</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Account Info */}
            {session.isLoggedIn && (
              <div className="bg-surface rounded-lg border border-border p-4">
                <h2 className="text-sm font-semibold text-text-main mb-3">Account</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Type</span>
                    <span className="text-text-main font-medium">{session.isHuman ? "Human" : "Agent"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">ID</span>
                    <span className="text-text-main font-mono">{shortId(selfAccountId)}</span>
                  </div>
                  {session.walletAddress && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Wallet</span>
                      <span className="text-text-main font-mono">
                        {session.walletAddress.slice(0, 6)}...{session.walletAddress.slice(-4)}
                      </span>
                    </div>
                  )}
                </div>
                <Link
                  to={profileTo}
                  className="block mt-4 w-full text-center px-4 py-2 border border-border hover:border-text-secondary text-text-secondary hover:text-text-main text-sm font-medium rounded transition-colors"
                >
                  View Profile
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        apiKey={session.apiKey}
        onSuccess={() => {
          void portfolioQ.refresh();
          setIsDepositOpen(false);
        }}
      />
      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        apiKey={session.apiKey}
        balanceCoin={portfolioQ.portfolio?.balanceCoin ?? 0}
        onSuccess={() => {
          void portfolioQ.refresh();
          setIsWithdrawOpen(false);
        }}
      />
    </div>
  );
}

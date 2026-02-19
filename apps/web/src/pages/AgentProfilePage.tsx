import { useLeaderboard } from "../hooks/useLeaderboard";
import { useAgentPortfolio } from "../hooks/useAgentPortfolio";
import { fmtCoin, shortId } from "../lib/format";
import { Link } from "../router";
import { useSession } from "../state/session";

import { Icon } from "../components/Icon";

type Tier = "Shrimp" | "Dolphin" | "Whale";

function tierForBalance(balanceCoin: number): Tier {
  if (balanceCoin >= 1000) return "Whale";
  if (balanceCoin >= 100) return "Dolphin";
  return "Shrimp";
}

export function AgentProfilePage(props: { agentId: string }) {
  const session = useSession();
  const lbQ = useLeaderboard({ sort: "balance" });
  const isSelf = session.agentId && props.agentId === session.agentId;
  const portfolioQ = useAgentPortfolio(props.agentId);

  const idx = lbQ.rows.findIndex((r) => r.id === props.agentId);
  const row = idx >= 0 ? lbQ.rows[idx] : null;
  const rank = row?.rank ?? null;
  const tier = row ? tierForBalance(row.balanceCoin) : null;

  return (
    <div className="min-h-screen bg-background-dark text-white font-display">
      {/* Header (stitch: agent_reputation_&_p&l_profile) */}
      <header className="sticky top-0 z-20 border-b border-solid border-b-border-dark bg-background-dark">
        <div className="max-w-[1600px] mx-auto w-full px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between whitespace-nowrap">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 text-white">
              <div className="size-8 flex items-center justify-center text-lobster">
                <Icon name="rocket_launch" className="text-[28px]" />
              </div>
              <h2 className="text-white text-xl font-bold leading-tight tracking-[-0.015em] font-display">OpenSight</h2>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/dashboard" className="text-gray-400 hover:text-lobster text-sm font-medium transition-colors">
                Dashboard
              </Link>
              <Link to="/markets" className="text-gray-400 hover:text-lobster text-sm font-medium transition-colors">
                Arena
              </Link>
              <Link to="/leaderboard" className="text-gray-400 hover:text-lobster text-sm font-medium transition-colors">
                Leaderboard
              </Link>
              <span className="text-white text-sm font-medium border-b-2 border-lobster pb-0.5">Profile</span>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex w-64 items-center rounded-lg bg-card-dark border border-border-dark h-10 px-3">
              <Icon name="search" className="text-gray-500 text-[20px]" />
              <input
                className="w-full bg-transparent border-none text-white text-sm placeholder:text-gray-500 focus:ring-0 ml-2"
                placeholder="Search agents..."
              />
            </div>
            <div className="bg-gradient-to-br from-primary/50 to-purple-900/30 rounded-full size-9 ring-2 ring-border-dark" />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="flex justify-center py-6 px-4 md:px-8">
          <div className="w-full max-w-[1280px] flex flex-col gap-6">
            {/* Profile header card */}
            <div className="w-full bg-card-dark/50 border border-border-dark rounded-xl p-6 relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-lobster/10 rounded-full blur-[80px] group-hover:bg-lobster/20 transition-all duration-700" />
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center relative z-10">
                <div className="bg-gradient-to-br from-white/10 to-white/0 rounded-xl w-24 h-24 md:w-32 md:h-32 shadow-2xl border-2 border-border-dark shrink-0 flex items-center justify-center">
                  <span className="text-4xl opacity-80">🤖</span>
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                      {row?.displayName ?? "Agent"} <span className="text-gray-500">{shortId(props.agentId)}</span>
                    </h1>
                    {tier ? (
                      <span className="inline-flex items-center gap-1 bg-lobster/20 text-lobster border border-lobster/40 px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(232,59,70,0.3)]">
                        <Icon name="water_drop" className="text-[14px]" /> {tier}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-y-1 gap-x-6 text-gray-400 text-sm md:text-base">
                    <div className="flex items-center gap-2">
                      <Icon name="trophy" className="text-lobster text-[18px]" />
                      <span>
                        Rank <span className="text-white font-medium">{rank ? `#${rank}` : "—"}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="account_balance_wallet" className="text-lobster text-[18px]" />
                      <span>
                        Total Balance: <span className="text-white font-medium font-mono">{row ? fmtCoin(row.balanceCoin) : "—"} Coin</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="trending_up" className="text-green-500 text-[18px]" />
                      <span>
                        ROI: <span className="text-white font-medium">{row ? (row.roi * 100).toFixed(1) + "%" : "—"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-2 md:mt-0">
                  <button className="bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors" disabled>
                    Follow
                  </button>
                  <button
                    className="bg-lobster text-white hover:bg-red-600 px-4 py-2 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(232,59,70,0.4)] transition-all"
                    disabled
                  >
                    Copy Trade
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: chart + metrics */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <div className="rounded-xl border border-border-dark bg-card-dark p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-gray-400 text-sm font-medium mb-1">Equity Curve (P&L)</h3>
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-bold text-white tracking-tight">{row ? (row.roi * 100).toFixed(1) + "%" : "—"}</span>
                        <span className="text-lobster bg-lobster/10 px-2 py-0.5 rounded text-sm font-bold border border-lobster/20">
                          M0 placeholder
                        </span>
                      </div>
                    </div>
                    <div className="flex bg-[#111318] rounded-lg p-1 border border-border-dark">
                      <button className="px-3 py-1 text-xs font-medium text-white bg-border-dark rounded shadow-sm">1W</button>
                      <button className="px-3 py-1 text-xs font-medium text-gray-400 hover:text-white">1M</button>
                      <button className="px-3 py-1 text-xs font-medium text-gray-400 hover:text-white">ALL</button>
                    </div>
                  </div>
                  <div className="w-full h-[260px] relative">
                    <div className="absolute inset-0 grid grid-rows-4 w-full h-full pointer-events-none opacity-20">
                      <div className="border-t border-dashed border-gray-500 w-full" />
                      <div className="border-t border-dashed border-gray-500 w-full" />
                      <div className="border-t border-dashed border-gray-500 w-full" />
                      <div className="border-t border-dashed border-gray-500 w-full" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm font-mono">
                      No equity time-series yet (M0).
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-card-dark border border-border-dark p-5 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Icon name="analytics" className="text-4xl text-white" />
                    </div>
                    <p className="text-gray-400 text-sm font-medium">Win Rate</p>
                    <p className="text-3xl font-bold text-white">—</p>
                    <p className="text-xs text-gray-500 mt-1">M0: not tracked</p>
                  </div>
                  <div className="bg-card-dark border border-border-dark p-5 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Icon name="show_chart" className="text-4xl text-white" />
                    </div>
                    <p className="text-gray-400 text-sm font-medium">Sharpe Ratio</p>
                    <p className="text-3xl font-bold text-white">—</p>
                    <p className="text-xs text-gray-500 mt-1">Future slice</p>
                  </div>
                  <div className="bg-card-dark border border-border-dark p-5 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Icon name="history" className="text-4xl text-white" />
                    </div>
                    <p className="text-gray-400 text-sm font-medium">Total Trades</p>
                    <p className="text-3xl font-bold text-white">—</p>
                    <p className="text-xs text-gray-500 mt-1">Future slice</p>
                  </div>
                </div>
              </div>

              {/* Right: portfolio (self only) */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="rounded-xl border border-border-dark bg-card-dark p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-gray-400 text-sm">Public Portfolio</div>
                      <div className="text-white text-lg font-bold mt-1">Positions</div>
                    </div>
                    {isSelf ? (
                      <Link
                        to="/dashboard"
                        className="text-lobster text-xs font-mono hover:underline underline-offset-4"
                      >
                        open dashboard
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    {portfolioQ.loading ? (
                      <div className="text-gray-500 font-mono text-xs">Loading…</div>
                    ) : portfolioQ.error ? (
                      <div className="text-red-400 font-mono text-xs">{portfolioQ.error}</div>
                    ) : (portfolioQ.portfolio?.positions ?? []).length === 0 ? (
                      <div className="text-gray-500 font-mono text-xs">No open positions.</div>
                    ) : (
                      portfolioQ.portfolio!.positions.slice(0, 6).map((p) => {
                        const pnlCls = p.unrealizedPnlCoin >= 0 ? "text-neon-green" : "text-neon-red";
                        return (
                          <div key={p.marketId} className="border border-border-dark rounded-lg p-3 bg-[#111318]">
                            <Link to={`/market/${p.marketId}`} className="text-white font-bold text-sm truncate hover:text-lobster">
                              {p.title}
                            </Link>
                            <div className="mt-1 text-xs text-gray-400 font-mono">
                              YES {fmtCoin(p.yesSharesCoin)} · NO {fmtCoin(p.noSharesCoin)}
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-mono">
                              <div>
                                <div className="text-gray-500">COST</div>
                                <div className="text-gray-200">{fmtCoin(p.costBasisCoin)}</div>
                              </div>
                              <div>
                                <div className="text-gray-500">MTM</div>
                                <div className="text-white">{fmtCoin(p.markToMarketCoin)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-gray-500">UPNL</div>
                                <div className={`${pnlCls} font-bold`}>{(p.unrealizedPnlCoin > 0 ? "+" : "") + fmtCoin(p.unrealizedPnlCoin)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border-dark bg-card-dark p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-gray-400 text-sm">Position History</div>
                      <div className="text-white text-lg font-bold mt-1">Resolved</div>
                    </div>
                    <div className="text-gray-500 text-xs font-mono">WIN / LOSE</div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {portfolioQ.loading ? (
                      <div className="text-gray-500 font-mono text-xs">Loading…</div>
                    ) : portfolioQ.error ? (
                      <div className="text-red-400 font-mono text-xs">{portfolioQ.error}</div>
                    ) : (portfolioQ.portfolio?.history ?? []).length === 0 ? (
                      <div className="text-gray-500 font-mono text-xs">No resolved positions.</div>
                    ) : (
                      portfolioQ.portfolio!.history.map((h) => {
                        const pnlCls = h.realizedPnlCoin >= 0 ? "text-neon-green" : "text-neon-red";
                        const badgeCls =
                          h.result === "WIN"
                            ? "bg-neon-green/10 text-neon-green border-neon-green/20"
                            : "bg-neon-red/10 text-neon-red border-neon-red/20";
                        return (
                          <div key={h.marketId} className="border border-border-dark rounded-lg p-3 bg-[#111318]">
                            <Link to={`/market/${h.marketId}`} className="text-white font-bold text-sm truncate hover:text-lobster">
                              {h.title}
                            </Link>
                            <div className="mt-2 flex items-center justify-between text-xs font-mono">
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${badgeCls}`}>{h.result}</span>
                              <span className={`${pnlCls} font-bold`}>{(h.realizedPnlCoin > 0 ? "+" : "") + fmtCoin(h.realizedPnlCoin)} Coin</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-gray-400">
                              <span>Outcome: {h.outcome}</span>
                              <span>Payout {fmtCoin(h.payoutCoin)} / Cost {fmtCoin(h.costBasisCoin)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border-dark bg-card-dark p-5">
                  <div className="text-gray-400 text-sm">Agent ID</div>
                  <div className="mt-2 text-white font-mono text-sm break-all">{props.agentId}</div>
                  <div className="mt-4 flex gap-2">
                    <button
                      className="px-3 py-2 rounded-lg bg-lobster/10 text-lobster border border-lobster/30 text-xs font-bold"
                      onClick={() => void lbQ.refresh()}
                    >
                      Refresh
                    </button>
                    <Link
                      to="/leaderboard"
                      className="px-3 py-2 rounded-lg bg-white/5 text-gray-300 border border-border-dark text-xs font-bold"
                    >
                      Back
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

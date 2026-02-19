import React from "react";

import { useLeaderboard } from "../hooks/useLeaderboard";
import { fmtCoin, shortId } from "../lib/format";
import { Link } from "../router";
import type { Badge } from "../types";

import { TopNavigation } from "../components/TopNavigation";

type Tier = "SHRIMP" | "DOLPHIN" | "WHALE";

function tierForBalance(balanceCoin: number): Tier {
  if (balanceCoin >= 1000) return "WHALE";
  if (balanceCoin >= 100) return "DOLPHIN";
  return "SHRIMP";
}

function badgeStyle(badge: Badge): { bg: string; text: string; border: string } {
  switch (badge) {
    case "TOP_0.1%":
      return { bg: "bg-primary/20", text: "text-primary", border: "border-primary/40" };
    case "TOP_0.5%":
      return { bg: "bg-text-secondary/20", text: "text-text-secondary", border: "border-text-secondary/40" };
    case "TOP_1%":
      return { bg: "bg-warning/20", text: "text-warning", border: "border-warning/40" };
    case "TOP_5%":
      return { bg: "bg-success/20", text: "text-success", border: "border-success/40" };
    case "TOP_10%":
      return { bg: "bg-text-tertiary/20", text: "text-text-tertiary", border: "border-text-tertiary/40" };
    default:
      return { bg: "", text: "", border: "" };
  }
}

function sparkPath(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 12; i++) {
    h = (h + 0x9e3779b9) | 0;
    const r = (h >>> 0) / 0xffffffff;
    const x = (i / 11) * 100;
    const y = 24 - r * 20;
    pts.push([x, y]);
  }
  return pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

export function LeaderboardsPage() {
  const [view, setView] = React.useState<"wealth" | "returns">("wealth");
  const sort = view === "returns" ? "roi" : "balance";
  const lbQ = useLeaderboard({ sort });

  const [tierFilter, setTierFilter] = React.useState<Tier | "ALL">("ALL");
  const [search, setSearch] = React.useState<string>("");

  const rows = lbQ.rows.filter((r) => {
    if (tierFilter !== "ALL" && tierForBalance(r.balanceCoin) !== tierFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${r.displayName ?? ""} ${r.id} ${r.xHandle ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-bg-main">
      <TopNavigation activePath="/leaderboard" />

      <main className="max-w-[1600px] mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-main">Leaderboard</h1>
            <p className="text-text-secondary text-sm mt-1">
              Top {rows.length} traders ranked by {view === "wealth" ? "balance" : "ROI"}
            </p>
          </div>
          <button
            onClick={() => void lbQ.refresh()}
            className="self-start px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-text-secondary hover:text-text-main text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* View Tabs */}
          <div className="flex bg-surface rounded-lg p-1 border border-border">
            {[
              { value: "wealth" as const, label: "Balance" },
              { value: "returns" as const, label: "ROI" }
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setView(tab.value)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  view === tab.value
                    ? "bg-primary text-bg-main"
                    : "text-text-secondary hover:text-text-main"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search traders..."
                className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-text-main placeholder-text-tertiary focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Tier Filter */}
          <div className="flex bg-surface rounded-lg p-1 border border-border">
            {[
              { value: "ALL" as const, label: "All" },
              { value: "WHALE" as const, label: "Whale" },
              { value: "DOLPHIN" as const, label: "Dolphin" },
              { value: "SHRIMP" as const, label: "Shrimp" }
            ].map((tier) => (
              <button
                key={tier.value}
                onClick={() => setTierFilter(tier.value)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  tierFilter === tier.value
                    ? "bg-surface-elevated text-text-main"
                    : "text-text-secondary hover:text-text-main"
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-bg-secondary text-text-secondary text-xs uppercase">
                  <th className="px-4 py-3 text-center font-medium w-16">Rank</th>
                  <th className="px-4 py-3 text-left font-medium">Trader</th>
                  <th className="px-4 py-3 text-center font-medium">Tier</th>
                  <th className="px-4 py-3 text-center font-medium w-32">Trend</th>
                  <th className="px-4 py-3 text-right font-medium">ROI</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 text-center font-medium">Badge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {lbQ.loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-text-secondary">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading leaderboard…
                      </div>
                    </td>
                  </tr>
                ) : lbQ.error ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-danger">
                      {lbQ.error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-text-secondary">
                      No traders found matching your criteria
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const tier = tierForBalance(r.balanceCoin);
                    const tierCls =
                      tier === "WHALE"
                        ? "bg-primary/20 text-primary border-primary/40"
                        : tier === "DOLPHIN"
                          ? "bg-success/20 text-success border-success/40"
                          : "bg-text-tertiary/20 text-text-tertiary border-text-tertiary/40";
                    const roiCls = r.roi >= 0 ? "text-success" : "text-danger";
                    const bStyle = badgeStyle(r.badge);
                    const profileLink = r.accountType === "HUMAN" ? `/user/${r.id}` : `/agent/${r.id}`;

                    return (
                      <tr key={r.id} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-4 py-4 text-center">
                          {r.rank <= 3 ? (
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                              r.rank === 1 ? "bg-primary text-bg-main" :
                              r.rank === 2 ? "bg-text-secondary text-bg-main" :
                              "bg-text-tertiary text-bg-main"
                            }`}>
                              {r.rank}
                            </span>
                          ) : (
                            <span className="text-text-secondary font-mono">{r.rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {r.xAvatar ? (
                              <img
                                src={r.xAvatar}
                                alt=""
                                className="w-10 h-10 rounded-full border border-border"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-bg-secondary border border-border flex items-center justify-center text-sm font-bold text-text-main rounded-full">
                                {shortId(r.id).slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <Link to={profileLink} className="text-text-main font-medium hover:text-primary transition-colors">
                                {r.displayName ?? (r.xHandle ? `@${r.xHandle}` : shortId(r.id))}
                              </Link>
                              <span className="text-text-tertiary text-xs">
                                {r.accountType === "HUMAN" ? "Human" : "Agent"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold uppercase border rounded ${tierCls}`}>
                            {tier}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <svg className="w-24 h-8 mx-auto" viewBox="0 0 100 30" aria-label="sparkline">
                            <path
                              className={r.roi >= 0 ? "stroke-success" : "stroke-danger"}
                              d={sparkPath(r.id)}
                              fill="none"
                              strokeWidth="2"
                            />
                          </svg>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-mono font-medium ${roiCls}`}>
                            {(r.roi >= 0 ? "+" : "") + (r.roi * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-text-main font-mono font-medium">{fmtCoin(r.balanceCoin)}</span>
                          <span className="text-text-tertiary text-xs ml-1">C</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {r.badge ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-bold border rounded ${bStyle.bg} ${bStyle.text} ${bStyle.border}`}>
                              {r.badge}
                            </span>
                          ) : (
                            <span className="text-text-tertiary text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

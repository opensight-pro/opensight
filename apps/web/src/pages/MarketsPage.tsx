import React from "react";

import { useMarkets } from "../hooks/useMarkets";
import { fmtPct01 } from "../lib/format";

import { StatusPill } from "../components/StatusPill";
import { TopNavigation } from "../components/TopNavigation";

export function MarketsPage() {
  const marketsQ = useMarkets();
  const [q, setQ] = React.useState<string>("");
  const [status, setStatus] = React.useState<"OPEN" | "RESOLVED" | "ALL">("OPEN");

  const filtered = marketsQ.markets.filter((m) => {
    if (status !== "ALL" && m.status !== status) return false;
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return `${m.title} ${m.description ?? ""}`.toLowerCase().includes(qq);
  });

  return (
    <div className="min-h-screen bg-bg-main">
      <TopNavigation activePath="/markets" />

      <main className="max-w-[1600px] mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-main">Markets</h1>
            <p className="text-text-secondary text-sm mt-1">
              {marketsQ.markets.length} prediction markets available
            </p>
          </div>
          <button
            onClick={() => void marketsQ.refresh()}
            className="self-start px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-text-secondary hover:text-text-main text-sm font-medium rounded transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Status Tabs */}
          <div className="flex bg-surface rounded-lg p-1 border border-border">
            {[
              { value: "OPEN" as const, label: "Open" },
              { value: "RESOLVED" as const, label: "Resolved" },
              { value: "ALL" as const, label: "All" }
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value)}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  status === tab.value
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
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search markets..."
                className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-text-main placeholder-text-tertiary focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Markets Table */}
        <div className="bg-surface rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-bg-secondary text-text-secondary text-xs uppercase">
                  <th className="px-4 py-3 text-left font-medium w-16">#</th>
                  <th className="px-4 py-3 text-left font-medium">Market</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">YES Price</th>
                  <th className="px-4 py-3 text-right font-medium">NO Price</th>
                  <th className="px-4 py-3 text-right font-medium">Implied Odds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {marketsQ.loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-text-secondary">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading markets…
                      </div>
                    </td>
                  </tr>
                ) : marketsQ.error ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-danger">
                      {marketsQ.error}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-text-secondary">
                      No markets found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filtered.map((m, idx) => (
                    <tr
                      key={m.id}
                      onClick={() => {
                        window.location.hash = `#/market/${m.id}`;
                      }}
                      className="hover:bg-surface-hover/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-4 text-text-tertiary font-mono">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-text-main font-medium hover:text-primary transition-colors">
                            {m.title}
                          </span>
                          {m.description && (
                            <span className="text-text-tertiary text-xs mt-0.5 truncate max-w-md">
                              {m.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <StatusPill status={m.status} outcome={m.outcome} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-success font-mono font-medium">{fmtPct01(m.priceYes)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-danger font-mono font-medium">{fmtPct01(m.priceNo)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-success"
                              style={{ width: `${m.priceYes * 100}%` }}
                            />
                          </div>
                          <span className="text-text-secondary text-xs font-mono">
                            {Math.round(m.priceYes * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

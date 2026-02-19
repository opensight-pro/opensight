import React from "react";

import { useMarket } from "../hooks/useMarket";
import { useMarkets } from "../hooks/useMarkets";
import { useMarketTrades } from "../hooks/useMarketTrades";
import { usePortfolio } from "../hooks/usePortfolio";
import { fmtCoin, fmtPct01, shortId } from "../lib/format";
import { Link } from "../router";
import { useSession } from "../state/session";
import type { MarketTrade } from "../types";

import { MarketChart } from "../components/MarketChart";
import { Orderbook } from "../components/Orderbook";
import { StatusPill } from "../components/StatusPill";
import { TopNavigation } from "../components/TopNavigation";
import { TradeTicket } from "../components/TradeTicket";

// Generate mock trades to fill the list when there are few real trades
function generateMockTrades(marketId: string, count: number): MarketTrade[] {
  const now = Date.now();
  const mockTraders = [
    { id: "trader_a1b2", name: "AlphaBot" },
    { id: "trader_c3d4", name: "BetaTrade" },
    { id: "trader_e5f6", name: "GammaAI" },
    { id: "trader_g7h8", name: "DeltaFlow" },
    { id: "trader_i9j0", name: "EpsilonX" },
    { id: "trader_k1l2", name: "ZetaMind" },
    { id: "trader_m3n4", name: "EtaVision" },
    { id: "trader_o5p6", name: "ThetaEdge" }
  ];

  return Array.from({ length: count }, (_, i) => {
    const traderIndex = i % mockTraders.length;
    const trader = mockTraders[traderIndex] ?? mockTraders[0]!;
    const side = Math.random() > 0.5 ? "YES" : "NO";
    const volume = Math.floor(Math.random() * 90) + 10;
    
    return {
      id: `mock-${marketId}-${i}`,
      createdAt: new Date(now - (i + 1) * 3600000).toISOString(),
      accountType: "AGENT",
      traderId: trader.id,
      traderDisplayName: trader.name,
      side,
      action: "BUY",
      volumeCoin: volume,
      sharesOutCoin: volume * (0.9 + Math.random() * 0.2),
      priceYesAfter: side === "YES" ? 0.5 + Math.random() * 0.2 : 0.5 - Math.random() * 0.2
    };
  });
}

export function MarketTradingPage(props: { marketId: string }) {
  const session = useSession();
  const marketQ = useMarket(props.marketId);
  const marketsQ = useMarkets();
  const tradesQ = useMarketTrades(props.marketId, { limit: 25 });
  const portfolioQ = usePortfolio(session.apiKey);

  const market = marketQ.market;
  
  // Track orderbook prices for display
  const [orderbookPrices, setOrderbookPrices] = React.useState<{ bestBid: number; bestAsk: number } | null>(null);
  
  // Calculate display prices from orderbook
  // YES price = best ask (what you pay to buy YES)
  // NO price = 100¢ - best bid (implied NO price)
  const yesPrice = orderbookPrices ? orderbookPrices.bestAsk : (market?.priceYes ?? 0.5);
  const noPrice = orderbookPrices ? (1 - orderbookPrices.bestBid) : (market?.priceNo ?? 0.5);

  // Transform user's positions and history for this market into trade format
  const userTrades: MarketTrade[] = React.useMemo(() => {
    if (!portfolioQ.portfolio) return [];

    const trades: MarketTrade[] = [];
    const traderId = session.isHuman ? session.userId : session.agentId;
    const traderName = session.isHuman 
      ? (session.walletAddress ? `${session.walletAddress.slice(0, 6)}...${session.walletAddress.slice(-4)}` : "You")
      : (session.agentId ? `Agent_${shortId(session.agentId)}` : "You");

    portfolioQ.portfolio.positions
      .filter((p) => p.marketId === props.marketId)
      .forEach((p) => {
        if (p.yesSharesCoin > 0) {
          trades.push({
            id: `pos-yes-${p.marketId}`,
            createdAt: new Date().toISOString(),
            accountType: session.accountType || "AGENT",
            traderId: traderId || "you",
            traderDisplayName: traderName,
            side: "YES",
            action: "BUY",
            volumeCoin: p.costBasisCoin,
            sharesOutCoin: p.yesSharesCoin,
            priceYesAfter: p.markToMarketCoin / p.yesSharesCoin || 0.5
          });
        }
        if (p.noSharesCoin > 0) {
          trades.push({
            id: `pos-no-${p.marketId}`,
            createdAt: new Date().toISOString(),
            accountType: session.accountType || "AGENT",
            traderId: traderId || "you",
            traderDisplayName: traderName,
            side: "NO",
            action: "BUY",
            volumeCoin: p.costBasisCoin,
            sharesOutCoin: p.noSharesCoin,
            priceYesAfter: 1 - (p.markToMarketCoin / p.noSharesCoin || 0.5)
          });
        }
      });

    portfolioQ.portfolio.history
      .filter((h) => h.marketId === props.marketId)
      .forEach((h) => {
        trades.push({
          id: `hist-${h.marketId}-${h.lastTradeAt}`,
          createdAt: h.lastTradeAt,
          accountType: session.accountType || "AGENT",
          traderId: traderId || "you",
          traderDisplayName: traderName,
          side: h.outcome,
          action: "BUY",
          volumeCoin: h.costBasisCoin,
          sharesOutCoin: h.payoutCoin,
          priceYesAfter: h.outcome === "YES" ? 1 : 0
        });
      });

    return trades;
  }, [portfolioQ.portfolio, props.marketId, session]);

  // Combine all trades and add mocks if needed
  const recentTrades = React.useMemo(() => {
    const allTrades = [...tradesQ.trades, ...userTrades];
    allTrades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (allTrades.length < 5) {
      const mockCount = 5 - allTrades.length;
      const mocks = generateMockTrades(props.marketId, mockCount);
      allTrades.push(...mocks);
    }
    
    return allTrades.slice(0, 10);
  }, [tradesQ.trades, userTrades, props.marketId]);

  return (
    <div className="min-h-screen bg-bg-main">
      <TopNavigation activePath="/markets" />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {marketQ.loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-text-secondary">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading market…
            </div>
          </div>
        ) : marketQ.error ? (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-6">
            {marketQ.error}
          </div>
        ) : !market ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center">
            <p className="text-text-secondary">Market not found</p>
            <Link to="/markets" className="inline-block mt-4 text-primary hover:text-primary-hover font-medium">
              ← Back to Markets
            </Link>
          </div>
        ) : (
          <>
            {/* Market Header */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-surface border border-border rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusPill status={market.status} outcome={market.outcome} />
                    <span className="text-text-tertiary text-xs">Binary Market</span>
                  </div>
                  <h1 className="text-xl font-bold text-text-main">{market.title}</h1>
                  {market.description && (
                    <p className="text-text-secondary text-sm mt-1 max-w-2xl">{market.description}</p>
                  )}
                </div>
              </div>

              {/* Price Display - Using orderbook prices that jump live */}
              <div className="flex items-center gap-6 bg-surface rounded-lg px-6 py-4 border border-border">
                <div className="text-center min-w-[100px]">
                  <p className="text-text-tertiary text-xs uppercase mb-1">YES Ask</p>
                  <p className={`text-3xl font-bold ${market.status === 'RESOLVED' ? (market.outcome === 'YES' ? 'text-success' : 'text-gray-600') : 'text-success'} tabular-nums`}>
                    {market.status === 'RESOLVED' 
                      ? (market.outcome === 'YES' ? '$1.00' : '$0.00')
                      : `${Math.round(yesPrice * 100)}¢`
                    }
                  </p>
                  {market.status !== 'RESOLVED' && (
                    <p className="text-xs text-success/70 mt-1 flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Live
                    </p>
                  )}
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center min-w-[100px]">
                  <p className="text-text-tertiary text-xs uppercase mb-1">NO Implied</p>
                  <p className={`text-3xl font-bold ${market.status === 'RESOLVED' ? (market.outcome === 'NO' ? 'text-danger' : 'text-gray-600') : 'text-danger'} tabular-nums`}>
                    {market.status === 'RESOLVED' 
                      ? (market.outcome === 'NO' ? '$1.00' : '$0.00')
                      : `${Math.round(noPrice * 100)}¢`
                    }
                  </p>
                  {market.status !== 'RESOLVED' && (
                    <p className="text-xs text-danger/70 mt-1">100¢ - Bid</p>
                  )}
                </div>
              </div>
            </div>

            {/* Main Trading Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Chart & Trades */}
              <div className="lg:col-span-2 space-y-6">
                {/* Chart */}
                <div className="bg-surface rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-text-main">Price History</h2>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      YES
                      <span className="w-2 h-2 rounded-full bg-danger ml-2" />
                      NO
                    </div>
                  </div>
                  <div className="p-4">
                    <MarketChart marketId={market.id} />
                  </div>
                </div>

                {/* Market Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <p className="text-text-tertiary text-xs uppercase">YES {market.status === 'RESOLVED' ? 'Payout' : 'Ask'}</p>
                    <p className={`text-lg font-bold mt-1 ${market.status === 'RESOLVED' ? (market.outcome === 'YES' ? 'text-success' : 'text-gray-600') : 'text-success'}`}>
                      {market.status === 'RESOLVED' 
                        ? (market.outcome === 'YES' ? '$1.00' : '$0.00')
                        : fmtPct01(yesPrice)
                      }
                    </p>
                  </div>
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <p className="text-text-tertiary text-xs uppercase">NO {market.status === 'RESOLVED' ? 'Payout' : 'Implied'}</p>
                    <p className={`text-lg font-bold mt-1 ${market.status === 'RESOLVED' ? (market.outcome === 'NO' ? 'text-danger' : 'text-gray-600') : 'text-danger'}`}>
                      {market.status === 'RESOLVED' 
                        ? (market.outcome === 'NO' ? '$1.00' : '$0.00')
                        : fmtPct01(noPrice)
                      }
                    </p>
                  </div>
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <p className="text-text-tertiary text-xs uppercase">Trading Fee</p>
                    <p className="text-lg font-bold text-text-main mt-1">1%</p>
                  </div>
                  <div className="bg-surface rounded-lg p-4 border border-border">
                    <p className="text-text-tertiary text-xs uppercase">Status</p>
                    <p className={`text-lg font-bold mt-1 ${market.status === 'RESOLVED' ? 'text-danger' : 'text-primary'}`}>{market.status}</p>
                  </div>
                </div>

                {/* Recent Trades */}
                <div className="bg-surface rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-text-main">Recent Trades</h2>
                    <button
                      onClick={() => {
                        void tradesQ.refresh();
                        void portfolioQ.refresh();
                      }}
                      className="p-1.5 text-text-secondary hover:text-text-main hover:bg-surface-hover rounded transition-colors"
                      title="Refresh"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-bg-secondary text-text-secondary text-xs uppercase">
                          <th className="px-4 py-2 text-left font-medium">Type</th>
                          <th className="px-4 py-2 text-left font-medium">Trader</th>
                          <th className="px-4 py-2 text-right font-medium">Volume</th>
                          <th className="px-4 py-2 text-right font-medium">YES Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-sm">
                        {tradesQ.loading || portfolioQ.loading ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                              Loading trades…
                            </td>
                          </tr>
                        ) : recentTrades.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                              No recent trades
                            </td>
                          </tr>
                        ) : (
                          recentTrades.map((t) => {
                            const from = t.traderDisplayName ?? (t.accountType === "HUMAN" && t.xHandle ? `@${t.xHandle}` : shortId(t.traderId));
                            const isUserTrade = t.traderId === session.userId || t.traderId === session.agentId;
                            return (
                              <tr key={t.id} className={`hover:bg-surface-hover/50 transition-colors ${isUserTrade ? "bg-primary/5" : ""}`}>
                                <td className="px-4 py-3">
                                  <span className={t.side === "YES" ? "text-success font-medium" : "text-danger font-medium"}>
                                    {t.action} {t.side}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-text-main">
                                  {isUserTrade ? <span className="text-primary">{from} (You)</span> : from}
                                </td>
                                <td className="px-4 py-3 text-right text-text-secondary font-mono">{fmtCoin(t.volumeCoin)} C</td>
                                <td className="px-4 py-3 text-right text-text-main font-mono">{fmtPct01(t.priceYesAfter)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column - Trade Ticket, Orderbook & Related */}
              <div className="space-y-6">
                <TradeTicket
                  market={market}
                  onAfterTrade={() => {
                    void marketQ.refresh();
                    void marketsQ.refresh();
                    void tradesQ.refresh();
                    void portfolioQ.refresh();
                  }}
                />

                {/* Orderbook */}
                <Orderbook 
                  midPrice={market.priceYes} 
                  status={market.status} 
                  outcome={market.outcome}
                  onPriceUpdate={setOrderbookPrices}
                />

                {/* Related Markets */}
                <div className="bg-surface rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-main">More Markets</h2>
                  </div>
                  <div className="p-3 space-y-2">
                    {marketsQ.loading ? (
                      <div className="p-4 text-center text-text-secondary text-sm">Loading…</div>
                    ) : marketsQ.error ? (
                      <div className="p-4 text-center text-danger text-sm">{marketsQ.error}</div>
                    ) : (
                      marketsQ.markets
                        .filter((m) => m.id !== market.id)
                        .slice(0, 5)
                        .map((m) => (
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
                  <Link
                    to="/markets"
                    className="block w-full py-3 text-center text-sm text-primary hover:text-primary-hover font-medium border-t border-border hover:bg-surface-hover transition-colors"
                  >
                    View All Markets →
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

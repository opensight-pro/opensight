#!/usr/bin/env node
/**
 * Terminal Showcase - Simplified Version (No Boot Cinematic)
 * Press ←/→ to switch markets, r to resolve, q to quit
 */

import 'dotenv/config';
import blessed from 'blessed';
import { prisma } from './prisma.js';
import type { Market, MarketPool, Agent as DbAgent } from '@prisma/client';

// State
const state = {
  markets: [] as Array<Market & { pool: MarketPool | null }>,
  agents: [] as DbAgent[],
  selectedMarketIndex: 0,
  logs: [] as string[],
  tickCount: 0,
  totalTrades: 0,
  positions: new Map<string, Array<{agent: string, side: string, shares: number, pnl: number}>>(),
  resolutionResults: new Map<string, Array<{agent: string, side: string, shares: number, pnl: number, won: boolean}>>(),
};

// UI Components
let screen: blessed.Widgets.Screen;
let logBox: blessed.Widgets.BoxElement;
let marketBox: blessed.Widgets.BoxElement;
let orderbookBox: blessed.Widgets.BoxElement;
let positionsBox: blessed.Widgets.BoxElement;
let overviewBox: blessed.Widgets.BoxElement;

// Helper functions
function addLog(msg: string) {
  const now = new Date().toTimeString().slice(0, 8);
  state.logs.push(`[${now}] ${msg}`);
  if (state.logs.length > 50) state.logs.shift();
  renderLogs();
}

function generateOrderbook(midPrice: number) {
  const bids = [] as Array<{ price: number; size: number }>;
  const asks = [] as Array<{ price: number; size: number }>;
  for (let i = 0; i < 8; i++) {
    // Add some randomness to make it move
    const bidSize = Math.floor(Math.random() * 800) + 50;
    const askSize = Math.floor(Math.random() * 800) + 50;
    bids.push({ price: Math.max(1, midPrice - (i + 1) * 2 - Math.random() * 2), size: bidSize });
    asks.push({ price: Math.min(99, midPrice + (i + 1) * 2 + Math.random() * 2), size: askSize });
  }
  return { bids, asks };
}

// Agent action generators
const STRATEGIES = [
  { name: 'Momentum', phrases: ['Trend accelerating', 'Momentum building', 'Breakout detected'] },
  { name: 'Contrarian', phrases: ['Overbought signal', 'Oversold bounce', 'Mean reversion'] },
  { name: 'Mean-Reversion', phrases: ['Deviation detected', 'Statistical edge', 'Z-score trigger'] },
  { name: 'Trend-Follow', phrases: ['Higher highs', 'Support held', 'Moving avg cross'] },
  { name: 'News-Reactive', phrases: ['Sentiment shift', 'Whale movement', 'Volume spike'] },
  { name: 'Value', phrases: ['Mispricing found', 'Expected value+', 'Risk/reward sweet'] },
  { name: 'Scalper', phrases: ['Spread capture', 'Quick flip', 'Micro arb'] },
  { name: 'Fundamental', phrases: ['On-chain bullish', 'Adoption metric', 'Network growth'] },
];

async function generateAgentAction() {
  const agent = state.agents[Math.floor(Math.random() * state.agents.length)];
  if (!agent) return;
  
  const market = state.markets[state.selectedMarketIndex];
  if (!market || market.status === 'RESOLVED') return; // Skip resolved markets
  
  const strategy = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
  const side: 'YES' | 'NO' = Math.random() > 0.5 ? 'YES' : 'NO';
  const shares = Math.floor(Math.random() * 200) + 20;
  const price = (market.pool ? 
    Math.round((Number(market.pool.yesSharesMicros) / (Number(market.pool.yesSharesMicros) + Number(market.pool.noSharesMicros))) * 100) : 50);
  
  // Create trade in database
  const success = await createTrade(agent.id, market.id, side, shares, price);
  
  const phrase = strategy.phrases[Math.floor(Math.random() * strategy.phrases.length)];
  const color = side === 'YES' ? 'green-fg' : 'red-fg';
  const dbIcon = success ? '{gray-fg}♦{/gray-fg}' : '{red-fg}✗{/red-fg}';
  
  addLog(`${dbIcon} {cyan-fg}${agent.displayName?.slice(0, 10)}{/cyan-fg} ${phrase} → {${color}}${side} ${shares}@${price}¢{/${color}}`);
  state.totalTrades++;
}

function generateMatch() {
  if (state.agents.length < 2) return;
  
  const market = state.markets[state.selectedMarketIndex];
  if (!market || market.status === 'RESOLVED') return; // Skip resolved markets
  
  const buyer = state.agents[Math.floor(Math.random() * state.agents.length)];
  let seller = state.agents[Math.floor(Math.random() * state.agents.length)];
  while (seller.id === buyer.id) {
    seller = state.agents[Math.floor(Math.random() * state.agents.length)];
  }
  
  const shares = Math.floor(Math.random() * 100) + 10;
  const price = (Math.random() * 30 + 35).toFixed(1);
  const txHash = '0x' + Array.from({length: 6}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  
  addLog(`{green-fg}[MATCH]{/green-fg} ${buyer.displayName?.slice(0, 8)} ↔ ${seller.displayName?.slice(0, 8)} | ${shares} shares @ ${price}¢ {gray-fg}(${txHash}...){/gray-fg}`);
  state.totalTrades++;
}

function generateAttentionEvent() {
  const market = state.markets[state.selectedMarketIndex];
  if (!market || market.status === 'RESOLVED') return; // Skip resolved markets
  
  const activeCount = Math.floor(Math.random() * 4) + 4;
  const consensus = Math.random() > 0.4 ? 'BULLISH' : 'BEARISH';
  const strength = (Math.random() * 0.3 + 0.6).toFixed(2);
  
  addLog(`{yellow-fg}[ATTENTION]{/yellow-fg} ${activeCount}/8 agents active on this market`);
  addLog(`           Consensus: {${consensus === 'BULLISH' ? 'green-fg' : 'red-fg'}}${consensus}{/${consensus === 'BULLISH' ? 'green-fg' : 'red-fg'}} (confidence: ${strength})`);
}

async function loadPositionsFromDB() {
  const market = state.markets[state.selectedMarketIndex];
  if (!market) return;
  
  // Get IDs of simulated agents to filter positions
  const simulatedAgentIds = state.agents.map(a => a.id);
  
  const dbPositions = await prisma.position.findMany({
    where: { 
      marketId: market.id,
      agentId: { in: simulatedAgentIds }
    },
    include: { agent: true },
  });
  
  const positions = dbPositions
    .filter(p => p.yesSharesMicros > 0n || p.noSharesMicros > 0n)
    .map(p => {
      const side = p.yesSharesMicros > 0n ? 'YES' : 'NO';
      const shares = Number(p.yesSharesMicros > 0n ? p.yesSharesMicros : p.noSharesMicros) / 1000000;
      // Calculate mock PnL based on market price
      const marketPrice = market.pool ? 
        Number(market.pool.yesSharesMicros) / (Number(market.pool.yesSharesMicros) + Number(market.pool.noSharesMicros)) : 0.5;
      const entryPrice = 0.5; // Mock entry price
      const currentValue = side === 'YES' ? shares * marketPrice : shares * (1 - marketPrice);
      const cost = shares * entryPrice;
      const pnl = Math.floor((currentValue - cost) * 100);
      
      return { 
        agent: p.agent?.displayName || 'Unknown', 
        side, 
        shares: Math.floor(shares), 
        pnl 
      };
    });
  
  state.positions.set(market.id, positions);
}

// Initialize UI directly (no boot box)
function initUI() {
  screen = blessed.screen({
    smartCSR: true,
    title: 'OpenSight Terminal',
    fullUnicode: true,
  });

  const width = screen.width as number || 100;
  const height = screen.height as number || 30;
  
  const col1Width = Math.floor(width * 0.35);
  const col2Width = Math.floor(width * 0.35);
  const col3Width = width - col1Width - col2Width;
  const topRowHeight = Math.floor(height * 0.6);
  const bottomRowHeight = height - topRowHeight - 1;

  // Event Logs (top-left)
  logBox = blessed.box({
    parent: screen,
    top: 0, left: 0,
    width: col1Width, height: topRowHeight,
    label: ' {bold}Event Logs{/bold} ',
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan' } },
    scrollable: true, alwaysScroll: true, tags: true,
  });

  // Market Snapshot (top-middle)
  marketBox = blessed.box({
    parent: screen,
    top: 0, left: col1Width,
    width: col2Width, height: topRowHeight,
    label: ' {bold}Markets (use ←/→){/bold} ',
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan' } },
    tags: true,
  });

  // Orderbook (top-right)
  orderbookBox = blessed.box({
    parent: screen,
    top: 0, left: col1Width + col2Width,
    width: col3Width, height: topRowHeight,
    label: ' {bold}Orderbook{/bold} ',
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan' } },
    tags: true,
  });

  // Positions (bottom-left)
  positionsBox = blessed.box({
    parent: screen,
    top: topRowHeight, left: 0,
    width: col1Width + col2Width, height: bottomRowHeight,
    label: ' {bold}Positions{/bold} ',
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan' } },
    tags: true,
  });

  // System Overview (bottom-right)
  overviewBox = blessed.box({
    parent: screen,
    top: topRowHeight, left: col1Width + col2Width,
    width: col3Width, height: bottomRowHeight,
    label: ' {bold}Overview{/bold} ',
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan' } },
    tags: true,
  });

  // Help line at bottom
  blessed.box({
    parent: screen,
    bottom: 0, left: 0, width: '100%', height: 1,
    content: ' {gray-fg}[←/→] Switch Market  [r] Resolve  [q] Quit{/gray-fg}',
    tags: true, style: { fg: 'gray' },
  });

  // Keyboard handlers
  screen.key(['q', 'C-c'], () => {
    prisma.$disconnect().then(() => process.exit(0));
  });

  screen.key(['left'], async () => {
    state.selectedMarketIndex = Math.max(0, state.selectedMarketIndex - 1);
    await loadPositionsFromDB();
    renderAll();
  });

  screen.key(['right'], async () => {
    state.selectedMarketIndex = Math.min(state.markets.length - 1, state.selectedMarketIndex + 1);
    await loadPositionsFromDB();
    renderAll();
  });

  screen.key(['r'], async () => {
    await triggerResolution();
  });

  screen.on('resize', renderAll);
}

// Render functions
function renderLogs() {
  if (!logBox) return;
  logBox.setContent(state.logs.slice(-20).join('\n'));
}

function renderMarkets() {
  if (!marketBox || state.markets.length === 0) return;
  const header = '{bold}Market                        Ask  Status{/bold}';
  const rows = state.markets.map((m, idx) => {
    const selected = idx === state.selectedMarketIndex ? '{inverse}' : '';
    const selectedEnd = idx === state.selectedMarketIndex ? '{/inverse}' : '';
    const title = m.title.slice(0, 28).padEnd(28);
    // Show "Ask" price with slight jitter for live feel
    const basePrice = m.pool ? Math.round((Number(m.pool.yesSharesMicros) / (Number(m.pool.yesSharesMicros) + Number(m.pool.noSharesMicros))) * 100) : 50;
    // Add tiny jitter based on market index and time for live effect
    const jitter = Math.sin(Date.now() / 1000 + idx) * 1.5;
    const askPrice = m.status === 'RESOLVED' ? (m.outcome === 'YES' ? 100 : 0) : Math.max(1, Math.min(99, Math.round(basePrice + jitter)));
    const status = m.status === 'RESOLVED' ? '{red-fg}RESOLVED{/red-fg}' : '{green-fg}OPEN{/green-fg}';
    return `${selected}${title} ${askPrice.toString().padStart(3)}¢ ${status}${selectedEnd}`;
  });
  marketBox.setContent([header, ...rows].join('\n'));
}

function renderOrderbook() {
  if (!orderbookBox) return;
  const market = state.markets[state.selectedMarketIndex];
  if (!market) return;
  
  // If market is resolved, show resolution info instead of orderbook
  if (market.status === 'RESOLVED') {
    const lines: string[] = [];
    lines.push(`{center}{bold}${market.title.slice(0, 28)}{/bold}{/center}\n`);
    lines.push('');
    lines.push('{center}{red-fg}{bold}⚠ MARKET RESOLVED ⚠{/bold}{/red-fg}{/center}');
    lines.push('');
    lines.push(`{center}{bold}Outcome: {${market.outcome === 'YES' ? 'green-fg' : 'red-fg'}}${market.outcome}{/${market.outcome === 'YES' ? 'green-fg' : 'red-fg'}}{/bold}{/center}`);
    lines.push('');
    lines.push('{center}{gray-fg}Trading has been halted{/gray-fg}{/center}');
    orderbookBox.setContent(lines.join('\n'));
    return;
  }
  
  // Base mid price from pool
  const poolPrice = market.pool ? 
    Math.round((Number(market.pool.yesSharesMicros) / (Number(market.pool.yesSharesMicros) + Number(market.pool.noSharesMicros))) * 100) : 50;
  
  // Add time-based jitter for "live" jumping prices
  const jitter = Math.sin(Date.now() / 800) * 2 + (Math.random() - 0.5) * 1.5;
  const midPrice = Math.max(5, Math.min(95, poolPrice + jitter));
  
  const ob = generateOrderbook(midPrice);
  
  const bestAsk = ob.asks[0]?.price ?? midPrice;
  const bestBid = ob.bids[0]?.price ?? midPrice;
  
  const lines: string[] = [];
  lines.push(`{center}{bold}${market.title.slice(0, 26)}{/bold}{/center}`);
  
  // Show live YES price (best ask) prominently
  lines.push('');
  lines.push(`{center}{green-fg}{bold}YES Ask: ${bestAsk.toString().padStart(2)}¢{/bold}{/green-fg}{/center}`);
  lines.push(`{center}{red-fg}NO Implied: ${(100 - bestBid).toString().padStart(2)}¢{/red-fg}{/center}`);
  lines.push('');
  
  lines.push('{red-fg}{bold}   ASKS (Sell YES){/bold}{/red-fg}');
  [...ob.asks].reverse().forEach(a => {
    lines.push(`{red-fg}${a.price.toString().padStart(4)}¢ ${a.size.toString().padStart(6)}{/red-fg}`);
  });
  lines.push('');
  lines.push('{green-fg}{bold}   BIDS (Buy YES){/bold}{/green-fg}');
  ob.bids.forEach(b => {
    lines.push(`{green-fg}${b.price.toString().padStart(4)}¢ ${b.size.toString().padStart(6)}{/green-fg}`);
  });
  orderbookBox.setContent(lines.join('\n'));
}

function renderPositions() {
  if (!positionsBox) return;
  const market = state.markets[state.selectedMarketIndex];
  if (!market) return;
  
  // If market is resolved, show resolution results
  if (market.status === 'RESOLVED') {
    const results = state.resolutionResults.get(market.id) || [];
    
    const lines: string[] = [];
    lines.push(`{bold}${market.title.slice(0, 35)}{/bold}\n`);
    lines.push(`{center}{bold}Outcome: {${market.outcome === 'YES' ? 'green-fg' : 'red-fg'}}${market.outcome}{/${market.outcome === 'YES' ? 'green-fg' : 'red-fg'}}{/bold}{/center}\n`);
    lines.push('Agent           Side    Shares   Result');
    
    if (results.length === 0) {
      lines.push('{gray-fg}No positions recorded{/gray-fg}');
    } else {
      results.forEach(r => {
        const resultStr = r.won ? `+${r.pnl.toFixed(0)} 🏆` : `${r.pnl.toFixed(0)} ❌`;
        const resultColor = r.won ? 'green-fg' : 'red-fg';
        const sideColor = r.side === 'YES' ? 'green-fg' : 'red-fg';
        lines.push(`${r.agent.slice(0, 12).padEnd(12)} {${sideColor}}${r.side}{/${sideColor}} ${r.shares.toString().padStart(7)} {${resultColor}}${resultStr}{/${resultColor}}`);
      });
    }
    
    positionsBox.setContent(lines.join('\n'));
    return;
  }
  
  // Show active positions for unresolved markets
  const positions = state.positions.get(market.id) || [];
  
  const lines: string[] = [];
  lines.push(`{bold}${market.title.slice(0, 40)}{/bold}\n`);
  lines.push('Agent           Side    Shares   PnL');
  
  positions.forEach(pos => {
    const pnlStr = pos.pnl >= 0 ? `+${pos.pnl}` : `${pos.pnl}`;
    const pnlColor = pos.pnl >= 0 ? 'green-fg' : 'red-fg';
    const sideColor = pos.side === 'YES' ? 'green-fg' : 'red-fg';
    lines.push(`${pos.agent.slice(0, 12).padEnd(12)} {${sideColor}}${pos.side}{/${sideColor}} ${pos.shares.toString().padStart(7)} {${pnlColor}}${pnlStr.padStart(5)}{/${pnlColor}}`);
  });
  
  positionsBox.setContent(lines.join('\n'));
}

function renderOverview() {
  if (!overviewBox) return;
  const lines: string[] = [];
  lines.push('{bold}System Metrics{/bold}\n');
  lines.push(`Markets:    {cyan-fg}${state.markets.length}{/cyan-fg}`);
  lines.push(`Agents:     {cyan-fg}${state.agents.length}{/cyan-fg}`);
  lines.push(`Trades:     {cyan-fg}${state.totalTrades}{/cyan-fg}`);
  lines.push(`Selected:   {cyan-fg}#${state.selectedMarketIndex + 1}{/cyan-fg}`);
  lines.push('');
  lines.push('{bold}Top Agents{/bold}\n');
  state.agents.slice(0, 4).forEach(a => {
    const bal = Number(a.balanceMicros) / 1000000;
    lines.push(`${(a.displayName || 'Unknown').slice(0, 10).padEnd(10)} {cyan-fg}${bal.toFixed(0)}{/cyan-fg}`);
  });
  overviewBox.setContent(lines.join('\n'));
}

function renderAll() {
  renderLogs();
  renderMarkets();
  renderOrderbook();
  renderPositions();
  renderOverview();
  screen.render();
}

// Resolution
async function triggerResolution() {
  const market = state.markets[state.selectedMarketIndex];
  if (!market || market.status === 'RESOLVED') {
    addLog('{yellow-fg}Market already resolved or invalid{/yellow-fg}');
    return;
  }
  
  const outcome: 'YES' | 'NO' = Math.random() > 0.5 ? 'YES' : 'NO';
  addLog(`{green-fg}Resolving "${market.title.slice(0, 25)}..." → ${outcome}{/green-fg}`);
  
  try {
    // Update market status
    await prisma.market.update({
      where: { id: market.id },
      data: { status: 'RESOLVED', outcome },
    });
    market.status = 'RESOLVED';
    market.outcome = outcome;
    addLog('{cyan-fg}Market status updated{/cyan-fg}');
    
    // Calculate payouts and update agent balances (only for simulated agents)
    const simulatedAgentIds = state.agents.map(a => a.id);
    const positions = await prisma.position.findMany({
      where: { 
        marketId: market.id,
        agentId: { in: simulatedAgentIds }
      },
      include: { agent: true },
    });
    
    addLog(`Processing ${positions.length} simulated positions...`);
    
    // Store resolution results
    const results: Array<{agent: string, side: string, shares: number, pnl: number, won: boolean}> = [];
    
    for (const pos of positions) {
      const posSide = pos.yesSharesMicros > 0n ? 'YES' : 'NO';
      const shares = Number(pos.yesSharesMicros > 0n ? pos.yesSharesMicros : pos.noSharesMicros) / 1000000;
      const agentName = pos.agent?.displayName || 'Unknown';
      
      if (posSide === outcome) {
        // Winner - payout shares as collateral
        const payoutMicros = pos.yesSharesMicros > 0n ? pos.yesSharesMicros : pos.noSharesMicros;
        const pnl = shares; // Won their share amount
        
        if (pos.agentId) {
          await prisma.agent.update({
            where: { id: pos.agentId },
            data: { balanceMicros: { increment: payoutMicros } },
          });
          addLog(`  {green-fg}✓{/green-fg} ${agentName.slice(0, 10)} won +${pnl.toFixed(0)}`);
        }
        
        results.push({ agent: agentName, side: posSide, shares, pnl, won: true });
      } else {
        // Loser - position is worthless, lost their investment
        const pnl = -shares; // Lost their shares
        addLog(`  {red-fg}✗{/red-fg} ${agentName.slice(0, 10)} lost ${shares.toFixed(0)}`);
        
        results.push({ agent: agentName, side: posSide, shares, pnl, won: false });
      }
      
      // Clear the position
      await prisma.position.update({
        where: { id: pos.id },
        data: { 
          yesSharesMicros: 0n, 
          noSharesMicros: 0n 
        },
      });
    }
    
    // Store results for display
    state.resolutionResults.set(market.id, results);
    
    addLog('{cyan-fg}All payouts processed{/cyan-fg}');
    
    // Reload agents to get updated balances
    state.agents = await prisma.agent.findMany({
      where: { accountType: 'AGENT'},
      take: 8,
    });
    
    renderAll();
  } catch (e) {
    addLog(`{red-fg}Error: ${e}{/red-fg}`);
  }
}

// Market templates for fresh markets
const MARKET_TEMPLATES = [
  { title: 'BTC > $100k', price: 0.6 },
  { title: 'ETH ETF approved', price: 0.4 },
  { title: 'BNB > $750', price: 0.7 },
  { title: 'SOL > $200', price: 0.3 },
  { title: 'Crypto mcap > $3T', price: 0.5 },
  { title: 'Fed rate cut in Q2', price: 0.45 },
  { title: 'AI beats human at Go', price: 0.8 },
  { title: 'SpaceX lands on Mars', price: 0.25 },
  { title: 'Apple releases VR headset', price: 0.55 },
  { title: 'Tesla FSD approved', price: 0.35 },
];

// Simulated agent names - only these agents will be used in simulation
const SIMULATED_AGENT_NAMES = [
  'Agent_Alpha',
  'Agent_Bear',
  'Agent_Quant',
  'Agent_Scout',
  'Agent_Oracle',
  'Agent_Steady',
  'Agent_Flash',
  'Agent_Deep',
];

// Data loading
async function loadData() {
  addLog('Loading markets from database...');
  
  // Get only locally-created markets (not Polymarket-synced)
  // These have externalId = null
  const allMarkets = await prisma.market.findMany({
    where: { externalId: null },
    take: 20,
    orderBy: { createdAt: 'desc' },
    include: { pool: true },
  });
  
  // Separate open and resolved markets
  const openMarkets = allMarkets.filter(m => m.status === 'OPEN');
  const resolvedMarkets = allMarkets.filter(m => m.status === 'RESOLVED');
  
  addLog(`Found ${openMarkets.length} open, ${resolvedMarkets.length} resolved`);
  
  // Check if we need to create fresh markets (target: 5 open markets)
  const targetOpenMarkets = 5;
  const marketsNeeded = targetOpenMarkets - openMarkets.length;
  
  if (marketsNeeded > 0) {
    addLog(`Creating ${marketsNeeded} fresh markets...`);
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    
    // Create fresh markets
    for (let i = 0; i < marketsNeeded; i++) {
      const templateIndex = (openMarkets.length + i) % MARKET_TEMPLATES.length;
      const template = MARKET_TEMPLATES[templateIndex]!;
      
      const yesShares = Math.floor(template.price * 1000);
      const noShares = 1000 - yesShares;
      
      try {
        const newMarket = await prisma.market.create({
          data: {
            title: `${template.title} (${timestamp})`,
            description: 'Simulated multi-agent prediction market',
            status: 'OPEN',
            outcome: 'UNRESOLVED',
            pool: {
              create: {
                collateralMicros: 0n,
                yesSharesMicros: BigInt(yesShares * 1000000),
                noSharesMicros: BigInt(noShares * 1000000),
                feeBps: 100,
              },
            },
          },
          include: { pool: true },
        });
        
        openMarkets.push(newMarket);
        addLog(`  ✓ Created: ${newMarket.title.slice(0, 40)}`);
      } catch (e) {
        addLog(`  ✗ Failed to create market: ${e}`);
      }
    }
  }
  
  // Use only open markets for the simulation
  state.markets = openMarkets.slice(0, targetOpenMarkets);
  addLog(`Active markets: ${state.markets.length}`);

  addLog('Loading agents...');
  // Only load simulated agents (not real user agents)
  state.agents = await prisma.agent.findMany({
    where: { 
      accountType: 'AGENT',
      displayName: { in: SIMULATED_AGENT_NAMES }
    },
    take: 8,
  });
  addLog(`Loaded ${state.agents.length} simulated agents`);
  
  // Create agents if less than 8 exist
  if (state.agents.length < 8) {
    addLog('Creating missing simulated agents...');
    const agentConfigs = [
      { name: 'Agent_Alpha', strategy: 'Momentum', accuracy: 81 },
      { name: 'Agent_Bear', strategy: 'Contrarian', accuracy: 74 },
      { name: 'Agent_Quant', strategy: 'Mean-Reversion', accuracy: 88 },
      { name: 'Agent_Scout', strategy: 'Trend-Follow', accuracy: 79 },
      { name: 'Agent_Oracle', strategy: 'News-Reactive', accuracy: 72 },
      { name: 'Agent_Steady', strategy: 'Value', accuracy: 85 },
      { name: 'Agent_Flash', strategy: 'Scalper', accuracy: 69 },
      { name: 'Agent_Deep', strategy: 'Fundamental', accuracy: 83 },
    ];
    
    // Get existing agent names
    const existingNames = new Set(state.agents.map(a => a.displayName));
    
    for (const config of agentConfigs) {
      // Skip if agent already exists
      if (existingNames.has(config.name)) {
        continue;
      }
      
      try {
        const agent = await prisma.agent.create({
          data: {
            displayName: config.name,
            balanceMicros: 1000n * 1000000n,
            accountType: 'AGENT',
          },
        });
        state.agents.push(agent);
        addLog(`  ✓ Created ${config.name}`);
      } catch (e) {
        addLog(`  ✗ Failed to create ${config.name}: ${e}`);
      }
    }
    addLog(`Created ${state.agents.length} agents`);
  }
  
  // Inject positions into database for active markets
  await injectPositions();
}

// Inject positions into database
async function injectPositions() {
  addLog('Injecting positions into database...');
  
  for (const market of state.markets) {
    for (const agent of state.agents) {
      // Check if position already exists for this agent+market
      const existing = await prisma.position.findFirst({
        where: { agentId: agent.id, marketId: market.id },
      });
      
      if (existing) continue; // Skip if exists
      
      // Create new position
      const side = Math.random() > 0.5 ? 'YES' : 'NO';
      const shares = Math.floor(Math.random() * 800) + 100;
      const sharesMicros = BigInt(shares * 1000000);
      
      try {
        await prisma.position.create({
          data: {
            agentId: agent.id,
            marketId: market.id,
            yesSharesMicros: side === 'YES' ? sharesMicros : 0n,
            noSharesMicros: side === 'NO' ? sharesMicros : 0n,
          },
        });
      } catch (e) {
        // Ignore errors
      }
    }
  }
  
  // Count total positions
  const count = await prisma.position.count();
  addLog(`Total positions in DB: ${count}`);
}

// Create a trade in the database
async function createTrade(agentId: string, marketId: string, side: 'YES' | 'NO', shares: number, price: number) {
  try {
    const collateral = Math.floor(shares * price / 100);
    const collateralMicros = BigInt(collateral * 1000000);
    const feeMicros = collateralMicros / 100n; // 1% fee
    const sharesMicros = BigInt(shares * 1000000);
    
    await prisma.trade.create({
      data: {
        agentId,
        marketId,
        side,
        collateralInMicros: collateralMicros,
        feeMicros,
        sharesOutMicros: sharesMicros,
        poolCollateralMicros: 0n,
        poolYesSharesMicros: 0n,
        poolNoSharesMicros: 0n,
      },
    });
    
    // Update position
    const position = await prisma.position.findFirst({
      where: { agentId, marketId },
    });
    
    if (position) {
      await prisma.position.update({
        where: { id: position.id },
        data: side === 'YES' 
          ? { yesSharesMicros: position.yesSharesMicros + sharesMicros }
          : { noSharesMicros: position.noSharesMicros + sharesMicros },
      });
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

// Main
async function main() {
  try {
    // Initialize UI immediately
    initUI();
    
    // Show initial message
    addLog('{green-fg}OpenSight Terminal v1.0{/green-fg}');
    addLog('Connecting to database...');
    
    // Load data
    await loadData();
    
    if (state.markets.length === 0) {
      addLog('{yellow-fg}No markets found! Run simple-demo.ts first{/yellow-fg}');
    }
    
    // Initial render
    renderAll();
    
    // Load positions from DB
    await loadPositionsFromDB();
    
    // Start tick loop for live updates
    setInterval(() => {
      state.tickCount++;
      
      // Agent action (60% chance per tick)
      if (Math.random() < 0.6) {
        void generateAgentAction();
      }
      
      // Match event (20% chance per tick)
      if (Math.random() < 0.2) {
        generateMatch();
      }
      
      // Attention summary every 20 ticks (~20 seconds)
      if (state.tickCount % 20 === 0) {
        generateAttentionEvent();
      }
      
      // Update orderbook (every tick for live feel)
      renderOrderbook();
      
      // Reload positions periodically (every 5 ticks)
      if (state.tickCount % 5 === 0) {
        void loadPositionsFromDB().then(() => renderPositions());
      }
      
      // Update overview (trade count)
      renderOverview();
      
      renderLogs();
      screen.render();
    }, 1000);
    
  } catch (error) {
    addLog(`{red-fg}Fatal error: ${error}{/red-fg}`);
    screen.render();
    setTimeout(() => process.exit(1), 3000);
  }
}

main();

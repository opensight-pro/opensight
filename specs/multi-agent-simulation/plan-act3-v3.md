# Act 3 v3 - Simulation with Seeded Markets (Per-Run Creation)

**Runtime:** 50 seconds  
**Approach:** Create 5 fresh markets each run → inject agent data → trade → resolve

---

## Problem with v2

If we create 5 markets on first run and resolve them all → subsequent runs have 0 open markets.

## Solution

**Create 5 NEW markets every run** (with unique names/timestamps)

```
Run 1: "BTC > $100k by Feb 18 14:00" → resolves
Run 2: "BTC > $100k by Feb 18 14:05" → resolves  
Run 3: "BTC > $100k by Feb 18 14:10" → resolves
...
```

This gives us:
- Fresh markets every time (no "already resolved" issues)
- Accumulated history of past markets
- Realistic time-based market titles

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SIMULATION FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RUN 1                                                      │
│  ├── Create 5 NEW markets (with timestamps)                 │
│  ├── Create 8 agents (or reuse existing)                    │
│  ├── Inject positions for these 5 markets                   │
│  ├── Inject trades for these 5 markets                      │
│  ├── Show simulation logs                                   │
│  └── Resolve markets → update DB                            │
│                                                             │
│  RUN 2                                                      │
│  ├── Create 5 NEW markets (different timestamps)            │
│  ├── Reuse same 8 agents                                    │
│  ├── Inject positions for these NEW markets                 │
│  ├── Inject trades for these NEW markets                    │
│  ├── Show simulation logs                                   │
│  └── Resolve markets → update DB                            │
│                                                             │
│  DATABASE                                                   │
│  ├── Markets: 5 (run 1) + 5 (run 2) + ...                   │
│  ├── Agents: Same 8 agents throughout                       │
│  ├── Positions: Only for current run's markets              │
│  └── Trades: Only for current run's markets                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Market Creation (Per Run)

### Market Titles (Auto-generated)

```typescript
const timestamp = new Date().toISOString().slice(11, 16); // "14:30"
const date = new Date().toISOString().slice(0, 10);       // "2024-02-18"

const marketTemplates = [
  `BTC > $100k by ${date} ${timestamp}`,
  `ETH ETF approved by ${date} ${timestamp}`,
  `BNB > $750 by ${date} ${timestamp}`,
  `SOL > $200 by ${date} ${timestamp}`,
  `Total crypto market cap > $3T by ${date} ${timestamp}`,
];
```

This ensures unique markets each run.

### Market Creation Code

```typescript
// Always create 5 new markets
const now = new Date();
const marketTitles = [
  `BTC > $100k (${now.toISOString()})`,
  `ETH ETF (${now.toISOString()})`,
  `BNB > $750 (${now.toISOString()})`,
  `SOL > $200 (${now.toISOString()})`,
  `Crypto mcap > $3T (${now.toISOString()})`,
];

for (const title of marketTitles) {
  const market = await prisma.market.create({
    data: {
      title,
      description: 'Simulated prediction market',
      status: 'OPEN',
      outcome: 'UNRESOLVED',
      pool: {
        create: {
          collateralMicros: 0n,
          yesSharesMicros: 500000000n,  // 500 YES shares
          noSharesMicros: 500000000n,   // 500 NO shares
          feeBps: 100,  // 1%
        },
      },
    },
    include: { pool: true },
  });
  state.markets.push(market);
}
```

---

## Idempotency Strategy

### What Gets Reused (Idempotent)
- **Agents**: Created once, reused forever
  ```typescript
  // Check by displayName
  const existing = await prisma.agent.findFirst({
    where: { displayName: 'Agent_Alpha' }
  });
  ```

### What Gets Created Fresh (Per Run)
- **Markets**: 5 new markets every run
- **Positions**: Created for current run's markets only
- **Trades**: Created for current run's markets only

### What Gets Cleaned Up (Optional)
After many runs, you may want to clean up old simulated data:
```sql
-- Remove old simulated markets (keep last 10)
DELETE FROM "Market" 
WHERE "title" LIKE '%2024-02-18%'
AND id NOT IN (SELECT id FROM "Market" ORDER BY "createdAt" DESC LIMIT 10);
```

---

## Implementation Plan

### Step 1: Modify Boot Sequence

**Current:** Read 5 markets from DB  
**New:** Create 5 fresh markets in DB

```typescript
// In runBootSequence()
await typeText(bootContent, '{cyan-fg}[DB]{/cyan-fg} Creating 5 fresh prediction markets...\n', 10);

const now = new Date();
const marketTemplates = [
  { title: `BTC > $100k (${now.toISOString()})`, initialPrice: 0.6 },
  { title: `ETH ETF approved (${now.toISOString()})`, initialPrice: 0.4 },
  { title: `BNB > $750 (${now.toISOString()})`, initialPrice: 0.7 },
  { title: `SOL > $200 (${now.toISOString()})`, initialPrice: 0.3 },
  { title: `Crypto mcap > $3T (${now.toISOString()})`, initialPrice: 0.5 },
];

for (const template of marketTemplates) {
  const yesShares = Math.floor(template.initialPrice * 1000);
  const noShares = 1000 - yesShares;
  
  const dbMarket = await prisma.market.create({
    data: {
      title: template.title,
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
  
  state.markets.push({
    id: dbMarket.id,
    title: dbMarket.title,
    priceYes: template.initialPrice,
    priceNo: 1 - template.initialPrice,
    dbRecord: dbMarket,
  });
  
  await typeText(bootContent, `  {gray-fg}- ${template.title.slice(0, 40)}...{/gray-fg}\n`, 8);
}

await typeText(bootContent, `{green-fg}[DB]{/green-fg} Created 5 fresh markets\n\n`, 10);
```

### Step 2: Positions (Per Run)

Only create positions for current run's markets:

```typescript
async function injectPositions(): Promise<void> {
  // Positions are always created fresh for this run's markets
  // (markets are new, so no need to check for existing positions)
  
  for (const agent of state.agents) {
    for (const market of state.markets) {
      const side = Math.random() > 0.5 ? 'yes' : 'no';
      const shares = Math.floor(Math.random() * 500) + 100;
      
      await prisma.position.create({
        data: {
          agentId: agent.id,
          marketId: market.id,
          yesSharesMicros: side === 'yes' ? BigInt(shares * 1000000) : 0n,
          noSharesMicros: side === 'no' ? BigInt(shares * 1000000) : 0n,
        },
      });
    }
  }
}
```

### Step 3: Trades (Per Run)

Same approach - fresh trades for fresh markets.

### Step 4: Resolution

When 'r' is pressed:
1. Resolve current run's markets
2. Update agent balances
3. Markets now show as RESOLVED in Web UI

---

## Demo Scenarios

### Scenario A: Fresh Demo
```
Run terminal
→ Creates 5 new markets
→ Creates/reuses 8 agents  
→ Injects positions/trades
→ Shows simulation
→ Press 'r' to resolve
→ All 5 markets resolved
```

### Scenario B: Second Demo (Same Day)
```
Run terminal again
→ Creates 5 NEW markets (different timestamps)
→ Reuses same 8 agents
→ Injects positions/trades for NEW markets
→ Shows simulation
→ Press 'r' to resolve
→ Now have 10 markets total (5 resolved + 5 resolved)
```

### Scenario C: Web UI Shows History
```
Web UI markets page:
- 10 resolved markets from past runs
- User can click to see trade history
- Leaderboard shows cumulative agent performance
```

---

## Files to Modify

1. `scripts/terminal-showcase.ts`
   - Replace `prisma.market.findMany()` with `prisma.market.create()`
   - Remove position/trade existence checks (always create fresh)

---

## Benefits

✅ **Always fresh markets** - No "already resolved" problems  
✅ **Accumulated history** - Past markets visible in Web UI  
✅ **Realistic** - Markets have timestamps like real markets  
✅ **Simple** - No complex cleanup logic  
✅ **Web UI always works** - Always has open markets to show  

---

## Cleanup Strategy (Optional)

If database gets too full of old simulated markets:

```bash
# Add a cleanup command
pnpm --filter @opensight/terminal-showcase cleanup
```

```typescript
// cleanup.ts
async function cleanup() {
  // Delete simulated markets older than 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  await prisma.market.deleteMany({
    where: {
      title: { contains: '2024-' }, // Our timestamp pattern
      createdAt: { lt: cutoff },
      status: 'RESOLVED',
    },
  });
}
```

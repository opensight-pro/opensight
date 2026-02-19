# Act 3 - Multi-Agent Simulation v2 (Hybrid Approach)

**Runtime:** 50 seconds  
**Approach:** Terminal reads real markets, injects simulated agent data into DB, Web UI reflects injected data

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HYBRID DEMO SETUP                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TERMINAL                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Read 5 markets from DB (real data)              │   │
│  │  2. Create 8 simulated agents                       │   │
│  │  3. Inject positions into DB                        │   │
│  │  4. Inject/update portfolio (PnL)                   │   │
│  │  5. Generate trade history                          │   │
│  │  6. Show narrative logs                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  DATABASE (PostgreSQL)                                      │
│  ┌─────────────┬──────────────┬─────────────────────────┐  │
│  │ markets     │ positions    │ trades (injected)       │  │
│  │ (real)      │ (injected)   │ portfolio (injected)    │  │
│  └─────────────┴──────────────┴─────────────────────────┘  │
│                         │                                   │
│                         ▼                                   │
│  WEB UI                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  - Shows real markets (from DB)                     │   │
│  │  - Shows injected positions                         │   │
│  │  - Shows injected trade history                     │   │
│  │  - Shows injected PnL                               │   │
│  │  - Orderbook matches market price                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Step 1: Terminal DB Connection (30 min)

**File:** `scripts/terminal-showcase.ts`

Add Prisma client to terminal:
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

**Tasks:**
- [ ] Add `@prisma/client` dependency to scripts/package.json
- [ ] Import and initialize Prisma client
- [ ] Add `.env` loading for DATABASE_URL

---

### Step 2: Read Real Markets (15 min)

**Query:**
```typescript
const markets = await prisma.market.findMany({
  where: { status: 'OPEN' },
  include: { pool: true },
  take: 5,
  orderBy: { createdAt: 'desc' }
});
```

**Tasks:**
- [ ] Query 5 open markets from DB
- [ ] Map to terminal market format
- [ ] Display real market titles in terminal

---

### Step 3: Create Simulated Agents (20 min)

**Agent Data Structure:**
```typescript
interface SimAgent {
  id: string;           // UUID
  name: string;         // Agent_Alpha, etc.
  strategy: string;
  accuracy: number;
  displayName: string;
}
```

**Tasks:**
- [ ] Define 8 agents with strategies
- [ ] Generate UUIDs for each
- [ ] Display in boot sequence

---

### Step 4: Inject Positions into DB (45 min)

**For each agent + market combo:**
```typescript
// Create position record
await prisma.position.create({
  data: {
    agentId: agent.id,
    marketId: market.id,
    yesSharesMicros: BigInt(yesShares * 1000000),
    noSharesMicros: BigInt(noShares * 1000000),
  }
});
```

**Tasks:**
- [ ] Generate random positions for each agent
- [ ] Calculate cost basis and PnL
- [ ] Inject into Position table
- [ ] Update Agent balance

---

### Step 5: Inject Trade History (30 min)

**Trade records:**
```typescript
await prisma.trade.create({
  data: {
    agentId: agent.id,
    marketId: market.id,
    side: 'YES' | 'NO',
    collateralInMicros: BigInt(amount * 1000000),
    feeMicros: BigInt(fee * 1000000),
    sharesOutMicros: BigInt(shares * 1000000),
    createdAt: new Date(),
  }
});
```

**Tasks:**
- [ ] Generate 3-5 trades per agent
- [ ] Vary timestamps (recent history)
- [ ] Link to real markets

---

### Step 6: Orderbook Visualization (20 min)

**Current orderbook:** Mock data around midPrice  
**Update:** Use real market price from DB

```typescript
const midPrice = market.pool.yesSharesMicros / 
  (market.pool.yesSharesMicros + market.pool.noSharesMicros);
```

**Tasks:**
- [ ] Read pool data for price calculation
- [ ] Generate orderbook around real price
- [ ] Keep visual bars (already implemented)

---

### Step 7: Terminal Display Updates (30 min)

**Positions Tab:**
- Query: `prisma.position.findMany({ include: { agent: true, market: true } })`
- Show real injected positions

**Logs:**
- Keep narrative logs (Agent_XXX did Y)
- Add [DB] prefix for DB operations

**Example:**
```
[DB] Injected 5 positions for Agent_Alpha
[DB] Updated Agent_Bear PnL: +45.2 Coin
[Agent_Alpha] Analyzing BNB market...
```

---

### Step 8: Resolution Mode (30 min)

**When 'r' pressed:**
1. Show terminal resolution logs
2. Update positions in DB (mark as settled)
3. Update agent balances
4. Web UI auto-reflects changes

```typescript
await prisma.position.updateMany({
  where: { marketId: selectedMarket },
  data: { /* settlement */ }
});
```

---

## Database Schema Usage

### Tables to Read
- `Market` - Real market data
- `MarketPool` - Price info

### Tables to Write
- `Position` - Simulated positions
- `Trade` - Simulated trade history
- `Agent` - Update balances

### No Changes To
- `User` (human accounts)
- `Payment` (deposits/withdrawals)
- `ApiKey` (auth)

---

## Checklist

### Setup
- [ ] Add Prisma client to scripts
- [ ] Configure DATABASE_URL in scripts/.env
- [ ] Test DB connection

### Terminal Implementation
- [ ] Read 5 real markets on startup
- [ ] Create 8 simulated agents
- [ ] Inject positions for each agent
- [ ] Inject trade history
- [ ] Update orderbook to use real prices
- [ ] Show DB operations in logs
- [ ] Resolution mode updates DB

### Web UI Verification
- [ ] Markets page shows real markets
- [ ] Positions show injected data
- [ ] Trade history shows injected trades
- [ ] PnL calculations work
- [ ] Leaderboard reflects agent balances

### Demo Flow
- [ ] Record terminal boot + injection
- [ ] Record web UI showing injected data
- [ ] Record resolution updating DB
- [ ] Composite side-by-side

---

## Example Demo Flow

```
TERMINAL                    DATABASE              WEB UI
─────────                   ────────              ──────
Boot sequence
$ opensight simulate
[BOOT] Reading markets...   ← SELECT * FROM markets
[DB] Found: BNB > $750
[DB] Found: ETH ETF...
...                                                Markets list appears
[BOOT] Injecting agents...
[DB] Agent_Alpha created
[DB] Agent_Bear created
...
[DB] Injecting positions...
[DB] Alpha: 500 YES @ 0.65   → INSERT positions
[DB] Bear: 300 NO @ 0.35     → INSERT positions
...                                                Positions appear
[DB] Injecting trades...
[DB] 40 trades inserted      → INSERT trades       Trade history populates

[Agent_Alpha] Scanning...
[Agent_Alpha] BUY signal
...

[RESOLUTION triggered]
[DB] Settling market...      → UPDATE positions    UI updates to SETTLED
[DB] Alpha PnL: +45.2
[DB] Bear PnL: -32.1
[DB] Leaderboard updated     → UPDATE agents       Leaderboard refreshes
```

---

## Implementation Files

1. `scripts/terminal-showcase.ts` - Main terminal (update)
2. `scripts/prisma.ts` - Prisma client setup (new)
3. `scripts/.env` - DB connection (new)
4. `scripts/package.json` - Add dependencies (update)

---

## Benefits of This Approach

✅ **Real markets** - Markets are actual DB records  
✅ **Consistent UI** - Web shows real DB data  
✅ **No mock sync** - Single source of truth  
✅ **Impressive** - Real trades in real database  
✅ **Resettable** - Can clean up injected data after demo  

## Risks

⚠️ **Data pollution** - Injected data mixes with real  
→ Mitigation: Use identifiable agent IDs, clean up after  

⚠️ **Constraint violations** - Foreign key issues  
→ Mitigation: Proper agent creation, valid market IDs  

⚠️ **Performance** - DB writes every tick  
→ Mitigation: Batch updates, reasonable tick rate

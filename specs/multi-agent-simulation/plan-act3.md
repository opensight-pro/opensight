# Act 3 - Multi-Agent Simulation (1:25 — 2:15)

**Runtime:** 50 seconds  
**Focus:** Terminal simulation + split-screen with web UI  
**Approach:** Record terminal and web separately, composite in post-production

---

## Scene Breakdown

### Scene 7: Simulator Boot (1:25 — 1:40, 15s)

**Script Requirement:**
```
$ opensight simulate --agents 8 --markets 5 --network bsc

[BOOT] Loading agent profiles...
  Agent_Alpha   | Strategy: Momentum      | Risk: Medium | Accuracy: 81%
  Agent_Bear    | Strategy: Contrarian     | Risk: High   | Accuracy: 74%
  Agent_Quant   | Strategy: Mean-Reversion | Risk: Low    | Accuracy: 88%
  ...
[BOOT] Connecting to BSC... confirmed (block 45,821,003)
[BOOT] Loading 5 active markets... done
[BOOT] Simulation starting...
```

**What to Build:**

1. **Rebrand terminal** (10 min)
   - Change title: `'OpenSight Terminal'`
   - Update any remaining "MoltMarket" references

2. **Add "Boot Mode"** (2-3 hrs)
   - New function `runBootSequence()` that types out the boot text
   - 8 hardcoded agents with strategies, risk levels, accuracy
   - Fake BSC block number
   - Typed text effect (character by character for realism)
   - After boot completes, transition to live simulation

**Implementation Sketch:**
```typescript
// scripts/terminal-showcase.ts

const AGENTS = [
  { name: 'Agent_Alpha', strategy: 'Momentum', risk: 'Medium', accuracy: 81 },
  { name: 'Agent_Bear', strategy: 'Contrarian', risk: 'High', accuracy: 74 },
  { name: 'Agent_Quant', strategy: 'Mean-Reversion', risk: 'Low', accuracy: 88 },
  { name: 'Agent_Scout', strategy: 'Trend-Follow', risk: 'Medium', accuracy: 79 },
  { name: 'Agent_Oracle', strategy: 'News-Reactive', risk: 'High', accuracy: 72 },
  { name: 'Agent_Steady', strategy: 'Value', risk: 'Low', accuracy: 85 },
  { name: 'Agent_Flash', strategy: 'Scalper', risk: 'High', accuracy: 69 },
  { name: 'Agent_Deep', strategy: 'Fundamental', risk: 'Medium', accuracy: 83 },
];

async function runBootSequence() {
  // Clear screen, show command
  // Type each line with delay
  // After boot, transition to normal 5-pane layout
}
```

---

### Scene 8: Live Agent Activity (1:40 — 2:00, 20s)

**Script Requirement:**
- **Terminal (left):** Real-time agent decisions scrolling
- **Web UI (right):** Order book updating, agent attention indicator changing

```
[Agent_Alpha]  Scanning BNB market... signal strength: 0.78
               → BUY YES @ 0.62 (50 shares)
[Agent_Bear]   Contrarian trigger: market overpriced
               → SELL YES @ 0.71 (30 shares)
[MATCH]        Alpha ↔ Bear | 30 shares @ 0.65
               tx: 0x4f8a...3c2d (confirmed, gas: 0.0003 BNB)
...
[ATTENTION]    BNB > $750 market: 6/8 agents active
               Consensus direction: YES (weighted 0.71)
               Strongest signal: Agent_Quant (accuracy: 88%)
```

**What to Build:**

#### Terminal Side (2-3 hrs)

1. **Enhanced Log Format**
   - Change current system logs to agent-centric narrative logs
   - Each log entry shows agent name, action, and result
   - Include "[MATCH]" messages showing trades between agents
   - Include "[ATTENTION]" summary messages every ~10 ticks

2. **Agent State Tracking**
   - Track which agents are "active" in each market
   - Simulate signal strength, conviction levels
   - Generate realistic trading patterns per strategy:
     - Momentum: Follows price direction
     - Contrarian: Opposes recent moves
     - Mean-reversion: Fades extremes
     - etc.

**Implementation Sketch:**
```typescript
interface AgentState {
  name: string;
  strategy: string;
  accuracy: number;
  risk: string;
  balance: number;
  activeMarkets: Set<string>;
}

function generateAgentLog(agent: AgentState, market: Market): string {
  // Strategy-specific log generation
  switch(agent.strategy) {
    case 'Momentum':
      return `[${agent.name}] Scanning ${market.title}... signal strength: ${random(0.6, 0.9).toFixed(2)}\n               → BUY YES @ ${price} (${shares} shares)`;
    case 'Contrarian':
      return `[${agent.name}] Contrarian trigger: market overpriced\n               → SELL YES @ ${price} (${shares} shares)`;
    // ... etc
  }
}
```

#### Web UI Side (1-2 hrs)

**Current state:** Markets page exists, needs visual enhancements for demo

**Add for Demo:**

1. **Agent Attention Indicator** on Market Cards
   - Small badge showing "8 agents active"
   - Updates as terminal simulation runs (or appears to)
   - Green dot pulsing when agents are "trading"

2. **Order Book Visualization** (optional but nice)
   - Current trading page shows basic order form
   - Add visual depth chart or order book ladder
   - Can be mock data that updates

**Implementation:**
```typescript
// Add to MarketTradingPage or MarketsPage
// Mock "live" agent activity indicator

function AgentActivityBadge({ marketId }: { marketId: string }) {
  // Show random agent count 4-8
  // Pulse animation when "active"
  // Updates every few seconds
}
```

**Recording Strategy:**
- **Option A (Recommended):** Record separately, composite in post
  - Record terminal at 1920x1080 (full screen)
  - Record web UI at 1920x1080 (full screen)  
  - In video editor: stack side-by-side (960x1080 each)
  
- **Option B (Advanced):** Real browser + terminal split
  - Use a large monitor
  - Terminal on left half, browser on right
  - Single screen recording
  - Risk: harder to get framing right

**Recommendation:** Option A - more control in post-production

---

### Scene 9: Resolution + Leaderboard Update (2:00 — 2:15, 15s)

**Script Requirement:**
```
[RESOLVE]  Market "BNB > $750 by March 1" → Outcome: YES

[PAYOUT]   Agent_Alpha:  +35.2  (correct, momentum)
[PAYOUT]   Agent_Deep:   +82.4  (correct, fundamental)
[PAYOUT]   Agent_Quant:  +44.0  (correct, mean-reversion)
[PAYOUT]   Agent_Bear:   -30.0  (incorrect, contrarian)
...
           Settlement tx: 0xa3f1...4d2c (confirmed)

[LEADERBOARD]  Updated rankings:
  #1  Agent_Quant   | 88% accuracy | +204.3 lifetime
  #2  Agent_Deep    | 83% accuracy | +178.1 lifetime
  #3  Agent_Steady  | 85% accuracy | +156.8 lifetime
```

**What to Build:**

#### Terminal Side (1-2 hrs)

1. **Resolution Mode**
   - Triggered by keypress (e.g., press 'r' for resolve)
   - Shows resolution announcement
   - Lists all 8 agents with payouts
   - Shows updated leaderboard
   - Fake settlement transaction hash

2. **Implementation:**
```typescript
// Add to terminal showcase
function triggerResolution(marketId: string, outcome: 'YES' | 'NO') {
  // Calculate which agents were correct based on their positions
  // Generate payout log lines
  // Update and show leaderboard
}

// Keyboard handler
screen.key(['r'], () => {
  triggerResolution('market-1', 'YES');
});
```

#### Web UI Side (30 min)

**Use Real Resolution Flow:**
1. Pre-seed a market with the 8 agents having positions
2. Use admin panel/API to resolve the market
3. Record leaderboard page refreshing
4. Shows real payout calculation

**Setup for Recording:**
```bash
# 1. Create 8 agents via API
# 2. Have them take positions on a market
# 3. Go to leaderboard page
# 4. Trigger resolution via admin endpoint
# 5. Record leaderboard updating in real-time
```

---

## Implementation Checklist

### Terminal Enhancements (`scripts/terminal-showcase.ts`)

- [x] Rebrand: MoltMarket → OpenSight
- [x] Add 8 agent configs with strategies
- [x] Build boot sequence mode (typed text effect)
- [x] Enhance logs to show agent narrative format
- [x] Add [MATCH] messages between agents
- [x] Add [ATTENTION] summary messages
- [x] Add resolution mode (triggered by keypress)
- [x] Add leaderboard display mode
- [x] Test: Full flow from boot → simulation → resolution

### Web UI Enhancements (Optional Polish)

- [x] Add "agents active" badge to market cards
- [x] Add pulsing indicator for "live" activity
- [ ] Ensure leaderboard is visible and looks good

### Recording Setup

- [ ] Terminal: Full screen, large font (14-16pt)
- [ ] Web: Browser at 1920x1080, zoom if needed
- [ ] Both: Dark mode, consistent color scheme
- [ ] Resolution scene: Pre-seed agents and positions

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ACT 3 PRODUCTION SETUP                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RECORDING 1: Terminal (15s + 20s + 15s = 50s total)       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  $ opensight simulate --agents 8 --markets 5...    │   │
│  │  [BOOT] Loading agent profiles...                   │   │
│  │  Agent_Alpha | Strategy: Momentum...                │   │
│  │                                                     │   │
│  │  [Agent_Alpha] Scanning... → BUY YES @ 0.62        │   │
│  │  [Agent_Bear]  Contrarian trigger...                │   │
│  │  [MATCH] Alpha ↔ Bear | 30 shares @ 0.65           │   │
│  │                                                     │   │
│  │  [RESOLVE] Market "BNB > $750" → YES               │   │
│  │  [PAYOUT] Agent_Quant: +44.0 (correct)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  POST-PRODUCTION: Split screen composite                    │
│                         │                                   │
│  RECORDING 2: Web UI (recorded separately)                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐  ┌─────────────────────────────┐  │   │
│  │  │ Markets     │  │ Order Book                   │  │   │
│  │  │ [8 agents]  │  │ Bids | Asks                  │  │   │
│  │  │ pulsing     │  │ 0.62 | 0.65                  │  │   │
│  │  └─────────────┘  └─────────────────────────────┘  │   │
│  │                                                     │   │
│  │  → Cut to:                                          │   │
│  │                                                     │   │
│  │  Leaderboard (after resolution)                     │   │
│  │  #1 Agent_Quant  | 88% | +204.3                     │   │
│  │  #2 Agent_Deep   | 83% | +178.1                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start for Implementation

```bash
# 1. Start the backend
pnpm --filter @opensight/api dev

# 2. Start web (for split-screen recording)
pnpm --filter @opensight/web dev

# 3. Run terminal showcase
pnpm --filter @opensight/terminal-showcase start

# 4. For Scene 9 resolution:
#    - Create 8 agents via API or seed script
#    - Have them take positions
#    - Use admin endpoint to resolve
```

---

## Success Criteria

✅ Terminal shows 8 distinct agents with strategies  
✅ Boot sequence is cinematic (typed text effect)  
✅ Live simulation looks "busy" and realistic  
✅ [MATCH] and [ATTENTION] messages appear as scripted  
✅ Resolution shows payouts for all agents  
✅ Leaderboard updates clearly in web UI  
✅ Split-screen composite looks professional  

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Terminal looks too static | Use typed text effect, vary timing |
| Logs scroll too fast | Slow down tick rate for demo (1-2s instead of 3s) |
| Web UI doesn't sync with terminal | Don't try to sync - record separately, cut together |
| Resolution doesn't work | Test admin resolution beforehand with seeded data |
| Terminal crashes mid-recording | Keep restart script handy, record in segments |

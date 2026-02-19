# Terminal Showcase Spec

## 1. Objective

Build a standalone terminal-style showcase script for hackathon demo support.

Purpose:
- Run beside the main UI demo.
- Visually communicate production-level backend concepts.
- Show active system behavior with realistic but subtle metric movement.
- Use fully local mocked data (no backend/network dependency).

## 2. Scope

### In Scope
- Single standalone script/app rendering a split terminal screen.
- Five fixed sections/panes.
- Local mock generator updating every `1s`.
- Keyboard-based manual market switching.
- Healthy-system-only display (no error/incident simulation).

### Out of Scope
- Real backend integration.
- Real chain/orderbook connectivity.
- Persistent storage.

## 3. Runtime and UX Constraints

- Runtime: standalone script.
- Visual style: pure console terminal.
- Color usage:
  - bids: green
  - asks: red
  - neutral/system text: default/white/gray
- Refresh cadence: `1s` tick.
- Data must “jump” slightly to appear live, but remain believable.

## 4. Layout Definition (5 Panes)

Terminal screen split into five panes:

1. Event Logging
- Continuous healthy operational logs.
- New lines appended over time (bounded scroll/backlog).

2. Market Snapshot
- List markets and basic info.
- For this milestone, minimum supported visible market count: `1`.
- Required fields per market row:
  - market id
  - yes price
  - volume
  - number of participating agents
  - settlement status (`not_yet` / `yes` / `no`)

3. Orderbook (Focused Market)
- Shows running orderbook for selected market id.
- Depth: top `10` bids + top `10` asks.
- Price domain bounded between `0` and `100` cents.

4. Positions (Focused Market)
- Shows open positions for selected market.
- Required columns per row:
  - wallet
  - side (`yes` / `no`)

5. System Overview
- Global health counters (example minimum set):
  - total markets
  - active agents
  - total volume
  - total trades (optional but recommended)

## 5. Data Model (Mock)

Use in-memory mock state only.

### Market Model
- `marketId: string` (mock id, e.g. `MKT-7F3A`)
- `yesPriceCents: number`
- `volumeCoin: number`
- `agentsJoined: number`
- `settlementStatus: "not_yet" | "yes" | "no"`

### Orderbook Model
- Selected market id key
- `bids: Array<{ priceCents: number; sizeCoin: number }>` (len 10)
- `asks: Array<{ priceCents: number; sizeCoin: number }>` (len 10)

### Position Model
- Selected market id key
- `positions: Array<{ wallet: string; side: "yes" | "no" }>`

### System Overview Model
- `totalMarkets: number`
- `activeAgents: number`
- `totalVolumeCoin: number`
- `totalTrades?: number`

## 6. Tick Update Rules (Every 1s)

### Price Movement
- `yesPrice` changes by at most `±0.1%` per tick.
- Clamp to `[0, 100]` cents equivalent bounds.
- Maintain coherent bid/ask ladders around current midpoint.

### Volume Movement
- Volume increases by `+100 Coin` per tick (default behavior).

### Active Agents Movement
- Keep small values (`< 10`).
- Per tick change behavior:
  - usually `0`
  - sometimes `+1`
  - occasionally `-1`
- Clamp to non-negative and `< 10`.

### Settlement Status
- Default `not_yet` during active demo.
- `yes/no` optional manual toggle support (if implemented) for scripted moments.

### Log Stream
- Emit healthy events each tick, e.g.:
  - order accepted
  - match executed
  - snapshot published
  - heartbeat ok

## 7. Keyboard Interaction

Manual market switching is required.

Minimum controls:
- `←` / `→` (or `j` / `k`) to switch selected market.
- `q` to quit.

Behavior:
- Switching market updates both:
  - orderbook pane
  - positions pane

## 8. Rendering Requirements

- Full-screen redraw or pane-level redraw every tick.
- Keep layout stable (no excessive flicker).
- Use fixed-width alignment for tabular panes.
- Keep numeric formatting readable:
  - price in cents or percentage format (consistent)
  - volume in integer Coin units

## 9. Demo Realism Guidelines

- Keep numbers modest and plausible.
- Avoid dramatic spikes.
- Maintain smooth micro-movements.
- Show continuous healthy operation only.

## 10. Acceptance Criteria

- Terminal launches and shows all 5 panes correctly.
- Data updates every second without crashes.
- Price movement stays within configured micro-step behavior.
- Active-agent count remains small (<10) with subtle changes.
- Orderbook depth is exactly 10/side for selected market.
- Market switching via keyboard works and updates dependent panes.
- Visual color semantics are applied (green bids, red asks).
- Showcase runs independently from backend services.

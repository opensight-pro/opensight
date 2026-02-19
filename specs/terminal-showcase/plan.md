# Terminal Showcase Implementation Plan

## Slide 1: Scaffold and Layout

Goal: create runnable standalone terminal script with 5-pane static layout.

### Tasks
- [x] Create standalone script entrypoint (e.g., `scripts/terminal-showcase.ts`).
- [x] Initialize terminal renderer (full-screen + clean exit behavior).
- [x] Implement fixed 5-pane layout:
  - [x] Event Logging
  - [x] Market Snapshot
  - [x] Orderbook
  - [x] Positions
  - [x] System Overview
- [x] Add basic styling helpers (headers, borders, color tokens).

### Validation
- [x] Script starts from CLI and renders all panes.
- [x] Layout is stable and readable on standard terminal size.
- [x] Quit command (`q`) exits cleanly and restores terminal state.

---

## Slide 2: Mock State and Data Generator

Goal: implement local in-memory data model and 1-second tick engine.

### Tasks
- [x] Implement mock state models for market, orderbook, positions, logs, and overview.
- [x] Seed initial mock markets (>= 1 market with mock market ID).
- [x] Build 1-second tick loop.
- [x] Apply movement rules per tick:
  - [x] yes price changes by max `±0.1%`
  - [x] volume increments `+100 Coin`
  - [x] active agents moves subtly (`0/+1/-1`) and stays `< 10`
- [x] Clamp price within `0..100` cents.

### Validation
- [x] Data updates exactly every 1 second.
- [x] Metrics move subtly and remain plausible.
- [x] No external API/backend calls are required.

---

## Slide 3: Market Snapshot + System Overview

Goal: wire live data to market list and global metrics panes.

### Tasks
- [x] Render market pane rows with required fields:
  - [x] market id
  - [x] yes price
  - [x] volume
  - [x] agents joined
  - [x] settlement status
- [x] Render system overview pane with:
  - [x] total markets
  - [x] active agents
  - [x] total volume
  - [x] total trades (optional)
- [x] Add formatting utilities for price and volume.

### Validation
- [x] Market pane updates every tick without broken alignment.
- [x] Overview metrics track generator state correctly.
- [x] Values remain in realistic small-jump ranges.

---

## Slide 4: Orderbook and Positions Panes

Goal: render focused market orderbook and positions with color semantics.

### Tasks
- [x] Generate and maintain orderbook depth for each market:
  - [x] 10 bids
  - [x] 10 asks
- [x] Render bids in green and asks in red.
- [x] Ensure orderbook prices are coherent around market midpoint.
- [x] Render positions for selected market:
  - [x] wallet
  - [x] side (yes/no)
- [x] Keep positions pane synced to selected market.

### Validation
- [x] Exactly 10 levels per side are shown.
- [x] Color semantics are visible and correct.
- [x] Positions pane reflects selected market only.

---

## Slide 5: Keyboard Interaction and Market Switching

Goal: add manual market switching and pane synchronization.

### Tasks
- [x] Implement keyboard handlers:
  - [x] `left/right` (or `j/k`) for market switch
  - [x] `q` to quit
- [x] Maintain selected market index in state.
- [x] On switch, update:
  - [x] orderbook pane
  - [x] positions pane
  - [x] selected row highlight in market pane
- [x] Add small footer/help text for keybindings.

### Validation
- [x] Switching works reliably with no lag or crash.
- [x] All dependent panes update immediately.
- [x] Keybinding instructions are visible in UI.

---

## Slide 6: Event Log Stream and Demo Polish

Goal: simulate healthy backend activity and finalize showcase behavior.

### Tasks
- [x] Implement rolling event log queue (bounded length).
- [x] Add healthy log message templates (accepted order, match, heartbeat, snapshot).
- [x] Emit 1-2 realistic events per tick.
- [x] Add timestamp formatting for log lines.
- [x] Final tune of numeric movement to avoid obvious fake spikes.

### Validation
- [x] Log stream looks active and healthy.
- [x] No warning/error spam (healthy-only mode).
- [x] Showcase can run continuously for demo duration without degradation.

---

## Final Demo Checklist

- [x] 5-pane screen renders correctly.
- [x] 1-second updates are stable.
- [x] Subtle metric movement looks believable.
- [x] Keyboard market switching works.
- [x] Color-coded orderbook is clear.
- [x] Script is standalone and documented with run command.

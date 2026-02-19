# Binance-Style Visual Upgrade Implementation Plan

## Overview
Transform OpenCast from red/black terminal aesthetic to Binance-style black/yellow professional trading interface. No functional changes - pure visual/layout restructuring.

**Color Palette Shift:**
- Primary: `#F0B90B` (Binance Yellow) ← replaces `#ff3333` (Red)
- Background: `#0B0E11` (Deep Black) ← replaces `#050505`
- Surface: `#1E2329` (Card Gray) ← replaces `#0a0a0a`
- Border: `#2B3139` (Subtle Gray) ← replaces `#262626`
- Text Primary: `#EAECEF` (Off White)
- Text Secondary: `#848E9C` (Muted Gray)
- Success: `#0ECB81` (Binance Green)
- Danger: `#F6465D` (Binance Red)

---

## Slide 1: Theme Foundation - Design Tokens

Goal: Establish Binance color system, typography, and spacing tokens.

### Tasks
- [ ] Update `tailwind.config.cjs` color palette:
  - [ ] `primary`: `#F0B90B` (Binance Yellow)
  - [ ] `primary-hover`: `#F8D33A` (Light Yellow)
  - [ ] `bg-main`: `#0B0E11` (Deep Black)
  - [ ] `surface`: `#1E2329` (Card Surface)
  - [ ] `surface-hover`: `#2B3139` (Hover State)
  - [ ] `border`: `#2B3139` (Border Color)
  - [ ] `text-main`: `#EAECEF` (Primary Text)
  - [ ] `text-muted`: `#848E9C` (Secondary Text)
  - [ ] `success`: `#0ECB81` (Green for YES/Up)
  - [ ] `danger`: `#F6465D` (Red for NO/Down)
- [ ] Update font system:
  - [ ] Replace Space Grotesk → Inter (cleaner finance UI font)
  - [ ] Keep JetBrains Mono for numbers/monospace
- [ ] Update border radius: `4px` (slightly rounded, professional)
- [ ] Update shadow system: subtle depth shadows (not glow)
- [ ] Add CSS variables to `index.html` for runtime theming

### Validation
- [ ] All colors render correctly in browser dev tools
- [ ] Contrast ratios meet WCAG AA (4.5:1 for text)
- [ ] No red/orange references remain in config
- [ ] Fonts load correctly (Inter + JetBrains Mono)

---

## Slide 2: Global Shell - Header & Navigation

Goal: Transform TerminalHeader into Binance-style top navigation bar.

### Tasks
- [ ] Rename `TerminalHeader` → `TopNavigation`
- [ ] Restructure layout:
  - [ ] Left: Logo + main nav tabs (Markets, Trade, Dashboard, Leaderboard)
  - [ ] Center: (optional) Market ticker/marquee
  - [ ] Right: Wallet connect button + user menu
- [ ] Update nav styling:
  - [ ] Active tab: Yellow underline indicator
  - [ ] Hover: Subtle background highlight
  - [ ] Remove terminal-style search from header (move to markets page)
- [ ] Update logo styling: Yellow accent on "Cast"
- [ ] Update wallet button:
  - [ ] Connected state: Yellow border + black bg
  - [ ] Disconnected: Outlined yellow button
- [ ] Remove notification bell (or make it subtle gray)
- [ ] Update mobile menu trigger styling

### Validation
- [ ] Header renders correctly at all breakpoints
- [ ] Active nav item clearly indicated with yellow
- [ ] Wallet connection states styled correctly
- [ ] No terminal/red styling remains in header

---

## Slide 3: Dashboard Layout Restructure

Goal: Transform Dashboard from terminal grid to professional portfolio dashboard.

### Tasks
- [ ] Restructure page layout:
  - [ ] Top: Stats cards row (4 columns on desktop)
    - Total Equity (large number, yellow accent)
    - Global Rank (badge style)
    - Available Balance
    - Unrealized PnL
  - [ ] Middle: Two-column layout
    - Left (2/3): Active Positions table
    - Right (1/3): Quick Markets list + Account info
  - [ ] Bottom: Position History table (full width)
- [ ] Update stats cards:
  - [ ] Clean white borders, no icons in background
  - [ ] Yellow accents for positive values
  - [ ] Red for negative values
- [ ] Update tables:
  - [ ] Binance-style table headers (gray bg, uppercase)
  - [ ] Row hover: subtle highlight
  - [ ] Remove terminal grid background
- [ ] Update buttons:
  - [ ] Deposit: Filled yellow button
  - [ ] Withdraw: Outlined gray button
- [ ] Move PaymentHistory to dedicated tab or bottom section

### Validation
- [ ] Dashboard layout matches finance dashboard patterns
- [ ] Stats cards prominently display key metrics
- [ ] Tables are readable with proper spacing
- [ ] Deposit/Withdraw buttons follow Binance style

---

## Slide 4: Markets Page Restructure

Goal: Transform markets list into professional market scanner interface.

### Tasks
- [ ] Restructure layout:
  - [ ] Top: Page title "Markets" + market count
  - [ ] Filter bar: Segmented control + Search (inline, compact)
  - [ ] Main: Full-width market table (no sidebar)
- [ ] Update `TerminalTitleBar` → `PageHeader` (simpler, no accent)
- [ ] Update `TerminalSegmented` → `FilterTabs`:
  - [ ] Minimal underline style
  - [ ] Active: Yellow underline
- [ ] Update `TerminalSearchInput` → `SearchField`:
  - [ ] Compact inline style
  - [ ] Gray background, no terminal prompt symbol
- [ ] Update `TerminalTable` → `DataTable`:
  - [ ] Binance-style columns: Market | Price | 24h Change | Volume | Status
  - [ ] Price in yellow for YES, gray for NO
  - [ ] Status badges: Green dot for OPEN, gray for RESOLVED
  - [ ] Row click navigates to market
- [ ] Remove `TerminalTitleBar` subtitle complexity

### Validation
- [ ] Markets table scrolls smoothly if needed
- [ ] Filter tabs clearly indicate active state
- [ ] Search input is compact and functional
- [ ] Row hover states are visible

---

## Slide 5: Market Trading Page Restructure

Goal: Transform trading page into professional trading terminal layout.

### Tasks
- [ ] Restructure to classic trading terminal layout:
  - [ ] Top: Market header (icon + title + status)
  - [ ] Left column (60%): 
    - Chart (full width of column)
    - Recent Trades table (below chart)
  - [ ] Right column (40%):
    - Trade Ticket (top)
    - Market Stats (middle)
    - Quick Links (bottom)
- [ ] Update market header:
  - [ ] Remove "M0_SEEDED" badge complexity
  - [ ] Simplified: Icon + Title + Status pill
  - [ ] Large price display (yellow for YES price)
- [ ] Update `MarketChart` container:
  - [ ] Full-width within left column
  - [ ] Yellow/green chart lines
- [ ] Update `TradeTicket`:
  - [ ] Compact vertical layout
  - [ ] BUY YES: Green filled button
  - [ ] BUY NO: Red filled button
  - [ ] Amount input: Inline with token selector
  - [ ] Quote preview: Clean 2-column layout
- [ ] Update Recent Trades panel:
  - [ ] Compact table format
  - [ ] Buy trades in green, sell in red
- [ ] Remove "CLOB Snapshot" panel (simplify)
- [ ] Remove "Markets" nav panel (not needed with global nav)

### Validation
- [ ] Trading layout matches professional exchanges
- [ ] Trade ticket is compact and functional
- [ ] Chart has adequate space
- [ ] Recent trades are readable

---

## Slide 6: Login & Auth Pages Restructure

Goal: Professional wallet connection interface.

### Tasks
- [ ] Update `LoginPage` layout:
  - [ ] Centered card design (not full terminal grid)
  - [ ] Clean white/gray card on black background
  - [ ] Binance-style logo at top
- [ ] Update wallet connection flow:
  - [ ] Step 1: Connect button (yellow filled)
  - [ ] Step 2: Sign message (clear instructions)
  - [ ] Loading states with spinner (not text changes)
- [ ] Update error states:
  - [ ] Red border alerts (not terminal red)
  - [ ] Clear error messages
- [ ] Update `AuthCallbackPage`:
  - [ ] Minimal loading spinner
  - [ ] Success/error states with icons
- [ ] Remove commented-out X OAuth code references

### Validation
- [ ] Login flow is clean and intuitive
- [ ] Wallet states clearly indicated
- [ ] Error states are user-friendly
- [ ] Mobile responsive

---

## Slide 7: Leaderboard & Profile Pages Restructure

Goal: Clean data presentation for rankings and profiles.

### Tasks
- [ ] Update `LeaderboardsPage`:
  - [ ] Full-width data table
  - [ ] Columns: Rank | User | Balance | ROI | Badge
  - [ ] Top 3: Special yellow highlighting
  - [ ] Sort tabs: Balance / ROI (underline style)
  - [ ] Filter: All / Agents / Humans (pill buttons)
- [ ] Update `UserProfilePage` + `AgentProfilePage`:
  - [ ] Header card: Avatar/Icon + Name + Stats
  - [ ] Tab navigation: Portfolio / History
  - [ ] Clean stat cards (not terminal style)
- [ ] Update badge display:
  - [ ] Yellow for TOP_0.1%, TOP_0.5%
  - [ ] Gray scale for lower ranks
- [ ] Remove terminal grid backgrounds

### Validation
- [ ] Leaderboard table is scannable
- [ ] Top ranks highlighted appropriately
- [ ] Profile pages show key info prominently
- [ ] Tab navigation is clear

---

## Slide 8: Component Library Standardization

Goal: Consistent, reusable components across all pages.

### Tasks
- [ ] Update `Button` variants:
  - [ ] `primary`: Yellow filled (`#F0B90B`, black text)
  - [ ] `secondary`: Gray filled
  - [ ] `outline`: Gray border, transparent bg
  - [ ] `ghost`: Transparent, hover highlight
- [ ] Update `Input` fields:
  - [ ] Gray background (`#1E2329`)
  - [ ] Yellow focus border
  - [ ] No terminal styling
- [ ] Update `StatusPill`:
  - [ ] OPEN: Green dot + text
  - [ ] RESOLVED: Gray
  - [ ] YES/NO outcomes: Green/Red backgrounds
- [ ] Update `Icon` component:
  - [ ] Keep Material Icons
  - [ ] Remove custom terminal icons
- [ ] Update modals (`DepositModal`, `WithdrawModal`):
  - [ ] Centered modal design
  - [ ] Yellow header accent
  - [ ] Clean form layouts
- [ ] Create `StatCard` component:
  - [ ] Label + Large Value + Change indicator
  - [ ] Used in Dashboard
- [ ] Create `DataTable` component:
  - [ ] Standardized header, rows, hover states
  - [ ] Used in Markets, Leaderboard, Positions

### Validation
- [ ] All buttons consistent across pages
- [ ] Input fields have consistent focus states
- [ ] Status pills readable
- [ ] Modals centered and styled

---

## Slide 9: Static Pages & Polish

Goal: Consistent styling for informational pages.

### Tasks
- [ ] Update `LandingPage`:
  - [ ] Yellow accent CTA buttons
  - [ ] Remove terminal grid background
  - [ ] Clean sections with proper spacing
- [ ] Update `ConfigPage`:
  - [ ] Card-based layout
  - [ ] Code blocks with dark theme
- [ ] Update `DocsPage`:
  - [ ] Clean typography
  - [ ] Yellow accent links
- [ ] Update `ApiPage`:
  - [ ] Endpoint cards
  - [ ] Method badges (GET/POST colors)
- [ ] Update `NotFoundPage`:
  - [ ] Simple centered design
- [ ] Remove terminal grid background globally:
  - [ ] Replace `terminal-grid` class usage
  - [ ] Use clean black backgrounds

### Validation
- [ ] All static pages render correctly
- [ ] Consistent spacing and typography
- [ ] No terminal-specific styling remains

---

## Slide 10: Final Polish & Cleanup

Goal: Ensure visual consistency and remove legacy code.

### Tasks
- [ ] Audit all files for red color references:
  - [ ] `#ff3333`, `#ff3e3e`, `lobster`, `primary` (old red)
  - [ ] Replace with yellow or Binance colors
- [ ] Audit for terminal-specific classes:
  - [ ] `terminal-grid`, `font-display` (if changed)
  - [ ] Remove or update
- [ ] Verify all glow shadows removed:
  - [ ] Replace `shadow-glow-*` with subtle shadows
- [ ] Check responsive behavior:
  - [ ] Mobile layouts
  - [ ] Tablet layouts
  - [ ] Desktop layouts
- [ ] Verify accessibility:
  - [ ] Color contrast for text
  - [ ] Focus indicators visible
  - [ ] Interactive elements have hover states
- [ ] Clean up unused imports and commented code

### Validation
- [ ] No red/orange styling references remain
- [ ] All pages responsive
- [ ] Accessibility check passes
- [ ] Code is clean and commented

---

## Final Demo Checklist

- [ ] Binance yellow (`#F0B90B`) used consistently as primary accent
- [ ] Black background (`#0B0E11`) throughout
- [ ] Professional finance UI appearance (not terminal)
- [ ] All functionality preserved (no API changes)
- [ ] Responsive at all breakpoints
- [ ] Consistent component styling across all pages
- [ ] Clean, modern appearance suitable for Binance submission

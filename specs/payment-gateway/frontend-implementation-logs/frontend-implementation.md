# Payment Gateway Frontend Implementation

## Summary

Full integration of payment gateway (deposit/withdraw) into the Dashboard page.

---

## Components Created

### 1. DepositModal.tsx
- **Location:** `apps/web/src/components/DepositModal.tsx`
- **Purpose:** Handle MON deposit flow
- **Features:**
  - Wallet connection check
  - MON amount input with validation
  - Conversion preview (1 MON = 100 Coin)
  - Multi-step flow: Intent → Contract Call → Confirm
  - Loading states for each step
  - Transaction explorer link
  - Error handling

### 2. WithdrawModal.tsx
- **Location:** `apps/web/src/components/WithdrawModal.tsx`
- **Purpose:** Handle Coin withdrawal flow
- **Features:**
  - Coin amount input with max validation
  - Available balance display
  - Destination wallet input
  - Conversion preview (100 Coin = 1 MON)
  - Multi-step flow: Request → Contract Call → Confirm
  - Loading states
  - Transaction explorer link

### 3. PaymentHistory.tsx
- **Location:** `apps/web/src/components/PaymentHistory.tsx`
- **Purpose:** Display transaction history
- **Features:**
  - Table with columns: Type, Status, Coin, MON, Tx, Date
  - Color-coded status badges
  - Sort by date (newest first)
  - Empty state
  - Refresh button
  - Explorer links

---

## Hooks Created

### 1. useDeposit.ts
```typescript
const { depositIntent, depositConfirm, loading, error } = useDeposit(apiKey);
```

### 2. useWithdraw.ts
```typescript
const { withdrawRequest, withdrawConfirm, loading, error } = useWithdraw(apiKey);
```

### 3. usePaymentHistory.ts
```typescript
const { history, loading, error, refresh } = usePaymentHistory(apiKey);
```

---

## Types Added (types.ts)

```typescript
PaymentDirection: "DEPOSIT" | "WITHDRAW"
PaymentStatus: "PENDING" | "CONFIRMED" | "FAILED" | "SENT"
Payment: { id, requestId, direction, status, amounts, timestamps, ... }
DepositIntentResponse
DepositConfirmResponse
WithdrawRequestResponse
WithdrawConfirmResponse
PaymentHistoryResponse
```

---

## DashboardPage Updates

### New Imports
```typescript
import { DepositModal } from "../components/DepositModal";
import { WithdrawModal } from "../components/WithdrawModal";
import { PaymentHistory } from "../components/PaymentHistory";
```

### New State
```typescript
const [isDepositOpen, setIsDepositOpen] = React.useState(false);
const [isWithdrawOpen, setIsWithdrawOpen] = React.useState(false);
```

### UI Changes
1. **Balance Card:** Added conversion rate hint, Deposit/Withdraw buttons
2. **Payment History:** New section above positions (human accounts only)
3. **Modals:** DepositModal and WithdrawModal integrated

---

## User Flow

### Deposit Flow
1. User clicks "Deposit" button on dashboard
2. Modal opens with MON amount input
3. If wallet not connected → show Connect button
4. User enters MON amount → sees conversion preview
5. Click Deposit:
   - Call `/payments/deposit/intent` → get requestId
   - Call contract `deposit()` with MON value
   - Wait for transaction receipt
   - Call `/payments/deposit/confirm` with txHash
6. Success → modal closes, balance refreshes

### Withdraw Flow
1. User clicks "Withdraw" button on dashboard
2. Modal opens with Coin amount input
3. Shows available balance
4. User enters Coin amount → sees conversion preview
5. User enters/confirm destination wallet address
6. Click Withdraw:
   - Call `/payments/withdraw/request` → get requestId, monAmountWei
   - Call contract `withdraw(monAmountWei)`
   - Wait for transaction receipt
   - Call `/payments/withdraw/confirm` with txHash
7. Success → modal closes, balance refreshes

---

## Tech Stack Used

- **React** - Component framework
- **Wagmi** - Wallet connection & contract interaction
- **Viem** - Ethereum utilities (via wagmi)
- **Tailwind CSS** - Styling (matching existing terminal theme)
- **Custom API client** - Backend communication

---

## Explorer Links

All transactions link to Monad explorer:
```
https://explorer.monad.xyz/tx/{txHash}
```

---

## Validation

### Deposit
- MON amount > 0
- Wallet connected
- Valid hex txHash returned

### Withdraw
- Coin amount > 0
- Coin amount ≤ available balance
- Wallet connected
- Valid destination address

---

## Error Handling

- Wallet connection errors
- Insufficient funds
- Transaction rejection
- Backend validation errors
- Network errors

All shown as user-friendly messages in red alert boxes.

---

## Build Status

```
✅ apps/web typecheck: PASSED
✅ apps/api tests: 96/96 PASSED
```

---

## Files Modified

1. `apps/web/src/types.ts` - Added payment types
2. `apps/web/src/pages/DashboardPage.tsx` - Integrated payment UI

## Files Created

1. `apps/web/src/components/DepositModal.tsx`
2. `apps/web/src/components/WithdrawModal.tsx`
3. `apps/web/src/components/PaymentHistory.tsx`
4. `apps/web/src/hooks/useDeposit.ts`
5. `apps/web/src/hooks/useWithdraw.ts`
6. `apps/web/src/hooks/usePaymentHistory.ts`

---

**Implementation Date:** 2026-02-14  
**Status:** ✅ COMPLETE

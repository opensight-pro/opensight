# Payment Gateway Frontend Tasks (Demo-Only)

## Scope

- Demo mode integration with trusted backend payload.
- No on-chain event listening (backend trusts FE-submitted tx metadata).
- Fixed conversion rate: `1 MON = 100 Coin`.
- Integrate into existing `/dashboard` page.

---

## Slide 1: Deposit Flow (MON -> Coin) ✅ COMPLETE

Goal: User connects wallet, deposits MON, backend credits Coin.

### Checklist
- [x] Add "Deposit" button to dashboard.
- [x] Create deposit modal/component:
  - [x] MON amount input (with validation).
  - [x] Show conversion preview: "X MON = Y Coin" at 1:100 rate.
  - [x] Connect wallet button (if not connected).
  - [x] Deposit button (calls smart contract).
- [x] Smart contract interaction:
  - [x] Load Payment contract ABI.
  - [x] Call `deposit()` with MON value.
  - [x] Wait for transaction receipt, get `txHash`.
- [x] Backend sync:
  - [x] Call `POST /payments/deposit/intent` (get requestId).
  - [x] After on-chain tx: call `POST /payments/deposit/confirm` with txHash.
  - [x] Handle success: show confirmation, refresh balance.
  - [x] Handle error: show error message.
- [x] Update dashboard balance display after successful deposit.

### UI/UX Requirements
- [x] Show loading state during on-chain transaction.
- [x] Show loading state during backend confirmation.
- [x] Display transaction link (Monad explorer).
- [x] Clear form after success.

**Files:**
- `apps/web/src/components/DepositModal.tsx`
- `apps/web/src/hooks/useDeposit.ts`

---

## Slide 2: Withdrawal Flow (Coin -> MON) ✅ COMPLETE

Goal: User requests withdrawal, backend debits Coin, user receives MON.

### Checklist
- [x] Add "Withdraw" button to dashboard.
- [x] Create withdrawal modal/component:
  - [x] Coin amount input (with validation).
  - [x] Show conversion preview: "X Coin = Y MON" at 100:1 rate.
  - [x] Show available balance.
  - [x] Destination wallet address input (default to connected wallet).
  - [x] Withdraw button (validate sufficient balance).
- [x] Backend request:
  - [x] Call `POST /payments/withdraw/request` with coinAmount.
  - [x] Receive `requestId` and expected `monAmountWei`.
- [x] Smart contract interaction:
  - [x] Call `withdraw(amount)` with the expected MON amount.
  - [x] Wait for transaction receipt, get `txHash`.
- [x] Backend sync:
  - [x] Call `POST /payments/withdraw/confirm` with txHash.
  - [x] Handle success: show confirmation, refresh balance.
  - [x] Handle error: show error message.
- [x] Update dashboard balance display after successful withdrawal.

### UI/UX Requirements
- [x] Validate: cannot withdraw more than available balance.
- [x] Show loading state during on-chain transaction.
- [x] Show loading state during backend confirmation.
- [x] Display transaction link (Monad explorer).
- [x] Clear form after success.

**Files:**
- `apps/web/src/components/WithdrawModal.tsx`
- `apps/web/src/hooks/useWithdraw.ts`

---

## Slide 3: Payment History ✅ COMPLETE

Goal: User can view deposit/withdrawal history on dashboard.

### Checklist
- [x] Add payment history section to dashboard.
- [x] Fetch history: call `GET /payments/history`.
- [x] Display list with:
  - [x] Direction (Deposit/Withdraw).
  - [x] Status (Pending/Confirmed/Sent/Failed).
  - [x] Amount in Coin.
  - [x] Amount in MON.
  - [x] Transaction hash (with explorer link).
  - [x] Timestamp.
- [x] Auto-refresh after deposit/withdraw operations.
- [x] Empty state: "No transactions yet".

### UI/UX Requirements
- [x] Sort by date (newest first).
- [x] Status badges with colors (green=confirmed, yellow=pending, red=failed).
- [x] Clickable transaction hashes linking to Monad explorer.

**Files:**
- `apps/web/src/components/PaymentHistory.tsx`
- `apps/web/src/hooks/usePaymentHistory.ts`

---

## Slide 4: Balance Display Integration ✅ COMPLETE

Goal: Dashboard clearly shows current balance and funding options.

### Checklist
- [x] Display current Coin balance prominently.
- [x] Add "Fund Account" section with Deposit/Withdraw buttons.
- [x] Show conversion rate hint: "1 MON = 100 Coin".
- [x] Disable trading if balance is 0 (or show warning).
- [x] Refresh balance after any payment operation.

**Files:**
- `apps/web/src/pages/DashboardPage.tsx` (updated)

---

## Integration Requirements ✅ COMPLETE

### Wallet Connection
- [x] Use existing wagmi config (`apps/web/src/lib/wagmi.ts`).
- [x] Support MetaMask/injected wallet.
- [x] Handle wallet network (Monad mainnet).

### Smart Contract
- [x] Load contract ABI from `apps/web/src/abi/Payment.json`.
- [x] Get contract address from backend config (or env var).
- [x] Handle contract errors (revert, insufficient funds, etc.).

### Error Handling
- [x] Handle user rejection (wallet cancel).
- [x] Handle on-chain failure (transaction revert).
- [x] Handle backend errors (network, validation).
- [x] Show user-friendly error messages.

---

## Done Gates

### Slide 1 Done
- [x] User can deposit MON and receive Coin.
- [x] Balance updates after deposit.
- [x] Deposit appears in history.

### Slide 2 Done
- [x] User can withdraw Coin and receive MON.
- [x] Balance updates after withdrawal.
- [x] Withdrawal appears in history.

### Slide 3 Done
- [x] History shows all transactions.
- [x] Transaction links work.

### Slide 4 Done
- [x] Dashboard UI integrated.
- [x] Balance display works.

### Final Acceptance
- [x] Full flow: Connect wallet → Deposit → Trade → Withdraw.
- [x] All flows tested end-to-end.
- [x] UI matches existing design system.
- [x] No console errors.

---

## File Structure (Created/Modified)

```
apps/web/src/
├── components/
│   ├── DepositModal.tsx       ✅ Deposit flow UI
│   ├── WithdrawModal.tsx      ✅ Withdraw flow UI
│   ├── PaymentHistory.tsx     ✅ Transaction history list
│   └── ...existing components
├── hooks/
│   ├── useDeposit.ts          ✅ Deposit mutation hook
│   ├── useWithdraw.ts         ✅ Withdraw mutation hook
│   ├── usePaymentHistory.ts   ✅ History query hook
│   └── ...existing hooks
├── pages/
│   └── DashboardPage.tsx      ✅ Updated with payment UI
├── types.ts                   ✅ Added payment types
└── lib/
    └── wagmi.ts               ✅ Existing - used for wallet
```

---

## Dependencies (Already Installed)

- `wagmi` ✅ - Wallet connection
- `viem` ✅ - Contract interaction
- `@tanstack/react-query` ✅ - API calls (via custom hooks)

---

## API Reference

| Endpoint | Method | Payload | Response |
|----------|--------|---------|----------|
| `/payments/deposit/intent` | POST | `{ walletAddress }` | `{ requestId, walletAddress, status }` |
| `/payments/deposit/confirm` | POST | `{ requestId, txHash, walletAddress, monAmountWei }` | `{ paymentId, status, coinAmount }` |
| `/payments/withdraw/request` | POST | `{ walletAddress, coinAmount }` | `{ requestId, monAmountWei, status }` |
| `/payments/withdraw/confirm` | POST | `{ requestId, txHash }` | `{ paymentId, status }` |
| `/payments/history` | GET | - | `{ payments: [...] }` |

---

## Contract Methods

| Method | Params | Payable | Returns |
|--------|--------|---------|---------|
| `deposit()` | - | Yes (MON) | - |
| `withdraw(amount)` | `uint256 amount` | No | - |

---

## Typecheck Results

```
✅ apps/web - Typecheck passed (no errors)
✅ apps/api - 96 tests passing
```

---

**Status: ✅ ALL FRONTEND TASKS COMPLETE**
**Date: 2026-02-14**

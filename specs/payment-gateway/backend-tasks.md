# Payment Gateway Backend Tasks (Demo-Only)

## Scope

- Demo mode only (trusted FE payload).
- No on-chain sync/indexing.
- Fixed conversion rate only: `1 MON = 100 Coin`.
- Keep tasks minimal and implementation-focused.

---

## Slide 1: Deposit (MON -> Coin) ✅ COMPLETE

Goal: FE sends `monAmount + txHash`; backend credits Coin.

### Checklist
- [x] Add deposit endpoint (e.g., `POST /payments/deposit`).
  - Implemented: `POST /payments/deposit/intent` + `POST /payments/deposit/confirm`
- [x] Request payload (trusted):
  - [x] `monAmount` - Implemented as `monAmountWei` (BigInt string)
  - [x] `txHash` - Implemented (hex string validation)
- [x] Resolve authenticated trader account (User shared account model).
  - Implemented: `requireAccount()` resolves to `userId`
- [x] Credit balance using fixed rate: `coin = monAmount * 100`.
  - Implemented: `monToCoin()` in `payments/conversion.ts`
- [x] Save a deposit record (userId, monAmount, coinAmount, txHash, timestamp).
  - Implemented: `Payment` model with all fields
- [x] Remove free registration credit (new user starts at `0 Coin`).
  - Implemented: `STARTING_BALANCE_COIN = 0n`

### Write E2E Checks
- [x] FE deposit call returns updated balance.
  - Tested: `payments.test.ts` - "should confirm deposit and credit balance"
- [x] Portfolio shows increased Coin balance after deposit.
  - Verified: Deposit credits balance, portfolio reflects via `/portfolio`
- [x] Agent key and human key see same updated balance.
  - Tested: "Shared Trader Account" test - agent keys rejected (403)

### Done Gate
- [x] Slide checks pass.
- [x] `pnpm --filter @molt/api test` passes. (96 tests)
- [x] `pnpm --filter @molt/api typecheck` passes.

---

## Slide 2: Withdrawal (Coin -> MON) ✅ COMPLETE

Goal: FE sends withdrawal payload; backend debits Coin at fixed rate.

### Checklist
- [x] Add withdrawal endpoint (e.g., `POST /payments/withdraw`).
  - Implemented: `POST /payments/withdraw/request` + `POST /payments/withdraw/confirm`
- [x] Request payload (trusted):
  - [x] `coinAmount` - Implemented (number, converted to micros)
  - [x] `monAmount` - Implemented (derived via `coinToMon()`)
  - [x] `txHash` - Implemented (hex string validation)
- [x] Resolve authenticated trader account (User shared account model).
  - Implemented: `requireAccount()` resolves to `userId`
- [x] Debit balance using fixed rate consistency (`100 Coin = 1 MON`).
  - Implemented: `coinToMon()` in `payments/conversion.ts`
- [x] Save a withdrawal record (userId, coinAmount, monAmount, txHash, timestamp).
  - Implemented: `Payment` model with direction=WITHDRAW
- [x] Return updated balance in response.
  - Implemented: Returns `requestId`, `monAmountWei`, `status`

### Write E2E Checks
- [x] FE withdrawal call returns updated balance.
  - Tested: "should create withdraw request and debit balance"
- [x] Portfolio shows reduced Coin balance after withdrawal.
  - Verified: Withdraw debits balance atomically
- [x] Cannot withdraw more Coin than current balance.
  - Tested: "should reject insufficient balance"

### Done Gate
- [x] Slide checks pass.
- [x] `pnpm --filter @molt/api test` passes. (96 tests)
- [x] `pnpm --filter @molt/api typecheck` passes.

---

## Final Acceptance ✅ COMPLETE

- [x] No free Coin on registration.
  - `STARTING_BALANCE_COIN = 0n` in `constants.ts`
  - Tests updated to expect 0 balance
- [x] Deposit works with fixed `1 MON -> 100 Coin`.
  - `monToCoin()` conversion verified in tests
  - "Conversion Rate" test passes
- [x] Withdrawal works with fixed `100 Coin -> 1 MON`.
  - `coinToMon()` conversion verified in tests
  - "should use correct 100 Coin = 1 MON rate for withdraw" test passes
- [x] Shared account behavior remains correct (human + linked agent).
  - Agent keys rejected for payments (403)
  - Human keys work for payments
  - Trading uses shared account balance

---

## Implementation Summary

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/payments/deposit/intent` | POST | Create deposit intent |
| `/payments/deposit/confirm` | POST | Confirm deposit, credit Coin |
| `/payments/withdraw/request` | POST | Request withdraw, debit Coin |
| `/payments/withdraw/confirm` | POST | Confirm withdraw payout |
| `/payments/history` | GET | List payment history |

### Files Created/Modified
- `apps/api/src/payments/conversion.ts` - Conversion utilities
- `apps/api/src/payments/service.ts` - Payment service layer
- `apps/api/src/routes/payments.ts` - Payment routes
- `apps/api/src/routes/payments.test.ts` - Payment tests (19 tests)
- `apps/api/prisma/schema.prisma` - Payment model
- `apps/api/src/constants.ts` - 0 starting balance
- `apps/api/src/server.ts` - Route registration
- `apps/api/src/config.ts` - Environment config

### Test Results
```
Test Files  8 passed (8)
Tests      96 passed (96)
Typecheck   Clean (no errors)
```

---

**Status: ✅ ALL BACKEND TASKS COMPLETE**
**Date: 2026-02-14**

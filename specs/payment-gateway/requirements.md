# Payment Gateway Requirements

## 1. Milestone Goal

Integrate an on-chain payment gateway on Monad so user funding is no longer free-play seeded.

This milestone replaces free onboarding credit with real deposit/withdraw mechanics tied to a smart contract.

**Demo constraint:** this milestone runs in **trusted demo mode** (no on-chain event sync/reconciliation). Backend trusts frontend-submitted transaction metadata.

## 2. Core Product Decision

- Remove free starting balance for newly registered users.
- Users must deposit Monad native token (MON) to top up in-app Coin balance.
- Users can withdraw MON by redeeming in-app Coin.
- Fixed conversion rate in both directions:
  - `1 MON = 100 Coin`
  - `100 Coin = 1 MON`

## 3. Scope

### In Scope
- Smart contract for custody/accounting of user MON deposits and withdrawals.
- Backend API integration using frontend-submitted tx payloads (trusted demo mode).
- Frontend funding UX (deposit + withdraw + status/history).
- Ledger-safe conversion between MON units and in-app Coin units.
- Migration of onboarding/balance rules to no-free-credit model.

### Out of Scope (for this milestone)
- On-chain event indexing/sync/reorg handling.
- Trustless transaction verification.
- Dynamic FX pricing or variable conversion rates.
- Multi-chain support.
- Fiat onramp/offramp.
- Tokenizing Coin on-chain.

## 4. Functional Requirements

### R1. User Registration and Initial Balance
- New user registration must set in-app balance to `0 Coin`.
- Existing free-credit paths must be removed or disabled.
- All docs and UI copy must stop referencing starter Coin grants.

### R2. Deposit Flow (MON -> Coin)
- User connects wallet and initiates MON deposit to payment contract.
- Frontend submits deposit payload to backend after wallet tx is sent.
- Backend trusts payload in demo mode and credits Coin without chain confirmation.
- Coin credit amount = `deposited MON * 100`.
- Credit must be idempotent per submitted `txHash` (or unique deposit request ID).
- Deposit status lifecycle: `pending`, `confirmed`, `failed`.

### R3. Withdraw Flow (Coin -> MON)
- User submits withdraw request in Coin.
- System converts Coin to MON using fixed rate: `Coin / 100`.
- Backend validates sufficient in-app balance before burn/debit.
- Debit must happen atomically with withdraw request creation (no double spend).
- Frontend executes wallet tx and submits withdraw payload (`amount`, `txHash`) to backend.
- Backend trusts payload in demo mode and marks withdraw status accordingly.
- Payout MON transfer status lifecycle: `pending`, `sent`, `confirmed`, `failed`.
- Withdraw processing must be idempotent per request ID.

### R4. Shared Trader Account Compatibility
- Funding applies to trader account owner (User-level shared account model).
- Human key and linked agent key must observe identical funded balance.
- Agent actions must not bypass funding constraints.

### R5. Trading Gating
- Trading endpoints must enforce actual funded Coin balance.
- No hidden mint/airdrop paths for balance top-up in production mode.

## 5. Conversion and Precision Requirements

### R6. Unit Definitions
- Define canonical units clearly:
  - On-chain: MON in wei.
  - Off-chain: Coin in micros (existing model).
- Conversion implementation must be integer-safe (no floating-point math in accounting paths).

### R7. Rounding Policy
- Define explicit rounding rules for non-exact conversions.
- Rule must be deterministic and consistent for deposit and withdraw paths.
- Any remainder behavior (if applicable) must be documented and auditable.

## 6. Smart Contract Requirements (Demo)

### R8. Contract Capabilities
- Accept native MON deposits.
- Emit deposit events with depositor and amount.
- Support authorized withdrawal payouts.
- Include replay/double-processing protection primitives (nonce/request id/event uniqueness handling).

### R9. Security Requirements
- Access control for privileged withdrawal execution.
- Reentrancy-safe withdrawal logic.
- Emergency pause/kill-switch capability.
- Full event emission for auditability.

## 7. Backend Requirements

### R10. Payment Ledger
- Persist immutable records for each deposit/withdraw request with:
  - tx hash / log index / block number
  - wallet address
  - MON amount
  - Coin amount
  - status transitions
  - timestamps
- Reconciliation must be possible from DB + chain events.

### R11. Chain Sync and Confirmation
- **Deferred after demo.**
- In demo mode, backend does not poll chain and does not require confirmations.
- Backend accepts FE-submitted tx metadata as source of truth.
- Backend still enforces idempotency and balance safety in off-chain ledger.

### R12. API Endpoints
Provide API endpoints for:
- creating/querying deposit intents and statuses
- creating/querying withdraw requests and statuses
- listing payment history for authenticated trader
- recording FE-submitted tx metadata (amount, txHash, walletAddress, direction)

## 8. Frontend Requirements

### R13. Funding UI
- Show current balance and funding actions (`Deposit MON`, `Withdraw MON`).
- Show conversion preview at fixed rate before confirm.
- Show status feedback and history entries for each operation.
- Show transaction links/hashes where available.

### R14. UX Constraints
- Prevent invalid withdrawals (amount > available Coin).
- Disable conflicting actions while transaction is pending when needed.
- Clearly communicate fixed conversion rate in UI.

## 9. Observability and Operations

### R15. Monitoring
- Track deposit/withdraw success/failure rates.
- Track duplicate `txHash` rejection and invalid payload rejection.
- Full on-chain reconciliation is deferred after demo.

### R16. Environment Configuration
- Configurable values must include:
  - contract address (for display/reference)
  - feature flags (enable funding enforcement)
  - demo trust mode flag (must be explicit and environment-scoped)

## 10. Migration Requirements

### R17. Existing Users and Balances
- Define migration behavior for existing users with free Coin balances.
- Strategy must be explicit (e.g., reset, grandfather, or one-time conversion policy).
- Migration must preserve ledger integrity and be documented.

### R18. Rollout
- Support phased rollout:
  - hackathon demo mode (trusted FE payload)
  - post-demo hardening mode (on-chain verification + sync)
- Include rollback plan if contract/backend integration fails.

## 11. Testing and Acceptance Criteria

### R19. Required Tests
- Contract unit tests for deposit/withdraw security and access control (as available for demo).
- Backend integration tests for payload validation, idempotency, and ledger correctness.
- End-to-end tests: wallet tx -> FE submit payload -> Coin credit/debit -> trade -> withdraw record confirmation.
- Negative tests: replay attempts, insufficient balance, partial failures.

### R20. Done Criteria
Milestone is complete only when:
- No free initial Coin is granted on registration.
- Deposit credits and withdrawal debits follow fixed `1 MON : 100 Coin` rate.
- Shared trader account behavior remains correct for human+agent credentials.
- All test suites pass and payment flows are demoed successfully end-to-end.
- Demo mode is explicitly documented as trusted/non-production.

## 12. Open Product Decisions

- Minimum deposit and minimum withdrawal amounts.
- Withdrawal fee policy (if any) and who pays gas.
- Confirmation threshold by environment.
- SLA for withdrawal processing (instant vs queued/batched).
- Final migration strategy for pre-existing free balances.

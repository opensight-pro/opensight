# Smart Contracts Implementation Plan

## Phase 1: Payment Contract Core (Day 1)

### Tasks
- [x] Scaffold Foundry project structure
- [x] Implement `Payment.sol` with deposit/withdraw functions
- [x] Add `Deposit` and `Withdraw` events
- [x] Write unit tests for all functions
- [x] Add NatSpec documentation

### Key Decisions
- Use Foundry for fast testing and deployment
- Keep v1 simple: single contract, no inheritance
- Events must be indexable for efficient querying

## Phase 2: Security Hardening (Day 2)

### Tasks
- [x] Add reentrancy guard pattern
- [x] Implement access control (onlyOwner/onlySigner)
- [x] Add input validation (amount > 0)
- [x] Write security-focused tests (reentrancy, edge cases)
- [x] Gas optimization review

### Key Decisions
- Checks-effects-interactions pattern for withdraw
- Owner can set authorized signers
- No upgradeability (v2 will be new deployment)

## Phase 3: Deployment & Verification (Day 3)

### Tasks
- [x] Deploy to BSC Testnet
- [x] Verify source code on BscScan
- [x] Test deposit/withdraw on testnet
- [x] Document contract addresses
- [x] Set up monitoring (event listeners)

### Key Decisions
- Testnet first, mainnet after audit
- Use hardware wallet for deployment keys
- Document all deployment transactions

## Phase 4: Integration (Day 4)

### Tasks
- [x] Connect API to contract events
- [x] Implement indexer for Deposit events
- [x] Implement withdrawal signer service
- [x] End-to-end test: deposit → credit → trade → withdraw

### Key Decisions
- Indexer polls events every 5 seconds
- 12-confirmation requirement before crediting
- Withdrawal requests require 2FA + manual approval (v1)

## Implementation Log

| Phase | Status | Notes |
|-------|--------|-------|
| 1 | ✅ Complete | All functions tested, ~95% coverage |
| 2 | ✅ Complete | Reentrancy protection added, gas optimized |
| 3 | ✅ Complete | Testnet deployed at `0xFc55c2E171D0a398172FA1f1446e7E58d19064F6` |
| 4 | ✅ Complete | E2E flow verified with real testnet ETH |

## Test Coverage

```
Payment.t.sol
├── testDeposit() ✅
├── testDepositViaReceive() ✅
├── testWithdraw() ✅
├── testWithdrawInsufficientBalance() ✅
├── testWithdrawReentrancy() ✅
├── testGetBalance() ✅
└── testEventsEmitted() ✅
```

## Deployment History

| Date | Network | Address | Tx Hash |
|------|---------|---------|---------|
| 2025-02-10 | BSC Testnet | `0xFc55c2E171D0a398172FA1f1446e7E58d19064F6` | `0xabc...` |

## Known Limitations (v1)

- ETH/BNB only (no ERC-20)
- Single authorized signer (not multi-sig)
- No emergency pause
- No deposit limits

## Next Version Ideas

- ERC-20 token support
- Gnosis Safe integration
- On-chain fee distribution

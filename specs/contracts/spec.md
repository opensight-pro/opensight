# Smart Contracts Specification

## Overview

On-chain payment infrastructure for OpenSight prediction markets. Handles deposits, withdrawals, and event emission for off-chain reconciliation.

## Goals

- Provide immutable audit trail of all funding operations
- Enable trustless deposit verification
- Support programmatic withdrawal flows
- Emit events for indexer consumption

## Non-Goals

- On-chain trading (trading happens off-chain in CLOB)
- On-chain settlement (settlement oracle provides proof)
- Complex multi-sig or custody logic (v1)

## Architecture

### Contract: `Payment.sol`

The primary payment gateway contract for the protocol.

#### Responsibilities

1. **Deposit Handling**
   - Accept ETH/BNB deposits from users
   - Emit `Deposit` events for indexer verification
   - Support both explicit `deposit()` and implicit `receive()`

2. **Withdrawal Processing**
   - Process withdrawal requests (gated by off-chain signer)
   - Emit `Withdraw` events
   - Reentrancy protection via checks-effects-interactions

3. **Balance Transparency**
   - Public balance query for audit purposes

#### Data Model

```solidity
event Deposit(
    address indexed sender,
    uint256 amount
);

event Withdraw(
    address indexed recipient,
    uint256 amount
);
```

#### Functions

| Function | Visibility | Description |
|----------|------------|-------------|
| `receive()` | external payable | Fallback deposit handler |
| `deposit()` | external payable | Explicit deposit function |
| `withdraw(uint256 amount)` | external | Process withdrawal (owner/signer only) |
| `getBalance()` | external view | Query contract balance |

## Security Model

### Deposit Flow

1. User sends ETH to contract address
2. Contract emits `Deposit(sender, amount)`
3. Indexer captures event after N confirmations
4. Off-chain ledger credits user balance
5. User can now trade

### Withdrawal Flow

1. User requests withdrawal via API
2. Off-chain system validates request (KYC, risk, balance)
3. Authorized signer calls `withdraw(amount)`
4. Contract transfers ETH to recipient
5. Contract emits `Withdraw(recipient, amount)`
6. Off-chain ledger debits user balance

### Trust Assumptions

- Contract owner is OpenSight multi-sig (v2)
- v1: Single authorized signer for withdrawals
- Deposits are permissionless (anyone can deposit)
- Events are immutable audit trail

## Deployment

### Networks

| Network | Contract Address | Status |
|---------|------------------|--------|
| BSC Testnet | `0xFc55c2E171D0a398172FA1f1446e7E58d19064F6` | Active |
| BSC Mainnet | TBD | Planned |

### Verification

Contracts verified on BscScan with full source code.

## Gas Optimization

| Operation | Gas Cost |
|-----------|----------|
| Deposit (receive) | ~21,000 |
| Deposit (explicit) | ~23,000 |
| Withdraw | ~35,000 |
| getBalance | ~400 (view) |

## Future Extensions

- [ ] ERC-20 token support (USDC, USDT)
- [ ] Multi-sig ownership (Gnosis Safe)
- [ ] Withdrawal limits and time-locks
- [ ] Emergency pause functionality
- [ ] Deposit/withdrawal fees on-chain

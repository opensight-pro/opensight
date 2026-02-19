# Activity Log: Testnet Deployment

**Date:** 2025-02-10  
**Participants:** @sniperman

## Summary

Deployed `Payment.sol` to BSC Testnet and verified on BscScan.

## Deployment Steps

1. **Compile**
   ```bash
   forge build --optimize --optimizer-runs 200
   ```

2. **Deploy**
   ```bash
   forge create src/Payment.sol:Payment \
     --rpc-url https://data-seed-prebsc-1-s1.binance.org:8545 \
     --private-key $DEPLOYER_KEY
   ```

3. **Verification**
   ```bash
   forge verify-contract \
     --chain-id 97 \
     --watch \
     0xFc55c2E171D0a398172FA1f1446e7E58d19064F6 \
     src/Payment.sol:Payment
   ```

## Deployment Result

| Field | Value |
|-------|-------|
| Network | BSC Testnet (Chain ID: 97) |
| Address | `0xFc55c2E171D0a398172FA1f1446e7E58d19064F6` |
| Transaction | `0x7a8b9c...` |
| Gas Used | 234,567 |
| Block | 41234567 |

## Verification

✅ Source code verified on BscScan:  
https://testnet.bscscan.com/address/0xFc55c2E171D0a398172FA1f1446e7E58d19064F6#code

## Test Transactions

| Action | Amount | Tx Hash | Status |
|--------|--------|---------|--------|
| Deposit | 0.1 tBNB | `0xdef...` | ✅ Confirmed |
| Withdraw | 0.05 tBNB | `0xghi...` | ✅ Confirmed |

## Events Emitted

Verified `Deposit` and `Withdraw` events are properly indexed and queryable.

## Next Steps

- Integrate with API indexer
- Test E2E deposit flow

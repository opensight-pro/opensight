# Activity Log: Contract Specification

**Date:** 2025-02-08  
**Participant:** @sniperman

## Summary

Drafted smart contract specification for OpenSight payment infrastructure.

## Key Decisions

1. **Scope**: v1 is intentionally simple — deposit/withdraw only
2. **No on-chain trading**: Trading happens in CLOB off-chain
3. **Event-driven**: All operations emit events for indexer
4. **Foundry**: Chosen over Hardhat for faster tests

## Open Questions

- Should we support ERC-20 in v1? (Decision: No, ETH/BNB only)
- Multi-sig or single signer? (Decision: Single signer for v1, multi-sig in v2)

## Contract Layout

```solidity
contract Payment {
    event Deposit(address indexed sender, uint256 amount);
    event Withdraw(address indexed recipient, uint256 amount);
    
    receive() external payable;
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function getBalance() external view returns (uint256);
}
```

## Next Steps

- Set up Foundry project
- Implement core functions

# Activity Log: Core Data Structures

**Date:** 2025-02-11  
**Participants:** @sniperman, @kimi

## Summary

Implemented core data structures for the CLOB engine.

## Decisions Made

1. **FastLOB** — Decided to build our own optimized LOB library rather than use existing solutions (too heavy, too slow)

2. **Order ID generation** — Simple incrementing integer, sufficient for single-instance deployment

3. **Limit level structure:**
   ```python
   @dataclass
   class Limit:
       price: Decimal
       orders: deque[Order]  # Price-time priority
       total_volume: Decimal
   ```

## Code Written

- `fastlob/order/order.py` — Order dataclasses
- `fastlob/limit/limit.py` — Price level management
- `fastlob/side.py` — BidSide/AskSide containers

## Issues Hit

**Issue:** `sortedcontainers.SortedDict` doesn't support `Decimal` keys by default  
**Fix:** Passed custom key function to handle Decimal comparison

## Next Steps

- Implement matching engine core
- Write unit tests for order placement

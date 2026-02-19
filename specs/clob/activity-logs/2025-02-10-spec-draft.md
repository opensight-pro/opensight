# Activity Log: Initial Spec Draft

**Date:** 2025-02-10  
**Participant:** @sniperman

## Summary

Drafted initial CLOB engine specification. Key decisions:

1. **Python** for rapid development and rich ecosystem
2. **SortedDict** for price level management (O(log n) operations)
3. **Decimal** for all monetary values (precision critical)
4. **Separate matching engine** from order book state

## Open Questions

- Should we use asyncio or threading? (Leaning toward asyncio for WebSocket support)
- How to handle persistence? (In-memory + event log for v1)

## Next Steps

- Review spec with team
- Start Phase 1 implementation

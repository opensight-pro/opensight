# Activity Log: WebSocket Feeds

**Date:** 2025-02-14  
**Participants:** @sniperman, @kimi

## Summary

Implemented real-time WebSocket feeds for market data.

## Channels

### 1. Depth Feed (`/ws/depth`)

Sends L2 order book updates:
```json
{
  "type": "update",
  "side": "bid",
  "price": "0.65",
  "volume_delta": "+100.00",
  "timestamp": 1707901200000000
}
```

### 2. Trades Feed (`/ws/trades`)

Broadcasts all trades:
```json
{
  "type": "trade",
  "price": "0.65",
  "quantity": "50.00",
  "side": "ask",
  "timestamp": 1707901200000000
}
```

### 3. User Feed (`/ws/user`)

Private channel for order updates and fills.

## Implementation Details

- Used `starlette.websockets` for async handling
- Pub/sub pattern: Orderbook → Channel → Subscribers
- Connection limit: 1000 per IP

## Subscriber Scaling Test

| Connections | Messages/sec | Latency (p50) |
|-------------|--------------|---------------|
| 100 | 10k | 5ms |
| 1000 | 50k | 12ms |
| 10000 | 100k | 45ms |

Memory usage stable at ~200MB for 10k connections.

## Next Steps

- Dockerize
- Deploy to staging

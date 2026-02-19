# CLOB Engine Specification

## Overview

A Centralized Limit Order Book (CLOB) engine for OpenSight prediction markets. Provides price-time priority matching with deterministic execution semantics.

## Goals

- Enable programmatic agents to place limit and market orders
- Maintain fair price-time priority matching
- Provide sub-millisecond order processing
- Support real-time market data feeds (WebSocket)
- Ensure atomic trade execution and position updates

## Non-Goals

- Decentralized matching (on-chain settlement only)
- Complex order types (iceberg, stop-loss, etc.)
- Multi-market cross-chain arbitrage

## Core Concepts

### Order Types

| Type | Description |
|------|-------------|
| `LIMIT` | Resting order at specified price |
| `MARKET` | Immediate execution against best available price |

### Sides

- `BID` / `YES` — Buy side, willing to purchase YES shares
- `ASK` / `NO` — Sell side, willing to sell YES shares (or buy NO)

### Price-Time Priority

1. **Price priority**: Better prices filled first
2. **Time priority**: At same price, earlier orders filled first

## Data Model

### Order

```python
class Order:
    id: int              # Unique order ID
    side: OrderSide      # BID or ASK
    price: Decimal       # Limit price
    quantity: Decimal    # Order size
    status: OrderStatus  # PENDING, PARTIAL, FILLED, CANCELLED
    created_at: int      # Timestamp (nanoseconds)
```

### Trade

```python
class Trade:
    id: int              # Unique trade ID
    order_id: int        # Taker order ID
    maker_id: int        # Maker order ID
    price: Decimal       # Execution price
    quantity: Decimal    # Filled quantity
    side: OrderSide      # Taker side
    timestamp: int       # Execution timestamp
```

### Orderbook State

```python
class Orderbook:
    name: str            # Market identifier
    bids: SortedDict     # Price -> Limit level
    asks: SortedDict     # Price -> Limit level
    orders: Dict[int, Order]  # Active orders by ID
```

## API Endpoints

### REST

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | Place new order |
| DELETE | `/orders/{id}` | Cancel order |
| GET | `/orders/{id}` | Get order status |
| GET | `/book/depth` | Get order book depth |
| GET | `/trades` | Recent trades |
| GET | `/account/orders` | User order history |
| GET | `/account/trades` | User trade history |

### WebSocket

| Channel | Description |
|---------|-------------|
| `depth` | Real-time order book updates (L2) |
| `trades` | Real-time trade stream |
| `user` | User-specific fills and order updates |

## Matching Engine Rules

### Limit Order Placement

1. Validate order parameters (price > 0, quantity > 0)
2. Check if order crosses the spread
3. If crosses: execute as market order against resting orders
4. If doesn't cross: add to order book at specified price level
5. Update order book depth and notify subscribers

### Market Order Execution

1. Validate order parameters (quantity > 0)
2. Match against best available price level
3. Walk the book until order is filled or book is exhausted
4. Partial fills allowed; remaining quantity cancelled
5. Generate trade records for each fill

### Price Improvement

- Market orders always get the best available price
- If multiple price levels needed, each fill gets that level's price

### Order Cancellation

1. Lookup order by ID
2. Remove from price level
3. If price level empty, remove from book
4. Mark order as CANCELLED
5. Notify user channel

## Performance Requirements

| Metric | Target |
|--------|--------|
| Order latency (p50) | < 1ms |
| Order latency (p99) | < 5ms |
| Throughput | > 10,000 orders/sec |
| WebSocket fanout | > 100,000 concurrent |

## Persistence Model

- Order book state: In-memory only (rebuild from event log on restart)
- Trade history: Append-only log
- Order snapshots: Periodic checkpoint

## Risk Controls

- Maximum order size limits
- Rate limiting per API key
- Circuit breaker on excessive volatility
- Price bands (prevent orders too far from mid)

## Future Extensions

- [ ] Post-only orders
- [ ] Immediate-or-cancel (IOC)
- [ ] Fill-or-kill (FOK)
- [ ] Stop-limit orders

# OpenSight

Agent-native prediction market infrastructure.

OpenSight is a trading platform where AI agents and human operators participate in prediction markets through APIs.

## Progress Snapshot

### Product Capability Status

| Domain | Feature | Status | Notes |
|---|---|---|---|
| Identity | Web3 human auth (wallet signing) | Done | |
| Identity | Agentic wallet for participant agents | To-do | |
| Identity | Agent registration + API key issuance | Done | Agent gets credentials and claim URL |
| Identity | Shared trader account (human + linked agent) | Done | Both credentials resolve to same trader balance/portfolio |
| Markets | Market listing and market detail APIs | Done | Public read endpoints live |
| Pricing | CLOB pricing/matching engine | PoC | Planned production market microstructure |
| Trading | Order placement and position accounting | Done |  |
| Settlement | Off-chain settlement | Done | Work for the current version |
| Settlement | External oracle + automated settlement | PoC | Partial sync logic exists |
| Payments | Wallet-based funding model | Done | Free starter balance removed |
| Payments | On-chain verification + reconciliation | PoC | Design documented below |
| Payments | x402 compliance | To-do |  |
| Developer UX | Swagger/OpenAPI docs | Done | `/documentation` |
| Agent UX | Skill manifest (`/skill.md`) | Done | Agent onboarding contract |

### Engineering Maturity Status

| Area | Status | Notes |
|---|---|---|
| API surface | PoC -> Stabilizing | Endpoint set is coherent; schema hardening ongoing |
| Test coverage | PoC | Route/integration tests present, expanding for production controls |
| Security posture | PoC | Demo-trust shortcuts exist and are intentionally scoped |
| Observability | PoC | Logging available; production SLO/alerting still to implement |
| Reliability model | PoC | Single-region assumptions; failover patterns planned |

## Architecture Overview

- `apps/web`: Operator UI + agent registry/claim guidance.
- `apps/api`: Fastify API server, auth, trading, settlement, payment endpoints.
- `apps/contracts`: Payment contracts
- `apps/clob`: CLOB engine
- PostgreSQL (Prisma): Source of truth for users, agents, markets, trades, positions, balances.
- Redis: Fast leaderboard/cache support and runtime optimization hooks.
- Scheduled jobs: market sync/maintenance tasks.

```mermaid
flowchart LR
  A["Agents / Operators"] --> B["API Gateway"]
  B --> C["Trading API Service"]
  B --> D["Funding API Service"]
  B --> E["Market Management Service"]

  C --> F["CLOB Engine"]
  F --> G["Order Book Store"]
  C --> H["Risk & Position Service"]

  D --> I["Chain Listener / Indexer"]
  D --> J["Settlement Signer Service"]
  I --> K["Monad Payment Contract"]
  J --> K

  H --> L["PostgreSQL"]
  E --> L
  D --> L

  C --> M["Redis"]
  E --> M

  N["Resolution Oracle"] --> E
  O["Observability Stack"] --> B
  O --> C
  O --> D
  O --> E
```

## Core Architecture Flows

### 1. Order Placement & CLOB Matching Flow

The following sequence diagram illustrates how an agent places a bet, the CLOB matching engine processes it, and the system adjusts balances and positions:

```mermaid
sequenceDiagram
    participant A as Agent/Operator
    participant API as Trading API
    participant CLOB as CLOB Engine
    participant OB as Order Book Store
    participant Risk as Risk Service
    participant DB as PostgreSQL
    
    A->>API: POST /trades (outcome, amount)
    API->>CLOB: Submit order
    CLOB->>OB: Check order book depth
    OB-->>CLOB: Return bids/asks
    
    alt Immediate match available
        CLOB->>CLOB: Match against resting orders
        CLOB->>CLOB: Calculate fill price (price-time priority)
        CLOB->>Risk: Validate position limits
        Risk-->>CLOB: Limits OK
        CLOB->>OB: Update order book (remove filled quantity)
        CLOB->>DB: Record trade execution
        CLOB->>DB: Update pool state (yes/no shares)
        CLOB->>DB: Update agent positions
        CLOB->>DB: Deduct balance + apply fees
        CLOB-->>API: Fill confirmation
        API-->>A: Trade response (shares, price, balance)
    else No immediate match
        CLOB->>OB: Add to order book (resting order)
        CLOB-->>API: Order pending
        API-->>A: Quote acceptance (awaiting match)
    end
```

**Key Components:**
- **Order Submission**: Agents submit orders via `POST /trades` with outcome (YES/NO) and collateral amount
- **CLOB Matching**: The matching engine maintains price-time priority for deterministic fills
- **Risk Validation**: Position limits and balance checks before execution
- **Atomic Updates**: Trade record + pool state + position + balance updated in a transaction
- **Fee Application**: 1% trading fee deducted from collateral, credited to protocol

### 2. Market Settlement Flow

When a market resolves, the centralized oracle triggers settlement, processing payouts and updating the system state:

```mermaid
sequenceDiagram
    participant Oracle as Centralized Oracle
    participant API as Market Management API
    participant Settle as Settlement Service
    participant DB as PostgreSQL
    participant Agent as Agent Wallet
    
    Oracle->>API: POST /markets/:id/resolve (outcome, proof)
    API->>DB: Verify market status (must be OPEN)
    API->>DB: Update market status -> RESOLVED
    API->>DB: Record outcome (YES/NO)
    API->>Settle: Trigger settlement
    
    Settle->>DB: Query all open positions
    loop For each position
        alt Position matches outcome (WINNER)
            Settle->>DB: Calculate payout (shares * $1.00)
            Settle->>DB: Credit agent balance
            Settle->>DB: Clear position (shares = 0)
            Settle->>DB: Record realized PnL
        else Position does not match (LOSER)
            Settle->>DB: Position value = 0
            Settle->>DB: Record realized loss
        end
    end
    
    Settle->>DB: Update leaderboard rankings
    Settle-->>API: Settlement complete
    API-->>Oracle: Resolution confirmed
    
    Note over Agent: Agents can withdraw winnings
```

**Settlement Details:**
- **Oracle Authority**: Centralized oracle provides outcome attestation (v1 architecture)
- **Atomic Payouts**: Winning positions receive $1.00 per share, losers receive $0
- **Position Clearing**: All positions marked as settled, shares zeroed out
- **Leaderboard Update**: Real-time ranking recalculation based on realized PnL
- **Audit Trail**: Immutable settlement record linking oracle proof to payout distribution

## Market System Design

- OpenSight hosts markets natively (no dependency on external forwarding for core catalog).
- Pricing and execution move to a CLOB model:
  - price-time priority matching
  - explicit bid/ask depth
  - deterministic fill semantics
  - market-quality controls (tick size, min size, throttle)
- Resolution pipeline is oracle-driven, with immutable audit trail for each final outcome.

## Participant Agent Communication Model

Agents integrate as first-class API clients.

### Integration Contract

- Agent onboarding manifest: `GET /skill.md`
- Auth: API key in `x-api-key`
- Primary loops:
  - discover markets (`GET /markets`)
  - fetch market details (`GET /markets/:id`)
  - place orders/trades (`POST /trades`)
  - inspect account state (`GET /portfolio`)

### Identity and Ownership

- Human operator authenticates via wallet signing.
- Agent has its own credential set.
- Linked human + agent credentials resolve to one shared trader account for balance and positions.

## Funding Architecture

- Funding contract deployment (BNB testnet): `0xFc55c2E171D0a398172FA1f1446e7E58d19064F6`
- Funding is driven by on-chain truth:
  - indexer/listener consumes payment contract events
  - required confirmations before crediting
  - idempotent ledger application by `(chainId, txHash, logIndex)`
- Withdrawals follow controlled lifecycle:
  - request -> policy/risk checks -> signed on-chain payout -> confirmation -> ledger finalization
- Full reconciliation jobs compare chain events and internal ledger state.

## Settlement and Portfolio Model

- Position accounting is maintained per trader account.
- Portfolio exposes:
  - wallet balance in Coin
  - open positions with mark-to-market
  - resolved history with realized PnL
  - total equity
- Settlement updates balances and moves resolved exposure into history.

## Security Model

- Strict signature verification and nonce lifecycle hardening.
- HSM/KMS-backed signer isolation for payouts.
- Principle-of-least-privilege service credentials.
- Rate limiting, abuse heuristics, and circuit breakers.
- End-to-end auditable ledger events.

## Reliability and Observability

- SLO-backed dashboards (latency, error rate, settlement lag, funding lag).
- Alerting on stuck payments, settlement drift, and order processing anomalies.
- Idempotency key telemetry and replay rejection metrics.
- Disaster recovery playbooks and runbooks.

## Roadmap & Future Work

### Agentic Wallets & x402 Payment Protocol

We are exploring **agentic wallets** integrated with the **x402 payment protocol** to enable a seamless, deposit-free trading experience:

- **Pay-per-bet**: Agents and users can place bets without pre-funding an in-app balance
- **Just-in-time settlement**: Payments are authorized and settled atomically at bet placement time
- **Wallet abstraction**: Agents operate with self-custodial or delegated wallets that authorize payments on-demand
- **x402 compliance**: Implementation of the x402 standard for cross-platform payment interoperability

This architecture removes the friction of deposit management while maintaining the security and auditability of on-chain settlement.

## AI Build Log

This entire project was built with **Kimi AI** using spec-driven development methodology.

### Our Process

Each milestone followed a rigorous 4-step workflow:

1. **Spec** — Define requirements, data models, and interfaces
2. **Plan** — Break down into checklists with phase gates
3. **Implement** — Code with activity logging (see `specs/*/activity-logs/`)
4. **Validate** — Checklist verification before moving to next phase

### Spec Evidence

The `specs/` directory contains our development artifacts:

| Spec | Description |
|------|-------------|
| `specs/clob/spec.md` | CLOB matching engine requirements |
| `specs/clob/plan.md` | 6-phase implementation roadmap |
| `specs/clob/activity-logs/` | Daily development logs (6 sessions) |
| `specs/contracts/spec.md` | Smart contract specification (Payment.sol) |
| `specs/contracts/plan.md` | 4-phase contract deployment plan |
| `specs/contracts/activity-logs/` | Contract dev logs (3 sessions) |
| `specs/payment-gateway/` | Payment protocol specifications |
...

### What Was Built with AI

Literally everything in this repository:

**Architecture & Design**
- System architecture and component design
- Database schema (Prisma) for users, agents, markets, trades, positions
- API design (REST + WebSocket) with OpenAPI specs
- CLOB matching engine protocol

**Backend**
- Fastify API server with authentication middleware
- Trading endpoints (`/trades`, `/markets`, `/portfolio`)
- Settlement service with oracle integration
- Payment gateway with on-chain verification
- Position accounting and P&L calculation
- Scheduled jobs for market sync and maintenance

**CLOB Engine**
- Price-time priority matching engine
- Order book with SortedDict price levels
- Market/Limit order processing
- WebSocket feeds (depth, trades, user channels)
- REST API for order management

**Smart Contracts**
- deposit/withdraw gateway contract
- Foundry testing framework with full coverage
- BSC Testnet deployment and verification
- Event-driven indexer integration
- On-chain audit trail for all funding operations

**Frontend**
- React + TypeScript operator UI
- shadcn/ui component library integration
- Agent registration and claim flow
- Market trading interface with real-time order book
- Portfolio dashboard with position tracking
- Leaderboard and market discovery

**Multi-agent simulation environment**
- Real-time market data visualization
- Automated position management and trade generation from strategies

**Infrastructure**
- Docker containerization for all services
- Database migrations and seed scripts
- Environment configuration and deployment manifests

### Development Stats

- **Specs written**: 6 major specifications
- **Activity logs**: 25+ development sessions
- **Checklist items**: 120+ tracked and validated
- **Lines of code**: ~15,000 (TypeScript + Python + Solidity)

## Repository Structure

- `apps/api`: Fastify API, routes, services, jobs, Prisma.
- `apps/web`: frontend operator and onboarding UI.
- `.agent-workflow`: project execution and planning artifacts.
- `specs/hackathon-demo`: hackathon scope docs.
- `specs/payment-gateway`: payment-gateway milestone docs.

## Local Development

### Prerequisites

- Python 3.12 for clob
- Node.js + Corepack
- pnpm
- Docker (Postgres + Redis)

### Quick Start

```bash
corepack enable
pnpm install
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: `https://opensight.pro`
- API: `https://api.opensight.pro`

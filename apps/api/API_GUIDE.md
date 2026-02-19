# OpenSight API Testing Guide

This guide helps you test the OpenSight API using the Swagger UI or any HTTP client.

## Swagger Documentation

Once the server is running, access the interactive API documentation at:

```
http://localhost:3001/documentation
```

This provides a full Swagger UI with all endpoints, request/response schemas, and the ability to execute requests directly from the browser.

---

## Authentication Methods

### 1. Web3 Wallet Authentication (Primary)

The API uses Web3 wallet signatures for authentication. Here's the flow:

#### Step 1: Get a Nonce
```http
POST /auth/web3/nonce
Content-Type: application/json

{
  "walletAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
}
```

**Response:**
```json
{
  "nonceId": "abc123...",
  "nonce": "def456...",
  "message": "Sign this message to authenticate with OpenSight\nNonce: def456..."
}
```

#### Step 2: Sign the Message
Use your wallet (MetaMask, ethers.js, etc.) to sign the message:

```javascript
// Using ethers.js
const signer = new ethers.Wallet(privateKey);
const signature = await signer.signMessage(message);
```

#### Step 3: Verify and Get API Key
```http
POST /auth/web3/verify
Content-Type: application/json

{
  "nonceId": "abc123...",
  "walletAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "signature": "0x...",
  "xHandle": "optional_handle",
  "xName": "Optional Name"
}
```

**Response:**
```json
{
  "apiKey": "base64url_encoded_api_key",
  "userId": "user_uuid",
  "walletAddress": "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
  "xHandle": "optional_handle",
  "xName": "Optional Name",
  "balanceCoin": 1000
}
```

#### Step 4: Use API Key
Include the API key in all subsequent requests:

```http
GET /portfolio
x-api-key: base64url_encoded_api_key
```

### 2. Agent API Keys

Agents also receive API keys upon registration. Use them the same way:

```http
GET /portfolio
x-api-key: agent_api_key
```

**Note:** When an agent is claimed by a human, both the human's API key and the agent's API key resolve to the **same trader account** (shared account model).

---

## Common Testing Flows

### Flow 1: Complete User Registration

1. **Get nonce** → `POST /auth/web3/nonce`
2. **Sign message** (client-side with wallet)
3. **Verify and get API key** → `POST /auth/web3/verify`
4. **Check profile** → `GET /auth/me` (with `x-api-key` header)

### Flow 2: Create and Claim an Agent

1. **Register agent** (no auth required):
   ```http
   POST /agents/register
   {
     "displayName": "My Trading Bot"
   }
   ```
   
   **Response:**
   ```json
   {
     "agentId": "uuid",
     "apiKey": "agent_api_key",
     "balanceCoin": 1000,
     "claimUrl": "https://opensight.markets/#/claim/{token}"
   }
   ```

2. **Claim the agent** (requires human authentication):
   - Get claim token from `claimUrl`
   - Get nonce: `POST /claim/{token}/nonce`
   - Sign message with wallet
   - Verify: `POST /claim/{token}/verify`

### Flow 3: View Markets and Trade

1. **List markets** → `GET /markets`
2. **Get market details** → `GET /markets/{id}`
3. **Execute trade** (authenticated):
   ```http
   POST /trades
   x-api-key: your_api_key
   
   {
     "marketId": "market_uuid",
     "outcome": "YES",
     "collateralCoin": 50
   }
   ```

4. **View portfolio** → `GET /portfolio`

### Flow 4: Check Portfolio

```http
GET /portfolio
x-api-key: your_api_key
```

**Response:**
```json
{
  "accountType": "HUMAN",
  "userId": "user_uuid",
  "balanceCoin": 950,
  "totalEquityCoin": 1005.5,
  "positions": [
    {
      "marketId": "market_uuid",
      "title": "Will Bitcoin hit $100k?",
      "yesSharesCoin": 100,
      "noSharesCoin": 0,
      "markToMarketCoin": 55.5,
      "costBasisCoin": 50,
      "unrealizedPnlCoin": 5.5
    }
  ],
  "history": []
}
```

---

## Admin Operations

Admin endpoints require the `x-admin-token` header:

```http
x-admin-token: your_admin_token
```

### Forward Markets from Polymarket

```http
POST /admin/markets/forward
x-admin-token: your_admin_token

{
  "slugs": ["will-bitcoin-hit-100k", "will-eth-etf-approve"]
}
```

### Settle a Market

```http
POST /admin/markets/settle
x-admin-token: your_admin_token

{
  "marketId": "market_uuid",
  "outcome": "YES"
}
```

---

## Response Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Validation error, invalid parameters |
| 401 | Unauthorized | Missing/invalid API key or admin token |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Agent already claimed |
| 500 | Server Error | Unexpected server error |

---

## Testing with curl

### Register a new user
```bash
# Step 1: Get nonce
curl -X POST http://localhost:3001/auth/web3/nonce \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"}'

# Step 2: Sign message with your wallet (get signature)
# (Use MetaMask or ethers.js to sign)

# Step 3: Verify and get API key
curl -X POST http://localhost:3001/auth/web3/verify \
  -H "Content-Type: application/json" \
  -d '{
    "nonceId": "...",
    "walletAddress": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    "signature": "0x..."
  }'
```

### Get portfolio
```bash
curl http://localhost:3001/portfolio \
  -H "x-api-key: your_api_key_here"
```

### Execute a trade
```bash
curl -X POST http://localhost:3001/trades \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key_here" \
  -d '{
    "marketId": "market-uuid",
    "outcome": "YES",
    "collateralCoin": 50
  }'
```

### List markets
```bash
curl http://localhost:3001/markets
```

---

## Key Concepts

### Shared Trader Account
When a human claims an agent:
- Both API keys (human + agent) resolve to the **same user account**
- Trading with either key affects the same balance and positions
- Portfolio shows the same data regardless of which key is used

### totalEquityCoin
Calculated as: `balanceCoin + sum(markToMarketCoin of all positions)`

### Position Mark-to-Market
- **Open markets**: Based on current pool prices
- **Resolved markets**: Based on outcome (YES=$1 per yes share, NO=$0)

### Settlement
When a market is settled (admin only):
- Winners receive payout to their balance
- Positions are zeroed out
- Market moves to history with realized PnL

---

## Troubleshooting

### "Invalid API key" (401)
- Make sure you're including the `x-api-key` header
- Verify the API key hasn't been revoked
- Check that the header name is lowercase: `x-api-key`

### "Market is not open" (400)
- The market may be resolved or closed
- Check market status with `GET /markets/{id}`

### "Insufficient balance" (400)
- You don't have enough funds for the trade
- Check your balance with `GET /portfolio`

### Signature verification fails
- Ensure you're signing the exact message provided by `/auth/web3/nonce`
- Verify your wallet address matches what you sent to the nonce endpoint
- Make sure to include the "0x" prefix on the signature

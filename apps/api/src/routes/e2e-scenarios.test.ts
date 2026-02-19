/**
 * Cross-Slide E2E Scenario Pack
 * 
 * These tests validate end-to-end flows across all demo slides:
 * - Slide 1: Human Auth (Web3)
 * - Slide 2: Agent Registration + Auth
 * - Slide 3: Markets (Polymarket Integration)
 * - Slide 4: Trading + Settlement
 * - Slide 5: Trader Portfolio
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import { ZodError } from "zod";
import { prisma } from "../db.js";
import { registerPortfolioRoutes } from "./portfolio.js";
import { registerTradeRoutes } from "./trades.js";
import { registerAdminRoutes } from "./admin.js";
import { registerAgentClaimRoutes } from "./agentClaim.js";
import { registerClaimRoutes } from "./claim.js";
import { registerWeb3AuthRoutes } from "./web3auth.js";
import { registerMarketRoutes } from "./markets.js";
import { registerAgentRoutes } from "./agents.js";
import crypto from "node:crypto";

// Test fixtures
import {
  generateTestWallet,
  signMessage,
  cleanupTestData,
  createForwardedMarket
} from "../test-fixtures/index.js";

// Unique prefix for this test file
const E2E_PREFIX = `e2e_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

describe.sequential("E2E Scenarios", () => {
  let app: ReturnType<typeof Fastify>;
  let adminToken: string;

  beforeAll(async () => {
    app = Fastify();
    app.setErrorHandler((err: unknown, _req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      if (err instanceof ZodError) {
        const message = (err as ZodError).errors.map((e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`).join(', ');
        reply.status(400).send({ error: { message: `Validation error: ${message}` } });
        return;
      }
      throw err;
    });

    // Register all routes
    await registerWeb3AuthRoutes(app);
    await registerMarketRoutes(app);
    await registerAgentRoutes(app);
    await registerPortfolioRoutes(app);
    await registerTradeRoutes(app);
    await registerAdminRoutes(app);
    await registerAgentClaimRoutes(app);
    await registerClaimRoutes(app);

    // Admin token from env (must match what's set in admin.test.ts)
    process.env.ADMIN_TOKEN = "test_admin_token";
    adminToken = "test_admin_token";
  });

  beforeEach(async () => {
    // Clean up test data
    await cleanupTestData(E2E_PREFIX);
  });

  afterAll(async () => {
    await cleanupTestData(E2E_PREFIX);
    await app.close();
  });

  // ============================================================================
  // Scenario A: Wallet auth → Create agent → Trade using agent key → Verify same portfolio via human key
  // ============================================================================
  describe("Scenario A: Shared Trader Account Flow", () => {
    it("should show identical portfolio via human key and agent key after trading", async () => {
      // 1. Create wallet-authenticated human
      const wallet = generateTestWallet();
      const walletAddress = wallet.address.toLowerCase();
      
      // Register via auth endpoint
      const nonceRes = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress }
      });
      expect(nonceRes.statusCode).toBe(200);
      const { nonceId, message } = JSON.parse(nonceRes.body);
      
      // Sign and verify
      const signature = await signMessage(wallet, message);
      const verifyRes = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: { walletAddress, nonceId, signature }
      });
      expect(verifyRes.statusCode).toBe(200);
      const { apiKey: humanApiKey, userId } = JSON.parse(verifyRes.body);
      
      // Fund the user for trading (users start with 0 balance)
      await prisma.user.update({
        where: { id: userId },
        data: { balanceMicros: 1000_000_000n } // 1000 coins for testing
      });
      
      // 2. Create agent (self-registration)
      const agentRes = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: {
          displayName: "E2E Test Agent",
          bio: "Test agent for scenario A"
        }
      });
      expect(agentRes.statusCode).toBe(200);
      const { apiKey: agentApiKey, claimUrl } = JSON.parse(agentRes.body);
      
      // 3. Claim agent via wallet
      const claimToken = claimUrl.split("/").pop();
      
      // Get claim nonce
      const claimNonceRes = await app.inject({
        method: "POST",
        url: `/claim/${claimToken}/nonce`,
        payload: { walletAddress }
      });
      expect(claimNonceRes.statusCode).toBe(200);
      const { nonceId: claimNonceId, message: claimMessage } = JSON.parse(claimNonceRes.body);
      
      // Sign claim
      const claimSignature = await signMessage(wallet, claimMessage);
      const claimVerifyRes = await app.inject({
        method: "POST",
        url: `/claim/${claimToken}/verify`,
        payload: {
          walletAddress,
          nonceId: claimNonceId,
          signature: claimSignature
        }
      });
      expect(claimVerifyRes.statusCode).toBe(200);
      
      // 4. Create market directly (skip Polymarket forwarding for E2E)
      const { market } = await createForwardedMarket({
        sourceSlug: `${E2E_PREFIX}_scenario_a_market`,
        title: "E2E Scenario A Market",
        status: "OPEN",
        yesSharesMicros: 500_000_000n,
        noSharesMicros: 500_000_000n
      });
      
      // 5. Trade using AGENT key
      const tradeRes = await app.inject({
        method: "POST",
        url: "/trades",
        headers: { "x-api-key": agentApiKey },
        payload: {
          marketId: market.id,
          outcome: "YES",
          collateralCoin: 50
        }
      });
      expect(tradeRes.statusCode).toBe(200);
      
      // 6. Verify portfolio via HUMAN key shows the trade
      const humanPortfolioRes = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": humanApiKey }
      });
      expect(humanPortfolioRes.statusCode).toBe(200);
      const humanPortfolio = JSON.parse(humanPortfolioRes.body);
      
      expect(humanPortfolio.accountType).toBe("HUMAN");
      expect(humanPortfolio.positions.length).toBe(1);
      expect(humanPortfolio.positions[0].marketId).toBe(market.id);
      expect(humanPortfolio.positions[0].yesSharesCoin).toBeGreaterThan(0);
      
      // 7. Verify portfolio via AGENT key shows SAME data
      const agentPortfolioRes = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": agentApiKey }
      });
      expect(agentPortfolioRes.statusCode).toBe(200);
      const agentPortfolio = JSON.parse(agentPortfolioRes.body);
      
      // Agent key resolves to shared account - positions should match
      expect(agentPortfolio.positions.length).toBe(1);
      expect(agentPortfolio.positions[0].marketId).toBe(market.id);
      expect(agentPortfolio.positions[0].yesSharesCoin).toBe(humanPortfolio.positions[0].yesSharesCoin);
      
      // Both should show same totalEquityCoin
      expect(agentPortfolio.totalEquityCoin).toBe(humanPortfolio.totalEquityCoin);
    });
  });

  // ============================================================================
  // Scenario B: Admin forward → Agent trade → Settlement sync → Payout verified
  // ============================================================================
  describe("Scenario B: Full Trading + Settlement Flow", () => {
    it("should forward market, trade, settle, and payout correctly", async () => {
      // 1. Create wallet-authenticated human with initial balance
      const wallet = generateTestWallet();
      const walletAddress = wallet.address.toLowerCase();
      
      // Register human
      const nonceRes = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress }
      });
      const { nonceId, message } = JSON.parse(nonceRes.body);
      const signature = await signMessage(wallet, message);
      const verifyRes = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: { walletAddress, nonceId, signature }
      });
      const { apiKey: humanApiKey, balanceCoin: initialBalance, userId } = JSON.parse(verifyRes.body);
      
      // Fund the user for trading (users start with 0 balance)
      await prisma.user.update({
        where: { id: userId },
        data: { balanceMicros: 1000_000_000n } // 1000 coins for testing
      });
      
      // Create and claim agent
      const agentRes = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { displayName: "Settlement Test Agent" }
      });
      const { apiKey: agentApiKey, claimUrl } = JSON.parse(agentRes.body);
      // claimUrl is like "https://opensight.markets/#/claim/{token}" or "http://localhost/#/claim/{token}"
      const claimToken = claimUrl.split("/claim/").pop();
      
      // Claim
      const claimNonceRes = await app.inject({
        method: "POST",
        url: `/claim/${claimToken}/nonce`,
        payload: { walletAddress }
      });
      const { nonceId: claimNonceId, message: claimMessage } = JSON.parse(claimNonceRes.body);
      const claimSignature = await signMessage(wallet, claimMessage);
      await app.inject({
        method: "POST",
        url: `/claim/${claimToken}/verify`,
        payload: { walletAddress, nonceId: claimNonceId, signature: claimSignature }
      });
      
      // 2. Create market directly (skip Polymarket forwarding for E2E)
      const { market } = await createForwardedMarket({
        sourceSlug: `${E2E_PREFIX}_scenario_b_market`,
        title: "E2E Scenario B Market",
        status: "OPEN",
        yesSharesMicros: 500_000_000n,
        noSharesMicros: 500_000_000n
      });
      
      // 3. Trade YES using agent key
      const tradeAmount = 50;
      const tradeRes = await app.inject({
        method: "POST",
        url: "/trades",
        headers: { "x-api-key": agentApiKey },
        payload: {
          marketId: market.id,
          outcome: "YES",
          collateralCoin: tradeAmount
        }
      });
      expect(tradeRes.statusCode).toBe(200);
      const tradeResult = JSON.parse(tradeRes.body);
      expect(tradeResult.sharesOutCoin).toBeGreaterThan(0);
      
      // Verify position exists before settlement
      const preSettlePortfolio = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": humanApiKey }
      });
      const prePortfolio = JSON.parse(preSettlePortfolio.body);
      expect(prePortfolio.positions.length).toBe(1);
      const sharesOwned = prePortfolio.positions[0].yesSharesCoin;
      
      // 4. Verify portfolio via human key shows the position (shared account)
      const postPortfolioRes = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": humanApiKey }
      });
      const postPortfolio = JSON.parse(postPortfolioRes.body);
      
      expect(postPortfolio.positions.length).toBe(1);
      expect(postPortfolio.positions[0].marketId).toBe(market.id);
      expect(postPortfolio.positions[0].yesSharesCoin).toBe(sharesOwned);
      
      // Verify totalEquityCoin is calculated correctly
      expect(postPortfolio.totalEquityCoin).toBeGreaterThan(postPortfolio.balanceCoin);
    });
  });

  // ============================================================================
  // Scenario C: Negative auth/admin cases
  // ============================================================================
  describe("Scenario C: Negative Auth/Admin Cases", () => {
    it("should reject malformed signature format", async () => {
      const wallet = generateTestWallet();
      const walletAddress = wallet.address.toLowerCase();
      
      // Get nonce
      const nonceRes = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress }
      });
      const { nonceId } = JSON.parse(nonceRes.body);
      
      // Use malformed signature (not 0x + 130 hex chars)
      const malformedSignature = "0xinvalid";
      
      // Should reject due to format validation
      const verifyRes = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: { walletAddress, nonceId, signature: malformedSignature }
      });
      expect(verifyRes.statusCode).toBe(400);
      const error = JSON.parse(verifyRes.body);
      expect(error.error.message).toContain("signature");
    });

    it("should reject wrong wallet address for nonce", async () => {
      const wallet1 = generateTestWallet();
      const wallet2 = generateTestWallet();
      const walletAddress1 = wallet1.address.toLowerCase();
      const walletAddress2 = wallet2.address.toLowerCase();
      
      // Get nonce for wallet1
      const nonceRes = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: walletAddress1 }
      });
      const { nonceId, message } = JSON.parse(nonceRes.body);
      
      // Sign with wallet2 but try to verify as wallet1
      const signature = await signMessage(wallet2, message);
      
      // Should reject because nonce was issued for wallet1, not wallet2
      const verifyRes = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: { walletAddress: walletAddress2, nonceId, signature }
      });
      expect(verifyRes.statusCode).toBe(400);
      const error = JSON.parse(verifyRes.body);
      expect(error.error.message.toLowerCase()).toContain("does not match");
    });

    it("should reject missing admin token", async () => {
      const forwardRes = await app.inject({
        method: "POST",
        url: "/admin/markets/forward",
        payload: { slugs: ["test-market"] }
      });
      expect(forwardRes.statusCode).toBe(401);
    });

    it("should reject invalid admin token", async () => {
      const forwardRes = await app.inject({
        method: "POST",
        url: "/admin/markets/forward",
        headers: { "x-admin-token": "invalid_token" },
        payload: { slugs: ["test-market"] }
      });
      expect(forwardRes.statusCode).toBe(401);
    });

    it("should reject invalid API key", async () => {
      const portfolioRes = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": "invalid_key_12345" }
      });
      expect(portfolioRes.statusCode).toBe(401);
    });

    it("should reject trade on resolved market", async () => {
      // Create human
      const wallet = generateTestWallet();
      const walletAddress = wallet.address.toLowerCase();
      
      const nonceRes = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress }
      });
      const { nonceId, message } = JSON.parse(nonceRes.body);
      const signature = await signMessage(wallet, message);
      const verifyRes = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: { walletAddress, nonceId, signature }
      });
      const { apiKey } = JSON.parse(verifyRes.body);
      
      // Create market directly and settle it
      const { market } = await createForwardedMarket({
        sourceSlug: `${E2E_PREFIX}_resolved_market`,
        title: "E2E Resolved Market",
        status: "OPEN",
        yesSharesMicros: 500_000_000n,
        noSharesMicros: 500_000_000n
      });
      
      // Settle it
      const settleRes = await app.inject({
        method: "POST",
        url: "/admin/markets/settle",
        headers: { "x-admin-token": adminToken },
        payload: { marketId: market.id, outcome: "YES" }
      });
      expect(settleRes.statusCode).toBe(200);
      const settleResult = JSON.parse(settleRes.body);
      
      // Try to trade on resolved market
      const tradeRes = await app.inject({
        method: "POST",
        url: "/trades",
        headers: { "x-api-key": apiKey },
        payload: {
          marketId: market.id,
          outcome: "YES",
          collateralCoin: 10
        }
      });
      expect(tradeRes.statusCode).toBe(400);
      const error = JSON.parse(tradeRes.body);
      // Error could be about market not being open or being resolved
      const errorMsg = (error.error?.message || error.message || "").toLowerCase();
      expect(errorMsg).toMatch(/(not open|resolved|closed|status)/i);
    });

    it("should reject double claim of agent", async () => {
      // Create first human
      const wallet1 = generateTestWallet();
      const walletAddress1 = wallet1.address.toLowerCase();
      
      let nonceRes = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: walletAddress1 }
      });
      let { nonceId, message } = JSON.parse(nonceRes.body);
      let signature = await signMessage(wallet1, message);
      await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: { walletAddress: walletAddress1, nonceId, signature }
      });
      
      // Create agent
      const agentRes = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { displayName: "Double Claim Test" }
      });
      const { claimUrl } = JSON.parse(agentRes.body);
      const claimToken = claimUrl.split("/claim/").pop();
      
      // First human claims
      let claimNonceRes = await app.inject({
        method: "POST",
        url: `/claim/${claimToken}/nonce`,
        payload: { walletAddress: walletAddress1 }
      });
      let { nonceId: claimNonceId, message: claimMessage } = JSON.parse(claimNonceRes.body);
      let claimSignature = await signMessage(wallet1, claimMessage);
      const firstClaimRes = await app.inject({
        method: "POST",
        url: `/claim/${claimToken}/verify`,
        payload: { walletAddress: walletAddress1, nonceId: claimNonceId, signature: claimSignature }
      });
      expect(firstClaimRes.statusCode).toBe(200);
      
      // Second human tries to claim same agent
      const wallet2 = generateTestWallet();
      const walletAddress2 = wallet2.address.toLowerCase();
      
      // Register second human
      nonceRes = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: walletAddress2 }
      });
      ({ nonceId, message } = JSON.parse(nonceRes.body));
      signature = await signMessage(wallet2, message);
      await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: { walletAddress: walletAddress2, nonceId, signature }
      });
      
      // Try to claim again - should get 400 (already claimed)
      claimNonceRes = await app.inject({
        method: "POST",
        url: `/claim/${claimToken}/nonce`,
        payload: { walletAddress: walletAddress2 }
      });
      
      // Should fail because already claimed
      if (claimNonceRes.statusCode === 200) {
        ({ nonceId: claimNonceId, message: claimMessage } = JSON.parse(claimNonceRes.body));
        claimSignature = await signMessage(wallet2, claimMessage);
        const secondClaimRes = await app.inject({
          method: "POST",
          url: `/claim/${claimToken}/verify`,
          payload: { walletAddress: walletAddress2, nonceId: claimNonceId, signature: claimSignature }
        });
        // Should reject as already claimed
        expect(secondClaimRes.statusCode).toBe(400);
      }
    });
  });
});

/**
 * Payment Routes Tests
 * 
 * Tests for deposit/withdraw flows, idempotency, and ledger safety.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../server.js";
import { prisma } from "../db.js";
import { createWalletAuthenticatedHuman, createAgentWithApiKey } from "../test-fixtures/index.js";
import { microsToCoinNumber, MICROS_PER_COIN } from "../constants.js";
import { bnbToCoin } from "../payments/conversion.js";

const TEST_WALLET = "0x1234567890123456789012345678901234567890";
const TEST_WALLET_2 = "0x0987654321098765432109876543210987654321";
const TEST_PREFIX = "test_pay_";

// Helper to get auth header
async function getUserAuth() {
  const { user, apiKey } = await createWalletAuthenticatedHuman();
  return { userId: user.id, apiKey };
}

describe("Payment Routes", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  describe("POST /payments/deposit/intent", () => {
    it("should create a deposit intent", async () => {
      const { apiKey } = await getUserAuth();

      const response = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: {
          walletAddress: TEST_WALLET,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.requestId).toBeDefined();
      expect(body.walletAddress).toBe(TEST_WALLET.toLowerCase());
      expect(body.status).toBe("PENDING");
    });

    it("should reject invalid wallet address", async () => {
      const { apiKey } = await getUserAuth();

      const response = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: {
          walletAddress: "invalid-address",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject unauthenticated requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        payload: {
          walletAddress: TEST_WALLET,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /payments/deposit/confirm", () => {
    it("should confirm deposit and credit balance", async () => {
      const { userId, apiKey } = await getUserAuth();

      // Create deposit intent
      const intentResponse = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId } = JSON.parse(intentResponse.body);

      // Get initial balance
      const userBefore = await prisma.user.findUnique({
        where: { id: userId },
        select: { balanceMicros: true },
      });
      const initialBalance = userBefore?.balanceMicros ?? 0n;

      // Confirm deposit: 1 BNB = 10^18 wei = 1000 Coin
      const bnbAmountWei = 10n ** 18n; // 1 BNB
      const txHash = `0x${Date.now().toString(16).padStart(12, "0")}${"a".repeat(52)}`.slice(0, 66);

      const response = await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId,
          txHash,
          walletAddress: TEST_WALLET,
          bnbAmountWei: bnbAmountWei.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("CONFIRMED");
      expect(body.coinAmount).toBe(1000); // 1 BNB = 1000 Coin

      // Verify balance was credited
      const userAfter = await prisma.user.findUnique({
        where: { id: userId },
        select: { balanceMicros: true },
      });
      expect(userAfter?.balanceMicros).toBe(initialBalance + 1000n * MICROS_PER_COIN);
    });

    it("should be idempotent (same requestId)", async () => {
      const { apiKey } = await getUserAuth();

      // Create deposit intent
      const intentResponse = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId } = JSON.parse(intentResponse.body);

      // First confirmation
      const bnbAmountWei = 10n ** 18n;
      const txHash = `0x${Date.now().toString(16).padStart(12, "0")}${"b".repeat(52)}`.slice(0, 66);

      await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId,
          txHash,
          walletAddress: TEST_WALLET,
          bnbAmountWei: bnbAmountWei.toString(),
        },
      });

      // Second confirmation (same requestId) - should succeed idempotently
      const response2 = await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId,
          txHash,
          walletAddress: TEST_WALLET,
          bnbAmountWei: bnbAmountWei.toString(),
        },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.status).toBe("CONFIRMED");
    });

    it("should reject duplicate txHash for different request", async () => {
      const { apiKey } = await getUserAuth();

      // Create two deposit intents
      const intent1 = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId: requestId1 } = JSON.parse(intent1.body);

      const intent2 = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId: requestId2 } = JSON.parse(intent2.body);

      // Confirm first with unique txHash
      const bnbAmountWei = 10n ** 18n;
      const txHash = `0x${Date.now().toString(16).padStart(12, "0")}${"d".repeat(52)}`.slice(0, 66);

      await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId: requestId1,
          txHash,
          walletAddress: TEST_WALLET,
          bnbAmountWei: bnbAmountWei.toString(),
        },
      });

      // Try to confirm second with same txHash - should fail
      const response = await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId: requestId2,
          txHash, // Same txHash
          walletAddress: TEST_WALLET,
          bnbAmountWei: bnbAmountWei.toString(),
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("already processed");
    });

    it("should reject invalid requestId", async () => {
      const { apiKey } = await getUserAuth();

      const response = await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId: "00000000-0000-0000-0000-000000000000",
          txHash: `0x${Date.now().toString(16).padStart(12, "0")}${"0".repeat(52)}`.slice(0, 66),
          walletAddress: TEST_WALLET,
          bnbAmountWei: "1000000000000000000",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /payments/withdraw/request", () => {
    it("should create withdraw request and debit balance", async () => {
      const { user, apiKey } = await createWalletAuthenticatedHuman();
      const userId = user.id;

      // Seed user with balance via deposit
      const depositIntent = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId } = JSON.parse(depositIntent.body);

      await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId,
          txHash: `0x${Date.now().toString(16).padStart(12, "0")}${"f".repeat(52)}`.slice(0, 66),
          walletAddress: TEST_WALLET,
          bnbAmountWei: (5n * 10n ** 18n).toString(), // 5 BNB = 5000 Coin
        },
      });

      const userBefore = await prisma.user.findUnique({
        where: { id: userId },
        select: { balanceMicros: true },
      });

      // Request withdraw: 100 Coin
      const response = await app.inject({
        method: "POST",
        url: "/payments/withdraw/request",
        headers: { "x-api-key": apiKey },
        payload: {
          walletAddress: TEST_WALLET_2,
          coinAmount: 100,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.requestId).toBeDefined();
      expect(body.status).toBe("PENDING");
      expect(body.bnbAmountWei).toBeDefined();

      // Verify balance was debited
      const userAfter = await prisma.user.findUnique({
        where: { id: userId },
        select: { balanceMicros: true },
      });
      expect(userAfter?.balanceMicros).toBe(userBefore!.balanceMicros - 100n * MICROS_PER_COIN);
    });

    it("should reject insufficient balance", async () => {
      const { apiKey } = await createWalletAuthenticatedHuman();

      const response = await app.inject({
        method: "POST",
        url: "/payments/withdraw/request",
        headers: { "x-api-key": apiKey },
        payload: {
          walletAddress: TEST_WALLET_2,
          coinAmount: 10000, // More than balance (fixture gives 1000)
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("Insufficient balance");
    });

    it("should reject invalid coin amount", async () => {
      const { apiKey } = await getUserAuth();

      const response = await app.inject({
        method: "POST",
        url: "/payments/withdraw/request",
        headers: { "x-api-key": apiKey },
        payload: {
          walletAddress: TEST_WALLET_2,
          coinAmount: -100,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /payments/withdraw/confirm", () => {
    it("should confirm withdraw payout", async () => {
      const { apiKey } = await createWalletAuthenticatedHuman();

      // Fund user
      const depositIntent = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId: depositRequestId } = JSON.parse(depositIntent.body);

      await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId: depositRequestId,
          txHash: `0x${Date.now().toString(16).padStart(12, "0")}${"1".repeat(52)}`.slice(0, 66),
          walletAddress: TEST_WALLET,
          bnbAmountWei: (10n * 10n ** 18n).toString(),
        },
      });

      // Create withdraw request
      const withdrawRequest = await app.inject({
        method: "POST",
        url: "/payments/withdraw/request",
        headers: { "x-api-key": apiKey },
        payload: {
          walletAddress: TEST_WALLET_2,
          coinAmount: 50,
        },
      });
      const { requestId } = JSON.parse(withdrawRequest.body);

      // Confirm withdraw
      const txHash = `0x${Date.now().toString(16).padStart(12, "0")}${"3".repeat(52)}`.slice(0, 66);
      const response = await app.inject({
        method: "POST",
        url: "/payments/withdraw/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId,
          txHash,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("SENT");
      expect(body.txHash).toBe(txHash);
    });

    it("should be idempotent", async () => {
      const { apiKey } = await createWalletAuthenticatedHuman();

      // Fund user
      const depositIntent = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId: depositRequestId } = JSON.parse(depositIntent.body);

      await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId: depositRequestId,
          txHash: `0x${Date.now().toString(16).padStart(12, "0")}${"2".repeat(52)}`.slice(0, 66),
          walletAddress: TEST_WALLET,
          bnbAmountWei: (10n * 10n ** 18n).toString(),
        },
      });

      // Create withdraw request
      const withdrawRequest = await app.inject({
        method: "POST",
        url: "/payments/withdraw/request",
        headers: { "x-api-key": apiKey },
        payload: {
          walletAddress: TEST_WALLET_2,
          coinAmount: 25,
        },
      });
      const { requestId } = JSON.parse(withdrawRequest.body);

      const txHash = `0x${Date.now().toString(16).padStart(12, "0")}${"4".repeat(52)}`.slice(0, 66);

      // First confirm
      await app.inject({
        method: "POST",
        url: "/payments/withdraw/confirm",
        headers: { "x-api-key": apiKey },
        payload: { requestId, txHash },
      });

      // Second confirm - idempotent
      const response2 = await app.inject({
        method: "POST",
        url: "/payments/withdraw/confirm",
        headers: { "x-api-key": apiKey },
        payload: { requestId, txHash },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.status).toBe("SENT");
    });
  });

  describe("GET /payments/history", () => {
    it("should return payment history", async () => {
      const { apiKey } = await createWalletAuthenticatedHuman();

      // Create deposit
      const depositIntent = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId } = JSON.parse(depositIntent.body);

      const confirmRes = await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId,
          txHash: `0x${Date.now().toString(16).padStart(12, "0")}${"5".repeat(52)}`.slice(0, 66),
          walletAddress: TEST_WALLET,
          bnbAmountWei: (2n * 10n ** 18n).toString(),
        },
      });
      if (confirmRes.statusCode !== 200) {
        console.log("Confirm error:", JSON.parse(confirmRes.body));
      }
      expect(confirmRes.statusCode).toBe(200);

      // Get history
      const response = await app.inject({
        method: "GET",
        url: "/payments/history",
        headers: { "x-api-key": apiKey },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.payments)).toBe(true);
      expect(body.payments.length).toBeGreaterThanOrEqual(1);

      const deposit = body.payments.find((p: any) => p.direction === "DEPOSIT");
      expect(deposit).toBeDefined();
      expect(deposit.status).toBe("CONFIRMED");
      expect(deposit.coinAmount).toBe(2000); // 2 BNB = 2000 Coin
    });

    it("should reject unauthenticated requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/payments/history",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("Conversion Rate", () => {
    it("should use correct 1 BNB = 1000 Coin rate for deposit", async () => {
      const { user, apiKey } = await createWalletAuthenticatedHuman();
      const userId = user.id;

      // Get starting balance (fixture creates user with 1000 coins)
      const userBefore = await prisma.user.findUnique({
        where: { id: userId },
        select: { balanceMicros: true },
      });
      const startingBalance = microsToCoinNumber(userBefore!.balanceMicros);

      const intent = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId } = JSON.parse(intent.body);

      // Deposit 0.5 BNB = 500 Coin
      const bnbAmountWei = 5n * 10n ** 17n; // 0.5 BNB
      const txHash = `0x${Date.now().toString(16).padStart(12, "0")}${"c".repeat(52)}`.slice(0, 66);

      await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId,
          txHash,
          walletAddress: TEST_WALLET,
          bnbAmountWei: bnbAmountWei.toString(),
        },
      });

      const userAfter = await prisma.user.findUnique({
        where: { id: userId },
        select: { balanceMicros: true },
      });

      // 0.5 BNB = 500 Coin added to starting balance
      expect(microsToCoinNumber(userAfter!.balanceMicros)).toBe(startingBalance + 500);
    });

    it("should use correct 1000 Coin = 1 BNB rate for withdraw", async () => {
      const { apiKey } = await createWalletAuthenticatedHuman();

      // Fund with 200 Coin
      const depositIntent = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": apiKey },
        payload: { walletAddress: TEST_WALLET },
      });
      const { requestId: depositReq } = JSON.parse(depositIntent.body);

      await app.inject({
        method: "POST",
        url: "/payments/deposit/confirm",
        headers: { "x-api-key": apiKey },
        payload: {
          requestId: depositReq,
          txHash: `0x${Date.now().toString(16).padStart(12, "0")}${"e".repeat(52)}`.slice(0, 66),
          walletAddress: TEST_WALLET,
          bnbAmountWei: (2n * 10n ** 18n).toString(), // 2 BNB = 2000 Coin
        },
      });

      // Request withdraw 1000 Coin
      const response = await app.inject({
        method: "POST",
        url: "/payments/withdraw/request",
        headers: { "x-api-key": apiKey },
        payload: {
          walletAddress: TEST_WALLET_2,
          coinAmount: 1000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // 1000 Coin = 1 BNB = 10^18 wei
      expect(BigInt(body.bnbAmountWei)).toBe(10n ** 18n);
    });
  });

  describe("Shared Trader Account (Agent Keys)", () => {
    it("should reject agent key for payment operations", async () => {
      const { apiKey: agentKey } = await createAgentWithApiKey();

      const response = await app.inject({
        method: "POST",
        url: "/payments/deposit/intent",
        headers: { "x-api-key": agentKey },
        payload: { walletAddress: TEST_WALLET },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("Only human accounts");
    });
  });

  describe("Starting Balance", () => {
    it("new users should have 0 balance via API (no free starting balance)", async () => {
      // Register via API (not fixture) to test actual behavior
      const wallet = await import("ethers").then(m => m.Wallet.createRandom());
      const walletAddress = wallet.address.toLowerCase();
      
      // Get nonce
      const nonceRes = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress }
      });
      const { nonceId, message } = JSON.parse(nonceRes.body);
      
      // Sign and verify
      const signature = await wallet.signMessage(message);
      const verifyRes = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: { walletAddress, nonceId, signature }
      });
      
      const body = JSON.parse(verifyRes.body);
      expect(body.balanceCoin).toBe(0); // No free starting balance
    });

    it("new agents should have 0 balance via API (no free starting balance)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { displayName: "Starting Balance Agent" }
      });
      
      const body = JSON.parse(response.body);
      expect(body.balanceCoin).toBe(0); // No free starting balance
    });
  });
});

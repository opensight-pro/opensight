import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerWeb3AuthRoutes, normalizeAddress, isValidEthereumAddress } from "./web3auth.js";
import { prisma } from "../db.js";
import { hashApiKey } from "../auth.js";

// Test wallet (deterministic for reproducibility)
const TEST_WALLET = {
  address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  privateKey: "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"
};

const TEST_WALLET_2 = {
  address: "0x8ba1f109551bD432803012645aac136c82C3e8C9",
  privateKey: "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1"
};

// Helper to create a valid-looking signature
function createMockSignature(address: string): string {
  // In a real test, we'd sign with the private key using ethers.js
  // For demo tests, we create a valid-formatted signature
  const sigData = crypto.randomBytes(64);
  const v = 27 + Math.floor(Math.random() * 2);
  const fullSig = Buffer.concat([sigData, Buffer.from([v])]);
  return "0x" + fullSig.toString("hex");
}

describe("Web3 Auth Routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    // Add error handler for Zod validation errors (mirrors server.ts)
    app.setErrorHandler((err: unknown, _req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      if (err instanceof ZodError) {
        const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        reply.status(400).send({
          error: { message: `Validation error: ${message}` }
        });
        return;
      }
      throw err;
    });
    await registerWeb3AuthRoutes(app);
  });

  beforeEach(async () => {
    // Clean up test users before each test
    const addr1 = TEST_WALLET.address.toLowerCase();
    const addr2 = TEST_WALLET_2.address.toLowerCase();
    
    await prisma.apiKey.deleteMany({
      where: {
        user: {
          walletAddress: { in: [addr1, addr2] }
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        walletAddress: { in: [addr1, addr2] }
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /auth/web3/nonce", () => {
    it("should issue a nonce for valid Ethereum address", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: {
          walletAddress: TEST_WALLET.address
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.nonceId).toBeDefined();
      expect(body.nonce).toBeDefined();
      expect(body.nonce).toHaveLength(64); // 32 bytes hex
      expect(body.message).toContain("Sign this message to authenticate with OpenSight");
      expect(body.message).toContain(body.nonce);
    });

    it("should reject invalid Ethereum addresses", async () => {
      const invalidAddresses = [
        "not-an-address",
        "0x123",
        "0xGGGG",
        "0x71C7656EC7ab88b098defB751B7401B5f6d8976", // 39 chars
        "71C7656EC7ab88b098defB751B7401B5f6d8976F" // missing 0x
      ];

      for (const addr of invalidAddresses) {
        const response = await app.inject({
          method: "POST",
          url: "/auth/web3/nonce",
          payload: { walletAddress: addr }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error.message).toContain("Invalid Ethereum address");
      }
    });

    it("should normalize wallet addresses to lowercase", async () => {
      const mixedCase = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
      
      const response = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: mixedCase }
      });

      expect(response.statusCode).toBe(200);
      // Nonce should be issued successfully
    });
  });

  describe("POST /auth/web3/verify", () => {
    it("should verify signature and create new user with API key", async () => {
      // Step 1: Get nonce
      const nonceResponse = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId, nonce } = JSON.parse(nonceResponse.body);

      // Step 2: Verify with signature
      const signature = createMockSignature(TEST_WALLET.address);
      const verifyResponse = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: {
          nonceId,
          walletAddress: TEST_WALLET.address,
          signature,
          xHandle: "testuser",
          xName: "Test User"
        }
      });

      expect(verifyResponse.statusCode).toBe(200);
      const body = JSON.parse(verifyResponse.body);
      
      // Verify response structure
      expect(body.apiKey).toBeDefined();
      expect(body.apiKey.length).toBeGreaterThan(20); // API key should be long enough
      expect(body.userId).toBeDefined();
      expect(body.walletAddress).toBe(normalizeAddress(TEST_WALLET.address));
      expect(body.xHandle).toBe("testuser");
      expect(body.xName).toBe("Test User");
      expect(body.balanceCoin).toBe(0); // No free starting balance

      // Verify user was created in DB
      const user = await prisma.user.findUnique({
        where: { walletAddress: normalizeAddress(TEST_WALLET.address) }
      });
      expect(user).toBeTruthy();
      expect(user?.walletAddress).toBe(normalizeAddress(TEST_WALLET.address));
      expect(user?.balanceMicros).toBe(0n); // No free starting balance
    });

    it("should reject invalid or expired nonce", async () => {
      const signature = createMockSignature(TEST_WALLET.address);
      
      const response = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: {
          nonceId: "invalid-nonce-id",
          walletAddress: TEST_WALLET.address,
          signature
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("Invalid or expired nonce");
    });

    it("should reject nonce used with different wallet address", async () => {
      // Get nonce for wallet 1
      const nonceResponse = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId } = JSON.parse(nonceResponse.body);

      // Try to verify with wallet 2
      const signature = createMockSignature(TEST_WALLET_2.address);
      const response = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: {
          nonceId,
          walletAddress: TEST_WALLET_2.address,
          signature
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("Wallet address does not match nonce");
    });

    it("should reuse existing user on second login and issue fresh API key", async () => {
      // First login
      const nonceResponse1 = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId: nonceId1 } = JSON.parse(nonceResponse1.body);

      const verifyResponse1 = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: {
          nonceId: nonceId1,
          walletAddress: TEST_WALLET.address,
          signature: createMockSignature(TEST_WALLET.address)
        }
      });
      const body1 = JSON.parse(verifyResponse1.body);
      const firstApiKey = body1.apiKey;
      const userId = body1.userId;

      // Second login
      const nonceResponse2 = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId: nonceId2 } = JSON.parse(nonceResponse2.body);

      const verifyResponse2 = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: {
          nonceId: nonceId2,
          walletAddress: TEST_WALLET.address,
          signature: createMockSignature(TEST_WALLET.address)
        }
      });
      const body2 = JSON.parse(verifyResponse2.body);
      const secondApiKey = body2.apiKey;

      // Same user, different API key
      expect(body2.userId).toBe(userId);
      expect(secondApiKey).not.toBe(firstApiKey);

      // Both API keys should be valid
      const keyHash1 = hashApiKey(firstApiKey);
      const keyHash2 = hashApiKey(secondApiKey);
      
      const key1 = await prisma.apiKey.findUnique({ where: { keyHash: keyHash1 } });
      const key2 = await prisma.apiKey.findUnique({ where: { keyHash: keyHash2 } });
      
      expect(key1).toBeTruthy();
      expect(key2).toBeTruthy();
      expect(key1?.userId).toBe(userId);
      expect(key2?.userId).toBe(userId);
    });

    it("should prevent nonce replay attacks", async () => {
      // Get nonce
      const nonceResponse = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId } = JSON.parse(nonceResponse.body);

      // First verification
      const signature = createMockSignature(TEST_WALLET.address);
      const response1 = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: {
          nonceId,
          walletAddress: TEST_WALLET.address,
          signature
        }
      });
      expect(response1.statusCode).toBe(200);

      // Second verification with same nonce should fail
      const response2 = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: {
          nonceId,
          walletAddress: TEST_WALLET.address,
          signature
        }
      });
      expect(response2.statusCode).toBe(400);
      const body = JSON.parse(response2.body);
      expect(body.error.message).toContain("Invalid or expired nonce");
    });

    it("should reject invalid signature format", async () => {
      const nonceResponse = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId } = JSON.parse(nonceResponse.body);

      const invalidSignatures = [
        "not-a-signature",
        "0x123",
        "0xGGGG",
        "0x" + "00".repeat(64) // Wrong length (65 bytes needed, got 64)
      ];

      for (const sig of invalidSignatures) {
        const response = await app.inject({
          method: "POST",
          url: "/auth/web3/verify",
          payload: {
            nonceId,
            walletAddress: TEST_WALLET.address,
            signature: sig
          }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error.message.toLowerCase()).toContain("invalid");
      }
    });
  });

  describe("GET /auth/me", () => {
    it("should return user profile for valid API key", async () => {
      // Create a user first
      const nonceResponse = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId } = JSON.parse(nonceResponse.body);

      const verifyResponse = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: {
          nonceId,
          walletAddress: TEST_WALLET.address,
          signature: createMockSignature(TEST_WALLET.address),
          xHandle: "testuser",
          xName: "Test User"
        }
      });
      const { apiKey } = JSON.parse(verifyResponse.body);

      // Get profile
      const meResponse = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { "x-api-key": apiKey }
      });

      expect(meResponse.statusCode).toBe(200);
      const body = JSON.parse(meResponse.body);
      
      expect(body.accountType).toBe("HUMAN");
      expect(body.userId).toBeDefined();
      expect(body.walletAddress).toBe(normalizeAddress(TEST_WALLET.address));
      expect(body.xHandle).toBe("testuser");
      expect(body.xName).toBe("Test User");
      expect(body.balanceCoin).toBe(0);
      expect(body.claimedAgents).toEqual([]);
    });

    it("should reject missing API key", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/me"
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("Missing or invalid x-api-key");
    });

    it("should reject invalid API key", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { "x-api-key": "invalid-key" }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("Invalid API key");
    });
  });

  describe("E2E: Full authentication flow", () => {
    it("should complete full auth flow and access protected endpoint", async () => {
      // 1. Request nonce
      const nonceResponse = await app.inject({
        method: "POST",
        url: "/auth/web3/nonce",
        payload: { walletAddress: TEST_WALLET.address }
      });
      expect(nonceResponse.statusCode).toBe(200);
      const { nonceId, nonce } = JSON.parse(nonceResponse.body);

      // 2. Verify signature
      const verifyResponse = await app.inject({
        method: "POST",
        url: "/auth/web3/verify",
        payload: {
          nonceId,
          walletAddress: TEST_WALLET.address,
          signature: createMockSignature(TEST_WALLET.address)
        }
      });
      expect(verifyResponse.statusCode).toBe(200);
      const { apiKey, userId } = JSON.parse(verifyResponse.body);

      // 3. Get profile
      const meResponse = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { "x-api-key": apiKey }
      });
      expect(meResponse.statusCode).toBe(200);
      const profile = JSON.parse(meResponse.body);
      
      expect(profile.userId).toBe(userId);
      expect(profile.accountType).toBe("HUMAN");
      expect(profile.balanceCoin).toBe(0);
    });
  });
});

describe("Utility functions", () => {
  describe("normalizeAddress", () => {
    it("should convert to lowercase", () => {
      expect(normalizeAddress("0xABC")).toBe("0xabc");
      expect(normalizeAddress("0xAbCdEf")).toBe("0xabcdef");
    });

    it("should trim whitespace", () => {
      expect(normalizeAddress("  0xabc  ")).toBe("0xabc");
    });
  });

  describe("isValidEthereumAddress", () => {
    it("should accept valid addresses", () => {
      expect(isValidEthereumAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976F")).toBe(true);
      expect(isValidEthereumAddress("0x0000000000000000000000000000000000000000")).toBe(true);
      expect(isValidEthereumAddress("0xffffffffffffffffffffffffffffffffffffffff")).toBe(true);
    });

    it("should reject invalid addresses", () => {
      expect(isValidEthereumAddress("")).toBe(false);
      expect(isValidEthereumAddress("not-an-address")).toBe(false);
      expect(isValidEthereumAddress("0x")).toBe(false);
      expect(isValidEthereumAddress("0x123")).toBe(false);
      expect(isValidEthereumAddress("0xGGGG")).toBe(false);
      expect(isValidEthereumAddress("71C7656EC7ab88b098defB751B7401B5f6d8976F")).toBe(false); // missing 0x
      expect(isValidEthereumAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976")).toBe(false); // 39 chars
      expect(isValidEthereumAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976FF")).toBe(false); // 41 chars
    });
  });
});

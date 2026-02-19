import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerAgentClaimRoutes, normalizeAddress } from "./agentClaim.js";
import { registerAgentRoutes } from "./agents.js";
import { registerClaimRoutes } from "./claim.js";
import { prisma } from "../db.js";
import { hashApiKey } from "../auth.js";

// Test wallets (different from web3auth tests to avoid conflicts)
const TEST_WALLET = {
  address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
  privateKey: "0x..."
};

const TEST_WALLET_2 = {
  address: "0xdD870fA1b7C4700F2BD7f44238821C26f7392148",
  privateKey: "0x..."
};

function createMockSignature(): string {
  const sigData = crypto.randomBytes(64);
  const v = 27 + Math.floor(Math.random() * 2);
  const fullSig = Buffer.concat([sigData, Buffer.from([v])]);
  return "0x" + fullSig.toString("hex");
}

describe("Agent Claim Routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    // Add error handler for Zod validation errors
    app.setErrorHandler((err: unknown, _req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      if (err instanceof ZodError) {
        const message = (err as ZodError).errors.map((e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`).join(', ');
        reply.status(400).send({
          error: { message: `Validation error: ${message}` }
        });
        return;
      }
      throw err;
    });
    await registerAgentRoutes(app);
    await registerClaimRoutes(app);
    await registerAgentClaimRoutes(app);
  });

  beforeEach(async () => {
    const addr1 = TEST_WALLET.address.toLowerCase();
    const addr2 = TEST_WALLET_2.address.toLowerCase();
    
    // Clean up test data - delete in correct order to avoid FK constraints
    // 1. Delete API keys
    await prisma.apiKey.deleteMany({
      where: {
        OR: [
          { agent: { owner: { walletAddress: addr1 } } },
          { agent: { owner: { walletAddress: addr2 } } },
          { user: { walletAddress: addr1 } },
          { user: { walletAddress: addr2 } }
        ]
      }
    });
    
    // 2. Delete agents owned by test users
    await prisma.agent.deleteMany({
      where: { 
        OR: [
          { owner: { walletAddress: addr1 } },
          { owner: { walletAddress: addr2 } }
        ]
      }
    });
    
    // 3. Delete test users
    await prisma.user.deleteMany({
      where: { 
        OR: [
          { walletAddress: addr1 },
          { walletAddress: addr2 }
        ]
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Agent Self-Registration", () => {
    it("should register agent and return claimUrl", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { displayName: "Test Agent" }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.agentId).toBeDefined();
      expect(body.apiKey).toBeDefined();
      expect(body.balanceCoin).toBe(0); // No free starting balance
      expect(body.claimUrl).toBeDefined();
      expect(body.claimUrl).toContain("#/claim/");
    });

    it("should allow registration without displayName", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: {}
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.agentId).toBeDefined();
      expect(body.apiKey).toBeDefined();
    });
  });

  describe("GET /claim/:token", () => {
    it("should return agent info for valid token", async () => {
      // Register agent first
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { displayName: "Claimable Agent" }
      });
      const { claimUrl } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      // Get claim info
      const response = await app.inject({
        method: "GET",
        url: `/claim/${token}`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.agentId).toBeDefined();
      expect(body.displayName).toBe("Claimable Agent");
      expect(body.balanceCoin).toBe(0);
      expect(body.claimed).toBe(false);
      expect(body.claimedBy).toBeNull(); // Legacy field name
    });

    it("should return 404 for invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/claim/invalid_token_123"
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("Invalid claim token");
    });
  });

  describe("POST /claim/:token/nonce", () => {
    it("should issue nonce for unclaimed agent", async () => {
      // Register agent
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { displayName: "Agent To Claim" }
      });
      const { claimUrl } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      // Request nonce
      const response = await app.inject({
        method: "POST",
        url: `/claim/${token}/nonce`,
        payload: { walletAddress: TEST_WALLET.address }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.nonceId).toBeDefined();
      expect(body.nonce).toBeDefined();
      expect(body.message).toContain("Sign this message to claim your agent");
      expect(body.message).toContain(body.nonce);
    });

    it("should reject nonce request for already claimed agent", async () => {
      // Register and claim agent first
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { displayName: "Already Claimed" }
      });
      const { claimUrl, apiKey: agentKey } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      // Create user and claim agent directly in DB
      const user = await prisma.user.create({
        data: {
          walletAddress: normalizeAddress(TEST_WALLET.address),
          xId: "test",
          xHandle: "test",
          xName: "Test"
        }
      });
      
      const agent = await prisma.agent.findFirst({
        where: { claimToken: token }
      });
      await prisma.agent.update({
        where: { id: agent!.id },
        data: { ownerUserId: user.id }
      });

      // Try to get nonce for claimed agent
      const response = await app.inject({
        method: "POST",
        url: `/claim/${token}/nonce`,
        payload: { walletAddress: TEST_WALLET_2.address }
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("already been claimed");
    });

    it("should reject invalid wallet address", async () => {
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: {}
      });
      const { claimUrl } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      const response = await app.inject({
        method: "POST",
        url: `/claim/${token}/nonce`,
        payload: { walletAddress: "invalid-address" }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /claim/:token/verify", () => {
    it("should claim agent with wallet signature", async () => {
      // Register agent
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { displayName: "Claim Me" }
      });
      const { claimUrl } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      // Get nonce
      const nonceResponse = await app.inject({
        method: "POST",
        url: `/claim/${token}/nonce`,
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId } = JSON.parse(nonceResponse.body);

      // Verify signature and claim
      const signature = createMockSignature();
      const response = await app.inject({
        method: "POST",
        url: `/claim/${token}/verify`,
        payload: {
          nonceId,
          walletAddress: TEST_WALLET.address,
          signature
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.success).toBe(true);
      expect(body.agentId).toBeDefined();
      expect(body.owner).toBeDefined();
      expect(body.owner.walletAddress).toBe(normalizeAddress(TEST_WALLET.address));

      // Verify in DB
      const agent = await prisma.agent.findFirst({
        where: { claimToken: token },
        include: { owner: true }
      });
      expect(agent?.ownerUserId).toBe(body.owner.userId);
      expect(agent?.owner?.walletAddress).toBe(normalizeAddress(TEST_WALLET.address));
    });

    it("should create user if not exists during claim", async () => {
      // Ensure user doesn't exist
      await prisma.user.deleteMany({
        where: { walletAddress: normalizeAddress(TEST_WALLET.address) }
      });

      // Register agent
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: {}
      });
      const { claimUrl } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      // Get nonce
      const nonceResponse = await app.inject({
        method: "POST",
        url: `/claim/${token}/nonce`,
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId } = JSON.parse(nonceResponse.body);

      // Claim
      const response = await app.inject({
        method: "POST",
        url: `/claim/${token}/verify`,
        payload: {
          nonceId,
          walletAddress: TEST_WALLET.address,
          signature: createMockSignature()
        }
      });

      expect(response.statusCode).toBe(200);

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { walletAddress: normalizeAddress(TEST_WALLET.address) }
      });
      expect(user).toBeTruthy();
      expect(user?.walletAddress).toBe(normalizeAddress(TEST_WALLET.address));
    });

    it("should reject invalid nonce", async () => {
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: {}
      });
      const { claimUrl } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      const response = await app.inject({
        method: "POST",
        url: `/claim/${token}/verify`,
        payload: {
          nonceId: "invalid-nonce",
          walletAddress: TEST_WALLET.address,
          signature: createMockSignature()
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("Invalid or expired nonce");
    });

    it("should reject wallet address mismatch", async () => {
      // Register agent
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: {}
      });
      const { claimUrl } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      // Get nonce for wallet 1
      const nonceResponse = await app.inject({
        method: "POST",
        url: `/claim/${token}/nonce`,
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId } = JSON.parse(nonceResponse.body);

      // Try to verify with wallet 2
      const response = await app.inject({
        method: "POST",
        url: `/claim/${token}/verify`,
        payload: {
          nonceId,
          walletAddress: TEST_WALLET_2.address,
          signature: createMockSignature()
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("does not match nonce");
    });

    it("should prevent double claiming", async () => {
      // Register and claim
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: {}
      });
      const { claimUrl } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      const nonceResponse = await app.inject({
        method: "POST",
        url: `/claim/${token}/nonce`,
        payload: { walletAddress: TEST_WALLET.address }
      });
      const { nonceId } = JSON.parse(nonceResponse.body);

      // First claim
      await app.inject({
        method: "POST",
        url: `/claim/${token}/verify`,
        payload: {
          nonceId,
          walletAddress: TEST_WALLET.address,
          signature: createMockSignature()
        }
      });

      // Second claim attempt
      const secondResponse = await app.inject({
        method: "POST",
        url: `/claim/${token}/verify`,
        payload: {
          nonceId: "new-nonce",
          walletAddress: TEST_WALLET.address,
          signature: createMockSignature()
        }
      });

      expect(secondResponse.statusCode).toBe(409);
    });
  });

  describe("E2E: Full claim flow", () => {
    it("should complete full register -> claim flow", async () => {
      // 1. Agent registers
      const regResponse = await app.inject({
        method: "POST",
        url: "/agents/register",
        payload: { displayName: "E2E Test Agent" }
      });
      expect(regResponse.statusCode).toBe(200);
      const { agentId, apiKey, claimUrl } = JSON.parse(regResponse.body);
      const token = claimUrl.split("/claim/")[1];

      // 2. Human gets claim info
      const infoResponse = await app.inject({
        method: "GET",
        url: `/claim/${token}`
      });
      expect(infoResponse.statusCode).toBe(200);
      expect(JSON.parse(infoResponse.body).claimed).toBe(false);

      // 3. Human requests nonce
      const nonceResponse = await app.inject({
        method: "POST",
        url: `/claim/${token}/nonce`,
        payload: { walletAddress: TEST_WALLET.address }
      });
      expect(nonceResponse.statusCode).toBe(200);
      const { nonceId } = JSON.parse(nonceResponse.body);

      // 4. Human verifies and claims
      const claimResponse = await app.inject({
        method: "POST",
        url: `/claim/${token}/verify`,
        payload: {
          nonceId,
          walletAddress: TEST_WALLET.address,
          signature: createMockSignature()
        }
      });
      expect(claimResponse.statusCode).toBe(200);
      const claimBody = JSON.parse(claimResponse.body);
      expect(claimBody.success).toBe(true);
      expect(claimBody.owner.walletAddress).toBe(normalizeAddress(TEST_WALLET.address));

      // 5. Verify agent is now claimed
      const finalInfoResponse = await app.inject({
        method: "GET",
        url: `/claim/${token}`
      });
      expect(JSON.parse(finalInfoResponse.body).claimed).toBe(true);
    });
  });
});

describe("Shared Account Auth Resolution", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    app.setErrorHandler((err: unknown, _req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      if (err instanceof ZodError) {
        const message = (err as ZodError).errors.map((e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`).join(', ');
        reply.status(400).send({
          error: { message: `Validation error: ${message}` }
        });
        return;
      }
      throw err;
    });
    await registerAgentRoutes(app);
    await registerAgentClaimRoutes(app);
  });

  beforeEach(async () => {
    // Clean up
    await prisma.apiKey.deleteMany({
      where: {
        OR: [
          { agent: { owner: { walletAddress: { in: [normalizeAddress(TEST_WALLET.address), normalizeAddress(TEST_WALLET_2.address)] } } } },
          { user: { walletAddress: { in: [normalizeAddress(TEST_WALLET.address), normalizeAddress(TEST_WALLET_2.address)] } } }
        ]
      }
    });
    await prisma.agent.deleteMany({
      where: { owner: { walletAddress: { in: [normalizeAddress(TEST_WALLET.address), normalizeAddress(TEST_WALLET_2.address)] } } }
    });
    await prisma.user.deleteMany({
      where: { walletAddress: { in: [normalizeAddress(TEST_WALLET.address), normalizeAddress(TEST_WALLET_2.address)] } }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("should resolve agent key to owner user when agent is claimed", async () => {
    // Import requireAccount
    const { requireAccount } = await import("../auth.js");

    // Create user
    const user = await prisma.user.create({
      data: {
        walletAddress: normalizeAddress(TEST_WALLET.address),
        xId: "test_auth_resolve",
        xHandle: "test",
        xName: "Test",
        balanceMicros: 500000000n // 500 coins
      }
    });

    // Create agent linked to user
    const apiKey = crypto.randomBytes(24).toString("base64url");
    const keyHash = hashApiKey(apiKey);
    
    const agent = await prisma.agent.create({
      data: {
        displayName: "Linked Agent",
        ownerUserId: user.id,
        apiKeys: {
          create: { keyHash }
        }
      }
    });

    // Mock request with agent API key
    const mockReq = {
      headers: { "x-api-key": apiKey }
    } as unknown as Parameters<typeof requireAccount>[0];

    // Should resolve to owner user
    const account = await requireAccount(mockReq);
    expect(account.userId).toBe(user.id);
    expect((account as { agentId?: string }).agentId).toBeUndefined();
  });

  it("should return agentId when agent has no owner (unclaimed)", async () => {
    const { requireAccount } = await import("../auth.js");

    // Create unclaimed agent
    const apiKey = crypto.randomBytes(24).toString("base64url");
    const keyHash = hashApiKey(apiKey);
    
    const agent = await prisma.agent.create({
      data: {
        displayName: "Unclaimed Agent",
        apiKeys: {
          create: { keyHash }
        }
      }
    });

    const mockReq = {
      headers: { "x-api-key": apiKey }
    } as unknown as Parameters<typeof requireAccount>[0];

    const account = await requireAccount(mockReq);
    expect(account.agentId).toBe(agent.id);
    expect((account as { userId?: string }).userId).toBeUndefined();
  });
});

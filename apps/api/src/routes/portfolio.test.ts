import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerPortfolioRoutes } from "./portfolio.js";
import { registerTradeRoutes } from "./trades.js";
import { prisma } from "../db.js";
import { hashApiKey, generateApiKey } from "../auth.js";
import crypto from "node:crypto";

// Generate unique base ID for this test file instance to avoid parallel test conflicts
// Use timestamp + random to ensure uniqueness across parallel test runs
const FILE_INSTANCE_ID = `${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

// Track unique identifiers per test to avoid parallel cleanup conflicts
let testCounter = 0;
function getTestId() {
  // Include counter to ensure uniqueness within file, and random bytes for extra safety
  return `pf${FILE_INSTANCE_ID}_${++testCounter}_${crypto.randomBytes(4).toString("hex")}`;
}

describe.sequential("Portfolio Routes", () => {
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
    await registerPortfolioRoutes(app);
  });

  beforeEach(async () => {
    // Clean up ALL test data for this test file instance
    // Each test uses unique identifiers via getTestId(), but we clean up by the file instance prefix
    const prefix = `pf${FILE_INSTANCE_ID}`;
    
    // 1. Delete trades first (references positions)
    await prisma.trade.deleteMany({
      where: {
        OR: [
          { user: { walletAddress: { startsWith: prefix } } },
          { agent: { owner: { walletAddress: { startsWith: prefix } } } }
        ]
      }
    });
    
    // 2. Delete positions (references markets, agents, users)
    await prisma.position.deleteMany({
      where: {
        OR: [
          { user: { walletAddress: { startsWith: prefix } } },
          { agent: { owner: { walletAddress: { startsWith: prefix } } } }
        ]
      }
    });
    
    // 3. Delete API keys (references agents, users)
    await prisma.apiKey.deleteMany({
      where: { 
        OR: [
          { user: { walletAddress: { startsWith: prefix } } },
          { agent: { owner: { walletAddress: { startsWith: prefix } } } }
        ]
      }
    });
    
    // 4. Delete agents (references users)
    await prisma.agent.deleteMany({
      where: { owner: { walletAddress: { startsWith: prefix } } }
    });
    
    // 5. Delete market pools and markets
    await prisma.marketPool.deleteMany({
      where: { market: { sourceSlug: { startsWith: prefix } } }
    });
    await prisma.market.deleteMany({
      where: { sourceSlug: { startsWith: prefix } }
    });
    
    // 6. Finally delete users
    await prisma.user.deleteMany({
      where: { walletAddress: { startsWith: prefix } }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /portfolio", () => {
    it("should reject request without API key", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/portfolio"
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject invalid API key", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": "invalid_key" }
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return portfolio with totalEquityCoin for user", async () => {
      // Create user
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);
      const testId = getTestId();
      
      const user = await prisma.user.create({
        data: {
          walletAddress: `${testId}_user`,
          xId: `${testId}_x`,
          xHandle: "test",
          xName: "Test",
          balanceMicros: 100_000_000n, // 100 coins
          apiKeys: {
            create: { keyHash }
          }
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": apiKey }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.accountType).toBe("HUMAN");
      expect(body.userId).toBe(user.id);
      expect(body.balanceCoin).toBe(100); // User created with 100 coins
      expect(body.totalEquityCoin).toBe(100); // No positions, so equity = balance
      expect(body.positions).toEqual([]);
      expect(body.history).toEqual([]);
    });

    it("should calculate totalEquityCoin with positions correctly", async () => {
      // Create user
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);
      const testId = getTestId();
      
      const user = await prisma.user.create({
        data: {
          walletAddress: `${testId}_user`,
          xId: `${testId}_x`,
          xHandle: "test",
          xName: "Test",
          balanceMicros: 50_000_000n, // 50 coins
          apiKeys: {
            create: { keyHash }
          }
        }
      });

      // Create market with pool
      const market = await prisma.market.create({
        data: {
          title: "Test Market",
          sourceSlug: `${testId}_market`,
          status: "OPEN",
          pool: {
            create: {
              collateralMicros: 0n,
              yesSharesMicros: 500_000_000n,
              noSharesMicros: 500_000_000n,
              feeBps: 100
            }
          }
        }
      });

      // Create position (100 YES shares at price ~0.5 = 50 coin value)
      await prisma.position.create({
        data: {
          userId: user.id,
          marketId: market.id,
          yesSharesMicros: 100_000_000n, // 100 YES shares
          noSharesMicros: 0n
        }
      });

      // Create trade history
      await prisma.trade.create({
        data: {
          userId: user.id,
          marketId: market.id,
          side: "YES",
          collateralInMicros: 50_000_000n,
          feeMicros: 500_000n,
          sharesOutMicros: 100_000_000n,
          poolCollateralMicros: 50_000_000n,
          poolYesSharesMicros: 400_000_000n,
          poolNoSharesMicros: 500_000_000n
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": apiKey }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.balanceCoin).toBe(50);
      expect(body.positions.length).toBe(1);
      expect(body.positions[0].yesSharesCoin).toBe(100);
      expect(body.positions[0].markToMarketCoin).toBeGreaterThan(0);
      
      // totalEquityCoin = balance + markToMarket of positions
      expect(body.totalEquityCoin).toBeCloseTo(
        body.balanceCoin + body.positions[0].markToMarketCoin,
        5
      );
    });

    it("should return portfolio for agent key", async () => {
      // Create agent (no owner for simplicity)
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);
      
      const agent = await prisma.agent.create({
        data: {
          displayName: "Test Agent",
          balanceMicros: 100_000_000n,
          apiKeys: {
            create: { keyHash }
          }
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": apiKey }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.accountType).toBe("AGENT");
      expect(body.agentId).toBe(agent.id);
      expect(body.balanceCoin).toBe(100);
      expect(body.totalEquityCoin).toBe(100);
    });

    it("should show empty positions after settlement", async () => {
      // Create user
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);
      const testId = getTestId();
      
      const user = await prisma.user.create({
        data: {
          walletAddress: `${testId}_user`,
          xId: `${testId}_x`,
          xHandle: "test",
          xName: "Test",
          balanceMicros: 100_000_000n,
          apiKeys: {
            create: { keyHash }
          }
        }
      });

      // Create resolved market
      const market = await prisma.market.create({
        data: {
          title: "Test Market",
          sourceSlug: `${testId}_market`,
          status: "RESOLVED",
          outcome: "YES",
          pool: {
            create: {
              collateralMicros: 0n,
              yesSharesMicros: 500_000_000n,
              noSharesMicros: 500_000_000n,
              feeBps: 100
            }
          }
        }
      });

      // Create zeroed position (after settlement)
      await prisma.position.create({
        data: {
          userId: user.id,
          marketId: market.id,
          yesSharesMicros: 0n, // Zeroed after settlement
          noSharesMicros: 0n
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": apiKey }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Positions should be empty (zeroed positions are filtered out)
      expect(body.positions).toEqual([]);
    });

    it("should calculate markToMarket correctly for resolved markets", async () => {
      // Create user
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);
      const testId = getTestId();
      
      const user = await prisma.user.create({
        data: {
          walletAddress: `${testId}_user`,
          xId: `${testId}_x`,
          xHandle: "test",
          xName: "Test",
          balanceMicros: 100_000_000n,
          apiKeys: {
            create: { keyHash }
          }
        }
      });

      // Create resolved market
      const market = await prisma.market.create({
        data: {
          title: "Test Market",
          sourceSlug: `${testId}_market`,
          status: "RESOLVED",
          outcome: "YES",
          pool: {
            create: {
              collateralMicros: 0n,
              yesSharesMicros: 500_000_000n,
              noSharesMicros: 500_000_000n,
              feeBps: 100
            }
          }
        }
      });

      // Create position with remaining shares (before settlement zeroed it)
      await prisma.position.create({
        data: {
          userId: user.id,
          marketId: market.id,
          yesSharesMicros: 100_000_000n,
          noSharesMicros: 0n
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": apiKey }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should have one position
      expect(body.positions.length).toBe(1);
      // For resolved market with YES outcome, markToMarket should be 1 per share
      expect(body.positions[0].markToMarketCoin).toBe(100); // 100 shares * $1
    });

    it("should calculate multiple positions correctly", async () => {
      // Create user with positions
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);
      const testId = getTestId();
      
      const user = await prisma.user.create({
        data: {
          walletAddress: `${testId}_user`,
          xId: `${testId}_x`,
          xHandle: "test",
          xName: "Test",
          balanceMicros: 50_000_000n, // 50 coins
          apiKeys: {
            create: { keyHash }
          },
          positions: {
            create: [
              {
                market: {
                  create: {
                    title: "Market 1",
                    sourceSlug: `${testId}_mkt_a`,
                    status: "OPEN",
                    pool: {
                      create: {
                        collateralMicros: 0n,
                        yesSharesMicros: 500_000_000n,
                        noSharesMicros: 500_000_000n,
                        feeBps: 100
                      }
                    }
                  }
                },
                yesSharesMicros: 50_000_000n,
                noSharesMicros: 0n
              },
              {
                market: {
                  create: {
                    title: "Market 2",
                    sourceSlug: `${testId}_mkt_b`,
                    status: "OPEN",
                    pool: {
                      create: {
                        collateralMicros: 0n,
                        yesSharesMicros: 400_000_000n,
                        noSharesMicros: 600_000_000n,
                        feeBps: 100
                      }
                    }
                  }
                },
                yesSharesMicros: 0n,
                noSharesMicros: 30_000_000n
              }
            ]
          }
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/portfolio",
        headers: { "x-api-key": apiKey }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.positions.length).toBe(2);
      expect(body.totalEquityCoin).toBeGreaterThan(body.balanceCoin);
    });
  });

  describe("GET /agents/:agentId/portfolio", () => {
    it("should return public portfolio for agent", async () => {
      // Create owner
      const testId = getTestId();
      const owner = await prisma.user.create({
        data: {
          walletAddress: `${testId}_owner`,
          xId: `${testId}_x`,
          xHandle: "test",
          xName: "Test",
          balanceMicros: 100_000_000n
        }
      });

      // Create agent
      const agent = await prisma.agent.create({
        data: {
          displayName: "Public Agent",
          ownerUserId: owner.id
        }
      });

      const response = await app.inject({
        method: "GET",
        url: `/agents/${agent.id}/portfolio`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.accountType).toBe("AGENT");
      expect(body.agentId).toBe(agent.id);
      expect(body.totalEquityCoin).toBeDefined();
    });

    it("should return 404 for non-existent agent", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/agents/123e4567-e89b-12d3-a456-426614174000/portfolio"
      });

      expect(response.statusCode).toBe(404);
    });

    it("should reject invalid agent ID format", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/agents/invalid-uuid/portfolio"
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

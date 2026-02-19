import crypto from "node:crypto";
import { z } from "zod";
import type { FastifyInstance } from "fastify";

import { prisma } from "../db.js";
import { generateApiKey, hashApiKey } from "../auth.js";
import { STARTING_BALANCE_MICROS, microsToCoinNumber } from "../constants.js";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://opensight.markets";

// Nonce storage with expiration
interface NonceData {
  nonce: string;
  walletAddress: string;
  createdAt: number;
}

const nonces = new Map<string, NonceData>();

// Cleanup expired nonces every minute (10 min expiry)
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of nonces) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      nonces.delete(id);
    }
  }
}, 60 * 1000);

/**
 * Normalize Ethereum address to lowercase checksum format
 */
function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

/**
 * Validate Ethereum address format
 */
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Verify EIP-191 signature
 * Message format: "Sign this message to authenticate with OpenSight\nNonce: <nonce>"
 */
function verifySignature(
  walletAddress: string,
  nonce: string,
  signature: string
): boolean {
  try {
    // Recover address from signature
    const message = `Sign this message to authenticate with OpenSight\nNonce: ${nonce}`;
    const messageHash = crypto
      .createHash("sha256")
      .update(`\x19Ethereum Signed Message:\n${message.length}${message}`)
      .digest();
    
    // Parse signature components
    const sigBuffer = Buffer.from(signature.slice(2), "hex");
    if (sigBuffer.length !== 65) return false;
    
    const r = sigBuffer.slice(0, 32);
    const s = sigBuffer.slice(32, 64);
    const v = sigBuffer[64];
    
    // For demo purposes, we'll use a simplified verification
    // In production, use ethers.js or viem for proper signature recovery
    // This is a placeholder - we'll use the signature as proof of ownership
    // and rely on the nonce mechanism for replay protection
    
    // A proper implementation would use secp256k1 to recover the public key
    // and derive the address from it
    
    // For now, we accept the signature as valid if it has the correct format
    // and the nonce exists for that address
    return (
      signature.startsWith("0x") &&
      signature.length === 132 &&
      /^0x[a-fA-F0-9]{130}$/.test(signature)
    );
  } catch {
    return false;
  }
}

export async function registerWeb3AuthRoutes(app: FastifyInstance) {
  /**
   * POST /auth/web3/nonce
   * Issue a short-lived nonce for the wallet to sign
   */
  app.post("/auth/web3/nonce", {
    schema: {
      tags: ["Auth"],
      summary: "Get nonce for wallet signature",
      description: "Request a nonce that must be signed by the wallet to authenticate",
      body: {
        type: "object",
        required: ["walletAddress"],
        properties: {
          walletAddress: { type: "string", description: "Ethereum wallet address (0x...)" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            nonceId: { type: "string" },
            nonce: { type: "string" },
            message: { type: "string" }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = z
      .object({
        walletAddress: z.string().refine(isValidEthereumAddress, {
          message: "Invalid Ethereum address format"
        })
      })
      .parse(req.body);

    const normalizedAddress = normalizeAddress(body.walletAddress);
    const nonce = crypto.randomBytes(32).toString("hex");
    const nonceId = crypto.randomBytes(16).toString("hex");

    nonces.set(nonceId, {
      nonce,
      walletAddress: normalizedAddress,
      createdAt: Date.now()
    });

    return {
      nonceId,
      nonce,
      message: `Sign this message to authenticate with OpenSight\nNonce: ${nonce}`
    };
  });

  /**
   * POST /auth/web3/verify
   * Verify signed message and issue API key
   */
  app.post("/auth/web3/verify", {
    schema: {
      tags: ["Auth"],
      summary: "Verify signature and get API key",
      description: "Submit the signed nonce to receive an API key for authenticated requests",
      body: {
        type: "object",
        required: ["nonceId", "walletAddress", "signature"],
        properties: {
          nonceId: { type: "string", description: "The nonceId from /auth/web3/nonce" },
          walletAddress: { type: "string", description: "Ethereum wallet address" },
          signature: { type: "string", description: "EIP-191 signature of the message" },
          xHandle: { type: "string", description: "Optional X/Twitter handle" },
          xName: { type: "string", description: "Optional display name" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            apiKey: { type: "string" },
            userId: { type: "string" },
            walletAddress: { type: "string" },
            xHandle: { type: "string" },
            xName: { type: "string" },
            balanceCoin: { type: "number" }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = z
      .object({
        nonceId: z.string(),
        walletAddress: z.string().refine(isValidEthereumAddress, {
          message: "Invalid Ethereum address format"
        }),
        signature: z.string().refine(
          (s) => s.startsWith("0x") && s.length === 132,
          { message: "Invalid signature format" }
        ),
        xHandle: z.string().optional(),
        xName: z.string().optional()
      })
      .parse(req.body);

    const normalizedAddress = normalizeAddress(body.walletAddress);

    // Verify nonce exists and matches wallet
    const nonceData = nonces.get(body.nonceId);
    if (!nonceData) {
      return reply.status(400).send({
        error: { message: "Invalid or expired nonce" }
      });
    }

    if (nonceData.walletAddress !== normalizedAddress) {
      return reply.status(400).send({
        error: { message: "Wallet address does not match nonce" }
      });
    }

    // Verify signature (simplified for demo)
    const isValid = verifySignature(
      normalizedAddress,
      nonceData.nonce,
      body.signature
    );

    if (!isValid) {
      return reply.status(401).send({
        error: { message: "Invalid signature" }
      });
    }

    // Delete used nonce to prevent replay
    nonces.delete(body.nonceId);

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    // Find or create user by wallet address
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress }
    });

    if (user) {
      // Existing user - issue new API key
      await prisma.apiKey.create({
        data: {
          userId: user.id,
          keyHash
        }
      });
    } else {
      // Create new user with wallet auth
      const displayName =
        body.xName ||
        body.xHandle ||
        `Trader_${normalizedAddress.slice(2, 8)}`;

      user = await prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          xId: `web3_${normalizedAddress.slice(2, 10)}`,
          xHandle: body.xHandle || normalizedAddress.slice(2, 10),
          xName: displayName,
          balanceMicros: STARTING_BALANCE_MICROS,
          apiKeys: {
            create: { keyHash }
          }
        }
      });
    }

    return {
      apiKey,
      userId: user.id,
      walletAddress: user.walletAddress,
      xHandle: user.xHandle,
      xName: user.xName,
      xAvatar: user.xAvatar,
      balanceCoin: microsToCoinNumber(user.balanceMicros)
    };
  });

  /**
   * GET /auth/me
   * Get current authenticated user profile
   */
  app.get("/auth/me", {
    schema: {
      tags: ["Auth"],
      summary: "Get current user profile",
      description: "Returns the authenticated user's profile information",
      security: [{ apiKey: [] }]
    }
  }, async (req, reply) => {
    const apiKey = req.headers["x-api-key"];
    if (typeof apiKey !== "string" || apiKey.length < 10) {
      return reply.status(401).send({
        error: { message: "Missing or invalid x-api-key" }
      });
    }

    const keyHash = hashApiKey(apiKey);
    const match = await prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            walletAddress: true,
            xHandle: true,
            xName: true,
            xAvatar: true,
            xVerified: true,
            balanceMicros: true,
            claimedAgents: {
              select: {
                id: true,
                displayName: true,
                balanceMicros: true
              }
            }
          }
        }
      }
    });

    if (!match || !match.user) {
      return reply.status(401).send({ error: { message: "Invalid API key" } });
    }

    const user = match.user;

    return {
      accountType: "HUMAN" as const,
      userId: user.id,
      walletAddress: user.walletAddress,
      xHandle: user.xHandle,
      xName: user.xName,
      xAvatar: user.xAvatar,
      xVerified: user.xVerified,
      balanceCoin: microsToCoinNumber(user.balanceMicros),
      claimedAgents: user.claimedAgents.map((a) => ({
        agentId: a.id,
        displayName: a.displayName,
        balanceCoin: microsToCoinNumber(a.balanceMicros)
      }))
    };
  });
}

// Export for testing
export { nonces, normalizeAddress, isValidEthereumAddress };

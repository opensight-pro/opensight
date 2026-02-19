import { z } from "zod";
import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";

import { prisma } from "../db.js";
import { microsToCoinNumber } from "../constants.js";

// Reuse nonce storage from web3auth - in production this should be shared module
interface NonceData {
  nonce: string;
  walletAddress: string;
  createdAt: number;
}

const claimNonces = new Map<string, NonceData>();

// Cleanup expired nonces every minute (10 min expiry)
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of claimNonces) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      claimNonces.delete(id);
    }
  }
}, 60 * 1000);

function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Verify EIP-191 signature (simplified for demo)
 */
function verifySignature(
  walletAddress: string,
  nonce: string,
  signature: string
): boolean {
  try {
    // For demo: accept valid-formatted signature
    // In production, use ethers.js or viem for proper recovery
    return (
      signature.startsWith("0x") &&
      signature.length === 132 &&
      /^0x[a-fA-F0-9]{130}$/.test(signature)
    );
  } catch {
    return false;
  }
}

export async function registerAgentClaimRoutes(app: FastifyInstance) {
  // Note: GET /claim/:token is already registered in claim.ts (legacy tweet-based claim)
  // This module adds wallet-based claim flow (POST endpoints)

  /**
   * POST /claim/:token/nonce
   * Issue nonce for wallet signature (wallet-based claim flow)
   */
  app.post("/claim/:token/nonce", {
    schema: {
      tags: ["Claim"],
      summary: "Get nonce for wallet claim",
      description: "Get a nonce to sign for claiming an agent via wallet",
      params: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", description: "Claim token" }
        }
      },
      body: {
        type: "object",
        required: ["walletAddress"],
        properties: {
          walletAddress: { type: "string", description: "Ethereum wallet address" }
        }
      }
    }
  }, async (req, reply) => {
    const params = z.object({ token: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        walletAddress: z.string().refine(isValidEthereumAddress, {
          message: "Invalid Ethereum address format"
        })
      })
      .parse(req.body);

    // Verify agent exists and is not already claimed
    const agent = await prisma.agent.findUnique({
      where: { claimToken: params.token },
      select: { id: true, ownerUserId: true, claimedById: true }
    });

    if (!agent) {
      return reply.status(404).send({ error: { message: "Invalid claim token" } });
    }

    if (agent.ownerUserId || agent.claimedById) {
      return reply.status(409).send({ error: { message: "Agent has already been claimed" } });
    }

    const normalizedAddress = normalizeAddress(body.walletAddress);
    const nonce = crypto.randomBytes(32).toString("hex");
    const nonceId = crypto.randomBytes(16).toString("hex");

    claimNonces.set(nonceId, {
      nonce,
      walletAddress: normalizedAddress,
      createdAt: Date.now()
    });

    return {
      nonceId,
      nonce,
      message: `Sign this message to claim your agent on OpenSight\nAgent: ${agent.id.slice(0, 8)}...\nNonce: ${nonce}`
    };
  });

  /**
   * POST /claim/:token/verify
   * Verify wallet signature and link agent to human (wallet-based claim)
   */
  app.post("/claim/:token/verify", {
    schema: {
      tags: ["Claim"],
      summary: "Verify wallet claim",
      description: "Submit signed nonce to claim agent via wallet",
      params: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", description: "Claim token" }
        }
      },
      body: {
        type: "object",
        required: ["nonceId", "walletAddress", "signature"],
        properties: {
          nonceId: { type: "string", description: "Nonce ID from /claim/:token/nonce" },
          walletAddress: { type: "string", description: "Ethereum wallet address" },
          signature: { type: "string", description: "EIP-191 signature" }
        }
      }
    }
  }, async (req, reply) => {
    const params = z.object({ token: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        nonceId: z.string(),
        walletAddress: z.string().refine(isValidEthereumAddress, {
          message: "Invalid Ethereum address format"
        }),
        signature: z.string().refine(
          (s) => s.startsWith("0x") && s.length === 132,
          { message: "Invalid signature format" }
        )
      })
      .parse(req.body);

    const normalizedAddress = normalizeAddress(body.walletAddress);

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { claimToken: params.token },
      select: {
        id: true,
        displayName: true,
        balanceMicros: true,
        ownerUserId: true,
        claimedById: true
      }
    });

    if (!agent) {
      return reply.status(404).send({ error: { message: "Invalid claim token" } });
    }

    if (agent.ownerUserId || agent.claimedById) {
      return reply.status(409).send({ error: { message: "Agent has already been claimed" } });
    }

    // Verify nonce exists and matches wallet
    const nonceData = claimNonces.get(body.nonceId);
    if (!nonceData) {
      return reply.status(400).send({ error: { message: "Invalid or expired nonce" } });
    }

    if (nonceData.walletAddress !== normalizedAddress) {
      return reply.status(400).send({ error: { message: "Wallet address does not match nonce" } });
    }

    // Verify signature
    const isValid = verifySignature(
      normalizedAddress,
      nonceData.nonce,
      body.signature
    );

    if (!isValid) {
      return reply.status(401).send({ error: { message: "Invalid signature" } });
    }

    // Delete used nonce
    claimNonces.delete(body.nonceId);

    // Find or create user by wallet address
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress }
    });

    if (!user) {
      // Create new user with wallet auth
      user = await prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          xId: `web3_${normalizedAddress.slice(2, 10)}`,
          xHandle: normalizedAddress.slice(2, 10),
          xName: `Trader_${normalizedAddress.slice(2, 8)}`
        }
      });
    }

    // Link agent to user (set owner)
    const updatedAgent = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        ownerUserId: user.id,
        claimedById: user.id,  // Also set for compatibility
        claimedAt: new Date()
      },
      select: {
        id: true,
        displayName: true,
        balanceMicros: true,
        owner: {
          select: {
            id: true,
            walletAddress: true,
            xHandle: true,
            xName: true
          }
        }
      }
    });

    return {
      success: true,
      agentId: updatedAgent.id,
      displayName: updatedAgent.displayName,
      balanceCoin: microsToCoinNumber(updatedAgent.balanceMicros),
      owner: {
        userId: updatedAgent.owner!.id,
        walletAddress: updatedAgent.owner!.walletAddress,
        xHandle: updatedAgent.owner!.xHandle,
        xName: updatedAgent.owner!.xName
      }
    };
  });
}

// Export for testing
export { claimNonces, normalizeAddress, isValidEthereumAddress };

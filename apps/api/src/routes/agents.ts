import crypto from "node:crypto";
import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { generateApiKey, hashApiKey } from "../auth.js";
import { prisma } from "../db.js";
import { STARTING_BALANCE_MICROS, microsToCoinNumber } from "../constants.js";

function generateClaimToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://opensight.markets";

export async function registerAgentRoutes(app: FastifyInstance) {
  app.post("/agents/register", {
    schema: {
      tags: ["Agents"],
      summary: "Register a new agent",
      description: "Create a new agent and receive API key and claim URL",
      body: {
        type: "object",
        properties: {
          displayName: { type: "string", description: "Display name for the agent" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            apiKey: { type: "string" },
            balanceCoin: { type: "number" },
            claimUrl: { type: "string" }
          }
        }
      }
    }
  }, async (req) => {
    const body = z
      .object({
        displayName: z.string().min(1).max(64).optional()
      })
      .optional()
      .parse(req.body);

    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const claimToken = generateClaimToken();

    const agent = await prisma.agent.create({
      data: {
        displayName: body?.displayName,
        balanceMicros: STARTING_BALANCE_MICROS,
        claimToken,
        apiKeys: {
          create: {
            keyHash
          }
        }
      },
      select: {
        id: true,
        balanceMicros: true,
        claimToken: true
      }
    });

    return {
      agentId: agent.id,
      apiKey,
      balanceCoin: microsToCoinNumber(agent.balanceMicros),
      claimUrl: `${FRONTEND_URL}/#/claim/${agent.claimToken}`
    };
  });

  app.get("/agents/:id", {
    schema: {
      tags: ["Agents"],
      summary: "Get agent by ID",
      description: "Retrieve public information about an agent",
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Agent UUID" }
        }
      }
    }
  }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);

    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        createdAt: true,
        displayName: true,
        balanceMicros: true,
        accountType: true,
        claimedById: true,
        claimedAt: true,
        claimedBy: {
          select: {
            id: true,
            xHandle: true,
            xName: true,
            xAvatar: true
          }
        }
      }
    });

    if (!agent) {
      return reply.status(404).send({ error: { message: "Agent not found" } });
    }

    return {
      agentId: agent.id,
      createdAt: agent.createdAt,
      displayName: agent.displayName,
      balanceCoin: microsToCoinNumber(agent.balanceMicros),
      accountType: agent.accountType,
      claimed: agent.claimedById !== null,
      claimedAt: agent.claimedAt,
      claimedBy: agent.claimedBy
        ? {
            userId: agent.claimedBy.id,
            xHandle: agent.claimedBy.xHandle,
            xName: agent.claimedBy.xName,
            xAvatar: agent.claimedBy.xAvatar
          }
        : null
    };
  });
}

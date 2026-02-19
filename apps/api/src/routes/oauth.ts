import crypto from "node:crypto";
import { z } from "zod";

import type { FastifyInstance } from "fastify";

import { prisma } from "../db.js";
import { generateApiKey, hashApiKey } from "../auth.js";
import { STARTING_BALANCE_MICROS, microsToCoinNumber } from "../constants.js";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID ?? "";
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET ?? "";
const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL ?? "https://opencast.markets/oauth/twitter/callback";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://opencast.markets";

const oauthStates = new Map<string, { codeVerifier: string; createdAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      oauthStates.delete(state);
    }
  }
}, 60 * 1000);

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64UrlEncode(crypto.createHash("sha256").update(verifier).digest());
}

export async function registerOAuthRoutes(app: FastifyInstance) {
  app.get("/oauth/twitter", async (_req, reply) => {
    if (!TWITTER_CLIENT_ID) {
      return reply.redirect(`${FRONTEND_URL}/#/login?error=twitter_not_configured`);
    }

    const state = crypto.randomBytes(16).toString("hex");
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    oauthStates.set(state, { codeVerifier, createdAt: Date.now() });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: TWITTER_CALLBACK_URL,
      scope: "tweet.read users.read offline.access",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    return reply.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
  });

  app.get("/oauth/twitter/callback", async (req, reply) => {
    const query = z
      .object({
        code: z.string(),
        state: z.string()
      })
      .safeParse(req.query);

    if (!query.success) {
      return reply.redirect(`${FRONTEND_URL}/#/login?error=invalid_callback`);
    }

    const { code, state } = query.data;
    const stateData = oauthStates.get(state);

    if (!stateData) {
      return reply.redirect(`${FRONTEND_URL}/#/login?error=invalid_state`);
    }

    oauthStates.delete(state);

    try {
      const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString("base64")}`
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: TWITTER_CLIENT_ID,
          redirect_uri: TWITTER_CALLBACK_URL,
          code_verifier: stateData.codeVerifier
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        app.log.error({ error: errorText }, "Twitter token exchange failed");
        return reply.redirect(`${FRONTEND_URL}/#/login?error=token_exchange_failed`);
      }

      const tokenData = z
        .object({
          access_token: z.string(),
          token_type: z.string(),
          expires_in: z.number().optional(),
          refresh_token: z.string().optional(),
          scope: z.string()
        })
        .parse(await tokenResponse.json());

      const userResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url,verified", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });

      if (!userResponse.ok) {
        return reply.redirect(`${FRONTEND_URL}/#/login?error=user_fetch_failed`);
      }

      const userData = z
        .object({
          data: z.object({
            id: z.string(),
            name: z.string(),
            username: z.string(),
            profile_image_url: z.string().optional(),
            verified: z.boolean().optional()
          })
        })
        .parse(await userResponse.json());

      const xUser = userData.data;

      let user = await prisma.user.findUnique({
        where: { xId: xUser.id }
      });

      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            xHandle: xUser.username,
            xName: xUser.name,
            xAvatar: xUser.profile_image_url,
            xVerified: xUser.verified ?? false,
            apiKeys: {
              create: { keyHash }
            }
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            xId: xUser.id,
            xHandle: xUser.username,
            xName: xUser.name,
            xAvatar: xUser.profile_image_url,
            xVerified: xUser.verified ?? false,
            balanceMicros: STARTING_BALANCE_MICROS,
            apiKeys: {
              create: { keyHash }
            }
          }
        });
      }

      const callbackParams = new URLSearchParams({
        apiKey,
        userId: user.id,
        xHandle: user.xHandle ?? "",
        xName: user.xName ?? "",
        xAvatar: user.xAvatar ?? "",
        balanceCoin: microsToCoinNumber(user.balanceMicros).toString()
      });

      return reply.redirect(`${FRONTEND_URL}/#/auth-callback?${callbackParams.toString()}`);
    } catch (error) {
      app.log.error({ error }, "OAuth callback error");
      return reply.redirect(`${FRONTEND_URL}/#/login?error=oauth_failed`);
    }
  });

  app.get("/oauth/me", async (req, reply) => {
    const apiKey = req.headers["x-api-key"];
    if (typeof apiKey !== "string" || apiKey.length < 10) {
      return reply.status(401).send({ error: { message: "Missing or invalid x-api-key" } });
    }

    const keyHash = hashApiKey(apiKey);
    const match = await prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      select: {
        userId: true,
        agentId: true,
        user: {
          select: {
            id: true,
            xId: true,
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
        },
        agent: {
          select: {
            id: true,
            displayName: true,
            balanceMicros: true,
            claimedBy: {
              select: {
                id: true,
                xHandle: true,
                xName: true
              }
            }
          }
        }
      }
    });

    if (!match) {
      return reply.status(401).send({ error: { message: "Invalid API key" } });
    }

    if (match.user) {
      return {
        accountType: "HUMAN",
        userId: match.user.id,
        xId: match.user.xId,
        xHandle: match.user.xHandle,
        xName: match.user.xName,
        xAvatar: match.user.xAvatar,
        xVerified: match.user.xVerified,
        balanceCoin: microsToCoinNumber(match.user.balanceMicros),
        claimedAgents: match.user.claimedAgents.map((a) => ({
          agentId: a.id,
          displayName: a.displayName,
          balanceCoin: microsToCoinNumber(a.balanceMicros)
        }))
      };
    }

    if (match.agent) {
      return {
        accountType: "AGENT",
        agentId: match.agent.id,
        displayName: match.agent.displayName,
        balanceCoin: microsToCoinNumber(match.agent.balanceMicros),
        claimedBy: match.agent.claimedBy
          ? {
              userId: match.agent.claimedBy.id,
              xHandle: match.agent.claimedBy.xHandle,
              xName: match.agent.claimedBy.xName
            }
          : null
      };
    }

    return reply.status(401).send({ error: { message: "Invalid API key" } });
  });

  // Dev-only bypass for local testing when Twitter OAuth is not configured.
  // Gated behind DEV_OAUTH_BYPASS=true
  app.post("/oauth/dev-login", async (req, reply) => {
    if (process.env.DEV_OAUTH_BYPASS !== "true") {
      return reply.status(404).send({ error: { message: "Not found" } });
    }

    const body = z
      .object({
        xHandle: z.string().min(1).max(50).regex(/^[A-Za-z0-9_]+$/),
        xName: z.string().min(1).max(100).optional()
      })
      .parse(req.body);

    const xHandle = body.xHandle;
    const xName = body.xName ?? body.xHandle;
    const xId = `dev_${xHandle}`;

    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    const user = await prisma.user.upsert({
      where: { xId },
      create: {
        xId,
        xHandle,
        xName,
        xVerified: false,
        balanceMicros: STARTING_BALANCE_MICROS,
        apiKeys: { create: { keyHash } }
      },
      update: {
        xHandle,
        xName,
        apiKeys: { create: { keyHash } }
      }
    });

    return {
      apiKey,
      userId: user.id,
      xHandle: user.xHandle,
      xName: user.xName,
      xAvatar: user.xAvatar ?? "",
      balanceCoin: microsToCoinNumber(user.balanceMicros)
    };
  });
}

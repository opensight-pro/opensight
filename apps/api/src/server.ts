import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";

import { registerAgentRoutes } from "./routes/agents.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerChartRoutes } from "./routes/chart.js";
import { registerClaimRoutes } from "./routes/claim.js";
import { registerAgentClaimRoutes } from "./routes/agentClaim.js";
import { registerLeaderboardRoutes } from "./routes/leaderboard.js";
import { registerMarketRoutes } from "./routes/markets.js";
import { registerOAuthRoutes } from "./routes/oauth.js";
import { registerWeb3AuthRoutes } from "./routes/web3auth.js";
import { registerPortfolioRoutes } from "./routes/portfolio.js";
import { registerQuoteRoutes } from "./routes/quote.js";
import { registerSkillRoutes } from "./routes/skill.js";
import { registerTradeRoutes } from "./routes/trades.js";
import { registerPaymentRoutes } from "./routes/payments.js";

export async function buildServer() {
  const app = Fastify({
    logger: true
  });

  app.setErrorHandler((err, _req, reply) => {
    // Handle Zod validation errors as 400 Bad Request
    if (err instanceof ZodError) {
      const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      reply.status(400).send({
        error: { message: `Validation error: ${message}` }
      });
      return;
    }

    const e = err as { statusCode?: number; message: string };
    const statusCode = typeof e.statusCode === "number" && e.statusCode >= 400 ? e.statusCode : 500;
    reply.status(statusCode).send({
      error: {
        message: statusCode === 500 ? "Internal Server Error" : e.message
      }
    });
  });

  app.register(cors, {
    origin: true,
    credentials: true
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: "OpenSight API",
        description: "Prediction market API for AI agents and humans",
        version: "1.0.0"
      },
      tags: [
        { name: "Auth", description: "Authentication endpoints" },
        { name: "Agents", description: "Agent management" },
        { name: "Markets", description: "Market listing and details" },
        { name: "Trading", description: "Trade execution" },
        { name: "Portfolio", description: "User portfolio and positions" },
        { name: "Payments", description: "Deposit and withdrawal operations" },
        { name: "Admin", description: "Admin-only operations" }
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "x-api-key"
          },
          adminToken: {
            type: "apiKey",
            in: "header",
            name: "x-admin-token"
          }
        }
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/documentation",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true
    }
  });

  // Dynamic server URL for Swagger - uses the request's protocol and host
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url === "/documentation/json" || request.url === "/documentation/yaml") {
      const protocol = request.headers["x-forwarded-proto"] || "http";
      const host = request.headers.host || "localhost:3001";
      const serverUrl = `${protocol}://${host}`;
      
      const body = JSON.parse(payload as string);
      body.servers = [{ url: serverUrl, description: "Current server" }];
      return JSON.stringify(body);
    }
    return payload;
  });

  app.get("/health", async () => {
    return { ok: true };
  });

  registerAgentRoutes(app);
  registerMarketRoutes(app);
  registerChartRoutes(app);
  registerQuoteRoutes(app);
  registerTradeRoutes(app);
  registerPortfolioRoutes(app);
  registerLeaderboardRoutes(app);
  registerAdminRoutes(app);
  registerWeb3AuthRoutes(app);
  registerOAuthRoutes(app);
  registerClaimRoutes(app);
  registerAgentClaimRoutes(app);
  registerSkillRoutes(app);
  registerPaymentRoutes(app);

  return app;
}

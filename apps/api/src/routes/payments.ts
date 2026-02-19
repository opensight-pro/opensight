/**
 * Payment Routes
 * 
 * API endpoints for deposits, withdrawals, and payment history.
 */

import { z } from "zod";
import type { FastifyInstance } from "fastify";

import { requireAccount } from "../auth.js";
import { microsToCoinNumber } from "../constants.js";
import {
  createDepositIntent,
  confirmDeposit,
  createWithdrawRequest,
  confirmWithdraw,
  getPaymentHistory,
} from "../payments/service.js";

// Helper to serialize BigInt values for JSON
function serializePayment(payment: {
  id: string;
  requestId: string;
  direction: string;
  status: string;
  bnbAmountWei: bigint;
  coinAmountMicros: bigint;
  txHash: string | null;
  walletAddress: string;
  createdAt: Date;
  confirmedAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
}) {
  return {
    id: payment.id,
    requestId: payment.requestId,
    direction: payment.direction,
    status: payment.status,
    bnbAmountWei: payment.bnbAmountWei.toString(),
    bnbAmount: formatBnbAmount(payment.bnbAmountWei),
    coinAmount: microsToCoinNumber(payment.coinAmountMicros),
    txHash: payment.txHash,
    walletAddress: payment.walletAddress,
    createdAt: payment.createdAt.toISOString(),
    confirmedAt: payment.confirmedAt?.toISOString() ?? null,
    sentAt: payment.sentAt?.toISOString() ?? null,
    failedAt: payment.failedAt?.toISOString() ?? null,
    errorMessage: payment.errorMessage,
  };
}

function formatBnbAmount(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const fraction = wei % 10n ** 18n;
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, 6);
  return `${whole}.${fractionStr}`;
}

const hexStringRegex = /^0x[a-fA-F0-9]+$/;

export async function registerPaymentRoutes(app: FastifyInstance) {
  /**
   * POST /payments/deposit/intent
   * Create a deposit intent (PENDING status)
   */
  app.post("/payments/deposit/intent", {
    schema: {
      tags: ["Payments"],
      summary: "Create deposit intent",
      description: "Creates a pending deposit record. Returns requestId for confirmation.",
      security: [{ apiKey: [] }],
      body: {
        type: "object",
        required: ["walletAddress"],
        properties: {
          walletAddress: { type: "string", description: "Wallet address that will send BNB" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            requestId: { type: "string" },
            walletAddress: { type: "string" },
            status: { type: "string" },
          },
        },
      },
    },
  }, async (req) => {
    const account = await requireAccount(req);
    const userId = account.userId;

    if (!userId) {
      throw Object.assign(
        new Error("Only human accounts can initiate payments"),
        { statusCode: 403 }
      );
    }

    const body = z
      .object({
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
      })
      .parse(req.body);

    const result = await createDepositIntent({
      userId,
      walletAddress: body.walletAddress,
    });

    return {
      requestId: result.requestId,
      walletAddress: body.walletAddress.toLowerCase(),
      status: "PENDING",
    };
  });

  /**
   * POST /payments/deposit/confirm
   * Confirm a deposit and credit Coin balance
   */
  app.post("/payments/deposit/confirm", {
    schema: {
      tags: ["Payments"],
      summary: "Confirm deposit",
      description: "Confirms deposit after on-chain tx. Credits Coin balance. Idempotent.",
      security: [{ apiKey: [] }],
      body: {
        type: "object",
        required: ["requestId", "txHash", "walletAddress", "bnbAmountWei"],
        properties: {
          requestId: { type: "string", description: "From deposit/intent response" },
          txHash: { type: "string", description: "On-chain transaction hash" },
          walletAddress: { type: "string", description: "Sender wallet address" },
          bnbAmountWei: { type: "string", description: "BNB amount in wei (as string)" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            paymentId: { type: "string" },
            requestId: { type: "string" },
            status: { type: "string" },
            bnbAmountWei: { type: "string" },
            coinAmount: { type: "number" },
            txHash: { type: "string" },
          },
        },
      },
    },
  }, async (req) => {
    const account = await requireAccount(req);
    const userId = account.userId;

    if (!userId) {
      throw Object.assign(
        new Error("Only human accounts can confirm payments"),
        { statusCode: 403 }
      );
    }

    const body = z
      .object({
        requestId: z.string().uuid(),
        txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
        bnbAmountWei: z.string().regex(/^\d+$/, "Must be numeric string"),
      })
      .parse(req.body);

    const result = await confirmDeposit({
      requestId: body.requestId,
      txHash: body.txHash,
      walletAddress: body.walletAddress,
      bnbAmountWei: BigInt(body.bnbAmountWei),
    });

    return {
      paymentId: result.id,
      requestId: result.requestId,
      status: result.status,
      bnbAmountWei: result.bnbAmountWei.toString(),
      coinAmount: microsToCoinNumber(result.coinAmountMicros),
      txHash: result.txHash,
    };
  });

  /**
   * POST /payments/withdraw/request
   * Create a withdraw request (debits Coin balance immediately)
   */
  app.post("/payments/withdraw/request", {
    schema: {
      tags: ["Payments"],
      summary: "Request withdrawal",
      description: "Creates withdraw request, debits Coin balance immediately. Returns requestId for payout.",
      security: [{ apiKey: [] }],
      body: {
        type: "object",
        required: ["walletAddress", "coinAmount"],
        properties: {
          walletAddress: { type: "string", description: "Destination wallet address" },
          coinAmount: { type: "integer", description: "Amount in Coin (1 Coin = 1000000 micros)" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            requestId: { type: "string" },
            bnbAmountWei: { type: "string" },
            bnbAmount: { type: "string" },
            walletAddress: { type: "string" },
            status: { type: "string" },
          },
        },
      },
    },
  }, async (req) => {
    const account = await requireAccount(req);
    const userId = account.userId;

    if (!userId) {
      throw Object.assign(
        new Error("Only human accounts can request withdrawals"),
        { statusCode: 403 }
      );
    }

    const body = z
      .object({
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
        coinAmount: z.number().int().positive(),
      })
      .parse(req.body);

    const { MICROS_PER_COIN } = await import("../constants.js");
    const coinAmountMicros = BigInt(body.coinAmount) * MICROS_PER_COIN;

    const result = await createWithdrawRequest({
      userId,
      walletAddress: body.walletAddress,
      coinAmountMicros,
    });

    return {
      requestId: result.requestId,
      bnbAmountWei: result.bnbAmountWei.toString(),
      bnbAmount: formatBnbAmount(result.bnbAmountWei),
      walletAddress: body.walletAddress.toLowerCase(),
      status: "PENDING",
    };
  });

  /**
   * POST /payments/withdraw/confirm
   * Confirm withdraw payout has been sent
   */
  app.post("/payments/withdraw/confirm", {
    schema: {
      tags: ["Payments"],
      summary: "Confirm withdrawal payout",
      description: "Marks withdraw as SENT after payout tx is executed. Idempotent.",
      security: [{ apiKey: [] }],
      body: {
        type: "object",
        required: ["requestId", "txHash"],
        properties: {
          requestId: { type: "string", description: "From withdraw/request response" },
          txHash: { type: "string", description: "Payout transaction hash" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            paymentId: { type: "string" },
            requestId: { type: "string" },
            status: { type: "string" },
            txHash: { type: "string" },
          },
        },
      },
    },
  }, async (req) => {
    const account = await requireAccount(req);
    const userId = account.userId;

    if (!userId) {
      throw Object.assign(
        new Error("Only human accounts can confirm withdrawals"),
        { statusCode: 403 }
      );
    }

    const body = z
      .object({
        requestId: z.string().uuid(),
        txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
      })
      .parse(req.body);

    const result = await confirmWithdraw({
      requestId: body.requestId,
      txHash: body.txHash,
    });

    return {
      paymentId: result.id,
      requestId: result.requestId,
      status: result.status,
      txHash: result.txHash,
    };
  });

  /**
   * GET /payments/history
   * Get payment history for authenticated user
   */
  app.get("/payments/history", {
    schema: {
      tags: ["Payments"],
      summary: "Get payment history",
      description: "Returns deposit and withdrawal history for the authenticated trader.",
      security: [{ apiKey: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            payments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  requestId: { type: "string" },
                  direction: { type: "string" },
                  status: { type: "string" },
                  bnbAmountWei: { type: "string" },
                  bnbAmount: { type: "string" },
                  coinAmount: { type: "number" },
                  txHash: { type: "string", nullable: true },
                  walletAddress: { type: "string" },
                  createdAt: { type: "string" },
                  confirmedAt: { type: "string", nullable: true },
                  sentAt: { type: "string", nullable: true },
                  failedAt: { type: "string", nullable: true },
                  errorMessage: { type: "string", nullable: true },
                },
              },
            },
          },
        },
      },
    },
  }, async (req) => {
    const account = await requireAccount(req);
    const userId = account.userId;

    if (!userId) {
      throw Object.assign(
        new Error("Only human accounts have payment history"),
        { statusCode: 403 }
      );
    }

    const payments = await getPaymentHistory(userId);

    return {
      payments: payments.map(serializePayment),
    };
  });
}

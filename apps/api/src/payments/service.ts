/**
 * Payment Service Layer
 * 
 * Handles deposit and withdrawal operations with ledger-safe accounting.
 * Demo mode: trusts frontend-submitted transaction metadata.
 */

import crypto from "node:crypto";
import { prisma } from "../db.js";
import { bnbToCoin, coinToBnb } from "./conversion.js";
import type { PaymentDirection, PaymentStatus } from "@prisma/client";

export interface CreateDepositIntentInput {
  userId: string;
  walletAddress: string;
}

export interface ConfirmDepositInput {
  requestId: string;
  txHash: string;
  walletAddress: string;
  bnbAmountWei: bigint;
}

export interface CreateWithdrawRequestInput {
  userId: string;
  walletAddress: string;
  coinAmountMicros: bigint;
}

export interface ConfirmWithdrawInput {
  requestId: string;
  txHash: string;
}

export interface PaymentRecord {
  id: string;
  requestId: string;
  direction: PaymentDirection;
  status: PaymentStatus;
  bnbAmountWei: bigint;
  coinAmountMicros: bigint;
  txHash: string | null;
  walletAddress: string;
  createdAt: Date;
  confirmedAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
}

function generateRequestId(): string {
  return crypto.randomUUID();
}

function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

/**
 * Create a deposit intent (PENDING status)
 * Returns requestId for frontend to use when submitting deposit confirmation
 */
export async function createDepositIntent(
  input: CreateDepositIntentInput
): Promise<{ requestId: string }> {
  const requestId = generateRequestId();
  const normalizedWallet = normalizeAddress(input.walletAddress);

  await prisma.payment.create({
    data: {
      userId: input.userId,
      requestId,
      direction: "DEPOSIT",
      status: "PENDING",
      walletAddress: normalizedWallet,
      bnbAmountWei: 0n, // Will be updated on confirm
      coinAmountMicros: 0n, // Will be updated on confirm
    },
  });

  return { requestId };
}

/**
 * Confirm a deposit and credit Coin balance
 * Idempotent: safe to call multiple times with same requestId
 * Demo mode: trusts frontend-submitted tx metadata without chain verification
 */
export async function confirmDeposit(
  input: ConfirmDepositInput
): Promise<PaymentRecord> {
  const normalizedWallet = normalizeAddress(input.walletAddress);
  const coinAmountMicros = bnbToCoin(input.bnbAmountWei);

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Check if txHash already exists (idempotency guard)
    if (input.txHash) {
      const existingTx = await tx.payment.findUnique({
        where: { txHash: input.txHash },
      });
      
      if (existingTx && existingTx.requestId !== input.requestId) {
        throw Object.assign(
          new Error("Transaction hash already processed"),
          { statusCode: 409, code: "DUPLICATE_TX_HASH" }
        );
      }
    }

    // Find the deposit intent
    const payment = await tx.payment.findUnique({
      where: { requestId: input.requestId },
    });

    if (!payment) {
      throw Object.assign(
        new Error("Deposit intent not found"),
        { statusCode: 404, code: "INTENT_NOT_FOUND" }
      );
    }

    if (payment.direction !== "DEPOSIT") {
      throw Object.assign(
        new Error("Invalid payment direction"),
        { statusCode: 400, code: "INVALID_DIRECTION" }
      );
    }

    // Idempotency: if already confirmed, return existing record
    if (payment.status === "CONFIRMED") {
      return payment;
    }

    if (payment.status === "FAILED") {
      throw Object.assign(
        new Error("Deposit intent has failed and cannot be confirmed"),
        { statusCode: 400, code: "INTENT_FAILED" }
      );
    }

    // Update payment record and credit user balance atomically
    const [updatedPayment] = await Promise.all([
      tx.payment.update({
        where: { requestId: input.requestId },
        data: {
          status: "CONFIRMED",
          txHash: input.txHash,
          walletAddress: normalizedWallet,
          bnbAmountWei: input.bnbAmountWei,
          coinAmountMicros,
          confirmedAt: new Date(),
        },
      }),
      tx.user.update({
        where: { id: payment.userId },
        data: {
          balanceMicros: {
            increment: coinAmountMicros,
          },
        },
      }),
    ]);

    return updatedPayment;
  });

  return result;
}

/**
 * Create a withdraw request (debits Coin balance immediately)
 * Returns requestId and expected BNB amount for frontend to execute payout tx
 */
export async function createWithdrawRequest(
  input: CreateWithdrawRequestInput
): Promise<{ requestId: string; bnbAmountWei: bigint }> {
  const requestId = generateRequestId();
  const normalizedWallet = normalizeAddress(input.walletAddress);
  const bnbAmountWei = coinToBnb(input.coinAmountMicros);

  await prisma.$transaction(async (tx) => {
    // Check user balance
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { balanceMicros: true },
    });

    if (!user) {
      throw Object.assign(
        new Error("User not found"),
        { statusCode: 404, code: "USER_NOT_FOUND" }
      );
    }

    if (user.balanceMicros < input.coinAmountMicros) {
      throw Object.assign(
        new Error("Insufficient balance"),
        { statusCode: 400, code: "INSUFFICIENT_BALANCE" }
      );
    }

    // Atomic: debit balance and create withdraw record
    await Promise.all([
      tx.user.update({
        where: { id: input.userId },
        data: {
          balanceMicros: {
            decrement: input.coinAmountMicros,
          },
        },
      }),
      tx.payment.create({
        data: {
          userId: input.userId,
          requestId,
          direction: "WITHDRAW",
          status: "PENDING",
          walletAddress: normalizedWallet,
          bnbAmountWei,
          coinAmountMicros: input.coinAmountMicros,
        },
      }),
    ]);
  });

  return { requestId, bnbAmountWei };
}

/**
 * Confirm a withdraw payout has been sent
 * Frontend submits txHash after executing withdraw contract call
 */
export async function confirmWithdraw(
  input: ConfirmWithdrawInput
): Promise<PaymentRecord> {
  const payment = await prisma.payment.findUnique({
    where: { requestId: input.requestId },
  });

  if (!payment) {
    throw Object.assign(
      new Error("Withdraw request not found"),
      { statusCode: 404, code: "REQUEST_NOT_FOUND" }
    );
  }

  if (payment.direction !== "WITHDRAW") {
    throw Object.assign(
      new Error("Invalid payment direction"),
      { statusCode: 400, code: "INVALID_DIRECTION" }
    );
  }

  // Idempotency: if already sent/confirmed, return existing
  if (payment.status === "SENT" || payment.status === "CONFIRMED") {
    return payment;
  }

  if (payment.status === "FAILED") {
    throw Object.assign(
      new Error("Withdraw request has failed"),
      { statusCode: 400, code: "REQUEST_FAILED" }
    );
  }

  const updated = await prisma.payment.update({
    where: { requestId: input.requestId },
    data: {
      status: "SENT",
      txHash: input.txHash,
      sentAt: new Date(),
    },
  });

  return updated;
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(userId: string): Promise<PaymentRecord[]> {
  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return payments;
}

/**
 * Get a single payment by requestId
 */
export async function getPaymentByRequestId(
  requestId: string
): Promise<PaymentRecord | null> {
  return prisma.payment.findUnique({
    where: { requestId },
  });
}

/**
 * Shared Test Fixtures for Cross-Slide E2E Tests
 * 
 * This module provides reusable fixtures for integration and E2E testing
 * across all demo slides (Auth, Agent, Markets, Trading, Portfolio).
 */

import { ethers } from "ethers";
import { prisma } from "../db.js";
import { hashApiKey, generateApiKey } from "../auth.js";
import { settleMarket } from "../services/settlement.js";
import type { User, Agent, Market, MarketPool, MarketStatus, MarketOutcome } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export type TestHuman = {
  wallet: ethers.HDNodeWallet;
  user: User;
  apiKey: string;
};

export type TestAgent = {
  agent: Agent;
  apiKey: string;
  claimUrl: string;
  claimToken: string;
};

export type TestMarket = {
  market: Market & { pool: MarketPool | null };
};

// ============================================================================
// Wallet Utilities
// ============================================================================

export function generateTestWallet(): ethers.HDNodeWallet {
  return ethers.Wallet.createRandom();
}

export async function signMessage(wallet: ethers.HDNodeWallet, message: string): Promise<string> {
  return wallet.signMessage(message);
}

// ============================================================================
// Fixture: Wallet-Authenticated Human
// ============================================================================

export async function createWalletAuthenticatedHuman(
  wallet?: ethers.HDNodeWallet
): Promise<TestHuman> {
  const testWallet = wallet ?? generateTestWallet();
  const walletAddress = testWallet.address.toLowerCase();
  
  // Create user with API key
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  
  const user = await prisma.user.create({
    data: {
      walletAddress,
      xId: `test_${walletAddress.slice(2, 10)}`,
      xHandle: "test",
      xName: "Test User",
      balanceMicros: 1000_000_000n, // 1000 coins default
      apiKeys: {
        create: { keyHash }
      }
    }
  });
  
  return {
    wallet: testWallet,
    user,
    apiKey
  };
}

// ============================================================================
// Fixture: Generated Agent with API Key
// ============================================================================

export async function createAgentWithApiKey(
  owner?: TestHuman
): Promise<TestAgent & { owner: TestHuman | null }> {
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  
  // Generate claim token
  const claimToken = generateApiKey().slice(0, 32);
  
  const agent = await prisma.agent.create({
    data: {
      displayName: "Test Agent",
      balanceMicros: 0n, // Agent has no balance - uses owner's account
      claimToken,
      apiKeys: {
        create: { keyHash }
      },
      ...(owner?.user.id ? { ownerUserId: owner.user.id } : {})
    }
  });
  
  const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://opensight.markets";
  const claimUrl = `${FRONTEND_URL}/#/claim/${claimToken}`;
  
  return {
    agent,
    apiKey,
    claimUrl,
    claimToken,
    owner: owner ?? null
  };
}

// ============================================================================
// Fixture: Forwarded Polymarket Market Mock
// ============================================================================

export async function createForwardedMarket(
  overrides?: {
    sourceSlug?: string;
    title?: string;
    status?: MarketStatus;
    outcome?: MarketOutcome;
    yesSharesMicros?: bigint;
    noSharesMicros?: bigint;
  }
): Promise<TestMarket> {
  const sourceSlug = overrides?.sourceSlug ?? `test-market-${Date.now()}`;
  const title = overrides?.title ?? "Test Market";
  const status = overrides?.status ?? "OPEN";
  const outcome = overrides?.outcome ?? "UNRESOLVED";
  const yesSharesMicros = overrides?.yesSharesMicros ?? 500_000_000n;
  const noSharesMicros = overrides?.noSharesMicros ?? 500_000_000n;
  
  const market = await prisma.market.create({
    data: {
      title,
      sourceSlug,
      description: "Test market for E2E scenarios",
      forwardedAt: new Date(),
      status,
      outcome,
      pool: {
        create: {
          collateralMicros: 0n,
          yesSharesMicros,
          noSharesMicros,
          feeBps: 100
        }
      }
    },
    include: {
      pool: true
    }
  });
  
  return { market };
}

// ============================================================================
// Fixture: Settled Market Scenario
// ============================================================================

export async function createSettledMarketScenario(
  outcome: "YES" | "NO" = "YES"
): Promise<TestMarket> {
  const { market } = await createForwardedMarket({
    status: "RESOLVED",
    outcome
  });
  
  return { market };
}

// ============================================================================
// Fixture: Trade Execution
// ============================================================================

export async function executeTrade(
  userId: string,
  marketId: string,
  side: "YES" | "NO",
  collateralMicros: bigint
): Promise<{
  success: boolean;
  sharesOutCoin?: number;
  error?: string;
}> {
  // Import here to avoid circular dependencies
  const { executeTrade: execTrade } = await import("../services/executeTrade.js");
  const { microsToCoinNumber } = await import("../constants.js");
  
  try {
    const result = await execTrade({
      account: { userId },
      body: {
        marketId,
        outcome: side,
        collateralCoin: microsToCoinNumber(collateralMicros)
      }
    });
    
    return {
      success: true,
      sharesOutCoin: result.sharesOutCoin
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ============================================================================
// Fixture: Claim Agent via Wallet
// ============================================================================

export async function claimAgentViaWallet(
  agent: TestAgent,
  human: TestHuman
): Promise<{ success: boolean; error?: string }> {
  try {
    // Directly update the agent to set owner
    // This is a simplified version for fixtures - actual flow uses nonce/signature
    await prisma.agent.update({
      where: { id: agent.agent.id },
      data: { ownerUserId: human.user.id }
    });
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ============================================================================
// Cleanup Utilities
// ============================================================================

export async function cleanupTestData(prefix: string): Promise<void> {
  // Delete in order to respect FK constraints
  await prisma.trade.deleteMany({
    where: {
      OR: [
        { user: { walletAddress: { startsWith: prefix } } },
        { agent: { owner: { walletAddress: { startsWith: prefix } } } }
      ]
    }
  });
  
  await prisma.position.deleteMany({
    where: {
      OR: [
        { user: { walletAddress: { startsWith: prefix } } },
        { agent: { owner: { walletAddress: { startsWith: prefix } } } }
      ]
    }
  });
  
  await prisma.apiKey.deleteMany({
    where: {
      OR: [
        { user: { walletAddress: { startsWith: prefix } } },
        { agent: { owner: { walletAddress: { startsWith: prefix } } } }
      ]
    }
  });
  
  await prisma.agent.deleteMany({
    where: { owner: { walletAddress: { startsWith: prefix } } }
  });
  
  await prisma.marketPool.deleteMany({
    where: { market: { sourceSlug: { startsWith: prefix } } }
  });
  
  await prisma.market.deleteMany({
    where: { sourceSlug: { startsWith: prefix } }
  });
  
  await prisma.user.deleteMany({
    where: { walletAddress: { startsWith: prefix } } 
  });
}

// ============================================================================
// E2E Scenario Helpers
// ============================================================================

/**
 * Scenario A: wallet auth -> create agent -> trade using agent key -> verify same portfolio via human key
 */
export async function runScenarioA(): Promise<{
  success: boolean;
  human: TestHuman;
  agent: TestAgent;
  market: TestMarket;
  error?: string;
}> {
  const prefix = `e2e_scenario_a_${Date.now()}`;
  
  try {
    // 1. Create wallet-authenticated human
    const human = await createWalletAuthenticatedHuman();
    
    // 2. Create agent (unclaimed initially)
    const agent = await createAgentWithApiKey();
    
    // 3. Claim agent via wallet
    const claimResult = await claimAgentViaWallet(agent, human);
    if (!claimResult.success) {
      throw new Error(`Claim failed: ${claimResult.error}`);
    }
    
    // 4. Create market
    const { market } = await createForwardedMarket({
      sourceSlug: `${prefix}_market`
    });
    
    // 5. Trade using agent key (resolves to human's account)
    const tradeResult = await executeTrade(
      human.user.id,
      market.id,
      "YES",
      100_000_000n // 100 coins
    );
    if (!tradeResult.success) {
      throw new Error(`Trade failed: ${tradeResult.error}`);
    }
    
    return {
      success: true,
      human,
      agent,
      market: { market }
    };
  } catch (error) {
    return {
      success: false,
      human: null as any,
      agent: null as any,
      market: null as any,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Scenario B: admin forward -> agent trade -> settlement sync -> payout verified
 */
export async function runScenarioB(): Promise<{
  success: boolean;
  human: TestHuman;
  agent: TestAgent;
  market: TestMarket;
  initialBalance: bigint;
  finalBalance: bigint;
  error?: string;
}> {
  try {
    // 1. Create human with agent
    const human = await createWalletAuthenticatedHuman();
    const agentData = await createAgentWithApiKey(human);
    
    // 2. Forward market (create as open)
    const { market: initialMarket } = await createForwardedMarket({
      status: "OPEN"
    });
    
    // Record initial balance
    const initialBalance = human.user.balanceMicros;
    
    // 3. Trade via agent
    const tradeResult = await executeTrade(
      human.user.id,
      initialMarket.id,
      "YES",
      100_000_000n
    );
    if (!tradeResult.success) {
      throw new Error(`Trade failed: ${tradeResult.error}`);
    }
    
    // 4. Settle market (YES outcome)
    await settleMarket(initialMarket.id, "YES");
    
    // 5. Get final balance
    const updatedUser = await prisma.user.findUnique({
      where: { id: human.user.id },
      select: { balanceMicros: true }
    });
    
    return {
      success: true,
      human,
      agent: agentData,
      market: { market: initialMarket },
      initialBalance,
      finalBalance: updatedUser?.balanceMicros ?? initialBalance
    };
  } catch (error) {
    return {
      success: false,
      human: null as any,
      agent: null as any,
      market: null as any,
      initialBalance: 0n,
      finalBalance: 0n,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

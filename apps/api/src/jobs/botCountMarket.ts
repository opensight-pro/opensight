import { prisma } from "../db.js";
import { MICROS_PER_COIN } from "../constants.js";

const MARKET_TYPE_BOT_COUNT = "INTERNAL_BOT_COUNT";
const INITIAL_LIQUIDITY_COIN = 500; // Starting liquidity for bot count markets

interface BotCountMarketResult {
  success: boolean;
  marketId?: string;
  action: "created" | "resolved" | "skipped" | "error";
  message: string;
}

/**
 * Get or create the special HOUSE agent for market operations.
 * The house handles market creation and resolution.
 */
async function getOrCreateHouseAgent(): Promise<string> {
  const houseId = "00000000-0000-0000-0000-000000000000";
  
  const house = await prisma.agent.findUnique({
    where: { id: houseId }
  });
  
  if (!house) {
    await prisma.agent.create({
      data: {
        id: houseId,
        displayName: "HOUSE",
        balanceMicros: 0n
      }
    });
  }
  
  return houseId;
}

/**
 * Count total registered agents in the system.
 */
async function getTotalAgentCount(): Promise<number> {
  const count = await prisma.agent.count();
  return count;
}

/**
 * Find the currently active (open) bot count market, if any.
 */
async function findActiveBotCountMarket(): Promise<{ id: string; createdAt: Date } | null> {
  // Look for markets with title starting with "How many total bots"
  const market = await prisma.market.findFirst({
    where: {
      status: "OPEN",
      title: {
        startsWith: "How many total bots"
      }
    },
    orderBy: { createdAt: "desc" }
  });
  
  return market ? { id: market.id, createdAt: market.createdAt } : null;
}

/**
 * Create a new bot count prediction market.
 * Market: "How many total bots will OpenSight have in the next hour?"
 * Resolution: Count of registered agents at market close
 */
async function createBotCountMarket(houseAgentId: string): Promise<BotCountMarketResult> {
  const now = new Date();
  const closesAt = new Date(now.getTime() + 59 * 60 * 1000); // 59 minutes from now
  
  const totalAgents = await getTotalAgentCount();
  const nextHour = now.getHours() + 1;
  
  // Create title that includes the hour for clarity
  const title = `How many total bots will OpenSight have at ${nextHour}:00?`;
  const description = `Prediction market on the total number of registered agents in OpenSight. ` +
    `Current count: ${totalAgents} agents. ` +
    `Market resolves at :59 minutes based on actual registered agent count. ` +
    `YES pays if count increases, NO pays if count decreases or stays same.`;
  
  const totalLiquidity = BigInt(INITIAL_LIQUIDITY_COIN) * MICROS_PER_COIN;
  
  // Bootstrap with 50/50 odds initially (equal shares)
  const yesSharesMicros = totalLiquidity / 2n;
  const noSharesMicros = totalLiquidity / 2n;
  
  try {
    const market = await prisma.market.create({
      data: {
        title,
        description,
        closesAt,
        category: "Internal",
        pool: {
          create: {
            collateralMicros: 0n,
            yesSharesMicros,
            noSharesMicros,
            feeBps: 100
          }
        }
      }
    });
    
    return {
      success: true,
      marketId: market.id,
      action: "created",
      message: `Created bot count market: ${title}. Current count: ${totalAgents} agents.`
    };
  } catch (err) {
    return {
      success: false,
      action: "error",
      message: `Failed to create market: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Resolve a bot count market based on actual agent count.
 * Pays out winning positions.
 */
async function resolveBotCountMarket(
  marketId: string, 
  houseAgentId: string
): Promise<BotCountMarketResult> {
  try {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { positions: true }
    });
    
    if (!market) {
      return {
        success: false,
        action: "error",
        message: `Market ${marketId} not found`
      };
    }
    
    if (market.status !== "OPEN") {
      return {
        success: false,
        action: "skipped",
        message: `Market ${marketId} is already ${market.status}`
      };
    }
    
    // Get current agent count
    const currentCount = await getTotalAgentCount();
    
    // Extract previous count from market description to determine direction
    const descriptionMatch = market.description?.match(/Current count: (\d+) agents/);
    const previousCount = (descriptionMatch && descriptionMatch[1]) ? parseInt(descriptionMatch[1], 10) : currentCount;
    
    // Determine outcome: YES if count increased, NO if decreased or stayed same
    const outcome: "YES" | "NO" = currentCount > previousCount ? "YES" : "NO";
    
    await prisma.$transaction(async (tx) => {
      for (const pos of market.positions) {
        const payout = outcome === "YES" ? pos.yesSharesMicros : pos.noSharesMicros;
        if (payout > 0n) {
          if (pos.agentId) {
            await tx.agent.update({
              where: { id: pos.agentId },
              data: { balanceMicros: { increment: payout } }
            });
          } else if (pos.userId) {
            await tx.user.update({
              where: { id: pos.userId },
              data: { balanceMicros: { increment: payout } }
            });
          }
        }
        
        await tx.position.update({
          where: { id: pos.id },
          data: { yesSharesMicros: 0n, noSharesMicros: 0n }
        });
      }
      
      // Mark market as resolved
      await tx.market.update({
        where: { id: marketId },
        data: {
          status: "RESOLVED",
          outcome
        }
      });
    });
    
    return {
      success: true,
      marketId,
      action: "resolved",
      message: `Resolved market ${marketId} with outcome ${outcome}. ` +
        `Agent count changed from ${previousCount} to ${currentCount}.`
    };
    
  } catch (err) {
    return {
      success: false,
      action: "error",
      message: `Failed to resolve market ${marketId}: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Main cycle function for the Total Bots prediction market system.
 * 
 * Runs every hour at :00 minutes:
 * 1. Check if there's an active bot count market
 * 2. If active and it's been ~59 minutes, resolve it
 * 3. Create a new market for the next hour
 * 
 * This ensures a continuous cycle of hourly prediction markets.
 */
export async function runBotCountMarketCycle(): Promise<BotCountMarketResult[]> {
  const results: BotCountMarketResult[] = [];
  const houseAgentId = await getOrCreateHouseAgent();
  
  console.log("[BotCount Cycle] Starting hourly cycle...");
  
  // Find active market
  const activeMarket = await findActiveBotCountMarket();
  
  if (activeMarket) {
    // Check if it's time to resolve (59 minutes old)
    const now = new Date();
    const ageMs = now.getTime() - activeMarket.createdAt.getTime();
    const ageMinutes = ageMs / (60 * 1000);
    
    if (ageMinutes >= 58) {
      // Time to resolve
      console.log(`[BotCount Cycle] Resolving active market ${activeMarket.id} (age: ${ageMinutes.toFixed(1)} min)`);
      const resolveResult = await resolveBotCountMarket(activeMarket.id, houseAgentId);
      results.push(resolveResult);
      
      if (resolveResult.success) {
        console.log(`[BotCount Cycle] ${resolveResult.message}`);
      } else {
        console.error(`[BotCount Cycle] Resolution failed: ${resolveResult.message}`);
      }
    } else {
      // Market still active, skip
      results.push({
        success: true,
        action: "skipped",
        message: `Active market ${activeMarket.id} is only ${ageMinutes.toFixed(1)} minutes old, skipping resolution`
      });
      console.log(`[BotCount Cycle] Active market found but too young (${ageMinutes.toFixed(1)} min), will resolve later`);
    }
  }
  
  // Create new market for next hour
  // Always create a new market at :00, even if we just resolved one
  console.log("[BotCount Cycle] Creating new bot count market for next hour");
  const createResult = await createBotCountMarket(houseAgentId);
  results.push(createResult);
  
  if (createResult.success) {
    console.log(`[BotCount Cycle] ${createResult.message}`);
  } else {
    console.error(`[BotCount Cycle] Creation failed: ${createResult.message}`);
  }
  
  return results;
}

/**
 * Get status of current bot count market cycle.
 * Useful for health checks and monitoring.
 */
export async function getBotCountMarketStatus(): Promise<{
  hasActiveMarket: boolean;
  activeMarketId?: string;
  totalAgents: number;
}> {
  const activeMarket = await findActiveBotCountMarket();
  const totalAgents = await getTotalAgentCount();
  
  return {
    hasActiveMarket: !!activeMarket,
    activeMarketId: activeMarket?.id,
    totalAgents
  };
}

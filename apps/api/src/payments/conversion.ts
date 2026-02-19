/**
 * Payment conversion utilities
 * 
 * BNB uses 18 decimals (wei)
 * Coin uses 6 decimals (micros)
 * 
 * Fixed conversion rate: 1 BNB = 1000 Coin
 * 
 * All calculations use integer arithmetic only (no floating point)
 */

const BNB_DECIMALS = 18;
const COIN_DECIMALS = 6;
const RATE_NUMERATOR = 1000n;  // 1 BNB = 1000 Coin

// Conversion factor: 10^(BNB_DECIMALS - COIN_DECIMALS) = 10^12
const DECIMAL_DIFF = BigInt(BNB_DECIMALS - COIN_DECIMALS);
const CONVERSION_FACTOR = 10n ** DECIMAL_DIFF;

/**
 * Convert BNB (wei) to Coin (micros)
 * Formula: coinMicros = (bnbWei * 1000) / 10^12
 * 
 * Example: 1 BNB (10^18 wei) = 1000 Coin (10^9 micros)
 */
export function bnbToCoin(bnbWei: bigint): bigint {
  if (bnbWei < 0n) {
    throw new Error("bnbWei must be non-negative");
  }
  return (bnbWei * RATE_NUMERATOR) / CONVERSION_FACTOR;
}

/**
 * Convert Coin (micros) to BNB (wei)
 * Formula: bnbWei = (coinMicros * 10^12) / 1000
 * 
 * Example: 1000 Coin (10^9 micros) = 1 BNB (10^18 wei)
 */
export function coinToBnb(coinMicros: bigint): bigint {
  if (coinMicros < 0n) {
    throw new Error("coinMicros must be non-negative");
  }
  return (coinMicros * CONVERSION_FACTOR) / RATE_NUMERATOR;
}

/**
 * Format wei amount to human-readable BNB string
 */
export function formatBnb(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const fraction = wei % 10n ** 18n;
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, 6);
  return `${whole}.${fractionStr}`;
}

/**
 * Parse BNB string to wei
 * Example: "1.5" -> 1500000000000000000n
 */
export function parseBnb(bnbStr: string): bigint {
  const [whole = "0", fraction = ""] = bnbStr.split(".");
  const wholeWei = BigInt(whole) * 10n ** 18n;
  const fractionWei = BigInt(fraction.padEnd(18, "0").slice(0, 18));
  return wholeWei + fractionWei;
}



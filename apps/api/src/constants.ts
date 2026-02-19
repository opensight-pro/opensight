export const MICROS_PER_COIN = 1_000_000n;
export const STARTING_BALANCE_COIN = 0n;  // No free starting balance - must deposit
export const STARTING_BALANCE_MICROS = STARTING_BALANCE_COIN * MICROS_PER_COIN;

export function coinToMicros(coin: number): bigint {
  if (!Number.isFinite(coin) || !Number.isInteger(coin) || coin < 0) {
    throw new Error("coin must be a non-negative integer");
  }
  return BigInt(coin) * MICROS_PER_COIN;
}

export function microsToCoinNumber(micros: bigint): number {
  return Number(micros) / Number(MICROS_PER_COIN);
}

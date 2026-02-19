export type Outcome = "YES" | "NO";

export type BinaryPoolState = {
  yesMicros: bigint;
  noMicros: bigint;
  feeBps: number;
};

export type BuyResult = {
  outcome: Outcome;
  collateralInMicros: bigint;
  feeMicros: bigint;
  netCollateralMicros: bigint;
  sharesOutMicros: bigint;
  nextPool: BinaryPoolState;
};

const BPS_DENOM = 10_000n;

function assertNonNegativeBigint(v: bigint, name: string) {
  if (v < 0n) {
    throw new Error(`${name} must be >= 0`);
  }
}

function assertPositiveBigint(v: bigint, name: string) {
  if (v <= 0n) {
    throw new Error(`${name} must be > 0`);
  }
}

function assertBps(feeBps: number) {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new Error("feeBps must be an integer between 0 and 10000");
  }
}

function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("division by zero");
  if (a === 0n) return 0n;
  return (a + b - 1n) / b;
}

export function quoteBuyBinaryFpmm(params: {
  pool: BinaryPoolState;
  outcome: Outcome;
  collateralInMicros: bigint;
}): BuyResult {
  const { pool, outcome, collateralInMicros } = params;
  assertBps(pool.feeBps);
  assertPositiveBigint(pool.yesMicros, "pool.yesMicros");
  assertPositiveBigint(pool.noMicros, "pool.noMicros");
  assertNonNegativeBigint(collateralInMicros, "collateralInMicros");

  const fee = (collateralInMicros * BigInt(pool.feeBps)) / BPS_DENOM;
  const net = collateralInMicros - fee;

  // Fixed-product market maker (FPMM) for 2 outcomes.
  // Reference intuition: add net collateral to BOTH outcome balances, then remove the
  // purchased outcome balance so that the product of outcome balances stays constant.
  // We use ceil division for the new balance to conservatively round against the trader.
  const k = pool.yesMicros * pool.noMicros;

  if (outcome === "YES") {
    const noAfterAdd = pool.noMicros + net;
    const yesNew = ceilDiv(k, noAfterAdd);
    const sharesOut = (pool.yesMicros + net) - yesNew;
    if (sharesOut <= 0n) {
      throw new Error("trade results in zero sharesOut");
    }
    return {
      outcome,
      collateralInMicros,
      feeMicros: fee,
      netCollateralMicros: net,
      sharesOutMicros: sharesOut,
      nextPool: {
        yesMicros: yesNew,
        noMicros: noAfterAdd,
        feeBps: pool.feeBps
      }
    };
  }

  const yesAfterAdd = pool.yesMicros + net;
  const noNew = ceilDiv(k, yesAfterAdd);
  const sharesOut = (pool.noMicros + net) - noNew;
  if (sharesOut <= 0n) {
    throw new Error("trade results in zero sharesOut");
  }
  return {
    outcome,
    collateralInMicros,
    feeMicros: fee,
    netCollateralMicros: net,
    sharesOutMicros: sharesOut,
    nextPool: {
      yesMicros: yesAfterAdd,
      noMicros: noNew,
      feeBps: pool.feeBps
    }
  };
}

export function quotePriceYes(pool: Pick<BinaryPoolState, "yesMicros" | "noMicros">): number {
  const denom = pool.yesMicros + pool.noMicros;
  if (denom <= 0n) return 0.5;
  // Note: number conversion is for UI display only; trading uses bigint math.
  return Number(pool.yesMicros) / Number(denom);
}

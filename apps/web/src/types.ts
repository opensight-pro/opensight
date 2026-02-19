export type Market = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "RESOLVED";
  outcome: "UNRESOLVED" | "YES" | "NO";
  priceYes: number;
  priceNo: number;
};

export type AccountType = "AGENT" | "HUMAN";
export type Badge = "TOP_0.1%" | "TOP_0.5%" | "TOP_1%" | "TOP_5%" | "TOP_10%" | null;

export type RegisterResponse = {
  agentId: string;
  apiKey: string;
  balanceCoin: number;
  claimUrl: string;
};

export type PortfolioResponse = {
  accountType: AccountType;
  agentId?: string;
  userId?: string;
  balanceCoin: number;
  totalEquityCoin: number;
  positions: Array<{
    marketId: string;
    title: string;
    status: "OPEN" | "RESOLVED";
    outcome: "UNRESOLVED" | "YES" | "NO";
    yesSharesCoin: number;
    noSharesCoin: number;
    markToMarketCoin: number;
    costBasisCoin: number;
    unrealizedPnlCoin: number;
  }>;
  history: Array<{
    marketId: string;
    title: string;
    outcome: "YES" | "NO";
    costBasisCoin: number;
    payoutCoin: number;
    realizedPnlCoin: number;
    result: "WIN" | "LOSE";
    lastTradeAt: string;
  }>;
};

export type MarketTrade = {
  id: string;
  createdAt: string;
  accountType: AccountType;
  traderId: string;
  traderDisplayName?: string | null;
  xHandle?: string | null;
  xAvatar?: string | null;
  side: "YES" | "NO";
  action: "BUY" | "SELL";
  volumeCoin: number;
  sharesOutCoin: number;
  priceYesAfter: number;
};

export type LeaderboardRow = {
  rank: number;
  id: string;
  displayName?: string | null;
  accountType: AccountType;
  balanceCoin: number;
  roi: number;
  badge: Badge;
  percentile: number;
  xHandle?: string | null;
  xAvatar?: string | null;
};

export type TradeResponse = {
  tradeId: string;
  feeCoin: number;
  sharesOutCoin: number;
  balanceCoin: number;
  position: {
    yesSharesCoin: number;
    noSharesCoin: number;
  };
};

export type QuoteResponse = {
  feeCoin: number;
  netCollateralCoin: number;
  sharesOutCoin: number;
  priceYesBefore: number;
  priceNoBefore: number;
  priceYesAfter: number;
  priceNoAfter: number;
};

export type UserInfo = {
  accountType: "HUMAN";
  userId: string;
  xHandle: string;
  xName: string;
  xAvatar?: string | null;
  balanceCoin: number;
  claimedAgents: Array<{ agentId: string; displayName?: string | null; balanceCoin: number }>;
};

// Web3 Auth Types
export type Web3NonceResponse = {
  nonceId: string;
  nonce: string;
  message: string;
};

export type Web3AuthVerifyResponse = {
  apiKey: string;
  userId: string;
  walletAddress: string;
  xHandle?: string | null;
  xName?: string | null;
  balanceCoin: number;
};

export type Web3ClaimNonceResponse = {
  nonceId: string;
  nonce: string;
  message: string;
};

export type Web3ClaimVerifyResponse = {
  success: boolean;
  agentId: string;
  displayName: string | null;
  balanceCoin: number;
  claimedBy: { userId: string; walletAddress: string };
};

// Payment Types
export type PaymentDirection = "DEPOSIT" | "WITHDRAW";

export type PaymentStatus = "PENDING" | "CONFIRMED" | "FAILED" | "SENT";

export type Payment = {
  id: string;
  requestId: string;
  direction: PaymentDirection;
  status: PaymentStatus;
  bnbAmountWei: string;
  bnbAmount: string;
  coinAmount: number;
  txHash: string | null;
  walletAddress: string;
  createdAt: string;
  confirmedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
};

export type DepositIntentResponse = {
  requestId: string;
  walletAddress: string;
  status: string;
};

export type DepositConfirmResponse = {
  paymentId: string;
  requestId: string;
  status: string;
  bnbAmountWei: string;
  coinAmount: number;
  txHash: string;
};

export type WithdrawRequestResponse = {
  requestId: string;
  bnbAmountWei: string;
  bnbAmount: string;
  walletAddress: string;
  status: string;
};

export type WithdrawConfirmResponse = {
  paymentId: string;
  requestId: string;
  status: string;
  txHash: string;
};

export type PaymentHistoryResponse = {
  payments: Payment[];
};

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

// Read chain configuration from environment variables
// Set these in your .env file to use any chain:
// VITE_CHAIN_ID=56
// VITE_CHAIN_NAME="BNB Chain"  
// VITE_RPC_URL=https://bsc-dataseed.binance.org
// VITE_CURRENCY_SYMBOL=BNB
// VITE_CURRENCY_DECIMALS=18

const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID as string || "1", 10);
const RPC_URL = (import.meta.env.VITE_RPC_URL as string) || "http://localhost:8545";
const CHAIN_NAME = (import.meta.env.VITE_CHAIN_NAME as string) || "Localhost";
const CURRENCY_SYMBOL = (import.meta.env.VITE_CURRENCY_SYMBOL as string) || "ETH";
const CURRENCY_DECIMALS = parseInt(import.meta.env.VITE_CURRENCY_DECIMALS as string || "18", 10);

// Configurable chain based on environment
export const appChain = {
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: {
    name: CURRENCY_SYMBOL,
    symbol: CURRENCY_SYMBOL,
    decimals: CURRENCY_DECIMALS
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] }
  }
} as const;

export const wagmiConfig = createConfig({
  chains: [appChain],
  connectors: [injected({ target: "metaMask" })],
  transports: {
    [appChain.id]: http()
  }
});

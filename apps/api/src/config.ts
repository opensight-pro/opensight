import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  HOST: z.string().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  TWITTER_CALLBACK_URL: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  // Payment Gateway Configuration
  PAYMENT_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  DEMO_TRUST_MODE: z.enum(["true", "false"]).optional().default("true"),
  MIN_DEPOSIT_WEI: z.string().optional().default("1000000000000000"), // 0.001 BNB default
  MIN_WITHDRAW_COIN: z.coerce.number().int().optional().default(100), // 100 Coin default
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return envSchema.parse(env);
}

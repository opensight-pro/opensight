import React from "react";

import { apiPost } from "../api";
import type { DepositIntentResponse, DepositConfirmResponse } from "../types";

export function useDeposit(apiKey: string) {
  const [intent, setIntent] = React.useState<DepositIntentResponse | null>(null);
  const [confirm, setConfirm] = React.useState<DepositConfirmResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  const depositIntent = React.useCallback(
    async (body: { walletAddress: string }) => {
      if (!apiKey) {
        setError("API key required");
        return null;
      }
      setLoading(true);
      setError("");
      try {
        const result = await apiPost<DepositIntentResponse>("/payments/deposit/intent", body, { apiKey });
        setIntent(result);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create deposit intent");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiKey]
  );

  const depositConfirm = React.useCallback(
    async (body: { requestId: string; txHash: string; walletAddress: string; bnbAmountWei: string }) => {
      if (!apiKey) {
        setError("API key required");
        return null;
      }
      setLoading(true);
      setError("");
      try {
        const result = await apiPost<DepositConfirmResponse>("/payments/deposit/confirm", body, { apiKey });
        setConfirm(result);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to confirm deposit");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiKey]
  );

  const refresh = React.useCallback(() => {
    setIntent(null);
    setConfirm(null);
    setError("");
  }, []);

  return { intent, confirm, loading, error, depositIntent, depositConfirm, refresh };
}

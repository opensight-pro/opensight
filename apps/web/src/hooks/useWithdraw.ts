import React from "react";

import { apiPost } from "../api";
import type { WithdrawRequestResponse, WithdrawConfirmResponse } from "../types";

export function useWithdraw(apiKey: string) {
  const [request, setRequest] = React.useState<WithdrawRequestResponse | null>(null);
  const [confirm, setConfirm] = React.useState<WithdrawConfirmResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  const withdrawRequest = React.useCallback(
    async (body: { coinAmount: number; walletAddress: string }) => {
      if (!apiKey) {
        setError("API key required");
        return null;
      }
      setLoading(true);
      setError("");
      try {
        const result = await apiPost<WithdrawRequestResponse>("/payments/withdraw/request", body, { apiKey });
        setRequest(result);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create withdraw request");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiKey]
  );

  const withdrawConfirm = React.useCallback(
    async (body: { requestId: string; txHash: string }) => {
      if (!apiKey) {
        setError("API key required");
        return null;
      }
      setLoading(true);
      setError("");
      try {
        const result = await apiPost<WithdrawConfirmResponse>("/payments/withdraw/confirm", body, { apiKey });
        setConfirm(result);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to confirm withdraw");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiKey]
  );

  const refresh = React.useCallback(() => {
    setRequest(null);
    setConfirm(null);
    setError("");
  }, []);

  return { request, confirm, loading, error, withdrawRequest, withdrawConfirm, refresh };
}

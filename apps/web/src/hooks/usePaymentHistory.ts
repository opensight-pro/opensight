import React from "react";

import { apiGet } from "../api";
import type { PaymentHistoryResponse } from "../types";

export function usePaymentHistory(apiKey: string) {
  const [history, setHistory] = React.useState<PaymentHistoryResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  const refresh = React.useCallback(async () => {
    if (!apiKey) {
      setHistory(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const h = await apiGet<PaymentHistoryResponse>("/payments/history", { apiKey });
      setHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payment history");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { history, loading, error, refresh };
}

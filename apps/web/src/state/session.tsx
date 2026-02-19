import React from "react";

import { apiPost } from "../api";
import { API_URL } from "../api";
import type { RegisterResponse, AccountType, Web3AuthVerifyResponse } from "../types";

type SessionState = {
  apiKey: string;
  agentId: string;
  userId: string;
  accountType: AccountType | null;
  xHandle: string;
  xName: string;
  xAvatar: string;
  walletAddress: string;
  adminToken: string;

  setApiKey: (v: string) => void;
  setAdminToken: (v: string) => void;

  registerAgent: () => Promise<void>;
  loginWithX: () => void;
  loginWithWallet: (walletAddress: string) => Promise<{ nonceId: string; nonce: string; message: string }>;
  handleAuthCallback: (params: {
    apiKey: string;
    userId: string;
    xHandle: string;
    xName: string;
    xAvatar: string;
    balanceCoin: string;
  }) => void;
  disconnect: () => void;

  isLoggedIn: boolean;
  isHuman: boolean;
  isAgent: boolean;
};

const SessionContext = React.createContext<SessionState | null>(null);

function loadLocal(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function saveLocal(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function SessionProvider(props: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = React.useState<string>(() => loadLocal("opensight.apiKey"));
  const [agentId, setAgentIdState] = React.useState<string>(() => loadLocal("opensight.agentId"));
  const [userId, setUserIdState] = React.useState<string>(() => loadLocal("opensight.userId"));
  const [accountType, setAccountTypeState] = React.useState<AccountType | null>(() => {
    const stored = loadLocal("opensight.accountType");
    return stored === "AGENT" || stored === "HUMAN" ? stored : null;
  });
  const [xHandle, setXHandleState] = React.useState<string>(() => loadLocal("opensight.xHandle"));
  const [xName, setXNameState] = React.useState<string>(() => loadLocal("opensight.xName"));
  const [xAvatar, setXAvatarState] = React.useState<string>(() => loadLocal("opensight.xAvatar"));
  const [walletAddress, setWalletAddressState] = React.useState<string>(() => loadLocal("opensight.walletAddress"));
  const [adminToken, setAdminToken] = React.useState<string>("");

  const setApiKey = React.useCallback((v: string) => {
    const next = v.trim();
    setApiKeyState(next);
    saveLocal("opensight.apiKey", next);
  }, []);

  const setAgentId = React.useCallback((v: string) => {
    const next = v.trim();
    setAgentIdState(next);
    saveLocal("opensight.agentId", next);
  }, []);

  const setUserId = React.useCallback((v: string) => {
    const next = v.trim();
    setUserIdState(next);
    saveLocal("opensight.userId", next);
  }, []);

  const setAccountType = React.useCallback((v: AccountType | null) => {
    setAccountTypeState(v);
    saveLocal("opensight.accountType", v ?? "");
  }, []);

  const setXHandle = React.useCallback((v: string) => {
    setXHandleState(v);
    saveLocal("opensight.xHandle", v);
  }, []);

  const setXName = React.useCallback((v: string) => {
    setXNameState(v);
    saveLocal("opensight.xName", v);
  }, []);

  const setXAvatar = React.useCallback((v: string) => {
    setXAvatarState(v);
    saveLocal("opensight.xAvatar", v);
  }, []);

  const setWalletAddress = React.useCallback((v: string) => {
    setWalletAddressState(v);
    saveLocal("opensight.walletAddress", v);
  }, []);

  const disconnect = React.useCallback(() => {
    setApiKey("");
    setAgentId("");
    setUserId("");
    setAccountType(null);
    setXHandle("");
    setXName("");
    setXAvatar("");
    setWalletAddress("");
    setAdminToken("");
  }, [setApiKey, setAgentId, setUserId, setAccountType, setXHandle, setXName, setXAvatar, setWalletAddress]);

  const registerAgent = React.useCallback(async () => {
    const res = await apiPost<RegisterResponse>("/agents/register", { displayName: "web-agent" });
    setApiKey(res.apiKey);
    setAgentId(res.agentId);
    setAccountType("AGENT");
  }, [setApiKey, setAgentId, setAccountType]);

  // X OAuth - kept but hidden from UI (deprecated for demo)
  const loginWithX = React.useCallback(() => {
    window.location.href = `${API_URL}/oauth/twitter`;
  }, []);

  // Web3 Wallet Auth - new primary auth method
  const loginWithWallet = React.useCallback(
    async (walletAddress: string) => {
      // Step 1: Get nonce
      const nonceRes = await apiPost<{ nonceId: string; nonce: string; message: string }>("/auth/web3/nonce", {
        walletAddress
      });

      // Step 2: Sign message (done by caller using wagmi signMessage)
      // Step 3: Verify and get API key
      return nonceRes;
    },
    []
  );

  const completeWalletLogin = React.useCallback(
    async (params: { nonceId: string; walletAddress: string; signature: string }) => {
      const res = await apiPost<Web3AuthVerifyResponse>("/auth/web3/verify", {
        nonceId: params.nonceId,
        walletAddress: params.walletAddress,
        signature: params.signature
      });

      setApiKey(res.apiKey);
      setUserId(res.userId);
      setWalletAddress(params.walletAddress);
      setAccountType("HUMAN");

      // Optionally set X info if provided in response
      if (res.xHandle) setXHandle(res.xHandle);
      if (res.xName) setXName(res.xName);

      return res;
    },
    [setApiKey, setUserId, setWalletAddress, setAccountType, setXHandle, setXName]
  );

  // Exposed as part of session for external use
  const completeWalletLoginRef = React.useRef(completeWalletLogin);
  React.useEffect(() => {
    completeWalletLoginRef.current = completeWalletLogin;
  }, [completeWalletLogin]);

  const handleAuthCallback = React.useCallback(
    (params: { apiKey: string; userId: string; xHandle: string; xName: string; xAvatar: string; balanceCoin: string }) => {
      setApiKey(params.apiKey);
      setUserId(params.userId);
      setXHandle(params.xHandle);
      setXName(params.xName);
      setXAvatar(params.xAvatar);
      setAccountType("HUMAN");
    },
    [setApiKey, setUserId, setXHandle, setXName, setXAvatar, setAccountType]
  );

  const isLoggedIn = Boolean(apiKey);
  const isHuman = accountType === "HUMAN";
  const isAgent = accountType === "AGENT";

  const value: SessionState = {
    apiKey,
    agentId,
    userId,
    accountType,
    xHandle,
    xName,
    xAvatar,
    walletAddress,
    adminToken,
    setApiKey,
    setAdminToken,
    registerAgent,
    loginWithX,
    loginWithWallet,
    handleAuthCallback,
    disconnect,
    isLoggedIn,
    isHuman,
    isAgent,
    // Expose completeWalletLogin via ref pattern
    completeWalletLogin: (params: { nonceId: string; walletAddress: string; signature: string }) =>
      completeWalletLoginRef.current(params)
  } as SessionState & { completeWalletLogin: typeof completeWalletLogin };

  return <SessionContext.Provider value={value}>{props.children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

// Hook for completing wallet login (exposed separately)
export function useCompleteWalletLogin() {
  const session = useSession();
  return (session as unknown as { completeWalletLogin: (params: { nonceId: string; walletAddress: string; signature: string }) => Promise<Web3AuthVerifyResponse> }).completeWalletLogin;
}

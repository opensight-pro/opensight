import React from "react";
import { useConnect, useAccount, useSignMessage, useConnectors } from "wagmi";

import { apiGet, apiPost } from "../api";
import { TopNavigation } from "../components/TopNavigation";
import { TerminalTitleBar } from "../components/TerminalTitleBar";
import { fmtCoin } from "../lib/format";
import type { Web3ClaimNonceResponse, Web3ClaimVerifyResponse } from "../types";

type AgentInfo = {
  agentId: string;
  displayName: string | null;
  balanceCoin: number;
  claimed: boolean;
  claimedBy: { walletAddress: string } | null;
};

export function ClaimPage({ token }: { token: string }) {
  const [loading, setLoading] = React.useState(true);
  const [claiming, setClaiming] = React.useState(false);
  const [agent, setAgent] = React.useState<AgentInfo | null>(null);
  const [error, setError] = React.useState<string>("");
  const [success, setSuccess] = React.useState(false);

  // Wagmi hooks
  const { isPending: isConnecting } = useConnect();
  const connectors = useConnectors();
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  // Load agent info on mount
  React.useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<AgentInfo>(`/claim/${token}`);
        setAgent(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load agent");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  const handleConnect = async () => {
    setError("");
    const connector = connectors.at(0);
    if (connector) {
      connector.connect();
    } else {
      setError("MetaMask not detected. Please install MetaMask.");
    }
  };

  const handleClaim = async () => {
    if (!address) return;
    setClaiming(true);
    setError("");

    try {
      // Step 1: Get nonce
      const nonceRes = await apiPost<Web3ClaimNonceResponse>(`/claim/${token}/nonce`, {
        walletAddress: address
      });

      // Step 2: Sign message
      const signature = await signMessageAsync({ message: nonceRes.message });

      // Step 3: Verify claim
      await apiPost<Web3ClaimVerifyResponse>(`/claim/${token}/verify`, {
        nonceId: nonceRes.nonceId,
        walletAddress: address,
        signature
      });

      setSuccess(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to claim agent";
      // Handle specific error cases
      if (msg.includes("409") || msg.toLowerCase().includes("already claimed")) {
        setError("This agent has already been claimed by another wallet.");
      } else if (msg.includes("404")) {
        setError("Invalid claim token. The agent may not exist.");
      } else {
        setError(msg);
      }
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-terminal text-text-dim font-mono flex flex-col terminal-grid">
      <TopNavigation activePath="" />
      <main className="flex-1 w-full max-w-[800px] mx-auto p-4 flex flex-col items-center justify-center">
        <TerminalTitleBar title="CLAIM_AGENT" accent="primary" className="w-full mb-6" />
        <div className="w-full bg-surface-terminal border border-border-terminal p-6 rounded-sm">
          {loading ? (
            <div className="text-center py-8 text-text-dim">Loading...</div>
          ) : error && !agent ? (
            <div className="text-center py-8">
              <div className="text-neon-red font-bold mb-2">Error</div>
              <div className="text-sm">{error}</div>
            </div>
          ) : agent ? (
            <>
              <div className="flex items-center gap-4 mb-6">
                <div className="size-16 rounded-sm bg-surface-terminal border border-border-terminal flex items-center justify-center text-2xl text-white font-bold">
                  AG
                </div>
                <div>
                  <div className="text-white font-bold text-lg">{agent.displayName || "Unnamed Agent"}</div>
                  <div className="text-text-dim text-sm font-mono">{agent.agentId.slice(0, 8)}...</div>
                  <div className="text-primary text-sm mt-1">{fmtCoin(agent.balanceCoin)} Coin</div>
                </div>
              </div>

              {success ? (
                <div className="p-4 bg-neon-green/10 border border-neon-green/40 text-neon-green rounded-sm text-center">
                  <div className="font-bold mb-1">Agent Claimed!</div>
                  <div className="text-sm">
                    Ownership has been verified via wallet signature. The agent is now linked to your
                    account.
                  </div>
                </div>
              ) : agent.claimed ? (
                <div className="p-4 bg-surface-terminal border border-border-terminal rounded-sm text-center">
                  <div className="text-text-dim mb-1">Already claimed by</div>
                  <div className="text-white font-mono text-sm">
                    {agent.claimedBy?.walletAddress
                      ? `${agent.claimedBy.walletAddress.slice(0, 8)}...${agent.claimedBy.walletAddress.slice(-6)}`
                      : "Unknown"}
                  </div>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="mb-4 p-3 bg-neon-red/10 border border-neon-red/40 text-neon-red text-sm rounded-sm">
                      {error}
                    </div>
                  )}

                  {!isConnected ? (
                    // Step 1: Connect Wallet
                    <>
                      <p className="text-text-dim text-sm mb-4">
                        Connect your wallet to claim this agent. The agent will be linked to your
                        wallet address and both credentials will share the same trader account.
                      </p>
                      <button
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="w-full px-4 py-3 bg-primary/10 border border-primary/40 text-primary font-bold text-sm uppercase rounded-sm hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10 10-4.48 10-10zm-10 8c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                        </svg>
                        {isConnecting ? "Connecting..." : "Connect MetaMask"}
                      </button>
                    </>
                  ) : (
                    // Step 2: Sign and Claim
                    <>
                      <div className="mb-4 p-3 bg-neon-green/10 border border-neon-green/40 text-neon-green rounded-sm text-sm">
                        <div className="font-bold mb-1">Wallet Connected</div>
                        <div className="font-mono">{address}</div>
                      </div>
                      <p className="text-text-dim text-sm mb-4">
                        Sign the message to claim this agent. This proves you own the wallet address
                        and links the agent to your account.
                      </p>
                      <button
                        onClick={() => void handleClaim()}
                        disabled={claiming || isSigning}
                        className="w-full px-4 py-3 bg-primary/10 border border-primary/40 text-primary font-bold text-sm uppercase rounded-sm hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        {isSigning ? "Signing..." : claiming ? "Claiming..." : "Sign & Claim Agent"}
                      </button>
                      <button
                        onClick={() => window.location.reload()}
                        className="w-full mt-3 px-4 py-2 border border-border-terminal text-text-dim text-xs uppercase rounded-sm hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

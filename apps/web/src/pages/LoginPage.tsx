import React from "react";
import { useConnect, useAccount, useSignMessage, useConnectors } from "wagmi";

import { TopNavigation } from "../components/TopNavigation";
import { useSession, useCompleteWalletLogin } from "../state/session";

export function LoginPage() {
  const session = useSession();
  const completeWalletLogin = useCompleteWalletLogin();
  const { isPending: isConnecting, error: connectError } = useConnect();
  const connectors = useConnectors();
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const [error, setError] = React.useState<string>("");
  const [isVerifying, setIsVerifying] = React.useState(false);

  // Handle wallet connection
  const handleConnect = async () => {
    setError("");
    const connector = connectors.at(0);
    if (connector) {
      connector.connect();
    } else {
      setError("MetaMask not detected. Please install MetaMask.");
    }
  };

  // Handle sign and verify
  const handleSignAndVerify = async () => {
    if (!address) return;
    setError("");
    setIsVerifying(true);

    try {
      const nonceRes = await session.loginWithWallet(address);
      const signature = await signMessageAsync({ message: nonceRes.message });
      await completeWalletLogin({
        nonceId: nonceRes.nonceId,
        walletAddress: address,
        signature
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle OAuth errors (legacy)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const err = params.get("error");
    if (err) {
      const messages: Record<string, string> = {
        twitter_not_configured: "X OAuth is not configured for this environment.",
        invalid_callback: "Invalid OAuth callback",
        invalid_state: "Session expired. Please try again.",
        token_exchange_failed: "Failed to authenticate with X",
        user_fetch_failed: "Failed to fetch user profile",
        oauth_failed: "OAuth authentication failed"
      };
      setError(messages[err] || err);
    }
  }, []);

  // Logged in state
  if (session.isLoggedIn) {
    return (
      <div className="min-h-screen bg-bg-main">
        <TopNavigation activePath="/login" />
        
        <main className="max-w-md mx-auto px-4 py-16">
          <div className="bg-surface rounded-xl border border-border p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">{session.isHuman ? "👤" : "🤖"}</span>
            </div>
            
            <h1 className="text-xl font-bold text-text-main mb-2">
              {session.isHuman ? "Wallet Connected" : "Agent Connected"}
            </h1>
            
            <div className="bg-bg-secondary rounded-lg p-4 mb-6">
              {session.walletAddress ? (
                <>
                  <p className="text-text-tertiary text-xs uppercase mb-1">Wallet Address</p>
                  <p className="text-text-main font-mono text-sm break-all">{session.walletAddress}</p>
                </>
              ) : (
                <>
                  <p className="text-text-tertiary text-xs uppercase mb-1">Agent ID</p>
                  <p className="text-text-main font-mono text-sm">{session.agentId}</p>
                </>
              )}
            </div>

            <button
              onClick={session.disconnect}
              className="w-full py-3 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-lg font-semibold transition-colors"
            >
              Disconnect
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main">
      <TopNavigation activePath="/login" />
      
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="bg-surface rounded-xl border border-border p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-text-main mb-2">Connect Wallet</h1>
            <p className="text-text-secondary text-sm">
              Connect your wallet to start trading on OpenSight
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Connection Error */}
          {connectError && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg">
              {connectError.message}
            </div>
          )}

          {!isConnected ? (
            // Step 1: Connect Wallet
            <div className="space-y-4">
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full py-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-bg-main font-bold rounded-lg transition-colors flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10 10-4.48 10-10zm-10 8c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
                {isConnecting ? "Connecting…" : "Connect MetaMask"}
              </button>

              <div className="text-center text-text-tertiary text-sm">
                <p>New to crypto wallets?</p>
                <a 
                  href="https://metamask.io/download/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary-hover font-medium"
                >
                  Get MetaMask →
                </a>
              </div>
            </div>
          ) : (
            // Step 2: Sign Message
            <div className="space-y-4">
              <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-success font-medium">Wallet Connected</span>
                </div>
                <p className="text-text-secondary text-sm font-mono break-all">{address}</p>
              </div>

              <p className="text-text-secondary text-sm text-center">
                Sign the message to authenticate with OpenSight. This proves you own the wallet address.
              </p>

              <button
                onClick={() => void handleSignAndVerify()}
                disabled={isSigning || isVerifying}
                className="w-full py-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-bg-main font-bold rounded-lg transition-colors"
              >
                {isSigning ? "Signing…" : isVerifying ? "Verifying…" : "Sign & Login"}
              </button>

              <button
                onClick={session.disconnect}
                className="w-full py-3 border border-border hover:border-text-secondary text-text-secondary hover:text-text-main rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import React from "react";
import { useDisconnect } from "wagmi";

import { apiGet } from "../api";
import { TopNavigation } from "../components/TopNavigation";
import { TerminalTitleBar } from "../components/TerminalTitleBar";
import { fmtCoin } from "../lib/format";
import { Link } from "../router";
import { useSession } from "../state/session";
import type { UserInfo } from "../types";

import { Icon } from "../components/Icon";

export function UserProfilePage({ userId }: { userId: string }) {
  const session = useSession();
  const { disconnect: disconnectWallet } = useDisconnect();
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [error, setError] = React.useState<string>("");

  const isOwnProfile = session.isLoggedIn && session.userId === userId;

  React.useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<UserInfo>(`/users/${userId}`);
        setUser(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load user");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [userId]);

  const handleDisconnect = () => {
    disconnectWallet();
    session.disconnect();
  };

  return (
    <div className="min-h-screen bg-bg-terminal text-text-dim font-mono flex flex-col terminal-grid">
      <TopNavigation activePath="" />
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-4">
        <TerminalTitleBar title="USER_PROFILE" accent="primary" className="mb-6" />
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : error ? (
          <div className="text-center py-8 text-neon-red">{error}</div>
        ) : user ? (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-surface-terminal border border-border-terminal p-6 rounded-sm">
              <div className="flex items-center gap-4 mb-4">
                {user.xAvatar ? (
                  <img src={user.xAvatar} alt="" className="size-16 rounded-full border border-border-terminal" />
                ) : (
                  <div className="size-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-2xl font-bold">
                    H
                  </div>
                )}
                <div>
                  <div className="text-white font-bold text-lg">{user.xName}</div>
                  <div className="text-text-dim">@{user.xHandle}</div>
                </div>
              </div>
              <div className="border-t border-border-terminal pt-4">
                <div className="text-[10px] text-text-dim uppercase mb-1">Balance</div>
                <div className="text-white text-xl font-bold">{fmtCoin(user.balanceCoin)} Coin</div>
              </div>

              {/* Disconnect Button - Only show for own profile */}
              {isOwnProfile && (
                <div className="border-t border-border-terminal pt-4 mt-4">
                  <button
                    onClick={handleDisconnect}
                    className="w-full px-4 py-3 bg-neon-red/10 border border-neon-red/40 text-neon-red font-bold text-sm uppercase rounded-sm hover:bg-neon-red/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="logout" className="text-[16px]" />
                    Disconnect Wallet
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2 bg-surface-terminal border border-border-terminal p-6 rounded-sm">
              <div className="text-[10px] text-text-dim uppercase mb-4">Claimed Agents</div>
              {user.claimedAgents.length === 0 ? (
                <div className="text-text-dim text-sm">No claimed agents</div>
              ) : (
                <div className="space-y-3">
                  {user.claimedAgents.map((agent) => (
                    <Link
                      key={agent.agentId}
                      to={`/agent/${agent.agentId}`}
                      className="flex items-center justify-between p-3 bg-bg-terminal border border-border-terminal rounded-sm hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-sm bg-surface-terminal border border-border-terminal flex items-center justify-center text-sm text-white font-bold">
                          AG
                        </div>
                        <div>
                          <div className="text-white font-bold">{agent.displayName || "Unnamed"}</div>
                          <div className="text-text-dim text-xs font-mono">{agent.agentId.slice(0, 8)}...</div>
                        </div>
                      </div>
                      <div className="text-primary font-bold">{fmtCoin(agent.balanceCoin)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

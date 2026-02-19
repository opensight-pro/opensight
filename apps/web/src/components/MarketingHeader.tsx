import React from "react";

import { API_URL } from "../api";
import { Link } from "../router";
import { useSession } from "../state/session";
import { shortId } from "../lib/format";

import { Icon } from "./Icon";

export function MarketingHeader(props: { onRefresh?: () => void; busy?: boolean }) {
  const session = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-dark bg-background-dark/80 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1280px] px-4 md:px-10 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-4 text-white hover:opacity-90 transition-opacity">
          <div className="size-8 flex items-center justify-center bg-primary/20 rounded border border-primary/20 text-primary">
            <Icon name="terminal" className="text-2xl" />
          </div>
          <div className="flex flex-col">
            <div className="text-white text-xl font-bold leading-tight tracking-tight font-display">OpenSight</div>
            <div className="text-text-muted text-[11px] font-mono">API {API_URL}</div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <nav className="flex items-center gap-6 font-mono text-sm">
            <Link to="/markets" className="text-text-muted hover:text-white transition-colors">
              Markets
            </Link>
            <Link to="/leaderboard" className="text-text-muted hover:text-white transition-colors">
              Leaderboard
            </Link>
            <Link to="/docs" className="text-text-muted hover:text-white transition-colors">
              Docs
            </Link>
            <Link to="/api" className="text-text-muted hover:text-white transition-colors">
              API
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {props.onRefresh ? (
              <button
                className="h-9 px-4 rounded-lg border border-border-dark bg-surface-dark text-white text-sm font-bold hover:border-primary/40 transition-colors"
                disabled={props.busy}
                onClick={() => props.onRefresh?.()}
              >
                Refresh
              </button>
            ) : null}

            {!session.apiKey ? (
              <Link
                to={`/config`}
                className="h-9 px-4 rounded-lg border border-accent-blue/30 bg-accent-blue/10 text-white text-sm font-bold hover:bg-accent-blue/15 transition-colors flex items-center gap-2"
              >
                <Icon name="api" className="text-[18px]" />
                Connect Agent
              </Link>
            ) : session.isHuman ? (
              <Link
                to={`/user/${session.userId}`}
                className="h-9 px-4 rounded-lg border border-accent-blue/30 bg-accent-blue/10 text-white text-sm font-bold hover:bg-accent-blue/15 transition-colors flex items-center gap-2"
                title={`@${session.xHandle}`}
              >
                <Icon name="person" className="text-[18px]" />
                @{session.xHandle || session.userId.slice(0, 8)}
              </Link>
            ) : (
              <Link
                to={`/agent/${session.agentId}`}
                className="h-9 px-4 rounded-lg border border-primary/30 bg-primary/10 text-white text-sm font-bold hover:bg-primary/15 transition-colors flex items-center gap-2"
                title={session.agentId}
              >
                <Icon name="smart_toy" className="text-[18px]" />
                {shortId(session.agentId)}
              </Link>
            )}
          </div>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <Link
            to="/markets"
            className="h-9 px-3 rounded border border-border-terminal bg-surface-terminal text-white font-mono text-xs flex items-center gap-2"
          >
            <Icon name="candlestick_chart" className="text-[18px] text-primary" />
            Markets
          </Link>
        </div>
      </div>
    </header>
  );
}

import { Link } from "../router";
import { useSession } from "../state/session";
import { shortId } from "../lib/format";
import logoUrl from "../../assets/molt-market-logo.jpg";

interface TopNavigationProps {
  activePath: string;
}

export function TopNavigation({ activePath }: TopNavigationProps) {
  const session = useSession();
  const profileTo = session.isHuman ? `/user/${session.userId}` : `/agent/${session.agentId}`;

  const navItems = [
    { path: "/markets", label: "Markets" },
    { path: "/dashboard", label: "Dashboard" },
    { path: "/leaderboard", label: "Leaderboard" },
    { path: "/docs", label: "Docs" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-bg-main border-b border-border">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={logoUrl} 
                alt="OpenSight" 
                className="w-8 h-8 rounded object-cover"
              />
              <span className="text-text-main font-bold text-lg tracking-tight">
                OpenSight
              </span>
            </Link>

            {/* Main Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                    activePath === item.path
                      ? "text-text-main"
                      : "text-text-secondary hover:text-text-main"
                  }`}
                >
                  {item.label}
                  {activePath === item.path && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary" />
                  )}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {!session.isLoggedIn ? (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-bg-main font-semibold text-sm rounded transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
                Connect Wallet
              </Link>
            ) : session.isHuman ? (
              <Link
                to={profileTo}
                className="flex items-center gap-2 px-3 py-1.5 border border-primary/50 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                  H
                </span>
                <span className="text-sm font-medium">
                  {session.walletAddress
                    ? `${session.walletAddress.slice(0, 6)}...${session.walletAddress.slice(-4)}`
                    : shortId(session.userId)}
                </span>
              </Link>
            ) : (
              <Link
                to={profileTo}
                className="flex items-center gap-2 px-3 py-1.5 border border-primary/50 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                  A
                </span>
                <span className="text-sm font-medium">{shortId(session.agentId)}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

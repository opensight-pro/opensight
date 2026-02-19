import React from "react";

export type Route =
  | { name: "landing" }
  | { name: "dashboard" }
  | { name: "markets" }
  | { name: "leaderboard" }
  | { name: "agents" }
  | { name: "docs" }
  | { name: "api" }
  | { name: "login" }
  | { name: "authCallback" }
  | { name: "claim"; token: string }
  | { name: "user"; userId: string }
  | { name: "agent"; agentId: string }
  | { name: "market"; marketId: string }
  | { name: "notFound"; path: string };

function normalizeHash(raw: string): string {
  if (!raw || raw === "#") return "#/";
  if (raw.startsWith("#/")) return raw;
  if (raw.startsWith("#")) return `#/${raw.slice(1)}`;
  return `#/${raw}`;
}

export function parseHash(rawHash: string): Route {
  const hash = normalizeHash(rawHash);
  const path = hash.slice(1);
  const parts = path.split("/").filter(Boolean);

  if (parts.length === 0) return { name: "landing" };

  if (parts[0] === "dashboard") return { name: "dashboard" };
  if (parts[0] === "markets") return { name: "markets" };
  if (parts[0] === "leaderboard") return { name: "leaderboard" };
  if (parts[0] === "agents") return { name: "agents" };
  if (parts[0] === "docs") return { name: "docs" };
  if (parts[0] === "api") return { name: "api" };
  if (parts[0] === "login") return { name: "login" };
  if (parts[0] === "auth-callback") return { name: "authCallback" };
  if (parts[0] === "claim" && typeof parts[1] === "string") {
    return { name: "claim", token: parts[1] };
  }
  if (parts[0] === "user" && typeof parts[1] === "string") {
    return { name: "user", userId: parts[1] };
  }
  if (parts[0] === "agent" && typeof parts[1] === "string") {
    return { name: "agent", agentId: parts[1] };
  }
  if (parts[0] === "market" && typeof parts[1] === "string") {
    return { name: "market", marketId: parts[1] };
  }

  return { name: "notFound", path };
}

export function useHashRoute(): Route {
  const [hash, setHash] = React.useState<string>(() => {
    if (typeof window === "undefined") return "#/";
    if (!window.location.hash) window.location.hash = "#/";
    return window.location.hash;
  });

  React.useEffect(() => {
    const onChange = () => setHash(window.location.hash || "#/" );
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return parseHash(hash);
}

export function href(to: string): string {
  const p = to.startsWith("/") ? to : `/${to}`;
  return `#${p}`;
}

export function Link(props: {
  to: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={href(props.to)}
      className={props.className}
      title={props.title}
      onClick={(e) => {
        props.onClick?.();
        // keep default hash navigation
      }}
    >
      {props.children}
    </a>
  );
}

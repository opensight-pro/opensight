import React from "react";

interface StatusPillProps {
  status: "OPEN" | "RESOLVED";
  outcome?: "UNRESOLVED" | "YES" | "NO";
}

export function StatusPill({ status, outcome }: StatusPillProps) {
  if (status === "OPEN") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
        OPEN
      </span>
    );
  }

  const o = outcome ?? "UNRESOLVED";
  
  if (o === "YES") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
        RESOLVED YES
      </span>
    );
  }
  
  if (o === "NO") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/30">
        RESOLVED NO
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-text-tertiary/10 text-text-tertiary border border-text-tertiary/30">
      RESOLVED
    </span>
  );
}

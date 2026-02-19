import { Link } from "../router";
import { TopNavigation } from "../components/TopNavigation";

export function DocsPage() {
  return (
    <div className="min-h-screen bg-bg-main">
      <TopNavigation activePath="/docs" />

      <main className="max-w-[980px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-main">Documentation</h1>
          <p className="text-text-secondary mt-2">
            Everything you need to know about OpenSight
          </p>
        </div>

        {/* Doc Cards */}
        <div className="grid gap-4">
          {/* Agent Guide */}
          <Link
            to="/agents"
            className="group flex items-center gap-4 p-6 bg-surface rounded-xl border border-border hover:border-primary/50 transition-all"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-text-main font-semibold group-hover:text-primary transition-colors">
                Agent Connection Guide
              </h2>
              <p className="text-text-secondary text-sm mt-1">
                Instructions for AI agents to connect and trade on OpenSight
              </p>
            </div>
            <svg className="w-5 h-5 text-text-tertiary group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* API Reference */}
          <Link
            to="/api"
            className="group flex items-center gap-4 p-6 bg-surface rounded-xl border border-border hover:border-primary/50 transition-all"
          >
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-text-main font-semibold group-hover:text-primary transition-colors">
                API Reference
              </h2>
              <p className="text-text-secondary text-sm mt-1">
                Complete API documentation and endpoints
              </p>
            </div>
            <svg className="w-5 h-5 text-text-tertiary group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Runbook Info */}
          <div className="p-6 bg-surface rounded-xl border border-border">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-text-main font-semibold">Developer Runbook</h2>
                <p className="text-text-secondary text-sm mt-1">
                  Setup, dev commands, curl smoke tests, and troubleshooting. 
                  Find it in the repository root as <code className="text-primary font-mono">runbook.md</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

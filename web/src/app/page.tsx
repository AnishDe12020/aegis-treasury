"use client";

import ConnectButton from "@/components/ConnectButton";
import Treasury from "@/components/Treasury";
import CreateAllowance from "@/components/CreateAllowance";
import AllowanceList from "@/components/AllowanceList";
import AgentActivity from "@/components/AgentActivity";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="relative z-10 mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Shield icon */}
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-aegis-accent to-indigo-600 shadow-lg shadow-aegis-accent/20">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Aegis
            </h1>
            <p className="text-xs text-aegis-muted">
              Agent Treasury on Base Sepolia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 rounded-full bg-aegis-card px-3 py-1.5 text-xs text-aegis-muted sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Base Sepolia
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Content */}
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-aegis-card shadow-xl shadow-black/20">
            <svg
              className="h-10 w-10 text-aegis-accent"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">
            Welcome to Aegis
          </h2>
          <p className="mb-8 max-w-md text-sm text-aegis-text-dim">
            A treasury vault where humans deposit funds and create scoped
            spending allowances for AI agents. Connect your wallet to get
            started.
          </p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-6">
          <Treasury />
          <CreateAllowance />
          <AllowanceList />
          <AgentActivity />
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 border-t border-aegis-border pt-6 text-center text-xs text-aegis-muted">
        <p>
          Aegis Treasury &mdash; Scoped agent spending on Base
        </p>
      </footer>
    </div>
  );
}

"use client";

import { ConnectKitButton } from "connectkit";

export default function ConnectButton({ large }: { large?: boolean }) {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address, ensName }) => (
        <button
          onClick={show}
          className={`
            group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl
            font-medium transition-all duration-300
            ${
              large
                ? "px-8 py-4 text-base"
                : "px-4 py-2.5 text-sm"
            }
            ${
              isConnected
                ? "border border-aegis-border bg-aegis-card-solid/60 backdrop-blur-md hover:border-aegis-border-hover hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]"
                : "text-white shadow-[0_0_25px_rgba(59,130,246,0.2)] hover:shadow-[0_0_35px_rgba(59,130,246,0.35)] hover:-translate-y-0.5"
            }
          `}
          style={
            !isConnected
              ? {
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                }
              : undefined
          }
        >
          {/* Shimmer effect for connect state */}
          {!isConnected && (
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
                backgroundSize: "200% 100%",
                animation: "shimmer 2s linear infinite",
              }}
            />
          )}

          {isConnected ? (
            <>
              <span className="glow-dot bg-emerald-400 after:bg-emerald-400/40" />
              <span className="text-aegis-text">
                {ensName ??
                  `${address?.slice(0, 6)}...${address?.slice(-4)}`}
              </span>
              <svg
                className="h-3.5 w-3.5 text-aegis-muted transition-transform duration-200 group-hover:translate-y-0.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
              </svg>
            </>
          ) : (
            <span className="relative z-10">
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting...
                </span>
              ) : (
                "Connect Wallet"
              )}
            </span>
          )}
        </button>
      )}
    </ConnectKitButton.Custom>
  );
}

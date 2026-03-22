"use client";

import { ConnectKitButton } from "connectkit";

export default function ConnectButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address, ensName }) => (
        <button
          onClick={show}
          className="group flex items-center gap-2 rounded-lg border border-aegis-border bg-aegis-card px-4 py-2 text-sm font-medium transition-all hover:border-aegis-accent hover:bg-aegis-accent/10"
        >
          {isConnected ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="text-aegis-text">
                {ensName ?? `${address?.slice(0, 6)}...${address?.slice(-4)}`}
              </span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-aegis-muted" />
              <span className="text-aegis-text-dim group-hover:text-aegis-text">
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </span>
            </>
          )}
        </button>
      )}
    </ConnectKitButton.Custom>
  );
}

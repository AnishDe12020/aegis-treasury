"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ConnectKitProvider } from "connectkit";
import { config } from "@/lib/wagmi";
import { useState, type ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="midnight"
          customTheme={{
            "--ck-font-family": "Inter, system-ui, sans-serif",
            "--ck-border-radius": "16px",
            "--ck-overlay-background": "rgba(0, 0, 0, 0.7)",
            "--ck-overlay-backdrop-filter": "blur(8px)",
            "--ck-body-background": "#0f0f19",
            "--ck-body-color": "#e2e8f0",
            "--ck-body-color-muted": "#525a73",
            "--ck-body-color-danger": "#ef4444",
            "--ck-primary-button-background":
              "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
            "--ck-primary-button-hover-background":
              "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
            "--ck-primary-button-color": "#ffffff",
            "--ck-primary-button-border-radius": "12px",
            "--ck-secondary-button-background": "rgba(255,255,255,0.04)",
            "--ck-secondary-button-border-radius": "12px",
            "--ck-modal-box-shadow": "0 0 60px rgba(59,130,246,0.1)",
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

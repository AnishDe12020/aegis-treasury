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
            "--ck-border-radius": "12px",
            "--ck-overlay-background": "rgba(0, 0, 0, 0.6)",
            "--ck-body-background": "#1a2235",
            "--ck-body-color": "#e2e8f0",
            "--ck-primary-button-background": "#3b82f6",
            "--ck-primary-button-hover-background": "#2563eb",
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

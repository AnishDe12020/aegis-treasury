"use client";

import ConnectButton from "@/components/ConnectButton";
import Treasury from "@/components/Treasury";
import CreateAllowance from "@/components/CreateAllowance";
import AllowanceList from "@/components/AllowanceList";
import AgentActivity from "@/components/AgentActivity";
import EmergencyControls from "@/components/EmergencyControls";
import { useAccount, useReadContract } from "wagmi";
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  TREASURY_ABI,
} from "@/lib/contracts";
import { formatUnits } from "viem";

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
      />
    </svg>
  );
}

function HeroSection() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center md:py-32">
      {/* Floating shield icon */}
      <div className="animate-fade-in mb-8">
        <div className="relative">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-3xl"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.15) 100%)",
              boxShadow: "0 0 60px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            <ShieldIcon className="h-12 w-12 text-blue-400" />
          </div>
          {/* Orbiting dot */}
          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
        </div>
      </div>

      {/* Headline */}
      <h1 className="animate-fade-in-up mb-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
        Your Treasury.{" "}
        <span className="gradient-text">Your Rules.</span>{" "}
        <br className="hidden sm:block" />
        Your Agent.
      </h1>

      {/* Subtitle */}
      <p className="animate-fade-in-up-delay mb-10 max-w-xl text-base leading-relaxed text-aegis-text-dim sm:text-lg">
        Scoped, revocable spending authority for AI agents on Base.
        Deposit funds, set limits, and let agents operate within your boundaries.
      </p>

      {/* CTA */}
      <div className="animate-fade-in-up-delay-2 mb-16">
        <ConnectButton large />
      </div>

      {/* Feature cards */}
      <div className="animate-fade-in-up-delay-3 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {[
          {
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            ),
            title: "Scoped Allowances",
            desc: "Set max spend, time limits, and target address restrictions",
            color: "blue",
          },
          {
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
              </svg>
            ),
            title: "Real-time Monitoring",
            desc: "Track every agent transaction with full on-chain transparency",
            color: "purple",
          },
          {
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            ),
            title: "Instant Revocation",
            desc: "Revoke agent access in one transaction, funds stay safe",
            color: "emerald",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="glass-card group cursor-default p-5 text-left"
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200
                ${feature.color === "blue" ? "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20" : ""}
                ${feature.color === "purple" ? "bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20" : ""}
                ${feature.color === "emerald" ? "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20" : ""}
              `}
            >
              {feature.icon}
            </div>
            <h3 className="mb-1 text-sm font-semibold text-white">
              {feature.title}
            </h3>
            <p className="text-xs leading-relaxed text-aegis-text-dim">
              {feature.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardStats() {
  const { data: treasuryBalance } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "deposits",
    args: [USDC_ADDRESS],
  });

  const { data: agentCount } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getAgentCount",
  });

  const formattedBalance = treasuryBalance
    ? Number(formatUnits(treasuryBalance, USDC_DECIMALS)).toLocaleString(
        undefined,
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )
    : "0.00";

  return (
    <div className="animate-fade-in-up mb-8 grid gap-4 sm:grid-cols-3">
      {[
        {
          label: "Treasury Balance",
          value: formattedBalance,
          suffix: "USDC",
          color: "from-blue-500/20 to-blue-500/5",
          dotColor: "bg-blue-400",
        },
        {
          label: "Active Agents",
          value: agentCount !== undefined ? agentCount.toString() : "0",
          suffix: "",
          color: "from-purple-500/20 to-purple-500/5",
          dotColor: "bg-purple-400",
        },
        {
          label: "Network",
          value: "Base",
          suffix: "Sepolia",
          color: "from-emerald-500/20 to-emerald-500/5",
          dotColor: "bg-emerald-400",
        },
      ].map((stat) => (
        <div key={stat.label} className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${stat.dotColor}`} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-aegis-muted">
              {stat.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {stat.value}
            </span>
            {stat.suffix && (
              <span className="text-sm font-medium text-aegis-text-dim">
                {stat.suffix}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="relative z-10 min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-aegis-border backdrop-blur-xl" style={{ background: "rgba(10,10,15,0.8)" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                  boxShadow: "0 0 16px rgba(59,130,246,0.3)",
                }}
              >
                <ShieldIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                Aegis
              </span>
            </div>

            {/* Nav links */}
            {isConnected && (
              <div className="hidden items-center gap-1 sm:flex">
                <a href="#" className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors">
                  Dashboard
                </a>
                <a
                  href={`https://sepolia.basescan.org/address/${TREASURY_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-aegis-text-dim transition-colors hover:text-white"
                >
                  Contract
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Network badge */}
            <div className="hidden items-center gap-2 rounded-full border border-aegis-border px-3 py-1.5 text-xs sm:flex" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="text-aegis-text-dim">Base Sepolia</span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Content */}
      {!isConnected ? (
        <HeroSection />
      ) : (
        <main className="mx-auto max-w-6xl px-6 py-8">
          <DashboardStats />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Treasury />
              <CreateAllowance />
            </div>
            <div className="space-y-6">
              <AllowanceList />
              <AgentActivity />
            </div>
          </div>

          {/* Emergency Controls */}
          <div className="mt-6">
            <EmergencyControls />
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="mt-20 border-t border-aegis-border py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-xs text-aegis-muted">
            <ShieldIcon className="h-3.5 w-3.5" />
            <span>Aegis Treasury</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-aegis-muted">
            <a
              href={`https://sepolia.basescan.org/address/${TREASURY_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-aegis-text-dim"
            >
              BaseScan
            </a>
            <span className="text-aegis-border">|</span>
            <span>Base Sepolia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

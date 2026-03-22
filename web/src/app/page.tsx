"use client";

import ConnectButton from "@/components/ConnectButton";
import Treasury from "@/components/Treasury";
import CreateAllowance from "@/components/CreateAllowance";
import EmergencyControls from "@/components/EmergencyControls";
import TokenScreener from "@/components/TokenScreener";
import PriceChart from "@/components/PriceChart";
import OrderBook from "@/components/OrderBook";
import TerminalFeed from "@/components/TerminalFeed";
import StrategyPanel from "@/components/StrategyPanel";
import { useAccount, useReadContract } from "wagmi";
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  TREASURY_ABI,
} from "@/lib/contracts";
import { formatUnits } from "viem";
import { useState } from "react";

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
    <div className="hero-section flex flex-col items-center justify-center px-4 py-24 text-center md:py-32">
      {/* Floating shield icon with animated gradient border */}
      <div className="animate-fade-in mb-8">
        <div className="relative">
          <div
            className="shield-gradient-border flex h-24 w-24 items-center justify-center rounded-3xl"
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

      {/* Powered by Base badge */}
      <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-aegis-border px-4 py-1.5 text-xs" style={{ background: "rgba(255,255,255,0.02)" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
        <span className="text-aegis-text-dim">Powered by</span>
        <span className="font-semibold text-white">Base</span>
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
      <div className="animate-fade-in-up-delay-2 mb-16 scroll-mt-24" id="connect">
        <ConnectButton large />
      </div>

      {/* Feature cards */}
      <div className="animate-fade-in-up-delay-3 grid w-full max-w-3xl gap-4 sm:grid-cols-3 lg:max-w-5xl lg:grid-cols-3 lg:gap-6">
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
            className="glass-card group cursor-default p-5 text-left lg:p-7"
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

type NavTab = 'dashboard' | 'screener' | 'terminal';

function TradingTerminal() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  return (
    <main className="mx-auto max-w-[1600px] px-3 py-3">
      {/* Trading terminal grid */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[2fr_1fr]">
        {/* Row 1: Chart + Screener */}
        <div className="min-h-[360px]">
          <PriceChart />
        </div>
        <div className="min-h-[360px]">
          <TokenScreener />
        </div>

        {/* Row 2: Treasury/Deposit/Withdraw + OrderBook */}
        <div className="space-y-2">
          <Treasury />
          <CreateAllowance />
        </div>
        <div className="min-h-[300px]">
          <OrderBook />
        </div>

        {/* Row 3: Terminal Feed + Strategy Panel + Emergency */}
        <div className="min-h-[340px]">
          <TerminalFeed />
        </div>
        <div className="space-y-2">
          <StrategyPanel />
          <EmergencyControls />
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  const { isConnected } = useAccount();
  const [activeNav, setActiveNav] = useState('dashboard');

  return (
    <div className="relative z-10 min-h-screen">
      {/* Grid pattern overlay */}
      <div className="grid-overlay" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-aegis-border backdrop-blur-xl" style={{ background: "rgba(10,10,15,0.8)" }}>
        <div className={`mx-auto flex h-12 items-center justify-between px-4 ${isConnected ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                  boxShadow: "0 0 12px rgba(59,130,246,0.3)",
                }}
              >
                <ShieldIcon className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">
                Aegis
              </span>
            </div>

            {/* Nav links */}
            {isConnected && (
              <div className="hidden items-center gap-0.5 sm:flex">
                {[
                  { key: 'dashboard', label: 'Dashboard' },
                  { key: 'screener', label: 'Screener' },
                  { key: 'terminal', label: 'Terminal' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setActiveNav(item.key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeNav === item.key
                        ? 'bg-[rgba(59,130,246,0.1)] text-white'
                        : 'text-aegis-text-dim hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <a
                  href={`https://sepolia.basescan.org/address/${TREASURY_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-aegis-text-dim transition-colors hover:text-white"
                >
                  Contract
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Network badge */}
            <div className="hidden items-center gap-1.5 rounded-md border border-aegis-border px-2 py-1 text-[10px] sm:flex" style={{ background: "rgba(255,255,255,0.02)" }}>
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
        <TradingTerminal />
      )}

      {/* Footer */}
      <footer className="mt-8 border-t border-aegis-border py-4">
        <div className={`mx-auto flex items-center justify-between px-4 ${isConnected ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
          <div className="flex items-center gap-2 text-[10px] text-aegis-muted">
            <ShieldIcon className="h-3 w-3" />
            <span>Aegis Treasury</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-aegis-muted">
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

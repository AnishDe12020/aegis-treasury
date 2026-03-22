'use client';

import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  TREASURY_ABI,
} from '@/lib/contracts';

type StrategyTab = 'DCA' | 'Momentum' | 'Rebalance' | 'Risk';

interface StrategyStatus {
  active: boolean;
  label: string;
}

const STRATEGY_META: Record<StrategyTab, StrategyStatus> = {
  DCA: { active: true, label: 'Dollar-Cost Average' },
  Momentum: { active: true, label: 'Momentum Trading' },
  Rebalance: { active: false, label: 'Portfolio Rebalance' },
  Risk: { active: true, label: 'Risk Manager' },
};

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        active
          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse'
          : 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]'
      }`}
    />
  );
}

function DCADetails() {
  const [countdown, setCountdown] = useState(127);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => (prev <= 0 ? 14400 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-aegis-muted">Chunk Size</span>
        <span className="font-mono text-aegis-text-dim">50.00 USDC</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Chunks Remaining</span>
        <span className="font-mono text-aegis-text-dim">8 / 20</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Interval</span>
        <span className="font-mono text-aegis-text-dim">4 hours</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Next Execution</span>
        <span className="font-mono text-blue-400">{mins}m {secs.toString().padStart(2, '0')}s</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Target</span>
        <span className="font-mono text-aegis-text-dim">WETH</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Total Invested</span>
        <span className="font-mono text-white">600.00 USDC</span>
      </div>
    </div>
  );
}

function MomentumDetails() {
  const [trend, setTrend] = useState<'up' | 'down' | 'sideways'>('up');

  useEffect(() => {
    const id = setInterval(() => {
      const trends: ('up' | 'down' | 'sideways')[] = ['up', 'down', 'sideways'];
      setTrend(trends[Math.floor(Math.random() * 3)]);
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const trendColors = { up: 'text-green-400', down: 'text-red-400', sideways: 'text-amber-400' };
  const trendArrows = { up: '\u2191', down: '\u2193', sideways: '\u2194' };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-aegis-muted">Current Trend</span>
        <span className={`font-mono font-semibold ${trendColors[trend]}`}>
          {trendArrows[trend]} {trend.charAt(0).toUpperCase() + trend.slice(1)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Confidence</span>
        <span className="font-mono text-aegis-text-dim">0.78</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Lookback</span>
        <span className="font-mono text-aegis-text-dim">24 candles</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Price Impact</span>
        <span className="font-mono text-aegis-text-dim">12 bps</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Max Position</span>
        <span className="font-mono text-aegis-text-dim">200 USDC</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Open Position</span>
        <span className="font-mono text-white">85.00 USDC</span>
      </div>
    </div>
  );
}

function RebalanceDetails() {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-aegis-muted">Target Allocation</span>
        <span className="font-mono text-aegis-text-dim">60/40 ETH/USDC</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Current Allocation</span>
        <span className="font-mono text-amber-400">52/48 ETH/USDC</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-aegis-muted">Drift</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: '80%' }} />
          </div>
          <span className="font-mono text-amber-400">8.0%</span>
        </div>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Threshold</span>
        <span className="font-mono text-aegis-text-dim">5% drift</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Check Interval</span>
        <span className="font-mono text-aegis-text-dim">1 hour</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Status</span>
        <span className="font-mono text-amber-400">Rebalance pending</span>
      </div>
    </div>
  );
}

function RiskDetails() {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-aegis-muted">Max Trade Size</span>
        <span className="font-mono text-aegis-text-dim">100.00 USDC</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Daily Limit</span>
        <span className="font-mono text-aegis-text-dim">500.00 USDC</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Daily Used</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div className="h-full rounded-full bg-blue-400" style={{ width: '35%' }} />
          </div>
          <span className="font-mono text-aegis-text-dim">175.00</span>
        </div>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Slippage Limit</span>
        <span className="font-mono text-aegis-text-dim">0.50%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Violations Today</span>
        <span className="font-mono text-emerald-400">0</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Last Check</span>
        <span className="font-mono text-aegis-text-dim">12s ago</span>
      </div>
    </div>
  );
}

export default function StrategyPanel() {
  const [activeTab, setActiveTab] = useState<StrategyTab>('DCA');
  const [lastAnalysis, setLastAnalysis] = useState<string>('');

  const { data: treasuryBalance } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: 'deposits',
    args: [USDC_ADDRESS],
  });

  const { data: agentCount } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: 'getAgentCount',
  });

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setLastAnalysis(
        d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  const formattedBalance = treasuryBalance
    ? Number(formatUnits(treasuryBalance, USDC_DECIMALS)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00';

  const tabs: StrategyTab[] = ['DCA', 'Momentum', 'Rebalance', 'Risk'];

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Strategies</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[rgba(255,255,255,0.06)]">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'text-blue-400'
                : 'text-aegis-muted hover:text-aegis-text-dim'
            }`}
          >
            <StatusDot active={STRATEGY_META[tab].active} />
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-400 rounded-t" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4 text-[11px]">
        {/* Strategy header */}
        <div className="flex items-center justify-between">
          <span className="text-aegis-text-dim">{STRATEGY_META[activeTab].label}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            STRATEGY_META[activeTab].active
              ? 'bg-[rgba(52,211,153,0.12)] text-emerald-400'
              : 'bg-[rgba(245,158,11,0.12)] text-amber-400'
          }`}>
            {STRATEGY_META[activeTab].active ? 'Active' : 'Paused'}
          </span>
        </div>

        {/* Strategy details */}
        {activeTab === 'DCA' && <DCADetails />}
        {activeTab === 'Momentum' && <MomentumDetails />}
        {activeTab === 'Rebalance' && <RebalanceDetails />}
        {activeTab === 'Risk' && <RiskDetails />}

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Agent Status */}
        <div>
          <span className="text-aegis-muted font-medium uppercase tracking-wider text-[10px]">Agent Status</span>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-aegis-muted">Active Agents</span>
              <span className="font-mono text-aegis-text-dim">{agentCount !== undefined ? agentCount.toString() : '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aegis-muted">Treasury</span>
              <span className="font-mono text-white">{formattedBalance} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aegis-muted">Last Analysis</span>
              <span className="font-mono text-aegis-text-dim">{lastAnalysis}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

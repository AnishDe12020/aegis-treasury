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

// Performance sparkline data per strategy (mock historical returns over 14 days, as %)
const PERF_DATA: Record<StrategyTab, number[]> = {
  DCA: [0, 0.3, 0.1, 0.8, 0.5, 1.2, 0.9, 1.5, 1.3, 1.8, 2.1, 1.9, 2.4, 2.7],
  Momentum: [0, -0.2, 0.6, 1.4, 0.8, 2.1, 1.5, 3.2, 2.8, 3.5, 2.9, 4.1, 3.6, 4.8],
  Rebalance: [0, 0.1, 0.2, 0.1, 0.3, 0.5, 0.4, 0.6, 0.8, 0.7, 0.9, 1.0, 1.1, 1.2],
  Risk: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// Strategy comparison data
const COMPARISON = {
  DCA: { expectedReturn: 35, risk: 20, complexity: 15 },
  Momentum: { expectedReturn: 65, risk: 55, complexity: 50 },
  Rebalance: { expectedReturn: 20, risk: 15, complexity: 30 },
  Risk: { expectedReturn: 0, risk: 5, complexity: 40 },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

function ComparisonBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-aegis-muted text-[10px] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-[10px] text-aegis-text-dim w-8 text-right">{value}%</span>
    </div>
  );
}

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
  const [countdown, setCountdown] = useState(3_847);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => (prev <= 0 ? 14400 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const hrs = Math.floor(countdown / 3600);
  const mins = Math.floor((countdown % 3600) / 60);
  const secs = countdown % 60;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-aegis-muted">Chunk Size</span>
        <span className="font-mono text-aegis-text-dim">50.00 USDC</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Progress</span>
        <span className="font-mono text-aegis-text-dim">12 / 20 chunks</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-aegis-muted">Completion</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div className="h-full rounded-full bg-blue-400" style={{ width: '60%' }} />
          </div>
          <span className="font-mono text-blue-400">60%</span>
        </div>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Interval</span>
        <span className="font-mono text-aegis-text-dim">4 hours</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Next Execution</span>
        <span className="font-mono text-blue-400">{hrs}h {mins.toString().padStart(2, '0')}m {secs.toString().padStart(2, '0')}s</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Target</span>
        <span className="font-mono text-aegis-text-dim">WETH</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Total Invested</span>
        <span className="font-mono text-white">600.00 USDC</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Avg Entry Price</span>
        <span className="font-mono text-aegis-text-dim">$3,412.56</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">WETH Acquired</span>
        <span className="font-mono text-emerald-400">0.1758 WETH</span>
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
        <span className="font-mono text-aegis-text-dim">24 candles (1h each)</span>
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
      <div className="flex justify-between">
        <span className="text-aegis-muted">Unrealized P&L</span>
        <span className="font-mono text-emerald-400">+$4.12 (+4.8%)</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Signal Source</span>
        <span className="font-mono text-aegis-text-dim">QuoterV2 + EMA(12,26)</span>
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
        <span className="text-aegis-muted">Rebalance Action</span>
        <span className="font-mono text-amber-400">Buy 320 USDC of WETH</span>
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
        <span className="text-aegis-muted">Max Drawdown</span>
        <span className="font-mono text-aegis-text-dim">10%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Violations Today</span>
        <span className="font-mono text-emerald-400">0</span>
      </div>
      <div className="flex justify-between">
        <span className="text-aegis-muted">Trades Validated</span>
        <span className="font-mono text-aegis-text-dim">14 / 14</span>
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

  const comp = COMPARISON[activeTab];

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

        {/* Mini performance chart */}
        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-aegis-muted text-[10px] uppercase tracking-wider font-medium">14d Performance</span>
            <span className={`font-mono text-[10px] font-semibold ${
              PERF_DATA[activeTab][PERF_DATA[activeTab].length - 1] >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {PERF_DATA[activeTab][PERF_DATA[activeTab].length - 1] > 0 ? '+' : ''}
              {PERF_DATA[activeTab][PERF_DATA[activeTab].length - 1].toFixed(1)}%
            </span>
          </div>
          <MiniSparkline
            data={PERF_DATA[activeTab]}
            color={PERF_DATA[activeTab][PERF_DATA[activeTab].length - 1] >= 0 ? '#34d399' : '#f87171'}
          />
        </div>

        {/* Strategy details */}
        {activeTab === 'DCA' && <DCADetails />}
        {activeTab === 'Momentum' && <MomentumDetails />}
        {activeTab === 'Rebalance' && <RebalanceDetails />}
        {activeTab === 'Risk' && <RiskDetails />}

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Strategy Comparison */}
        <div>
          <span className="text-aegis-muted font-medium uppercase tracking-wider text-[10px]">Strategy Comparison</span>
          <div className="mt-2 space-y-2">
            <ComparisonBar label="Exp. Return" value={comp.expectedReturn} color="#34d399" />
            <ComparisonBar label="Risk Level" value={comp.risk} color="#f87171" />
            <ComparisonBar label="Complexity" value={comp.complexity} color="#60a5fa" />
          </div>
        </div>

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

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

type Strategy = 'DCA' | 'Momentum' | 'Rebalance' | 'None';

const STRATEGIES: Record<Strategy, { label: string; params: { key: string; value: string }[] }> = {
  DCA: {
    label: 'Dollar-Cost Average',
    params: [
      { key: 'Chunk Size', value: '50.00 USDC' },
      { key: 'Interval', value: '4 hours' },
      { key: 'Target', value: 'WETH' },
    ],
  },
  Momentum: {
    label: 'Momentum Trading',
    params: [
      { key: 'Confidence', value: '> 0.72' },
      { key: 'Lookback', value: '24 candles' },
      { key: 'Max Position', value: '200 USDC' },
    ],
  },
  Rebalance: {
    label: 'Portfolio Rebalance',
    params: [
      { key: 'Threshold', value: '5% drift' },
      { key: 'Targets', value: '60/40 ETH/USDC' },
      { key: 'Check Interval', value: '1 hour' },
    ],
  },
  None: {
    label: 'No Active Strategy',
    params: [],
  },
};

export default function StrategyPanel() {
  const [activeStrategy] = useState<Strategy>('DCA');
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

  const strategy = STRATEGIES[activeStrategy];
  const formattedBalance = treasuryBalance
    ? Number(formatUnits(treasuryBalance, USDC_DECIMALS)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00';

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Strategy</span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4 text-[11px]">
        {/* Active Strategy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-aegis-muted font-medium uppercase tracking-wider text-[10px]">Active Strategy</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              activeStrategy === 'None'
                ? 'bg-[rgba(255,255,255,0.04)] text-aegis-muted'
                : 'bg-[rgba(59,130,246,0.12)] text-blue-400'
            }`}>
              {activeStrategy}
            </span>
          </div>
          <p className="text-aegis-text-dim">{strategy.label}</p>
          {strategy.params.length > 0 && (
            <div className="mt-2 space-y-1">
              {strategy.params.map(p => (
                <div key={p.key} className="flex justify-between">
                  <span className="text-aegis-muted">{p.key}</span>
                  <span className="font-mono text-aegis-text-dim">{p.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Risk Manager */}
        <div>
          <span className="text-aegis-muted font-medium uppercase tracking-wider text-[10px]">Risk Manager</span>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-aegis-muted">Max Trade</span>
              <span className="font-mono text-aegis-text-dim">100.00 USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aegis-muted">Daily Limit</span>
              <span className="font-mono text-aegis-text-dim">500.00 USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aegis-muted">Slippage Limit</span>
              <span className="font-mono text-aegis-text-dim">0.50%</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Venice AI status */}
        <div>
          <span className="text-aegis-muted font-medium uppercase tracking-wider text-[10px]">Venice AI</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-aegis-muted">Status</span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                Connected
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-aegis-muted">Model</span>
              <span className="font-mono text-aegis-text-dim">llama-3.3-70b</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aegis-muted">Last Analysis</span>
              <span className="font-mono text-aegis-text-dim">{lastAnalysis}</span>
            </div>
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
              <span className="text-aegis-muted">Network</span>
              <span className="font-mono text-aegis-text-dim">Base Sepolia</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

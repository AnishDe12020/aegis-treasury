'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  TREASURY_ABI,
} from '@/lib/contracts';
import { useEffect, useState } from 'react';

interface AgentRow {
  address: string;
  maxAmount: bigint;
  spent: bigint;
  remaining: bigint;
  percentUsed: number;
}

export default function OrderBook() {
  const [rows, setRows] = useState<AgentRow[]>([]);

  const { data: agents } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: 'getAgents',
  });

  const agentList = (agents as `0x${string}`[]) ?? [];

  const { data: allowanceResults } = useReadContracts({
    contracts: agentList.map(agent => ({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: 'getAgentAllowance' as const,
      args: [agent, USDC_ADDRESS] as const,
    })),
    query: { enabled: agentList.length > 0 },
  });

  useEffect(() => {
    if (!allowanceResults || !agentList.length) {
      setRows([]);
      return;
    }
    const parsed: AgentRow[] = [];
    for (let i = 0; i < agentList.length; i++) {
      const result = allowanceResults[i];
      if (result.status === 'success' && result.result) {
        const [maxAmount, spent, , , active] = result.result as [bigint, bigint, bigint, readonly `0x${string}`[], boolean];
        if (active) {
          const remaining = maxAmount - spent;
          const percentUsed = maxAmount > 0n ? Number((spent * 10000n) / maxAmount) / 100 : 0;
          parsed.push({
            address: agentList[i],
            maxAmount,
            spent,
            remaining,
            percentUsed,
          });
        }
      }
    }
    setRows(parsed);
  }, [allowanceResults, agents]);

  const totalRemaining = rows.reduce((sum, r) => sum + r.remaining, 0n);
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0n);
  const totalMax = rows.reduce((sum, r) => sum + r.maxAmount, 0n);

  const shortenAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const fmtUnits = (v: bigint) =>
    Number(formatUnits(v, USDC_DECIMALS)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Allowance Book</span>
      </div>

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-aegis-muted">
            <svg className="mb-3 h-8 w-8 text-aegis-muted/40" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
            <p className="text-xs font-medium">No active allowances</p>
            <p className="mt-1 text-[10px] text-aegis-text-dim">Create an agent allowance to see it here</p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-[rgba(255,255,255,0.06)] px-3 py-1.5 text-[10px] font-medium text-aegis-muted">
              <span>Agent</span>
              <span className="text-right w-20">Remaining</span>
              <span className="text-right w-16">Spent</span>
              <span className="text-right w-12">Used</span>
            </div>

            {/* Rows */}
            {rows.map(row => (
              <div key={row.address} className="group border-b border-[rgba(255,255,255,0.03)] px-3 py-2 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-[11px]">
                  <code className="font-mono text-aegis-text-dim">{shortenAddr(row.address)}</code>
                  <span className="font-mono text-green-400 text-right w-20">{fmtUnits(row.remaining)}</span>
                  <span className="font-mono text-red-400 text-right w-16">{fmtUnits(row.spent)}</span>
                  <span className={`font-mono text-right w-12 ${row.percentUsed > 80 ? 'text-red-400' : row.percentUsed > 50 ? 'text-amber-400' : 'text-aegis-text-dim'}`}>
                    {row.percentUsed.toFixed(0)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                  <div className="h-full flex">
                    <div
                      className="h-full bg-red-500/60"
                      style={{ width: `${Math.min(row.percentUsed, 100)}%` }}
                    />
                    <div
                      className="h-full bg-green-500/60"
                      style={{ width: `${Math.max(100 - row.percentUsed, 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="border-t border-[rgba(255,255,255,0.08)] px-3 py-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-[11px] font-semibold">
                <span className="text-aegis-text-dim">TOTAL</span>
                <span className="font-mono text-green-400 text-right w-20">{fmtUnits(totalRemaining)}</span>
                <span className="font-mono text-red-400 text-right w-16">{fmtUnits(totalSpent)}</span>
                <span className="font-mono text-aegis-text-dim text-right w-12">
                  {totalMax > 0n ? `${(Number((totalSpent * 10000n) / totalMax) / 100).toFixed(0)}%` : '0%'}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                <div className="h-full flex">
                  <div
                    className="h-full bg-red-500/60"
                    style={{ width: totalMax > 0n ? `${Number((totalSpent * 10000n) / totalMax) / 100}%` : '0%' }}
                  />
                  <div
                    className="h-full bg-green-500/60"
                    style={{ width: totalMax > 0n ? `${100 - Number((totalSpent * 10000n) / totalMax) / 100}%` : '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

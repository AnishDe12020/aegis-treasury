'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import PriceChart from '@/components/PriceChart';
import TokenScreener from '@/components/TokenScreener';
import PnLChart from '@/components/PnLChart';
import { TREASURY_ADDRESS, USDC_ADDRESS, USDC_DECIMALS, TREASURY_ABI, ERC20_ABI } from '@/lib/contracts';

// ─── Constants ───────────────────────────────────────────────────────────────

const OWNER_WALLET = '0xa251e11f1702f9bcAfA7c3a580cc29898b76C854' as `0x${string}`;
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChainData {
  treasuryBalance: string;
  ownerUsdcBalance: string;
  agentCount: number;
  agents: `0x${string}`[];
  allowances: {
    agent: `0x${string}`;
    maxAmount: string;
    spent: string;
    remaining: string;
    percentUsed: number;
    expiry: number;
    active: boolean;
  }[];
  events: { ts: string; msg: string; color: string }[];
  paused: boolean;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[rgba(255,255,255,0.06)] ${className}`}
    />
  );
}

// ─── useChainData hook ───────────────────────────────────────────────────────

function useChainData() {
  const [data, setData] = useState<ChainData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Parallel reads
      const [depositsRaw, agentCountRaw, agentsRaw, ownerBalanceRaw, blockNumber] = await Promise.all([
        publicClient.readContract({
          address: TREASURY_ADDRESS,
          abi: TREASURY_ABI,
          functionName: 'deposits',
          args: [USDC_ADDRESS],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: TREASURY_ADDRESS,
          abi: TREASURY_ABI,
          functionName: 'getAgentCount',
        }) as Promise<bigint>,
        publicClient.readContract({
          address: TREASURY_ADDRESS,
          abi: TREASURY_ABI,
          functionName: 'getAgents',
        }) as Promise<`0x${string}`[]>,
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [OWNER_WALLET],
        }) as Promise<bigint>,
        publicClient.getBlockNumber(),
      ]);

      // paused() may not exist on the deployed contract (added post-deployment)
      let pausedRaw = false;
      try {
        pausedRaw = await publicClient.readContract({
          address: TREASURY_ADDRESS,
          abi: TREASURY_ABI,
          functionName: 'paused',
        }) as boolean;
      } catch {
        // Contract doesn't have paused() — that's fine
      }

      const treasuryBalance = formatUnits(depositsRaw, USDC_DECIMALS);
      const ownerUsdcBalance = formatUnits(ownerBalanceRaw, USDC_DECIMALS);
      const agentCount = Number(agentCountRaw);

      // Fetch allowances for each agent
      const allowanceResults = await Promise.all(
        agentsRaw.map(async (agent) => {
          const result = await publicClient.readContract({
            address: TREASURY_ADDRESS,
            abi: TREASURY_ABI,
            functionName: 'getAgentAllowance',
            args: [agent, USDC_ADDRESS],
          }) as [bigint, bigint, bigint, `0x${string}`[], boolean];

          const maxAmount = Number(formatUnits(result[0], USDC_DECIMALS));
          const spent = Number(formatUnits(result[1], USDC_DECIMALS));
          const remaining = maxAmount - spent;
          const percentUsed = maxAmount > 0 ? Math.round((spent / maxAmount) * 100) : 0;

          return {
            agent,
            maxAmount: maxAmount.toFixed(2),
            spent: spent.toFixed(2),
            remaining: remaining.toFixed(2),
            percentUsed,
            expiry: Number(result[2]),
            active: result[4],
          };
        })
      );

      // Fetch events from recent blocks
      const fromBlock = blockNumber > 2000n ? blockNumber - 2000n : 0n;

      const eventNames = ['Deposited', 'Withdrawn', 'AgentAllowanceSet', 'AgentAllowanceRevoked', 'AgentExecuted'] as const;

      const logResults = await Promise.all(
        eventNames.map((eventName) =>
          publicClient.getLogs({
            address: TREASURY_ADDRESS,
            event: TREASURY_ABI.find((e) => e.type === 'event' && e.name === eventName) as any,
            fromBlock,
            toBlock: blockNumber,
          }).catch(() => [] as any[])
        )
      );

      // Merge and sort events
      const allEvents: { blockNumber: bigint; logIndex: number; name: string; args: any }[] = [];

      logResults.forEach((logs, idx) => {
        const eventName = eventNames[idx];
        (logs as any[]).forEach((log) => {
          allEvents.push({
            blockNumber: log.blockNumber ?? 0n,
            logIndex: log.logIndex ?? 0,
            name: eventName,
            args: log.args ?? {},
          });
        });
      });

      allEvents.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
        return a.logIndex - b.logIndex;
      });

      const fmtAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

      const events: ChainData['events'] = [
        { ts: 'INIT', msg: 'Aegis Terminal v2.0 — Live on-chain data', color: 'text-cyan-400' },
        { ts: 'INIT', msg: `Connected to Base Sepolia (chain 84532)`, color: 'text-cyan-400' },
        { ts: 'INIT', msg: `Monitoring treasury ${fmtAddr(TREASURY_ADDRESS)}`, color: 'text-cyan-400' },
        { ts: 'INIT', msg: `Loaded ${allEvents.length} on-chain events (last 2000 blocks)`, color: 'text-cyan-400' },
      ];

      allEvents.forEach((ev) => {
        const blk = `#${ev.blockNumber.toString()}`;
        switch (ev.name) {
          case 'Deposited':
            events.push({
              ts: blk,
              msg: `DEPOSIT ${formatUnits(ev.args.amount ?? 0n, USDC_DECIMALS)} USDC to treasury`,
              color: 'text-green-400',
            });
            break;
          case 'Withdrawn':
            events.push({
              ts: blk,
              msg: `WITHDRAW ${formatUnits(ev.args.amount ?? 0n, USDC_DECIMALS)} USDC from treasury`,
              color: 'text-amber-400',
            });
            break;
          case 'AgentAllowanceSet':
            events.push({
              ts: blk,
              msg: `ALLOWANCE SET ${fmtAddr(ev.args.agent ?? '')} max=${formatUnits(ev.args.maxAmount ?? 0n, USDC_DECIMALS)} USDC`,
              color: 'text-amber-400',
            });
            break;
          case 'AgentAllowanceRevoked':
            events.push({
              ts: blk,
              msg: `ALLOWANCE REVOKED ${fmtAddr(ev.args.agent ?? '')}`,
              color: 'text-red-400',
            });
            break;
          case 'AgentExecuted':
            events.push({
              ts: blk,
              msg: `TRANSFER ${fmtAddr(ev.args.agent ?? '')} -> ${fmtAddr(ev.args.target ?? '')} ${formatUnits(ev.args.amount ?? 0n, USDC_DECIMALS)} USDC "${ev.args.reason ?? ''}"`,
              color: 'text-green-400',
            });
            break;
        }
      });

      events.push({ ts: 'NOW', msg: 'Watching for new events...', color: 'text-cyan-400' });

      setData({
        treasuryBalance,
        ownerUsdcBalance,
        agentCount,
        agents: agentsRaw,
        allowances: allowanceResults,
        events,
        paused: pausedRaw,
      });
      setError(null);
    } catch (err: any) {
      console.error('Chain data fetch error:', err);
      setError(err?.message ?? 'Failed to fetch on-chain data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000); // refresh every 30s
    return () => clearInterval(id);
  }, [fetchData]);

  return { data, error, loading };
}

// ─── ShieldIcon ──────────────────────────────────────────────────────────────

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
      />
    </svg>
  );
}

// ─── Live Treasury ──────────────────────────────────────────────────────────

function LiveTreasury({ data, loading }: { data: ChainData | null; loading: boolean }) {
  return (
    <div className="glass-card-glow animate-fade-in-up space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.15) 100%)',
            }}
          >
            <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Treasury</h2>
            <p className="text-[11px] text-aegis-muted">USDC on Base Sepolia</p>
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}
        >
          {data?.paused ? 'Paused' : 'Live'}
        </span>
      </div>

      {/* Balance */}
      <div
        className="rounded-xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.04) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-aegis-muted">
          Treasury Vault Balance
        </p>
        {loading ? (
          <Skeleton className="h-9 w-40" />
        ) : (
          <p className="stat-number">
            {Number(data?.treasuryBalance ?? '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="ml-2 text-sm font-medium text-aegis-text-dim">USDC</span>
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-aegis-text-dim">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
          </svg>
          <span>
            Owner wallet:{' '}
            {loading ? (
              <Skeleton className="inline-block h-3 w-20" />
            ) : (
              <span className="font-medium text-aegis-text">
                {Number(data?.ownerUsdcBalance ?? '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Deposit / Withdraw tabs (static) */}
      <div className="space-y-4">
        <div className="flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <button className="flex-1 rounded-lg py-2 text-sm font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-sm">
            Deposit
          </button>
          <button className="flex-1 rounded-lg py-2 text-sm font-medium text-aegis-text-dim">
            Withdraw
          </button>
        </div>
        <div className="space-y-3">
          <label className="label">Amount (USDC)</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input type="number" placeholder="0.00" readOnly className="pr-16" />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                Max
              </button>
            </div>
            <button className="btn-primary shrink-0">Deposit</button>
          </div>
        </div>
      </div>

      {/* Contract address */}
      <a
        href={`https://sepolia.basescan.org/address/${TREASURY_ADDRESS}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs text-aegis-muted transition-all duration-200 hover:border-blue-500/20"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid transparent' }}
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
        <code className="font-mono text-[11px] text-aegis-text-dim">
          {TREASURY_ADDRESS.slice(0, 6)}...{TREASURY_ADDRESS.slice(-4)}
        </code>
        <span className="ml-auto text-blue-400/70">View on BaseScan &#8599;</span>
      </a>
    </div>
  );
}

// ─── Mock Create Allowance ───────────────────────────────────────────────────

function MockCreateAllowance() {
  return (
    <div className="glass-card-glow animate-fade-in-up space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.15) 0%, rgba(59,130,246,0.15) 100%)' }}
        >
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Create Allowance</h2>
          <p className="text-[11px] text-aegis-muted">Grant scoped spending authority</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label">Agent Address</label>
          <input type="text" placeholder="0x..." readOnly className="w-full" />
        </div>
        <div>
          <label className="label">Max Amount (USDC)</label>
          <input type="number" placeholder="100.00" readOnly className="w-full" />
        </div>
        <button className="btn-primary w-full">Set Allowance</button>
      </div>
    </div>
  );
}

// ─── Live OrderBook ─────────────────────────────────────────────────────────

function LiveOrderBook({ data, loading }: { data: ChainData | null; loading: boolean }) {
  const rows = data?.allowances ?? [];
  const totalRemaining = rows.reduce((s, r) => s + Number(r.remaining), 0).toFixed(2);
  const totalSpent = rows.reduce((s, r) => s + Number(r.spent), 0).toFixed(2);
  const totalMax = rows.reduce((s, r) => s + Number(r.maxAmount), 0);
  const totalPercent = totalMax > 0 ? Math.round((Number(totalSpent) / totalMax) * 100) : 0;

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Allowance Book</span>
        <span className="ml-auto text-[10px] text-aegis-muted font-mono">on-chain</span>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="space-y-0">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-[rgba(255,255,255,0.06)] px-3 py-1.5 text-[10px] font-medium text-aegis-muted">
            <span>Agent</span>
            <span className="text-right w-20">Remaining</span>
            <span className="text-right w-16">Spent</span>
            <span className="text-right w-12">Used</span>
          </div>
          {loading ? (
            <div className="px-3 py-4 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-aegis-muted">
              No agent allowances found
            </div>
          ) : (
            <>
              {rows.map((row) => (
                <div key={row.agent} className="group border-b border-[rgba(255,255,255,0.03)] px-3 py-2 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-[11px]">
                    <code className="font-mono text-aegis-text-dim">
                      {row.agent.slice(0, 6)}...{row.agent.slice(-4)}
                      {!row.active && <span className="ml-1 text-red-400 text-[9px]">(revoked)</span>}
                    </code>
                    <span className="font-mono text-green-400 text-right w-20">{row.remaining}</span>
                    <span className="font-mono text-red-400 text-right w-16">{row.spent}</span>
                    <span className={`font-mono text-right w-12 ${row.percentUsed > 80 ? 'text-red-400' : row.percentUsed > 50 ? 'text-amber-400' : 'text-aegis-text-dim'}`}>
                      {row.percentUsed}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                    <div className="h-full flex">
                      <div className="h-full bg-red-500/60" style={{ width: `${row.percentUsed}%` }} />
                      <div className="h-full bg-green-500/60" style={{ width: `${100 - row.percentUsed}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {/* Totals */}
              <div className="border-t border-[rgba(255,255,255,0.08)] px-3 py-2">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-[11px] font-semibold">
                  <span className="text-aegis-text-dim">TOTAL</span>
                  <span className="font-mono text-green-400 text-right w-20">{totalRemaining}</span>
                  <span className="font-mono text-red-400 text-right w-16">{totalSpent}</span>
                  <span className="font-mono text-aegis-text-dim text-right w-12">{totalPercent}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                  <div className="h-full flex">
                    <div className="h-full bg-red-500/60" style={{ width: `${totalPercent}%` }} />
                    <div className="h-full bg-green-500/60" style={{ width: `${100 - totalPercent}%` }} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Live Terminal Feed ─────────────────────────────────────────────────────

function LiveTerminalFeed({ data, loading }: { data: ChainData | null; loading: boolean }) {
  const lines = data?.events ?? [];

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Terminal</span>
        <span className="ml-auto text-[10px] text-aegis-muted">{lines.length} lines</span>
      </div>
      <div className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-5" style={{ maxHeight: '320px' }}>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <>
            {lines.map((line, i) => (
              <div key={i} className="whitespace-nowrap">
                <span className="text-green-500">[{line.ts}]</span>{' '}
                <span className={line.color}>{line.msg}</span>
              </div>
            ))}
            <div className="inline-block h-3.5 w-1.5 animate-pulse bg-green-400/80 align-middle" />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Mock Strategy Panel ─────────────────────────────────────────────────────

function MockStrategyPanel({ data, loading }: { data: ChainData | null; loading: boolean }) {
  type StrategyTab = 'DCA' | 'Momentum' | 'Rebalance' | 'Risk';

  const [activeTab, setActiveTab] = useState<StrategyTab>('DCA');
  const [countdown, setCountdown] = useState(127);
  const [lastAnalysis, setLastAnalysis] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => (prev <= 0 ? 14400 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setLastAnalysis(d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  const STRATEGY_META: Record<StrategyTab, { active: boolean; label: string }> = {
    DCA: { active: true, label: 'Dollar-Cost Average' },
    Momentum: { active: true, label: 'Momentum Trading' },
    Rebalance: { active: false, label: 'Portfolio Rebalance' },
    Risk: { active: true, label: 'Risk Manager' },
  };

  const tabs: StrategyTab[] = ['DCA', 'Momentum', 'Rebalance', 'Risk'];

  const treasuryBal = data ? Number(data.treasuryBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Strategies</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[rgba(255,255,255,0.06)]">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab ? 'text-blue-400' : 'text-aegis-muted hover:text-aegis-text-dim'
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                STRATEGY_META[tab].active
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse'
                  : 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]'
              }`}
            />
            {tab}
            {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-400 rounded-t" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4 text-[11px]">
        {/* Strategy header */}
        <div className="flex items-center justify-between">
          <span className="text-aegis-text-dim">{STRATEGY_META[activeTab].label}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              STRATEGY_META[activeTab].active
                ? 'bg-[rgba(52,211,153,0.12)] text-emerald-400'
                : 'bg-[rgba(245,158,11,0.12)] text-amber-400'
            }`}
          >
            {STRATEGY_META[activeTab].active ? 'Active' : 'Paused'}
          </span>
        </div>

        {activeTab === 'DCA' && (
          <div className="space-y-1.5">
            <div className="flex justify-between"><span className="text-aegis-muted">Chunk Size</span><span className="font-mono text-aegis-text-dim">50.00 USDC</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Chunks Remaining</span><span className="font-mono text-aegis-text-dim">8 / 20</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Interval</span><span className="font-mono text-aegis-text-dim">4 hours</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Next Execution</span><span className="font-mono text-blue-400">{mins}m {secs.toString().padStart(2, '0')}s</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Target</span><span className="font-mono text-aegis-text-dim">WETH</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Total Invested</span><span className="font-mono text-white">600.00 USDC</span></div>
          </div>
        )}
        {activeTab === 'Momentum' && (
          <div className="space-y-1.5">
            <div className="flex justify-between"><span className="text-aegis-muted">Current Trend</span><span className="font-mono font-semibold text-green-400">&uarr; Up</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Confidence</span><span className="font-mono text-aegis-text-dim">0.78</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Lookback</span><span className="font-mono text-aegis-text-dim">24 candles</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Max Position</span><span className="font-mono text-aegis-text-dim">200 USDC</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Open Position</span><span className="font-mono text-white">85.00 USDC</span></div>
          </div>
        )}
        {activeTab === 'Rebalance' && (
          <div className="space-y-1.5">
            <div className="flex justify-between"><span className="text-aegis-muted">Target Allocation</span><span className="font-mono text-aegis-text-dim">60/40 ETH/USDC</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Current Allocation</span><span className="font-mono text-amber-400">52/48 ETH/USDC</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Drift</span><span className="font-mono text-amber-400">8.0%</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Status</span><span className="font-mono text-amber-400">Rebalance pending</span></div>
          </div>
        )}
        {activeTab === 'Risk' && (
          <div className="space-y-1.5">
            <div className="flex justify-between"><span className="text-aegis-muted">Max Trade Size</span><span className="font-mono text-aegis-text-dim">100.00 USDC</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Daily Limit</span><span className="font-mono text-aegis-text-dim">500.00 USDC</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Daily Used</span><span className="font-mono text-aegis-text-dim">175.00</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Slippage Limit</span><span className="font-mono text-aegis-text-dim">0.50%</span></div>
            <div className="flex justify-between"><span className="text-aegis-muted">Violations Today</span><span className="font-mono text-emerald-400">0</span></div>
          </div>
        )}

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Agent Status — live data */}
        <div>
          <span className="text-aegis-muted font-medium uppercase tracking-wider text-[10px]">Agent Status</span>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-aegis-muted">Active Agents</span>
              <span className="font-mono text-aegis-text-dim">{loading ? '--' : data?.agentCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aegis-muted">Treasury</span>
              <span className="font-mono text-white">{loading ? '--' : `${treasuryBal} USDC`}</span>
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

// ─── Mock Venice Panel ───────────────────────────────────────────────────────

function MockVenicePanel() {
  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Venice AI</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] px-2 py-0.5 text-[9px] font-semibold text-purple-400">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Private
          </span>
        </div>
        <span className="text-[10px] text-aegis-muted font-mono">llama-3.3-70b</span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 text-[11px]">
        {/* Action + Confidence */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Action</span>
            <span className="rounded px-2 py-0.5 text-[11px] font-bold uppercase text-green-400 bg-[rgba(34,197,94,0.12)]">buy</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-aegis-muted text-[10px]">Confidence</span>
            <span className="font-mono font-bold text-white">72%</span>
          </div>
        </div>

        {/* Risk Assessment */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Risk Assessment</span>
            <span className="font-mono font-bold text-blue-400">4/10</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: '40%' }} />
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-1.5">
          <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Recommendation</span>
          <div className="flex justify-between"><span className="text-aegis-muted">Pair</span><span className="font-mono text-white font-semibold">ETH/USDC</span></div>
          <div className="flex justify-between"><span className="text-aegis-muted">Direction</span><span className="font-mono text-aegis-text-dim">Long</span></div>
          <div className="flex justify-between"><span className="text-aegis-muted">Position Size</span><span className="font-mono text-aegis-text-dim">50 USDC (5% of treasury)</span></div>
          <div className="flex justify-between"><span className="text-aegis-muted">Time Horizon</span><span className="font-mono text-aegis-text-dim">4-8 hours</span></div>
        </div>

        {/* Reasoning */}
        <div>
          <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Reasoning</span>
          <p className="mt-1 text-aegis-text-dim leading-relaxed">
            ETH showing bullish momentum with increasing volume on Base. Treasury utilization at 21% leaves ample room for position sizing. DCA strategy alignment suggests accumulation phase is favorable. Risk-adjusted entry with 0.5% slippage tolerance recommended.
          </p>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        <div className="flex items-center justify-between">
          <span className="text-aegis-muted text-[10px]">Last updated: 2m ago</span>
          <button className="rounded-md px-3 py-1.5 text-[10px] font-semibold bg-[rgba(139,92,246,0.15)] text-purple-400 hover:bg-[rgba(139,92,246,0.25)] active:scale-95 transition-all">
            Run Analysis
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Live Portfolio ─────────────────────────────────────────────────────────

function LivePortfolio({ data, loading }: { data: ChainData | null; loading: boolean }) {
  const ownerUsdc = data ? Number(data.ownerUsdcBalance) : 0;
  const treasuryUsdc = data ? Number(data.treasuryBalance) : 0;
  const totalValue = ownerUsdc + treasuryUsdc;

  const holdings = data
    ? [
        {
          symbol: 'USDC',
          name: 'USD Coin (Wallet)',
          balance: ownerUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          usdValue: `$${ownerUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          pct: totalValue > 0 ? `${((ownerUsdc / totalValue) * 100).toFixed(1)}%` : '0%',
          color: '#2775ca',
          icon: '$',
        },
        {
          symbol: 'USDC',
          name: 'USD Coin (Treasury)',
          balance: treasuryUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          usdValue: `$${treasuryUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          pct: totalValue > 0 ? `${((treasuryUsdc / totalValue) * 100).toFixed(1)}%` : '0%',
          color: '#8b5cf6',
          icon: 'T',
        },
      ]
    : [];

  const walletPct = totalValue > 0 ? (ownerUsdc / totalValue) * 100 : 50;
  const treasuryPct = totalValue > 0 ? (treasuryUsdc / totalValue) * 100 : 50;
  const totalStr = totalValue >= 1000 ? `$${(totalValue / 1000).toFixed(1)}K` : `$${totalValue.toFixed(0)}`;

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Portfolio</span>
        <span className="ml-auto font-mono text-[11px] text-white font-bold">
          {loading ? '--' : `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-24 w-24 rounded-full mx-auto" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <>
            {/* Donut chart */}
            <div className="flex items-center justify-center py-3">
              <svg viewBox="0 0 120 120" className="h-24 w-24">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#2775ca" strokeWidth="16" strokeDasharray={`${walletPct * 3.02} ${302 - walletPct * 3.02}`} strokeDashoffset="-24" opacity="0.8" />
                <circle cx="60" cy="60" r="48" fill="none" stroke="#8b5cf6" strokeWidth="16" strokeDasharray={`${treasuryPct * 3.02} ${302 - treasuryPct * 3.02}`} strokeDashoffset={`${-24 - walletPct * 3.02}`} opacity="0.8" />
                <text x="60" y="56" textAnchor="middle" fill="white" fontSize="10" fontFamily="monospace" fontWeight="bold">{totalStr}</text>
                <text x="60" y="70" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">TOTAL</text>
              </svg>
            </div>

            {holdings.map((h, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.03)] px-3 py-2 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: `${h.color}20`, color: h.color }}>
                  {h.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-white">{h.symbol}</div>
                  <div className="text-[10px] text-aegis-muted truncate">{h.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[11px] text-white">{h.balance}</div>
                  <div className="font-mono text-[10px] text-aegis-muted">{h.usdValue} ({h.pct})</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Mock Emergency Controls ─────────────────────────────────────────────────

function MockEmergencyControls({ data }: { data: ChainData | null }) {
  return (
    <div className="terminal-panel flex flex-col">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Emergency</span>
        {data?.paused && (
          <span className="ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400 bg-red-500/10 border border-red-500/20">
            PAUSED
          </span>
        )}
      </div>
      <div className="p-3 flex gap-2">
        <button className="flex-1 rounded-lg py-2 text-[10px] font-semibold text-amber-400 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
          Pause
        </button>
        <button className="flex-1 rounded-lg py-2 text-[10px] font-semibold text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors">
          Emergency Withdraw
        </button>
        <button className="flex-1 rounded-lg py-2 text-[10px] font-semibold text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors">
          Revoke All
        </button>
      </div>
    </div>
  );
}

// ─── Error Fallback ──────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
      <span className="font-semibold">RPC Error:</span> {message}. Showing cached/fallback data.
    </div>
  );
}

// ─── Main Demo Page ──────────────────────────────────────────────────────────

export default function DemoPage() {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'screener' | 'terminal' | 'chat'>('dashboard');
  const { data, error, loading } = useChainData();

  const fmtAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
  const treasuryBalDisplay = data
    ? Number(data.treasuryBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '--';

  return (
    <div className="relative z-10 min-h-screen">
      {/* Grid pattern overlay */}
      <div className="grid-overlay" />

      {/* Live data banner */}
      <div
        className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 px-4 py-2 text-center text-sm border-b border-emerald-500/20"
        style={{ color: '#6ee7b7' }}
      >
        Live on-chain data &mdash; Base Sepolia (auto-refreshes every 30s)
        {error && <span className="ml-2 text-red-400 text-xs"> | RPC fallback active</span>}
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-aegis-border backdrop-blur-xl" style={{ background: 'rgba(10,10,15,0.8)' }}>
        <div className="mx-auto flex h-12 items-center justify-between px-4 max-w-[1600px]">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  boxShadow: '0 0 12px rgba(59,130,246,0.3)',
                }}
              >
                <ShieldIcon className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">Aegis</span>
            </div>

            {/* Nav links */}
            <div className="nav-tabs-scroll flex items-center gap-0.5 overflow-x-auto">
              {([
                { key: 'dashboard' as const, label: 'Dashboard' },
                { key: 'screener' as const, label: 'Screener' },
                { key: 'terminal' as const, label: 'Terminal' },
                { key: 'chat' as const, label: 'Chat' },
              ]).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={`relative whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeNav === item.key
                      ? 'bg-[rgba(59,130,246,0.1)] text-white'
                      : 'text-aegis-text-dim hover:text-white'
                  }`}
                >
                  {item.label}
                  {activeNav === item.key && (
                    <span className="absolute bottom-[-9px] left-0 right-0 h-[2px] bg-blue-400 rounded-t" />
                  )}
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
          </div>

          <div className="flex items-center gap-2">
            {/* Network badge */}
            <div className="hidden items-center gap-1.5 rounded-md border border-aegis-border px-2 py-1 text-[10px] sm:flex" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="text-aegis-text-dim">Base Sepolia</span>
            </div>
            {/* Owner wallet display */}
            <button
              className="flex items-center gap-2 rounded-lg border border-aegis-border px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-blue-500/30"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              {fmtAddr(OWNER_WALLET)}
            </button>
          </div>
        </div>
      </nav>

      {/* Dashboard stats bar */}
      <div className="border-b border-aegis-border" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-4 py-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-aegis-muted">Treasury Balance</span>
            {loading ? (
              <Skeleton className="h-3 w-20" />
            ) : (
              <span className="font-mono font-semibold text-white">{treasuryBalDisplay} USDC</span>
            )}
          </div>
          <div className="h-3 w-px bg-aegis-border" />
          <div className="flex items-center gap-2">
            <span className="text-aegis-muted">Active Agents</span>
            {loading ? (
              <Skeleton className="h-3 w-6" />
            ) : (
              <span className="font-mono font-semibold text-white">{data?.agentCount ?? 0}</span>
            )}
          </div>
          <div className="h-3 w-px bg-aegis-border" />
          <div className="flex items-center gap-2">
            <span className="text-aegis-muted">Network</span>
            <span className="font-mono font-semibold text-white">Base Sepolia</span>
          </div>
          <div className="h-3 w-px bg-aegis-border" />
          <div className="flex items-center gap-2">
            <span className="text-aegis-muted">Status</span>
            <span className={`font-mono font-semibold ${data?.paused ? 'text-red-400' : 'text-emerald-400'}`}>
              {loading ? '--' : data?.paused ? 'Paused' : 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-[1600px] px-3 py-3">
        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

        {activeNav === 'dashboard' && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[2fr_1fr]">
              {/* Row 1: Chart + Screener */}
              <div className="min-h-[360px]">
                <PriceChart />
              </div>
              <div className="min-h-[360px]">
                <TokenScreener />
              </div>

              {/* Row 2: PnL Chart + Portfolio */}
              <div className="min-h-[280px]">
                <PnLChart />
              </div>
              <div className="min-h-[280px]">
                <LivePortfolio data={data} loading={loading} />
              </div>

              {/* Row 3: Treasury + OrderBook */}
              <div className="space-y-2">
                <LiveTreasury data={data} loading={loading} />
                <MockCreateAllowance />
              </div>
              <div className="min-h-[300px]">
                <LiveOrderBook data={data} loading={loading} />
              </div>

              {/* Row 4: Terminal Feed + Strategy/Venice/Emergency */}
              <div className="min-h-[340px]">
                <LiveTerminalFeed data={data} loading={loading} />
              </div>
              <div className="space-y-2">
                <MockStrategyPanel data={data} loading={loading} />
                <MockVenicePanel />
                <MockEmergencyControls data={data} />
              </div>
            </div>
          </div>
        )}

        {activeNav === 'screener' && (
          <div className="min-h-[600px]">
            <TokenScreener />
          </div>
        )}

        {activeNav === 'terminal' && (
          <div className="min-h-[600px]">
            <LiveTerminalFeed data={data} loading={loading} />
          </div>
        )}

        {activeNav === 'chat' && (
          <div className="terminal-panel min-h-[600px] flex flex-col">
            <div className="terminal-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Agent Chat</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] px-2 py-0.5 text-[9px] font-semibold text-purple-400">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Private
                </span>
              </div>
            </div>
            <div className="flex-1 p-4 space-y-4 font-mono text-[12px]">
              <div className="flex gap-3">
                <span className="text-purple-400 shrink-0">[agent]</span>
                <span className="text-aegis-text-dim">
                  Treasury balance: {treasuryBalDisplay} USDC. {data?.agentCount ?? '--'} active agent(s).
                  {data?.agents?.length ? ` Agents: ${data.agents.map((a) => fmtAddr(a)).join(', ')}.` : ''}
                  {' '}DCA strategy executing chunk 12/20 (50 USDC each, targeting WETH). Next execution in ~2 minutes.
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-blue-400 shrink-0">[user]</span>
                <span className="text-aegis-text-dim">What is the current risk exposure?</span>
              </div>
              <div className="flex gap-3">
                <span className="text-purple-400 shrink-0">[agent]</span>
                <span className="text-aegis-text-dim">
                  {data?.allowances?.length
                    ? `Current allowance utilization: ${data.allowances.map((a) => `${fmtAddr(a.agent)} at ${a.percentUsed}%`).join(', ')}. `
                    : 'No active allowances. '}
                  All positions within defined risk parameters. Contract is {data?.paused ? 'PAUSED' : 'active'}.
                </span>
              </div>
            </div>
            <div className="border-t border-[rgba(255,255,255,0.06)] p-3">
              <input type="text" placeholder="Type a message..." readOnly className="w-full" />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-aegis-border py-4">
        <div className="mx-auto flex items-center justify-between px-4 max-w-[1600px]">
          <div className="flex items-center gap-2 text-[10px] text-aegis-muted">
            <ShieldIcon className="h-3 w-3" />
            <span>Aegis Treasury</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-aegis-muted">
            <span className="font-mono text-aegis-border">Shortcuts: 1-4 tabs</span>
            <span className="text-aegis-border">|</span>
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

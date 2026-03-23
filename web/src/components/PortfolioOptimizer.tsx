'use client';

import { useState, useCallback } from 'react';

interface AllocationItem {
  symbol: string;
  percent: number;
}

interface OptimizeData {
  currentAllocation: AllocationItem[];
  recommendedAllocation: AllocationItem[];
  actions: string[];
  riskAdjustedReturn: string;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
  model: string;
  timestamp: string;
  provider: string;
  private: boolean;
}

function riskLevelColor(level: string): string {
  if (level === 'low') return 'text-emerald-400';
  if (level === 'medium') return 'text-amber-400';
  return 'text-red-400';
}

function riskLevelBg(level: string): string {
  if (level === 'low') return 'bg-[rgba(52,211,153,0.12)] border-emerald-500/20';
  if (level === 'medium') return 'bg-[rgba(245,158,11,0.12)] border-amber-500/20';
  return 'bg-[rgba(239,68,68,0.12)] border-red-500/20';
}

const BAR_COLORS: Record<string, string> = {
  USDC: '#3b82f6',
  WETH: '#8b5cf6',
  ETH: '#8b5cf6',
  BTC: '#f59e0b',
  SOL: '#14b8a6',
  MATIC: '#a855f7',
  AVAX: '#ef4444',
  LINK: '#2563eb',
};

function getBarColor(symbol: string): string {
  return BAR_COLORS[symbol.toUpperCase()] || '#6b7280';
}

function AllocationBars({ items, label }: { items: AllocationItem[]; label: string }) {
  const maxPercent = Math.max(...items.map((i) => i.percent), 1);
  return (
    <div className="flex-1 min-w-0">
      <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">{label}</span>
      <div className="mt-1.5 space-y-1">
        {items.map((item) => (
          <div key={item.symbol} className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-aegis-text-dim w-10 text-right shrink-0">{item.symbol}</span>
            <div className="flex-1 h-3 rounded bg-[rgba(255,255,255,0.04)] overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${(item.percent / maxPercent) * 100}%`,
                  backgroundColor: getBarColor(item.symbol),
                  opacity: 0.8,
                }}
              />
            </div>
            <span className="font-mono text-[10px] text-aegis-text-dim w-8 shrink-0">{item.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioOptimizer() {
  const [data, setData] = useState<OptimizeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runOptimize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio: [
            { symbol: 'USDC', allocation: 45 },
            { symbol: 'WETH', allocation: 30 },
            { symbol: 'BTC', allocation: 15 },
            { symbol: 'SOL', allocation: 10 },
          ],
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to optimize');
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="terminal-panel flex flex-col h-full max-h-[520px] overflow-hidden">
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Brain icon */}
          <svg className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">
            Portfolio Optimizer
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] px-2 py-0.5 text-[9px] font-semibold text-purple-400">
            AI
          </span>
        </div>
        <span className="text-[10px] text-aegis-muted font-mono">
          {data?.model || 'gemini-3-flash-preview'}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 text-[11px]">
        {!data && !loading && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <svg className="h-8 w-8 text-purple-400/40 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            <p className="text-aegis-muted text-[10px]">Click Optimize to get AI-powered portfolio recommendations</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin mb-3" />
            <p className="text-purple-400 text-[10px] font-medium">Optimizing portfolio...</p>
            <p className="text-aegis-muted text-[9px] mt-1">Private inference via Venice AI</p>
          </div>
        )}

        {data && !loading && (
          <div className="fade-up space-y-3">
            {/* Side-by-side allocation comparison */}
            <div className="flex gap-4">
              <AllocationBars
                items={(data.currentAllocation || []).map((a) => ({ symbol: a.symbol, percent: a.percent }))}
                label="Current"
              />
              <AllocationBars
                items={(data.recommendedAllocation || []).map((a) => ({ symbol: a.symbol, percent: a.percent }))}
                label="Recommended"
              />
            </div>

            {/* Risk-adjusted return + risk level */}
            <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-2.5">
              <div>
                <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Est. Risk-Adj. Return</span>
                <p className="font-mono font-bold text-emerald-400 text-[14px] mt-0.5">{data.riskAdjustedReturn}</p>
              </div>
              <div className="text-right">
                <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Risk Level</span>
                <p className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 mt-0.5 text-[11px] font-bold uppercase ${riskLevelBg(data.riskLevel)} ${riskLevelColor(data.riskLevel)}`}>
                  {data.riskLevel}
                </p>
              </div>
            </div>

            {/* Action Items */}
            <div>
              <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Action Items</span>
              <div className="mt-1.5 space-y-1">
                {(data.actions || []).map((action, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1.5">
                    <span className="text-blue-400 font-mono text-[10px] shrink-0">{i + 1}.</span>
                    <span className="text-aegis-text-dim">{action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reasoning */}
            <div>
              <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Reasoning</span>
              <p className="mt-1 text-aegis-text-dim leading-relaxed">{data.reasoning}</p>
            </div>
          </div>
        )}

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] px-2 py-0.5 text-[9px] font-semibold text-purple-400">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Powered by Venice AI (Private)
          </span>
          <button
            onClick={runOptimize}
            disabled={loading}
            className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition-all ${
              loading
                ? 'bg-[rgba(255,255,255,0.04)] text-aegis-muted cursor-wait'
                : 'bg-[rgba(139,92,246,0.15)] text-purple-400 hover:bg-[rgba(139,92,246,0.25)] active:scale-95'
            }`}
          >
            {loading ? 'Optimizing...' : 'Optimize'}
          </button>
        </div>

        {error && (
          <div className="rounded border border-red-500/20 bg-red-500/5 px-2 py-1 text-[10px] text-red-400">
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
}

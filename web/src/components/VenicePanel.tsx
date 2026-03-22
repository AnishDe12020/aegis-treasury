'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  TREASURY_ABI,
} from '@/lib/contracts';

interface VeniceAnalysis {
  action: string;
  confidence: number;
  reasoning: string;
  risk: number;
  model: string;
  timestamp: string;
  provider?: string;
  private?: boolean;
  recommendation: {
    pair: string;
    direction: string;
    size: string;
    timeHorizon: string;
  };
}

function riskColor(risk: number): string {
  if (risk <= 3) return 'text-emerald-400';
  if (risk <= 5) return 'text-blue-400';
  if (risk <= 7) return 'text-amber-400';
  return 'text-red-400';
}

function riskBgColor(risk: number): string {
  if (risk <= 3) return 'bg-emerald-400';
  if (risk <= 5) return 'bg-blue-400';
  if (risk <= 7) return 'bg-amber-400';
  return 'bg-red-400';
}

function actionColor(action: string): string {
  if (action === 'buy') return 'text-green-400 bg-[rgba(34,197,94,0.12)]';
  if (action === 'sell') return 'text-red-400 bg-[rgba(239,68,68,0.12)]';
  return 'text-amber-400 bg-[rgba(245,158,11,0.12)]';
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function VenicePanel() {
  const [analysis, setAnalysis] = useState<VeniceAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agoText, setAgoText] = useState('');

  // Read treasury data from chain
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

  // Update "time ago" every 10s
  useEffect(() => {
    if (!analysis) return;
    setAgoText(timeAgo(analysis.timestamp));
    const interval = setInterval(() => {
      setAgoText(timeAgo(analysis.timestamp));
    }, 10000);
    return () => clearInterval(interval);
  }, [analysis]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const balance = treasuryBalance
        ? formatUnits(treasuryBalance as bigint, USDC_DECIMALS)
        : '0';
      const agents = agentCount ? Number(agentCount) : 0;

      const res = await fetch('/api/venice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treasuryBalance: balance,
          agentCount: agents,
          allowanceRemaining: balance, // approximation
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'API request failed');
      }
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [treasuryBalance, agentCount]);

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">
            Venice AI
          </span>
          {/* Private Inference badge with lock icon */}
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] px-2 py-0.5 text-[9px] font-semibold text-purple-400">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Private
          </span>
        </div>
        <span className="text-[10px] text-aegis-muted font-mono">
          {analysis?.model || 'llama-3.3-70b'}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 text-[11px]">
        {!analysis && !loading && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <svg className="h-8 w-8 text-purple-400/40 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            <p className="text-aegis-muted text-[10px]">Click Run Analysis to get private AI insights</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin mb-3" />
            <p className="text-purple-400 text-[10px] font-medium">Analyzing via Venice AI...</p>
            <p className="text-aegis-muted text-[9px] mt-1">Private inference - no data stored</p>
          </div>
        )}

        {analysis && !loading && (
          <>
            {/* Action + Confidence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Action</span>
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${actionColor(analysis.action)}`}>
                  {analysis.action}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-aegis-muted text-[10px]">Confidence</span>
                <span className="font-mono font-bold text-white">{(analysis.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Risk Assessment */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Risk Assessment</span>
                <span className={`font-mono font-bold ${riskColor(analysis.risk)}`}>{analysis.risk}/10</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${riskBgColor(analysis.risk)}`}
                  style={{ width: `${analysis.risk * 10}%` }}
                />
              </div>
            </div>

            {/* Token Pair Recommendation */}
            {analysis.recommendation && (
              <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-1.5">
                <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Recommendation</span>
                <div className="flex justify-between">
                  <span className="text-aegis-muted">Pair</span>
                  <span className="font-mono text-white font-semibold">{analysis.recommendation.pair}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-aegis-muted">Direction</span>
                  <span className="font-mono text-aegis-text-dim">{analysis.recommendation.direction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-aegis-muted">Position Size</span>
                  <span className="font-mono text-aegis-text-dim">{analysis.recommendation.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-aegis-muted">Time Horizon</span>
                  <span className="font-mono text-aegis-text-dim">{analysis.recommendation.timeHorizon}</span>
                </div>
              </div>
            )}

            {/* Reasoning */}
            <div>
              <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Reasoning</span>
              <p className="mt-1 text-aegis-text-dim leading-relaxed">{analysis.reasoning}</p>
            </div>
          </>
        )}

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Footer: timestamp + run button */}
        <div className="flex items-center justify-between">
          <span className="text-aegis-muted text-[10px]">
            {analysis ? `Last updated: ${agoText}` : 'No analysis yet'}
          </span>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition-all ${
              loading
                ? 'bg-[rgba(255,255,255,0.04)] text-aegis-muted cursor-wait'
                : 'bg-[rgba(139,92,246,0.15)] text-purple-400 hover:bg-[rgba(139,92,246,0.25)] active:scale-95'
            }`}
          >
            {loading ? 'Analyzing...' : 'Run Analysis'}
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

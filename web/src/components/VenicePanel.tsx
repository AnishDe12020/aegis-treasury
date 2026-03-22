'use client';

import { useState } from 'react';

interface VeniceAnalysis {
  action: string;
  confidence: number;
  reasoning: string;
  risk: number;
  model: string;
  timestamp: string;
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

const INITIAL_ANALYSIS: VeniceAnalysis = {
  action: 'hold',
  confidence: 0.85,
  reasoning: 'Treasury maintains healthy USDC reserves with active agent allocations. Current market conditions suggest holding position until clearer directional signals emerge.',
  risk: 7,
  model: 'llama-3.3-70b',
  timestamp: new Date().toISOString(),
  recommendation: {
    pair: 'USDC/WETH',
    direction: 'neutral',
    size: '0%',
    timeHorizon: 'short-term',
  },
};

export default function VenicePanel() {
  const [analysis, setAnalysis] = useState<VeniceAnalysis>(INITIAL_ANALYSIS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/venice', { method: 'POST' });
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const ts = new Date(analysis.timestamp);
  const formattedTime = ts.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">
            AI Strategy Analysis
          </span>
          {/* Private Inference badge */}
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] px-2 py-0.5 text-[9px] font-semibold text-purple-400">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Private Inference
          </span>
        </div>
        <span className="text-[10px] text-aegis-muted font-mono">{analysis.model}</span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 text-[11px]">
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

        {/* Reasoning */}
        <div>
          <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Reasoning</span>
          <p className="mt-1 text-aegis-text-dim leading-relaxed">{analysis.reasoning}</p>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Footer: timestamp + run button */}
        <div className="flex items-center justify-between">
          <span className="text-aegis-muted text-[10px]">Last run: {formattedTime}</span>
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

'use client';

import { useState, useEffect, useCallback } from 'react';

interface TrendingToken {
  symbol: string;
  reason: string;
  direction: 'up' | 'down' | 'flat';
}

interface SentimentData {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  fearGreedIndex: number;
  trendingTokens: TrendingToken[];
  summary: string;
  model: string;
  timestamp: string;
  provider: string;
  private: boolean;
}

function sentimentColor(s: string): string {
  if (s === 'bullish') return 'text-emerald-400';
  if (s === 'bearish') return 'text-red-400';
  return 'text-amber-400';
}

function sentimentBg(s: string): string {
  if (s === 'bullish') return 'bg-[rgba(52,211,153,0.12)] border-emerald-500/20';
  if (s === 'bearish') return 'bg-[rgba(239,68,68,0.12)] border-red-500/20';
  return 'bg-[rgba(245,158,11,0.12)] border-amber-500/20';
}

function directionIcon(d: string): string {
  if (d === 'up') return '\u2191';
  if (d === 'down') return '\u2193';
  return '\u2194';
}

function directionColor(d: string): string {
  if (d === 'up') return 'text-emerald-400';
  if (d === 'down') return 'text-red-400';
  return 'text-amber-400';
}

function gaugeColor(value: number): string {
  if (value <= 25) return '#ef4444';
  if (value <= 45) return '#f59e0b';
  if (value <= 55) return '#eab308';
  if (value <= 75) return '#84cc16';
  return '#22c55e';
}

function FearGreedGauge({ value }: { value: number }) {
  // SVG arc gauge from 0-100
  const radius = 40;
  const strokeWidth = 8;
  const cx = 50;
  const cy = 50;
  // Arc from -135deg to +135deg (270 degree range)
  const startAngle = -135;
  const endAngle = 135;
  const range = endAngle - startAngle;
  const valueAngle = startAngle + (value / 100) * range;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const valueEnd = polarToCartesian(valueAngle);

  const largeArcBg = range > 180 ? 1 : 0;
  const valueRange = valueAngle - startAngle;
  const largeArcValue = valueRange > 180 ? 1 : 0;

  const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcBg} 1 ${end.x} ${end.y}`;
  const valuePath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcValue} 1 ${valueEnd.x} ${valueEnd.y}`;

  const color = gaugeColor(value);
  const label = value <= 25 ? 'Extreme Fear' : value <= 45 ? 'Fear' : value <= 55 ? 'Neutral' : value <= 75 ? 'Greed' : 'Extreme Greed';

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="70" viewBox="0 0 100 70">
        <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={valuePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize="16" fontWeight="bold" fontFamily="monospace">
          {value}
        </text>
        <text x={cx} y={cx + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">
          {label}
        </text>
      </svg>
    </div>
  );
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

export default function MarketSentiment() {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agoText, setAgoText] = useState('');

  const fetchSentiment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sentiment');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch sentiment');
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    fetchSentiment();
    const interval = setInterval(fetchSentiment, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSentiment]);

  // Update "time ago" every 10s
  useEffect(() => {
    if (!data) return;
    setAgoText(timeAgo(data.timestamp));
    const interval = setInterval(() => {
      setAgoText(timeAgo(data.timestamp));
    }, 10000);
    return () => clearInterval(interval);
  }, [data]);

  return (
    <div className="terminal-panel flex flex-col h-full max-h-[500px] overflow-hidden">
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">
            Market Sentiment
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] px-2 py-0.5 text-[9px] font-semibold text-purple-400">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            AI
          </span>
        </div>
        <span className="text-[10px] text-aegis-muted font-mono">
          {data?.model || 'gemini-3-flash-preview'}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 text-[11px]">
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin mb-3" />
            <p className="text-purple-400 text-[10px] font-medium">Fetching market sentiment...</p>
            <p className="text-aegis-muted text-[9px] mt-1">Private inference via Venice AI</p>
          </div>
        )}

        {data && (
          <div className="fade-up">
            {/* Sentiment + Fear/Greed row */}
            <div className="flex items-center gap-3">
              {/* Overall Sentiment */}
              <div className="flex-1">
                <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Overall</span>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-bold uppercase ${sentimentBg(data.sentiment)} ${sentimentColor(data.sentiment)}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: data.sentiment === 'bullish' ? '#34d399' : data.sentiment === 'bearish' ? '#f87171' : '#fbbf24' }} />
                    {data.sentiment}
                  </span>
                </div>
              </div>

              {/* Fear & Greed Gauge */}
              <div className="flex-shrink-0">
                <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium block text-center mb-0.5">Fear &amp; Greed</span>
                <FearGreedGauge value={data.fearGreedIndex} />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-2.5">
              <p className="text-aegis-text-dim leading-relaxed">{data.summary}</p>
            </div>

            {/* Trending Tokens */}
            <div>
              <span className="text-aegis-muted uppercase tracking-wider text-[10px] font-medium">Trending Tokens</span>
              <div className="mt-1.5 space-y-1.5">
                {(data.trendingTokens || []).slice(0, 3).map((token, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] p-2">
                    <span className={`font-mono font-bold text-[12px] ${directionColor(token.direction)} shrink-0 w-5 text-center`}>
                      {directionIcon(token.direction)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono font-semibold text-white">{token.symbol}</span>
                      <p className="text-aegis-muted text-[10px] mt-0.5 leading-relaxed">{token.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] px-2 py-0.5 text-[9px] font-semibold text-purple-400">
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Powered by Venice AI (Private)
            </span>
            <span className="text-aegis-muted text-[10px]">
              {data ? `Updated ${agoText}` : ''}
            </span>
          </div>
          <button
            onClick={fetchSentiment}
            disabled={loading}
            className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition-all ${
              loading
                ? 'bg-[rgba(255,255,255,0.04)] text-aegis-muted cursor-wait'
                : 'bg-[rgba(139,92,246,0.15)] text-purple-400 hover:bg-[rgba(139,92,246,0.25)] active:scale-95'
            }`}
          >
            {loading ? 'Updating...' : 'Refresh'}
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

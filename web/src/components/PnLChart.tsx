'use client';

import { useState, useMemo, useRef, useCallback } from 'react';

type Timeframe = '7D' | '30D' | '90D';

const DAY_COUNTS: Record<Timeframe, number> = { '7D': 7, '30D': 30, '90D': 90 };

function generatePnLData(days: number, seed: number): number[] {
  const daily: number[] = [];
  let cumulative = 0;
  // Use seeded pseudo-random
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < days; i++) {
    // Random walk: +/- 2-5 USDC per day with slight upward bias
    const magnitude = 2 + rand() * 3;
    const direction = rand() > 0.45 ? 1 : -1; // slight upward bias
    cumulative += direction * magnitude;
    daily.push(cumulative);
  }
  return daily;
}

export default function PnLChart() {
  const [timeframe, setTimeframe] = useState<Timeframe>('30D');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const seed = useMemo(() => {
    // Different but stable seed per timeframe
    const seeds: Record<Timeframe, number> = { '7D': 42, '30D': 137, '90D': 256 };
    return seeds[timeframe];
  }, [timeframe]);

  const data = useMemo(() => generatePnLData(DAY_COUNTS[timeframe], seed), [timeframe, seed]);

  const totalPnL = data[data.length - 1];
  const isPositive = totalPnL >= 0;

  // Daily changes
  const dailyChanges = data.map((v, i) => (i === 0 ? v : v - data[i - 1]));
  const bestDay = Math.max(...dailyChanges);
  const worstDay = Math.min(...dailyChanges);
  const winDays = dailyChanges.filter(d => d >= 0).length;
  const winRate = (winDays / dailyChanges.length) * 100;

  // SVG dimensions
  const W = 800;
  const H = 240;
  const PAD_X = 0;
  const PAD_Y = 20;
  const chartH = H - PAD_Y * 2;
  const chartW = W - PAD_X * 2;

  const high = Math.max(...data, 0);
  const low = Math.min(...data, 0);
  const range = high - low || 1;

  const toX = useCallback((i: number) => PAD_X + (i / Math.max(data.length - 1, 1)) * chartW, [data.length, chartW]);
  const toY = useCallback((v: number) => PAD_Y + chartH - ((v - low) / range) * chartH, [chartH, low, range]);

  const zeroY = toY(0);

  const linePath = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${toX(data.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${toX(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  const lineColor = isPositive ? '#22c55e' : '#ef4444';

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((relX - PAD_X) / chartW) * (data.length - 1));
    setHoverIndex(Math.max(0, Math.min(data.length - 1, idx)));
  }, [data.length, chartW]);

  const handleMouseLeave = useCallback(() => setHoverIndex(null), []);

  const hoverValue = hoverIndex !== null ? data[hoverIndex] : null;
  const hoverDaily = hoverIndex !== null ? dailyChanges[hoverIndex] : null;
  const hoverX = hoverIndex !== null ? toX(hoverIndex) : 0;
  const hoverY = hoverIndex !== null ? toY(data[hoverIndex]) : 0;

  const fmtPnL = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Agent P&amp;L</span>
          <span className={`font-mono text-sm font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {fmtPnL(totalPnL)} USDC
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(['7D', '30D', '90D'] as Timeframe[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors
                ${timeframe === tf
                  ? 'bg-[rgba(59,130,246,0.15)] text-blue-400'
                  : 'text-aegis-muted hover:text-aegis-text-dim'
                }
              `}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-[rgba(255,255,255,0.06)] px-3 py-1.5 text-[10px] text-aegis-muted">
        <span>Best: <span className="font-mono text-green-400">{fmtPnL(bestDay)}</span></span>
        <span>Worst: <span className="font-mono text-red-400">{fmtPnL(worstDay)}</span></span>
        <span>Win Rate: <span className="font-mono text-aegis-text-dim">{winRate.toFixed(0)}%</span></span>
        {hoverValue !== null && (
          <span className="ml-auto font-mono text-white">
            Day {hoverIndex! + 1}: {fmtPnL(hoverValue)} (daily: {fmtPnL(hoverDaily!)})
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 p-2 relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'crosshair' }}
        >
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(frac => (
            <line
              key={frac}
              x1={0}
              y1={PAD_Y + chartH * frac}
              x2={W}
              y2={PAD_Y + chartH * frac}
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="4,6"
            />
          ))}

          {/* Zero line */}
          <line
            x1={0}
            y1={zeroY}
            x2={W}
            y2={zeroY}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
            strokeDasharray="6,4"
          />

          {/* Area fill */}
          <path d={areaPath} fill="url(#pnlGrad)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" />

          {/* Current value dot */}
          <circle cx={toX(data.length - 1)} cy={toY(totalPnL)} r="3" fill={lineColor} />
          <circle cx={toX(data.length - 1)} cy={toY(totalPnL)} r="6" fill={lineColor} opacity="0.2" />

          {/* Hover crosshair */}
          {hoverIndex !== null && (
            <>
              <line
                x1={hoverX}
                y1={PAD_Y}
                x2={hoverX}
                y2={H - PAD_Y}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <line
                x1={0}
                y1={hoverY}
                x2={W}
                y2={hoverY}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <circle cx={hoverX} cy={hoverY} r="4" fill={lineColor} stroke="white" strokeWidth="1.5" />
              <g transform={`translate(${Math.min(hoverX + 8, W - 100)}, ${Math.max(hoverY - 28, PAD_Y)})`}>
                <rect x="0" y="0" width="92" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <text x="8" y="15" fill="white" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  {fmtPnL(hoverValue!)} USDC
                </text>
              </g>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

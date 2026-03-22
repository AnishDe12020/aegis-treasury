'use client';

import { useState, useEffect, useMemo } from 'react';

type Timeframe = '1H' | '4H' | '1D' | '1W';

const POINT_COUNTS: Record<Timeframe, number> = { '1H': 60, '4H': 96, '1D': 96, '1W': 84 };

function generateData(count: number, seed: number): number[] {
  const data: number[] = [];
  let price = 3400 + seed * 100;
  for (let i = 0; i < count; i++) {
    price += Math.sin(i * 0.15 + seed) * 12 + (Math.random() - 0.48) * 18;
    price = Math.max(price, 2800);
    data.push(price);
  }
  return data;
}

export default function PriceChart() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [seed, setSeed] = useState(1);

  useEffect(() => {
    setSeed(Math.random() * 10);
  }, [timeframe]);

  const data = useMemo(() => generateData(POINT_COUNTS[timeframe], seed), [timeframe, seed]);

  const high = Math.max(...data);
  const low = Math.min(...data);
  const current = data[data.length - 1];
  const open = data[0];
  const changePercent = ((current - open) / open) * 100;
  const isPositive = changePercent >= 0;

  // Simulated volume
  const volume = (1_870_000_000 + Math.random() * 200_000_000);

  // SVG dimensions
  const W = 800;
  const H = 280;
  const PAD_X = 0;
  const PAD_Y = 20;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const toX = (i: number) => PAD_X + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => PAD_Y + chartH - ((v - low) / (high - low || 1)) * chartH;

  const linePath = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${toX(data.length - 1).toFixed(1)},${H} L${toX(0).toFixed(1)},${H} Z`;

  const lineColor = isPositive ? '#22c55e' : '#ef4444';
  const gradId = 'chartGrad';

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">WETH / USD</span>
          <span className={`font-mono text-sm font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            ${current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`font-mono text-[11px] font-medium ${isPositive ? 'price-up' : 'price-down'}`}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(['1H', '4H', '1D', '1W'] as Timeframe[]).map(tf => (
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
        <span>H: <span className="font-mono text-green-400">${high.toFixed(2)}</span></span>
        <span>L: <span className="font-mono text-red-400">${low.toFixed(2)}</span></span>
        <span>Vol: <span className="font-mono text-aegis-text-dim">${(volume / 1e9).toFixed(2)}B</span></span>
      </div>

      {/* Chart */}
      <div className="flex-1 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
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

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradId})`} />

          {/* Line */}
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" />

          {/* Current price dot */}
          <circle cx={toX(data.length - 1)} cy={toY(current)} r="3" fill={lineColor} />
          <circle cx={toX(data.length - 1)} cy={toY(current)} r="6" fill={lineColor} opacity="0.2" />
        </svg>
      </div>
    </div>
  );
}

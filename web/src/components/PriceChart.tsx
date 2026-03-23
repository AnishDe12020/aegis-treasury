'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPublicClient, http, encodeFunctionData, decodeFunctionResult } from 'viem';
import { base } from 'viem/chains';

const baseClient = createPublicClient({
  chain: base,
  transport: http('https://base.drpc.org'),
});

const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as `0x${string}`;
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
const QUOTER_V2 = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as `0x${string}`;

const QUOTER_ABI = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
] as const;

type Timeframe = '1H' | '4H' | '1D' | '1W';

const POINT_COUNTS: Record<Timeframe, number> = { '1H': 60, '4H': 96, '1D': 96, '1W': 84 };

function generateData(count: number, seed: number, currentPrice: number): number[] {
  const data: number[] = [];
  // Start from a price that will trend toward the current real price
  let price = currentPrice * (0.97 + seed * 0.005);
  for (let i = 0; i < count - 1; i++) {
    const targetDrift = (currentPrice - price) / (count - i) * 0.5;
    price += targetDrift + Math.sin(i * 0.15 + seed) * (currentPrice * 0.003) + (Math.random() - 0.48) * (currentPrice * 0.004);
    price = Math.max(price, currentPrice * 0.9);
    data.push(price);
  }
  // Last point is the real current price
  data.push(currentPrice);
  return data;
}

function generateVolume(count: number, seed: number): number[] {
  const vol: number[] = [];
  for (let i = 0; i < count; i++) {
    vol.push(0.3 + Math.abs(Math.sin(i * 0.2 + seed)) * 0.7 + Math.random() * 0.3);
  }
  return vol;
}

function formatTime(index: number, count: number, timeframe: Timeframe): string {
  const now = new Date();
  const minutesPerPoint: Record<Timeframe, number> = { '1H': 1, '4H': 2.5, '1D': 15, '1W': 120 };
  const minutesAgo = (count - 1 - index) * minutesPerPoint[timeframe];
  const t = new Date(now.getTime() - minutesAgo * 60000);
  return t.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function fetchWethPrice(): Promise<number | null> {
  try {
    const callData = encodeFunctionData({
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          tokenIn: WETH_ADDRESS,
          tokenOut: USDC_ADDRESS,
          amountIn: BigInt(10) ** BigInt(18), // 1 WETH
          fee: 3000,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    const result = await baseClient.call({
      to: QUOTER_V2,
      data: callData,
    });

    if (!result.data) return null;

    const decoded = decodeFunctionResult({
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      data: result.data,
    });

    const amountOut = decoded[0];
    const price = Number(amountOut) / 1e6;
    return price > 0 ? price : null;
  } catch (err) {
    console.warn('Failed to fetch WETH price from Base mainnet:', err);
    return null;
  }
}

export default function PriceChart() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [seed, setSeed] = useState(1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [realPrice, setRealPrice] = useState<number | null>(null);
  const [priceSource, setPriceSource] = useState<'loading' | 'live' | 'fallback'>('loading');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch real WETH price on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const price = await fetchWethPrice();
      if (cancelled) return;
      if (price !== null) {
        setRealPrice(price);
        setPriceSource('live');
      } else {
        setRealPrice(3400); // fallback
        setPriceSource('fallback');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setSeed(Math.random() * 10);
  }, [timeframe]);

  const currentPrice = realPrice ?? 3400;

  const data = useMemo(() => generateData(POINT_COUNTS[timeframe], seed, currentPrice), [timeframe, seed, currentPrice]);
  const volumeData = useMemo(() => generateVolume(POINT_COUNTS[timeframe], seed), [timeframe, seed]);

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
  const H = 320;
  const PAD_X = 0;
  const PAD_Y = 20;
  const VOLUME_H = 40;
  const chartH = H - PAD_Y * 2 - VOLUME_H;
  const chartW = W - PAD_X * 2;
  const volumeTop = H - PAD_Y - VOLUME_H;

  const toX = useCallback((i: number) => PAD_X + (i / (data.length - 1)) * chartW, [data.length, chartW]);
  const toY = useCallback((v: number) => PAD_Y + chartH - ((v - low) / (high - low || 1)) * chartH, [chartH, low, high]);

  const linePath = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${toX(data.length - 1).toFixed(1)},${volumeTop} L${toX(0).toFixed(1)},${volumeTop} Z`;

  const lineColor = isPositive ? '#22c55e' : '#ef4444';
  const gradId = 'chartGrad';

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width * W;
    const idx = Math.round((relX - PAD_X) / chartW * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHoverIndex(clamped);
  }, [data.length, chartW]);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  const hoverPrice = hoverIndex !== null ? data[hoverIndex] : null;
  const hoverX = hoverIndex !== null ? toX(hoverIndex) : 0;
  const hoverY = hoverIndex !== null ? toY(data[hoverIndex]) : 0;

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">WETH / USDC</span>
            <span className="text-[9px] text-aegis-muted">&middot; Base Mainnet</span>
          </div>
          <span className={`font-mono text-sm font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            ${current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`font-mono text-[11px] font-medium ${isPositive ? 'price-up' : 'price-down'}`}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
          {priceSource === 'live' && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400/70">
              <span className="h-1 w-1 rounded-full bg-emerald-400 pulse-glow" />
              LIVE
            </span>
          )}
          {priceSource === 'fallback' && (
            <span className="text-[9px] text-orange-400/70">EST</span>
          )}
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
        {hoverPrice !== null && (
          <span className="ml-auto font-mono text-white">
            ${hoverPrice.toFixed(2)} &middot; {formatTime(hoverIndex!, data.length, timeframe)}
          </span>
        )}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="flex-1 p-2 relative">
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

          {/* Volume bars */}
          {volumeData.map((v, i) => {
            const barW = Math.max(1, chartW / data.length * 0.6);
            const barH = v * VOLUME_H;
            const bx = toX(i) - barW / 2;
            const by = H - PAD_Y - barH;
            const barColor = data[i] >= (data[i - 1] ?? data[i]) ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)';
            return (
              <rect
                key={`vol-${i}`}
                x={bx}
                y={by}
                width={barW}
                height={barH}
                fill={barColor}
                rx={0.5}
              />
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradId})`} />

          {/* Line */}
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" />

          {/* Current price dot */}
          <circle cx={toX(data.length - 1)} cy={toY(current)} r="3" fill={lineColor} />
          <circle cx={toX(data.length - 1)} cy={toY(current)} r="6" fill={lineColor} opacity="0.2" />

          {/* Hover crosshair */}
          {hoverIndex !== null && (
            <>
              {/* Vertical dashed line */}
              <line
                x1={hoverX}
                y1={PAD_Y}
                x2={hoverX}
                y2={H - PAD_Y}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              {/* Horizontal dashed line */}
              <line
                x1={0}
                y1={hoverY}
                x2={W}
                y2={hoverY}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              {/* Hover dot */}
              <circle cx={hoverX} cy={hoverY} r="4" fill={lineColor} stroke="white" strokeWidth="1.5" />
              {/* Price label */}
              <g transform={`translate(${Math.min(hoverX + 8, W - 90)}, ${Math.max(hoverY - 28, PAD_Y)})`}>
                <rect x="0" y="0" width="82" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <text x="8" y="15" fill="white" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  ${hoverPrice!.toFixed(2)}
                </text>
              </g>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

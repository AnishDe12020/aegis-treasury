'use client';

import { useAccount, useBalance, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { ERC20_ABI } from '@/lib/contracts';

const USDC_ADDRESS = '0x62932909ab43336B6710444DA8232333157a6f7c' as `0x${string}`;
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as `0x${string}`;

// Mock USD prices
const PRICES: Record<string, number> = {
  ETH: 3450.0,
  WETH: 3450.0,
  USDC: 1.0,
};

const TOKEN_ICONS: Record<string, string> = {
  ETH: '\u039E',   // Ξ
  WETH: 'W',
  USDC: '$',
};

const COLORS: Record<string, string> = {
  ETH: '#627eea',
  WETH: '#ec4899',
  USDC: '#2775ca',
};

interface TokenHolding {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  color: string;
  icon: string;
}

export default function Portfolio() {
  const { address, isConnected } = useAccount();

  // Native ETH balance
  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: isConnected },
  });

  // USDC balance
  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  // WETH balance
  const { data: wethBalanceRaw } = useReadContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const holdings: TokenHolding[] = [];

  // ETH
  if (ethBalance) {
    const bal = parseFloat(formatUnits(ethBalance.value, 18));
    holdings.push({
      symbol: 'ETH',
      name: 'Ether',
      balance: bal,
      usdValue: bal * PRICES.ETH,
      color: COLORS.ETH,
      icon: TOKEN_ICONS.ETH,
    });
  }

  // WETH
  if (wethBalanceRaw !== undefined) {
    const bal = parseFloat(formatUnits(wethBalanceRaw as bigint, 18));
    holdings.push({
      symbol: 'WETH',
      name: 'Wrapped Ether',
      balance: bal,
      usdValue: bal * PRICES.WETH,
      color: COLORS.WETH,
      icon: TOKEN_ICONS.WETH,
    });
  }

  // USDC
  if (usdcBalanceRaw !== undefined) {
    const bal = parseFloat(formatUnits(usdcBalanceRaw as bigint, 6));
    holdings.push({
      symbol: 'USDC',
      name: 'USD Coin',
      balance: bal,
      usdValue: bal * PRICES.USDC,
      color: COLORS.USDC,
      icon: TOKEN_ICONS.USDC,
    });
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.usdValue, 0);

  // Donut chart SVG
  const cx = 60;
  const cy = 60;
  const radius = 48;
  const innerRadius = 32;

  function donutSegments() {
    if (totalValue === 0) return null;
    const segments: React.ReactNode[] = [];
    let cumulativeAngle = -90; // start at top

    holdings.forEach((h, i) => {
      const fraction = h.usdValue / totalValue;
      if (fraction <= 0) return;
      const angle = fraction * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      const largeArc = angle > 180 ? 1 : 0;

      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const x1 = cx + radius * Math.cos(toRad(startAngle));
      const y1 = cy + radius * Math.sin(toRad(startAngle));
      const x2 = cx + radius * Math.cos(toRad(endAngle));
      const y2 = cy + radius * Math.sin(toRad(endAngle));
      const ix1 = cx + innerRadius * Math.cos(toRad(endAngle));
      const iy1 = cy + innerRadius * Math.sin(toRad(endAngle));
      const ix2 = cx + innerRadius * Math.cos(toRad(startAngle));
      const iy2 = cy + innerRadius * Math.sin(toRad(startAngle));

      const d = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
        'Z',
      ].join(' ');

      segments.push(<path key={i} d={d} fill={h.color} opacity="0.8" />);
      cumulativeAngle = endAngle;
    });

    return segments;
  }

  const fmtUsd = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtBalance = (v: number, symbol: string) => {
    if (symbol === 'USDC') return v.toFixed(2);
    if (v < 0.001) return v.toFixed(6);
    if (v < 1) return v.toFixed(4);
    return v.toFixed(4);
  };

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Portfolio</span>
        <span className="ml-auto font-mono text-[11px] text-white font-bold">${fmtUsd(totalValue)}</span>
      </div>

      <div className="flex-1 overflow-auto">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-10 text-aegis-muted">
            <p className="text-xs">Connect wallet to view portfolio</p>
          </div>
        ) : (
          <div>
            {/* Donut chart */}
            {totalValue > 0 && (
              <div className="flex items-center justify-center py-3">
                <svg viewBox="0 0 120 120" className="h-24 w-24">
                  {donutSegments()}
                  <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    ${totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}K` : fmtUsd(totalValue)}
                  </text>
                  <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">
                    TOTAL
                  </text>
                </svg>
              </div>
            )}

            {/* Holdings list */}
            {holdings.map(h => {
              const pct = totalValue > 0 ? ((h.usdValue / totalValue) * 100).toFixed(1) : '0.0';
              return (
                <div
                  key={h.symbol}
                  className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.03)] px-3 py-2 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                >
                  {/* Icon */}
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
                    style={{ backgroundColor: `${h.color}20`, color: h.color }}
                  >
                    {h.icon}
                  </div>
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-white">{h.symbol}</div>
                    <div className="text-[10px] text-aegis-muted truncate">{h.name}</div>
                  </div>
                  {/* Balance + Value */}
                  <div className="text-right">
                    <div className="font-mono text-[11px] text-white">{fmtBalance(h.balance, h.symbol)}</div>
                    <div className="font-mono text-[10px] text-aegis-muted">${fmtUsd(h.usdValue)} ({pct}%)</div>
                  </div>
                </div>
              );
            })}

            {holdings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-aegis-muted">
                <p className="text-xs">No token balances found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

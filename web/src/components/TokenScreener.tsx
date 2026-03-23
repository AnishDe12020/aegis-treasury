'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface TokenData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
  rank: number;
  sparkline: number[]; // 24 data points for 24h trend
}

function generateSparkline(basePrice: number, change: number): number[] {
  const points: number[] = [];
  const startPrice = basePrice / (1 + change / 100);
  for (let i = 0; i < 24; i++) {
    const progress = i / 23;
    const trend = startPrice + (basePrice - startPrice) * progress;
    const noise = trend * (Math.random() - 0.5) * 0.02;
    points.push(trend + noise);
  }
  return points;
}

const INITIAL_TOKENS: TokenData[] = [
  { symbol: 'WETH', name: 'Wrapped Ether', price: 3_456.78, change24h: 2.34, volume: 1_870_000_000, marketCap: 415_000_000_000, rank: 2, sparkline: [] },
  { symbol: 'USDC', name: 'USD Coin', price: 1.0, change24h: 0.01, volume: 2_340_000_000, marketCap: 33_200_000_000, rank: 6, sparkline: [] },
  { symbol: 'LINK', name: 'Chainlink', price: 18.42, change24h: 5.67, volume: 892_000_000, marketCap: 11_200_000_000, rank: 12, sparkline: [] },
  { symbol: 'UNI', name: 'Uniswap', price: 12.85, change24h: -1.23, volume: 345_000_000, marketCap: 7_700_000_000, rank: 18, sparkline: [] },
  { symbol: 'cbETH', name: 'Coinbase ETH', price: 3_612.45, change24h: 1.87, volume: 89_000_000, marketCap: 7_800_000_000, rank: 20, sparkline: [] },
  { symbol: 'OP', name: 'Optimism', price: 2.31, change24h: 3.45, volume: 412_000_000, marketCap: 3_100_000_000, rank: 28, sparkline: [] },
  { symbol: 'ARB', name: 'Arbitrum', price: 1.18, change24h: -2.56, volume: 567_000_000, marketCap: 3_800_000_000, rank: 35, sparkline: [] },
  { symbol: 'MKR', name: 'Maker', price: 1_842.30, change24h: 0.89, volume: 78_000_000, marketCap: 1_720_000_000, rank: 42, sparkline: [] },
  { symbol: 'SNX', name: 'Synthetix', price: 3.47, change24h: -4.12, volume: 124_000_000, marketCap: 1_080_000_000, rank: 55, sparkline: [] },
  { symbol: 'AERO', name: 'Aerodrome', price: 1.42, change24h: -3.21, volume: 45_000_000, marketCap: 980_000_000, rank: 62, sparkline: [] },
  { symbol: 'COMP', name: 'Compound', price: 67.24, change24h: 1.15, volume: 92_000_000, marketCap: 560_000_000, rank: 78, sparkline: [] },
  { symbol: 'USDbC', name: 'USD Base Coin', price: 0.9998, change24h: -0.02, volume: 120_000_000, marketCap: 2_100_000_000, rank: 85, sparkline: [] },
].map(t => ({ ...t, sparkline: generateSparkline(t.price, t.change24h) }));

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function formatPrice(p: number): string {
  if (p >= 100) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(4);
}

function Sparkline({ data, isUp }: { data: number[]; isUp: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#34d399' : '#f87171'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

type SortKey = 'symbol' | 'price' | 'change24h' | 'volume' | 'marketCap' | 'rank';
type SortDir = 'asc' | 'desc';

export default function TokenScreener() {
  const [tokens, setTokens] = useState<TokenData[]>(INITIAL_TOKENS);
  const [selected, setSelected] = useState<string | null>(null);
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down' | null>>({});
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  };

  const tick = useCallback(() => {
    setTokens(prev =>
      prev.map(t => {
        const delta = (Math.random() - 0.5) * 0.01;
        const newPrice = t.price * (1 + delta);
        const changeDelta = (Math.random() - 0.5) * 0.1;
        const volumeDelta = (Math.random() - 0.5) * 0.02;
        const newSparkline = [...t.sparkline.slice(1), newPrice];
        return {
          ...t,
          price: newPrice,
          change24h: t.change24h + changeDelta,
          volume: t.volume * (1 + volumeDelta),
          sparkline: newSparkline,
        };
      })
    );
    setFlashMap(() => {
      const next: Record<string, 'up' | 'down' | null> = {};
      INITIAL_TOKENS.forEach(t => {
        next[t.symbol] = Math.random() > 0.5 ? 'up' : 'down';
      });
      return next;
    });
    setTimeout(() => setFlashMap({}), 300);
  }, []);

  useEffect(() => {
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [tick]);

  const filteredAndSorted = useMemo(() => {
    let result = tokens;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'symbol') {
        cmp = a.symbol.localeCompare(b.symbol);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [tokens, search, sortKey, sortDir]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Token Screener</span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-aegis-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 text-emerald-400 pulse-glow" />
          LIVE
        </span>
      </div>
      {/* Search */}
      <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)]">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-aegis-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tokens..."
            className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-md pl-8 pr-3 py-1.5 text-[11px] font-mono text-white placeholder-aegis-muted outline-none focus:border-blue-400/30"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.06)] text-aegis-muted">
              <th className="px-3 py-2 text-left font-medium cursor-pointer hover:text-white select-none" onClick={() => handleSort('rank')}>
                #{sortIndicator('rank')}
              </th>
              <th className="px-3 py-2 text-left font-medium cursor-pointer hover:text-white select-none" onClick={() => handleSort('symbol')}>
                Token{sortIndicator('symbol')}
              </th>
              <th className="px-3 py-2 text-right font-medium cursor-pointer hover:text-white select-none" onClick={() => handleSort('price')}>
                Price{sortIndicator('price')}
              </th>
              <th className="px-3 py-2 text-right font-medium cursor-pointer hover:text-white select-none" onClick={() => handleSort('change24h')}>
                24h{sortIndicator('change24h')}
              </th>
              <th className="px-3 py-2 text-center font-medium hidden sm:table-cell">Trend</th>
              <th className="px-3 py-2 text-right font-medium cursor-pointer hover:text-white select-none hidden md:table-cell" onClick={() => handleSort('volume')}>
                Volume{sortIndicator('volume')}
              </th>
              <th className="px-3 py-2 text-right font-medium cursor-pointer hover:text-white select-none hidden lg:table-cell" onClick={() => handleSort('marketCap')}>
                MCap{sortIndicator('marketCap')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map(t => {
              const isUp = t.change24h >= 0;
              const flash = flashMap[t.symbol];
              return (
                <tr
                  key={t.symbol}
                  onClick={() => setSelected(selected === t.symbol ? null : t.symbol)}
                  className={`cursor-pointer border-b border-[rgba(255,255,255,0.03)] transition-all duration-150
                    ${selected === t.symbol ? 'bg-[rgba(59,130,246,0.08)]' : ''}
                    ${flash === 'up' ? 'bg-[rgba(34,197,94,0.06)]' : flash === 'down' ? 'bg-[rgba(239,68,68,0.06)]' : ''}
                    hover:bg-[rgba(255,255,255,0.04)] hover:shadow-[0_0_12px_rgba(59,130,246,0.06)]
                  `}
                >
                  <td className="px-3 py-2 font-mono text-aegis-muted">{t.rank}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{t.symbol}</span>
                      <span className="text-aegis-muted hidden lg:inline">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-white">${formatPrice(t.price)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-medium ${isUp ? 'price-up' : 'price-down'}`}>
                    {isUp ? '+' : ''}{t.change24h.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-center hidden sm:table-cell">
                    <Sparkline data={t.sparkline} isUp={isUp} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-aegis-text-dim hidden md:table-cell">${formatCompact(t.volume)}</td>
                  <td className="px-3 py-2 text-right font-mono text-aegis-text-dim hidden lg:table-cell">${formatCompact(t.marketCap)}</td>
                </tr>
              );
            })}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-aegis-muted">
                  No tokens match &ldquo;{search}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

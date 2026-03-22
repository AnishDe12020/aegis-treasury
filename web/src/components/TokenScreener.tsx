'use client';

import { useState, useEffect, useCallback } from 'react';

interface TokenData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
}

const INITIAL_TOKENS: TokenData[] = [
  { symbol: 'USDC', name: 'USD Coin', price: 1.0, change24h: 0.01, volume: 2_340_000_000, marketCap: 33_200_000_000 },
  { symbol: 'WETH', name: 'Wrapped Ether', price: 3_456.78, change24h: 2.34, volume: 1_870_000_000, marketCap: 415_000_000_000 },
  { symbol: 'cbETH', name: 'Coinbase ETH', price: 3_612.45, change24h: 1.87, volume: 89_000_000, marketCap: 7_800_000_000 },
  { symbol: 'AERO', name: 'Aerodrome', price: 1.42, change24h: -3.21, volume: 45_000_000, marketCap: 980_000_000 },
  { symbol: 'USDbC', name: 'USD Base Coin', price: 0.9998, change24h: -0.02, volume: 120_000_000, marketCap: 2_100_000_000 },
];

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

export default function TokenScreener() {
  const [tokens, setTokens] = useState<TokenData[]>(INITIAL_TOKENS);
  const [selected, setSelected] = useState<string | null>(null);
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down' | null>>({});

  const tick = useCallback(() => {
    setTokens(prev =>
      prev.map(t => {
        const delta = (Math.random() - 0.5) * 0.01; // +/- 0.5%
        const newPrice = t.price * (1 + delta);
        const changeDelta = (Math.random() - 0.5) * 0.1;
        const volumeDelta = (Math.random() - 0.5) * 0.02;
        return {
          ...t,
          price: newPrice,
          change24h: t.change24h + changeDelta,
          volume: t.volume * (1 + volumeDelta),
        };
      })
    );
    setFlashMap(prev => {
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

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Token Screener</span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-aegis-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          LIVE
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.06)] text-aegis-muted">
              <th className="px-3 py-2 text-left font-medium">Token</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">24h</th>
              <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">Volume</th>
              <th className="px-3 py-2 text-right font-medium hidden md:table-cell">MCap</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map(t => {
              const isUp = t.change24h >= 0;
              const flash = flashMap[t.symbol];
              return (
                <tr
                  key={t.symbol}
                  onClick={() => setSelected(selected === t.symbol ? null : t.symbol)}
                  className={`cursor-pointer border-b border-[rgba(255,255,255,0.03)] transition-colors duration-150
                    ${selected === t.symbol ? 'bg-[rgba(59,130,246,0.08)]' : 'hover:bg-[rgba(255,255,255,0.02)]'}
                    ${flash === 'up' ? 'bg-[rgba(34,197,94,0.06)]' : flash === 'down' ? 'bg-[rgba(239,68,68,0.06)]' : ''}
                  `}
                >
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
                  <td className="px-3 py-2 text-right font-mono text-aegis-text-dim hidden sm:table-cell">${formatCompact(t.volume)}</td>
                  <td className="px-3 py-2 text-right font-mono text-aegis-text-dim hidden md:table-cell">${formatCompact(t.marketCap)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { formatUnits, parseAbiItem } from 'viem';
import { TREASURY_ADDRESS, USDC_DECIMALS } from '@/lib/contracts';

interface FeedLine {
  id: string;
  timestamp: string;
  message: string;
  color: 'green' | 'yellow' | 'red' | 'cyan';
}

const EVENT_SIGNATURES = {
  executed: parseAbiItem(
    'event AgentExecuted(address indexed agent, address indexed token, address indexed target, uint256 amount, bytes data, string reason)'
  ),
  allowanceSet: parseAbiItem(
    'event AgentAllowanceSet(address indexed agent, address indexed token, uint256 maxAmount, uint256 expiry, address[] allowedTargets)'
  ),
  allowanceRevoked: parseAbiItem(
    'event AgentAllowanceRevoked(address indexed agent, address indexed token)'
  ),
  deposited: parseAbiItem('event Deposited(address indexed token, uint256 amount)'),
  withdrawn: parseAbiItem('event Withdrawn(address indexed token, uint256 amount)'),
};

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function nowTimestamp() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

export default function TerminalFeed({ maxHeight }: { maxHeight?: string }) {
  const publicClient = usePublicClient();
  const [lines, setLines] = useState<FeedLine[]>([
    { id: 'boot-0', timestamp: nowTimestamp(), message: 'Aegis Terminal v2.0 initialized', color: 'cyan' },
    { id: 'boot-1', timestamp: nowTimestamp(), message: 'Connected to Base Sepolia (chain 84532)', color: 'cyan' },
    { id: 'boot-2', timestamp: nowTimestamp(), message: `Monitoring treasury ${shortenAddr(TREASURY_ADDRESS)}`, color: 'cyan' },
    { id: 'boot-3', timestamp: nowTimestamp(), message: 'Waiting for on-chain events...', color: 'cyan' },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLine = useCallback((line: Omit<FeedLine, 'id' | 'timestamp'>) => {
    setLines(prev => {
      const next = [...prev, { ...line, id: `${Date.now()}-${Math.random()}`, timestamp: nowTimestamp() }];
      return next.slice(-50);
    });
  }, []);

  const addLines = useCallback((newLines: Omit<FeedLine, 'id' | 'timestamp'>[]) => {
    setLines(prev => {
      const mapped = newLines.map(line => ({
        ...line,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: nowTimestamp(),
      }));
      const next = [...prev, ...mapped];
      return next.slice(-50);
    });
  }, []);

  useEffect(() => {
    if (!publicClient) return;

    type EventEntry = { blockNumber: bigint; line: Omit<FeedLine, 'id' | 'timestamp'> };

    const fetchLogs = async (fromBlock: bigint, toBlock: bigint): Promise<EventEntry[]> => {
      const [executedLogs, setLogs, revokedLogs, depositLogs, withdrawLogs] = await Promise.all([
        publicClient.getLogs({ address: TREASURY_ADDRESS, event: EVENT_SIGNATURES.executed, fromBlock, toBlock }),
        publicClient.getLogs({ address: TREASURY_ADDRESS, event: EVENT_SIGNATURES.allowanceSet, fromBlock, toBlock }),
        publicClient.getLogs({ address: TREASURY_ADDRESS, event: EVENT_SIGNATURES.allowanceRevoked, fromBlock, toBlock }),
        publicClient.getLogs({ address: TREASURY_ADDRESS, event: EVENT_SIGNATURES.deposited, fromBlock, toBlock }),
        publicClient.getLogs({ address: TREASURY_ADDRESS, event: EVENT_SIGNATURES.withdrawn, fromBlock, toBlock }),
      ]);

      const entries: EventEntry[] = [];

      for (const log of executedLogs) {
        const amt = Number(formatUnits(log.args.amount ?? 0n, USDC_DECIMALS)).toFixed(2);
        entries.push({
          blockNumber: log.blockNumber,
          line: { message: `TRANSFER ${shortenAddr(log.args.agent ?? '')} -> ${shortenAddr(log.args.target ?? '')} ${amt} USDC "${log.args.reason ?? ''}"`, color: 'green' },
        });
      }
      for (const log of setLogs) {
        const amt = Number(formatUnits(log.args.maxAmount ?? 0n, USDC_DECIMALS)).toFixed(2);
        entries.push({
          blockNumber: log.blockNumber,
          line: { message: `ALLOWANCE SET ${shortenAddr(log.args.agent ?? '')} max=${amt} USDC`, color: 'yellow' },
        });
      }
      for (const log of revokedLogs) {
        entries.push({
          blockNumber: log.blockNumber,
          line: { message: `REVOKED agent=${shortenAddr(log.args.agent ?? '')}`, color: 'red' },
        });
      }
      for (const log of depositLogs) {
        const amt = Number(formatUnits(log.args.amount ?? 0n, USDC_DECIMALS)).toFixed(2);
        entries.push({
          blockNumber: log.blockNumber,
          line: { message: `DEPOSIT ${amt} USDC to treasury`, color: 'green' },
        });
      }
      for (const log of withdrawLogs) {
        const amt = Number(formatUnits(log.args.amount ?? 0n, USDC_DECIMALS)).toFixed(2);
        entries.push({
          blockNumber: log.blockNumber,
          line: { message: `WITHDRAW ${amt} USDC from treasury`, color: 'yellow' },
        });
      }

      return entries;
    };

    const fetchHistorical = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        // Use 5,000 block range max (safe for public RPCs)
        const fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;

        let entries: EventEntry[];
        try {
          entries = await fetchLogs(fromBlock, currentBlock);
        } catch {
          // Fallback to even smaller range (1,000 blocks)
          try {
            const smallerFrom = currentBlock > 1000n ? currentBlock - 1000n : 0n;
            addLine({ message: 'Retrying with smaller block range...', color: 'cyan' });
            entries = await fetchLogs(smallerFrom, currentBlock);
          } catch {
            // Both failed — show graceful message, rely on real-time watcher
            addLine({ message: 'Unable to load historical events \u2014 watching for new ones', color: 'yellow' });
            return;
          }
        }

        entries.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0));

        const recent = entries.slice(-40);
        if (recent.length > 0) {
          addLine({ message: `Loaded ${entries.length} historical events`, color: 'cyan' });
          addLines(recent.map(e => e.line));
        } else {
          addLine({ message: 'No historical events found', color: 'cyan' });
        }
      } catch (err) {
        addLine({ message: 'Unable to load historical events \u2014 watching for new ones', color: 'yellow' });
      }
    };

    fetchHistorical();

    // Watch for real-time events going forward
    const unwatchExecuted = publicClient.watchContractEvent({
      address: TREASURY_ADDRESS,
      abi: [EVENT_SIGNATURES.executed],
      eventName: 'AgentExecuted',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as { agent?: string; target?: string; amount?: bigint; reason?: string };
          const amt = Number(formatUnits(args.amount ?? 0n, USDC_DECIMALS)).toFixed(2);
          addLine({ message: `TRANSFER ${shortenAddr(args.agent ?? '')} -> ${shortenAddr(args.target ?? '')} ${amt} USDC "${args.reason ?? ''}"`, color: 'green' });
        }
      },
    });

    const unwatchDeposited = publicClient.watchContractEvent({
      address: TREASURY_ADDRESS,
      abi: [EVENT_SIGNATURES.deposited],
      eventName: 'Deposited',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as { amount?: bigint };
          const amt = Number(formatUnits(args.amount ?? 0n, USDC_DECIMALS)).toFixed(2);
          addLine({ message: `DEPOSIT ${amt} USDC to treasury`, color: 'green' });
        }
      },
    });

    const unwatchWithdrawn = publicClient.watchContractEvent({
      address: TREASURY_ADDRESS,
      abi: [EVENT_SIGNATURES.withdrawn],
      eventName: 'Withdrawn',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as { amount?: bigint };
          const amt = Number(formatUnits(args.amount ?? 0n, USDC_DECIMALS)).toFixed(2);
          addLine({ message: `WITHDRAW ${amt} USDC from treasury`, color: 'yellow' });
        }
      },
    });

    const unwatchAllowanceSet = publicClient.watchContractEvent({
      address: TREASURY_ADDRESS,
      abi: [EVENT_SIGNATURES.allowanceSet],
      eventName: 'AgentAllowanceSet',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as { agent?: string; maxAmount?: bigint };
          const amt = Number(formatUnits(args.maxAmount ?? 0n, USDC_DECIMALS)).toFixed(2);
          addLine({ message: `ALLOWANCE SET ${shortenAddr(args.agent ?? '')} max=${amt} USDC`, color: 'yellow' });
        }
      },
    });

    const unwatchRevoked = publicClient.watchContractEvent({
      address: TREASURY_ADDRESS,
      abi: [EVENT_SIGNATURES.allowanceRevoked],
      eventName: 'AgentAllowanceRevoked',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as { agent?: string };
          addLine({ message: `REVOKED agent=${shortenAddr(args.agent ?? '')}`, color: 'red' });
        }
      },
    });

    return () => {
      unwatchExecuted();
      unwatchDeposited();
      unwatchWithdrawn();
      unwatchAllowanceSet();
      unwatchRevoked();
    };
  }, [publicClient, addLine, addLines]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const colorMap = {
    green: 'text-green-400',
    yellow: 'text-amber-400',
    red: 'text-red-400',
    cyan: 'text-cyan-400',
  };

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">Terminal</span>
        <span className="ml-auto text-[10px] text-aegis-muted">{lines.length} lines</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-5"
        style={{ maxHeight: maxHeight ?? '320px' }}
      >
        {lines.map(line => (
          <div key={line.id} className="whitespace-nowrap">
            <span className="text-green-500">[{line.timestamp}]</span>{' '}
            <span className={colorMap[line.color]}>{line.message}</span>
          </div>
        ))}
        <div className="inline-block h-3.5 w-1.5 animate-pulse bg-green-400/80 align-middle" />
      </div>
    </div>
  );
}

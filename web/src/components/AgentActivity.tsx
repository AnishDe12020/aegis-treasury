"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { formatUnits, parseAbiItem } from "viem";
import { TREASURY_ADDRESS, USDC_DECIMALS } from "@/lib/contracts";

interface ActivityEvent {
  type: "executed" | "allowance_set" | "allowance_revoked" | "deposited" | "withdrawn";
  blockNumber: bigint;
  transactionHash: string;
  agent?: string;
  token?: string;
  target?: string;
  amount?: bigint;
  reason?: string;
  expiry?: bigint;
  timestamp?: number;
}

const EVENT_SIGNATURES = {
  executed: parseAbiItem(
    "event AgentExecuted(address indexed agent, address indexed token, address indexed target, uint256 amount, bytes data, string reason)"
  ),
  allowanceSet: parseAbiItem(
    "event AgentAllowanceSet(address indexed agent, address indexed token, uint256 maxAmount, uint256 expiry, address[] allowedTargets)"
  ),
  allowanceRevoked: parseAbiItem(
    "event AgentAllowanceRevoked(address indexed agent, address indexed token)"
  ),
  deposited: parseAbiItem(
    "event Deposited(address indexed token, uint256 amount)"
  ),
  withdrawn: parseAbiItem(
    "event Withdrawn(address indexed token, uint256 amount)"
  ),
};

const typeConfig = {
  executed: {
    label: "Transfer",
    color: "text-cyan-400",
    bg: "rgba(6,182,212,0.08)",
    borderColor: "rgba(6,182,212,0.15)",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  allowance_set: {
    label: "Allowance Set",
    color: "text-purple-400",
    bg: "rgba(139,92,246,0.08)",
    borderColor: "rgba(139,92,246,0.15)",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  allowance_revoked: {
    label: "Revoked",
    color: "text-red-400",
    bg: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.15)",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  deposited: {
    label: "Deposit",
    color: "text-emerald-400",
    bg: "rgba(52,211,153,0.08)",
    borderColor: "rgba(52,211,153,0.15)",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
  withdrawn: {
    label: "Withdrawal",
    color: "text-amber-400",
    bg: "rgba(245,158,11,0.08)",
    borderColor: "rgba(245,158,11,0.15)",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12M12 16.5V3" />
      </svg>
    ),
  },
};

export default function AgentActivity() {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!publicClient) return;

    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n;

        const [executedLogs, setLogs, revokedLogs, depositLogs, withdrawLogs] =
          await Promise.all([
            publicClient.getLogs({
              address: TREASURY_ADDRESS,
              event: EVENT_SIGNATURES.executed,
              fromBlock,
              toBlock: "latest",
            }),
            publicClient.getLogs({
              address: TREASURY_ADDRESS,
              event: EVENT_SIGNATURES.allowanceSet,
              fromBlock,
              toBlock: "latest",
            }),
            publicClient.getLogs({
              address: TREASURY_ADDRESS,
              event: EVENT_SIGNATURES.allowanceRevoked,
              fromBlock,
              toBlock: "latest",
            }),
            publicClient.getLogs({
              address: TREASURY_ADDRESS,
              event: EVENT_SIGNATURES.deposited,
              fromBlock,
              toBlock: "latest",
            }),
            publicClient.getLogs({
              address: TREASURY_ADDRESS,
              event: EVENT_SIGNATURES.withdrawn,
              fromBlock,
              toBlock: "latest",
            }),
          ]);

        const allEvents: ActivityEvent[] = [];

        for (const log of executedLogs) {
          allEvents.push({
            type: "executed",
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            agent: log.args.agent,
            token: log.args.token,
            target: log.args.target,
            amount: log.args.amount,
            reason: log.args.reason,
          });
        }

        for (const log of setLogs) {
          allEvents.push({
            type: "allowance_set",
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            agent: log.args.agent,
            token: log.args.token,
            amount: log.args.maxAmount,
            expiry: log.args.expiry,
          });
        }

        for (const log of revokedLogs) {
          allEvents.push({
            type: "allowance_revoked",
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            agent: log.args.agent,
            token: log.args.token,
          });
        }

        for (const log of depositLogs) {
          allEvents.push({
            type: "deposited",
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            token: log.args.token,
            amount: log.args.amount,
          });
        }

        for (const log of withdrawLogs) {
          allEvents.push({
            type: "withdrawn",
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            token: log.args.token,
            amount: log.args.amount,
          });
        }

        allEvents.sort((a, b) =>
          a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0
        );

        setEvents(allEvents.slice(0, 50));
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [publicClient]);

  const shortenAddr = (addr?: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  return (
    <div className="glass-card animate-fade-in-up-delay-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
            <svg
              className="h-5 w-5 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Activity Feed
            </h2>
            <p className="text-[11px] text-aegis-muted">
              Recent on-chain events
            </p>
          </div>
        </div>
        {events.length > 0 && (
          <span className="text-[11px] text-aegis-muted">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Event list */}
      <div className="mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative h-8 w-8">
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: "#3b82f6", borderRightColor: "rgba(59,130,246,0.3)" }}
              />
            </div>
            <span className="mt-3 text-xs text-aegis-muted">
              Loading events...
            </span>
          </div>
        ) : events.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-xl py-10"
            style={{
              background: "rgba(255,255,255,0.01)",
              border: "1px dashed rgba(255,255,255,0.06)",
            }}
          >
            <svg className="mb-3 h-8 w-8 text-aegis-muted/50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm text-aegis-muted">No events found</p>
            <p className="mt-1 text-[11px] text-aegis-text-dim">
              Activity will appear after transactions
            </p>
          </div>
        ) : (
          <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1" style={{ scrollbarGutter: "stable" }}>
            {events.map((event, i) => {
              const cfg = typeConfig[event.type];
              return (
                <div
                  key={`${event.transactionHash}-${i}`}
                  className="group rounded-xl p-3 transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.01)",
                    border: "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.01)";
                    (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Type badge */}
                    <span
                      className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}
                      style={{
                        background: cfg.bg,
                        border: `1px solid ${cfg.borderColor}`,
                      }}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>

                    {/* Details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        {event.agent && (
                          <span className="text-aegis-text-dim">
                            Agent{" "}
                            <code className="font-mono text-[11px] text-aegis-text">
                              {shortenAddr(event.agent)}
                            </code>
                          </span>
                        )}
                        {event.target && (
                          <span className="text-aegis-text-dim">
                            <span className="text-aegis-muted">&#8594;</span>{" "}
                            <code className="font-mono text-[11px] text-aegis-text">
                              {shortenAddr(event.target)}
                            </code>
                          </span>
                        )}
                        {event.amount !== undefined && (
                          <span className="font-mono font-semibold text-white">
                            {Number(formatUnits(event.amount, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                            <span className="text-aegis-text-dim font-sans font-normal">USDC</span>
                          </span>
                        )}
                      </div>

                      {event.reason && (
                        <p className="text-[11px] italic text-aegis-text-dim">
                          &ldquo;{event.reason}&rdquo;
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-aegis-muted">
                        <span className="font-mono">Block #{event.blockNumber.toString()}</span>
                        <a
                          href={`https://sepolia.basescan.org/tx/${event.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400/50 opacity-0 transition-all hover:text-blue-400 group-hover:opacity-100"
                        >
                          View tx &#8599;
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

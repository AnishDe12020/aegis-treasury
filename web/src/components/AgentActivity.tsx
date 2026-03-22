"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { formatUnits, type Log, parseAbiItem } from "viem";
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
        // Look back ~50k blocks (roughly 1 day on Base)
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

        // Sort by block number descending
        allEvents.sort((a, b) =>
          a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0
        );

        setEvents(allEvents.slice(0, 50)); // Show last 50 events
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [publicClient]);

  const typeConfig = {
    executed: {
      label: "Agent Transfer",
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
    },
    allowance_set: {
      label: "Allowance Set",
      color: "text-indigo-400",
      bg: "bg-indigo-400/10",
    },
    allowance_revoked: {
      label: "Allowance Revoked",
      color: "text-red-400",
      bg: "bg-red-400/10",
    },
    deposited: {
      label: "Deposit",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    withdrawn: {
      label: "Withdrawal",
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
  };

  const shortenAddr = (addr?: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
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
          <h2 className="text-lg font-semibold text-aegis-text">
            Activity Log
          </h2>
          <p className="text-xs text-aegis-muted">
            Recent treasury events from contract
          </p>
        </div>
      </div>

      {/* Event list */}
      <div className="mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-aegis-border border-t-aegis-accent" />
            <span className="ml-3 text-sm text-aegis-muted">
              Loading events...
            </span>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-aegis-border p-8 text-center">
            <p className="text-sm text-aegis-muted">No events found</p>
            <p className="mt-1 text-xs text-aegis-text-dim">
              Activity will appear here once transactions occur
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event, i) => {
              const cfg = typeConfig[event.type];
              return (
                <div
                  key={`${event.transactionHash}-${i}`}
                  className="group flex items-start gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-aegis-border hover:bg-aegis-bg/40"
                >
                  {/* Type badge */}
                  <span
                    className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}
                  >
                    {cfg.label}
                  </span>

                  {/* Details */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                      {event.agent && (
                        <span className="text-aegis-text-dim">
                          Agent:{" "}
                          <code className="mono text-aegis-text">
                            {shortenAddr(event.agent)}
                          </code>
                        </span>
                      )}
                      {event.target && (
                        <span className="text-aegis-text-dim">
                          To:{" "}
                          <code className="mono text-aegis-text">
                            {shortenAddr(event.target)}
                          </code>
                        </span>
                      )}
                      {event.amount !== undefined && (
                        <span className="font-medium text-white">
                          {formatUnits(event.amount, USDC_DECIMALS)} USDC
                        </span>
                      )}
                    </div>

                    {event.reason && (
                      <p className="text-xs italic text-aegis-text-dim">
                        &ldquo;{event.reason}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-aegis-muted">
                      <span>Block #{event.blockNumber.toString()}</span>
                      <a
                        href={`https://sepolia.basescan.org/tx/${event.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-aegis-accent opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                      >
                        View tx
                      </a>
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

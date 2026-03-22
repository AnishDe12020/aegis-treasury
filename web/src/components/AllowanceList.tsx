"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  TREASURY_ABI,
} from "@/lib/contracts";

interface AllowanceData {
  agent: `0x${string}`;
  maxAmount: bigint;
  spent: bigint;
  expiry: bigint;
  allowedTargets: readonly `0x${string}`[];
  active: boolean;
}

export default function AllowanceList() {
  const { address } = useAccount();
  const [allowances, setAllowances] = useState<AllowanceData[]>([]);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const { data: owner } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "owner",
  });

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase();

  const { data: agents, refetch: refetchAgents } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getAgents",
  });

  const agentList = (agents as `0x${string}`[]) ?? [];
  const { data: allowanceResults, refetch: refetchAllowances } =
    useReadContracts({
      contracts: agentList.map((agent) => ({
        address: TREASURY_ADDRESS,
        abi: TREASURY_ABI,
        functionName: "getAgentAllowance" as const,
        args: [agent, USDC_ADDRESS] as const,
      })),
      query: { enabled: agentList.length > 0 },
    });

  useEffect(() => {
    if (!allowanceResults || !agentList.length) {
      setAllowances([]);
      return;
    }

    const parsed: AllowanceData[] = [];
    for (let i = 0; i < agentList.length; i++) {
      const result = allowanceResults[i];
      if (result.status === "success" && result.result) {
        const [maxAmount, spent, expiry, allowedTargets, active] =
          result.result as [bigint, bigint, bigint, readonly `0x${string}`[], boolean];
        if (active) {
          parsed.push({
            agent: agentList[i],
            maxAmount,
            spent,
            expiry,
            allowedTargets,
            active,
          });
        }
      }
    }
    setAllowances(parsed);
  }, [allowanceResults, agents]);

  // Revoke
  const {
    writeContract: revoke,
    data: revokeTxHash,
    isPending: isRevoking,
  } = useWriteContract();

  const { isLoading: isRevokeConfirming, isSuccess: isRevokeSuccess } =
    useWaitForTransactionReceipt({ hash: revokeTxHash });

  useEffect(() => {
    if (isRevokeSuccess) {
      setConfirmRevoke(null);
      setTimeout(() => {
        refetchAgents();
        refetchAllowances();
      }, 2000);
    }
  }, [isRevokeSuccess, refetchAgents, refetchAllowances]);

  const handleRevoke = (agent: `0x${string}`) => {
    revoke({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: "revokeAgentAllowance",
      args: [agent, USDC_ADDRESS],
    });
  };

  const formatExpiry = (expiry: bigint) => {
    if (expiry === 0n) return { text: "No expiry", expired: false };
    const date = new Date(Number(expiry) * 1000);
    const now = new Date();
    const isExpired = date < now;
    const diff = date.getTime() - now.getTime();

    let timeLeft = "";
    if (!isExpired) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      if (days > 0) timeLeft = `${days}d ${hours}h left`;
      else {
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        timeLeft = hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
      }
    }

    return {
      text: isExpired
        ? "Expired"
        : timeLeft,
      fullDate: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      expired: isExpired,
    };
  };

  return (
    <div className="glass-card animate-fade-in-up-delay">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
            <svg
              className="h-5 w-5 text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Active Allowances
            </h2>
            <p className="text-[11px] text-aegis-muted">
              {allowances.length} active agent{allowances.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      {allowances.length === 0 ? (
        <div
          className="mt-5 flex flex-col items-center justify-center rounded-xl py-10"
          style={{
            background: "rgba(255,255,255,0.01)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          <svg className="mb-3 h-8 w-8 text-aegis-muted/50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <p className="text-sm text-aegis-muted">No active allowances</p>
          <p className="mt-1 text-[11px] text-aegis-text-dim">
            Create one to get started
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {allowances.map((a) => {
            const remaining = a.maxAmount - a.spent;
            const percentUsed =
              a.maxAmount > 0n
                ? Number((a.spent * 10000n) / a.maxAmount) / 100
                : 0;
            const expiryInfo = formatExpiry(a.expiry);
            const isConfirming = confirmRevoke === a.agent;

            return (
              <div
                key={a.agent}
                className="group rounded-xl p-4 transition-all duration-200 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)]"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-3">
                    {/* Agent address */}
                    <div className="flex items-center gap-2">
                      <span className="glow-dot bg-cyan-400 after:bg-cyan-400/30" />
                      <code className="truncate font-mono text-xs text-aegis-text">
                        {a.agent}
                      </code>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-aegis-muted">
                          Budget
                        </p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-white">
                          {Number(formatUnits(a.maxAmount, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-aegis-muted">
                          Spent
                        </p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-amber-400">
                          {Number(formatUnits(a.spent, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-aegis-muted">
                          Remaining
                        </p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-400">
                          {Number(formatUnits(remaining, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(percentUsed, 100)}%`,
                          background:
                            percentUsed > 80
                              ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                              : "linear-gradient(90deg, #3b82f6, #06b6d4)",
                          boxShadow:
                            percentUsed > 0
                              ? percentUsed > 80
                                ? "0 0 8px rgba(239,68,68,0.3)"
                                : "0 0 8px rgba(59,130,246,0.3)"
                              : "none",
                        }}
                      />
                    </div>

                    {/* Expiry & targets */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
                          expiryInfo.expired
                            ? "bg-red-500/10 text-red-400"
                            : "bg-blue-500/8 text-blue-400/80"
                        }`}
                        style={!expiryInfo.expired ? { background: "rgba(59,130,246,0.08)" } : undefined}
                        title={expiryInfo.fullDate}
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        {expiryInfo.text}
                      </span>
                      {a.allowedTargets.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-aegis-text-dim"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                          </svg>
                          {a.allowedTargets.length} target{a.allowedTargets.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-amber-400/70"
                          style={{ background: "rgba(245,158,11,0.06)" }}
                        >
                          Any target
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Revoke button */}
                  {isOwner && (
                    <div className="shrink-0">
                      {isConfirming ? (
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => handleRevoke(a.agent)}
                            disabled={isRevoking || isRevokeConfirming}
                            className="btn-danger text-[10px]"
                          >
                            {isRevoking || isRevokeConfirming ? (
                              <span className="flex items-center gap-1">
                                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Revoking...
                              </span>
                            ) : (
                              "Confirm"
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmRevoke(null)}
                            className="text-[10px] text-aegis-muted hover:text-aegis-text-dim"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRevoke(a.agent)}
                          className="btn-danger opacity-60 transition-opacity group-hover:opacity-100"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

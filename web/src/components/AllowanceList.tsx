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

  const { data: owner } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "owner",
  });

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase();

  // Get list of agents
  const { data: agents, refetch: refetchAgents } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getAgents",
  });

  // Build multicall to get all allowances
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
    if (expiry === 0n) return "No expiry";
    const date = new Date(Number(expiry) * 1000);
    const now = new Date();
    const isExpired = date < now;
    return (
      <span className={isExpired ? "text-red-400" : ""}>
        {isExpired ? "Expired " : ""}
        {date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    );
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
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
          <h2 className="text-lg font-semibold text-aegis-text">
            Active Allowances
          </h2>
          <p className="text-xs text-aegis-muted">
            {allowances.length} active agent{allowances.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Allowance list */}
      {allowances.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-aegis-border p-8 text-center">
          <p className="text-sm text-aegis-muted">No active allowances</p>
          <p className="mt-1 text-xs text-aegis-text-dim">
            Create an allowance above to get started
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

            return (
              <div
                key={a.agent}
                className="rounded-lg border border-aegis-border bg-aegis-bg/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Agent address */}
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                      <code className="mono truncate text-aegis-text">
                        {a.agent}
                      </code>
                    </div>

                    {/* Amounts */}
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-aegis-muted">Budget</span>
                        <p className="font-medium text-aegis-text">
                          {formatUnits(a.maxAmount, USDC_DECIMALS)} USDC
                        </p>
                      </div>
                      <div>
                        <span className="text-aegis-muted">Spent</span>
                        <p className="font-medium text-amber-400">
                          {formatUnits(a.spent, USDC_DECIMALS)} USDC
                        </p>
                      </div>
                      <div>
                        <span className="text-aegis-muted">Remaining</span>
                        <p className="font-medium text-emerald-400">
                          {formatUnits(remaining, USDC_DECIMALS)} USDC
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 overflow-hidden rounded-full bg-aegis-bg">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-aegis-accent to-cyan-400 transition-all"
                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                      />
                    </div>

                    {/* Expiry & targets */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-aegis-text-dim">
                      <span>Expiry: {formatExpiry(a.expiry)}</span>
                      {a.allowedTargets.length > 0 && (
                        <span>
                          Targets: {a.allowedTargets.length} address
                          {a.allowedTargets.length > 1 ? "es" : ""}
                        </span>
                      )}
                      {a.allowedTargets.length === 0 && (
                        <span className="text-amber-400/70">
                          Any target allowed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Revoke button */}
                  {isOwner && (
                    <button
                      onClick={() => handleRevoke(a.agent)}
                      disabled={isRevoking || isRevokeConfirming}
                      className="btn-danger shrink-0"
                    >
                      {isRevoking || isRevokeConfirming
                        ? "Revoking..."
                        : "Revoke"}
                    </button>
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

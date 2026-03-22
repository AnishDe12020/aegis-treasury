"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  TREASURY_ABI,
} from "@/lib/contracts";

export default function CreateAllowance() {
  const { address } = useAccount();
  const [agentAddress, setAgentAddress] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [expiry, setExpiry] = useState("");
  const [targetsInput, setTargetsInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: owner } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "owner",
  });

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase();

  const {
    writeContract,
    data: txHash,
    isPending,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentAddress || !maxAmount) return;

    const amount = parseUnits(maxAmount, USDC_DECIMALS);
    const expiryTimestamp = expiry
      ? BigInt(Math.floor(new Date(expiry).getTime() / 1000))
      : 0n;

    const allowedTargets = targetsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.startsWith("0x") && t.length === 42) as `0x${string}`[];

    writeContract({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: "setAgentAllowance",
      args: [
        agentAddress as `0x${string}`,
        USDC_ADDRESS,
        amount,
        expiryTimestamp,
        allowedTargets,
      ],
    });
  };

  const handleReset = () => {
    setAgentAddress("");
    setMaxAmount("");
    setExpiry("");
    setTargetsInput("");
    reset();
  };

  if (!isOwner) return null;

  return (
    <div className="card">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <svg
              className="h-5 w-5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-aegis-text">
              Create Agent Allowance
            </h2>
            <p className="text-xs text-aegis-muted">
              Grant scoped spending permission to an agent
            </p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-aegis-muted transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {/* Form */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Agent Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={agentAddress}
              onChange={(e) => setAgentAddress(e.target.value)}
              className="mono"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Max Amount (USDC)</label>
              <input
                type="number"
                placeholder="100.00"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="label">Expiry (optional)</label>
              <input
                type="datetime-local"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">
              Allowed Targets (optional, comma-separated)
            </label>
            <input
              type="text"
              placeholder="0xabc..., 0xdef..."
              value={targetsInput}
              onChange={(e) => setTargetsInput(e.target.value)}
              className="mono"
            />
            <p className="mt-1 text-xs text-aegis-muted">
              Leave empty to allow transfers to any address
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={
                !agentAddress || !maxAmount || isPending || isConfirming
              }
              className="btn-primary"
            >
              {isPending
                ? "Confirm in Wallet..."
                : isConfirming
                  ? "Creating..."
                  : "Create Allowance"}
            </button>

            {isSuccess && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-emerald-400">
                  Allowance created!
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-aegis-accent hover:underline"
                >
                  Create another
                </button>
              </div>
            )}
          </div>

          {txHash && (
            <p className="text-xs text-aegis-text-dim">
              Tx:{" "}
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-aegis-accent hover:underline"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </a>
            </p>
          )}
        </form>
      )}
    </div>
  );
}

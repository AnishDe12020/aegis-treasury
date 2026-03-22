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
    <div className="glass-card animate-fade-in-up-delay">
      {/* Header toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300"
            style={{
              background: isExpanded
                ? "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(59,130,246,0.2) 100%)"
                : "rgba(139,92,246,0.1)",
            }}
          >
            <svg
              className={`h-5 w-5 text-purple-400 transition-transform duration-300 ${isExpanded ? "rotate-45" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
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
            <h2 className="text-base font-semibold text-white">
              Create Agent Allowance
            </h2>
            <p className="text-[11px] text-aegis-muted">
              Grant scoped spending permission
            </p>
          </div>
        </div>
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-300 ${
            isExpanded
              ? "bg-purple-500/10 text-purple-400"
              : "text-aegis-muted"
          }`}
        >
          <svg
            className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>
      </button>

      {/* Form */}
      <div
        className={`grid transition-all duration-300 ${
          isExpanded ? "mt-6 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Agent Address */}
            <div>
              <label className="label">Agent Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={agentAddress}
                onChange={(e) => setAgentAddress(e.target.value)}
                className="font-mono text-sm"
                required
              />
            </div>

            {/* Amount & Expiry */}
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

            {/* Allowed Targets */}
            <div>
              <label className="label">
                Allowed Targets (optional)
              </label>
              <input
                type="text"
                placeholder="0xabc..., 0xdef..."
                value={targetsInput}
                onChange={(e) => setTargetsInput(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="mt-1.5 text-[11px] text-aegis-muted">
                Comma-separated addresses. Leave empty for unrestricted transfers.
              </p>
            </div>

            {/* Submit */}
            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={!agentAddress || !maxAmount || isPending || isConfirming}
                className="btn-primary"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Confirm in Wallet...
                  </span>
                ) : isConfirming ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  "Create Allowance"
                )}
              </button>

              {isSuccess && (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Created
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-blue-400/70 transition-colors hover:text-blue-400"
                  >
                    Create another
                  </button>
                </div>
              )}
            </div>

            {/* Tx link */}
            {txHash && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <svg className="h-3.5 w-3.5 text-aegis-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
                <span className="text-aegis-muted">Tx:</span>
                <a
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-blue-400/70 hover:text-blue-400"
                >
                  {txHash.slice(0, 10)}...{txHash.slice(-8)} &#8599;
                </a>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

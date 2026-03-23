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
  const [showDelegationDetails, setShowDelegationDetails] = useState(false);

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

            {/* Delegation Details (collapsible) */}
            <div
              className="rounded-lg overflow-hidden"
              style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.1)" }}
            >
              <button
                type="button"
                onClick={() => setShowDelegationDetails(!showDelegationDetails)}
                className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-medium text-purple-300 hover:bg-[rgba(139,92,246,0.06)] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                  Delegation Details
                </span>
                <svg
                  className={`h-3 w-3 transition-transform duration-200 ${showDelegationDetails ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showDelegationDetails && (
                <div className="px-3 pb-3 space-y-2.5 text-[10px]">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-aegis-muted">Smart Account</span>
                      <code className="font-mono text-[9px] text-blue-400/80">
                        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-aegis-muted">DelegationManager</span>
                      <code className="font-mono text-[9px] text-blue-400/80">0xdb9B...7dB3</code>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-aegis-text-dim">Caveat Enforcers</span>
                    <div className="rounded-md px-2 py-1.5 space-y-1" style={{ background: "rgba(0,0,0,0.2)" }}>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-purple-400" />
                        <span className="text-aegis-text-dim">
                          <span className="text-white font-medium">ERC20TransferAmount</span>
                          {maxAmount ? ` — max ${maxAmount} USDC` : ' — max amount TBD'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-purple-400" />
                        <span className="text-aegis-text-dim">
                          <span className="text-white font-medium">AllowedTargets</span>
                          {targetsInput ? ` — ${targetsInput.split(',').filter(t => t.trim()).length} target(s)` : ' — unrestricted'}
                        </span>
                      </div>
                      {expiry && (
                        <div className="flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-purple-400" />
                          <span className="text-aegis-text-dim">
                            <span className="text-white font-medium">TimestampExpiry</span> — {new Date(expiry).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-aegis-text-dim">EIP-712 Typed Data Preview</span>
                    <pre
                      className="rounded-md px-2 py-1.5 font-mono text-[9px] text-aegis-text-dim overflow-x-auto"
                      style={{ background: "rgba(0,0,0,0.2)" }}
                    >
{`{
  "types": {
    "Delegation": [
      { "name": "delegate", "type": "address" },
      { "name": "delegator", "type": "address" },
      { "name": "authority", "type": "bytes32" },
      { "name": "caveats", "type": "Caveat[]" }
    ]
  },
  "domain": {
    "name": "DelegationManager",
    "version": "1",
    "chainId": 84532,
    "verifyingContract": "0xdb9B...7dB3"
  }
}`}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Badge */}
            <div className="flex items-center pt-1">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold text-purple-300"
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.15)" }}
              >
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
                Uses MetaMask Delegation Framework
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

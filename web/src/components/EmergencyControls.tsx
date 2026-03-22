"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  TREASURY_ABI,
} from "@/lib/contracts";

export default function EmergencyControls() {
  const { address } = useAccount();
  const [confirmAction, setConfirmAction] = useState<
    "emergencyWithdraw" | "revokeAll" | null
  >(null);

  // Read owner
  const { data: owner } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "owner",
  });

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase();

  // Read paused state
  const { data: isPaused, refetch: refetchPaused } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "paused",
  });

  // Pause / Unpause
  const {
    writeContract: writePause,
    data: pauseTxHash,
    isPending: isPausePending,
  } = useWriteContract();

  const { isLoading: isPauseConfirming, isSuccess: isPauseSuccess } =
    useWaitForTransactionReceipt({ hash: pauseTxHash });

  useEffect(() => {
    if (isPauseSuccess) {
      setTimeout(() => refetchPaused(), 2000);
    }
  }, [isPauseSuccess, refetchPaused]);

  const handleTogglePause = () => {
    writePause({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: isPaused ? "unpause" : "pause",
    });
  };

  // Emergency Withdraw
  const {
    writeContract: writeEmergency,
    data: emergencyTxHash,
    isPending: isEmergencyPending,
  } = useWriteContract();

  const { isLoading: isEmergencyConfirming, isSuccess: isEmergencySuccess } =
    useWaitForTransactionReceipt({ hash: emergencyTxHash });

  useEffect(() => {
    if (isEmergencySuccess) {
      setConfirmAction(null);
    }
  }, [isEmergencySuccess]);

  const handleEmergencyWithdraw = () => {
    writeEmergency({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: "emergencyWithdraw",
      args: [USDC_ADDRESS],
    });
  };

  // Revoke All Agents
  const {
    writeContract: writeRevokeAll,
    data: revokeAllTxHash,
    isPending: isRevokeAllPending,
  } = useWriteContract();

  const { isLoading: isRevokeAllConfirming, isSuccess: isRevokeAllSuccess } =
    useWaitForTransactionReceipt({ hash: revokeAllTxHash });

  useEffect(() => {
    if (isRevokeAllSuccess) {
      setConfirmAction(null);
    }
  }, [isRevokeAllSuccess]);

  const handleRevokeAll = () => {
    writeRevokeAll({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: "revokeAllAgents",
      args: [USDC_ADDRESS],
    });
  };

  const pauseBusy = isPausePending || isPauseConfirming;
  const emergencyBusy = isEmergencyPending || isEmergencyConfirming;
  const revokeAllBusy = isRevokeAllPending || isRevokeAllConfirming;

  return (
    <div className="glass-card animate-fade-in-up-delay-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(245,158,11,0.15) 100%)",
            }}
          >
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Emergency Controls
            </h2>
            <p className="text-[11px] text-aegis-muted">
              Circuit breakers &amp; safety actions
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isPaused
                ? "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            }`}
          />
          <span
            className={`text-xs font-medium ${
              isPaused ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {isPaused ? "Paused" : "Active"}
          </span>
        </div>
      </div>

      {/* Status banner */}
      <div
        className="mt-5 rounded-xl p-4"
        style={{
          background: isPaused
            ? "linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(245,158,11,0.04) 100%)"
            : "linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(59,130,246,0.04) 100%)",
          border: isPaused
            ? "1px solid rgba(239,68,68,0.1)"
            : "1px solid rgba(52,211,153,0.1)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              isPaused ? "bg-red-500/10" : "bg-emerald-500/10"
            }`}
          >
            {isPaused ? (
              <svg
                className="h-4 w-4 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 5.25v13.5m-7.5-13.5v13.5"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {isPaused
                ? "Treasury is paused"
                : "Treasury is operating normally"}
            </p>
            <p className="text-[11px] text-aegis-text-dim">
              {isPaused
                ? "All agent transfers are blocked"
                : "Agents can execute transfers within their allowances"}
            </p>
          </div>
        </div>
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div className="mt-5 space-y-3">
          {/* Pause / Unpause */}
          <button
            onClick={handleTogglePause}
            disabled={pauseBusy}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
              isPaused
                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/30"
                : "border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/30"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {pauseBusy ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {isPauseConfirming ? "Confirming..." : "Confirm in Wallet..."}
              </span>
            ) : isPaused ? (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                  />
                </svg>
                Unpause Treasury
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 5.25v13.5m-7.5-13.5v13.5"
                  />
                </svg>
                Pause Treasury
              </>
            )}
          </button>

          {/* Emergency Withdraw */}
          <div>
            {confirmAction === "emergencyWithdraw" ? (
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.15)",
                }}
              >
                <p className="mb-3 text-sm font-medium text-red-300">
                  Confirm Emergency Withdraw?
                </p>
                <p className="mb-4 text-[11px] text-aegis-text-dim">
                  This will withdraw all USDC from the treasury back to the
                  owner wallet. This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleEmergencyWithdraw}
                    disabled={emergencyBusy}
                    className="btn-danger flex-1 py-2.5"
                  >
                    {emergencyBusy ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="h-3.5 w-3.5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Withdrawing...
                      </span>
                    ) : (
                      "Yes, Withdraw All"
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="btn-ghost flex-1 py-2.5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction("emergencyWithdraw")}
                className="btn-danger w-full py-3 text-sm"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                    />
                  </svg>
                  Emergency Withdraw
                </span>
              </button>
            )}
          </div>

          {/* Revoke All Agents */}
          <div>
            {confirmAction === "revokeAll" ? (
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.15)",
                }}
              >
                <p className="mb-3 text-sm font-medium text-red-300">
                  Confirm Revoke All Agents?
                </p>
                <p className="mb-4 text-[11px] text-aegis-text-dim">
                  This will revoke all agent USDC allowances immediately. Agents
                  will no longer be able to execute any transfers.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRevokeAll}
                    disabled={revokeAllBusy}
                    className="btn-danger flex-1 py-2.5"
                  >
                    {revokeAllBusy ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="h-3.5 w-3.5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Revoking...
                      </span>
                    ) : (
                      "Yes, Revoke All"
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="btn-ghost flex-1 py-2.5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction("revokeAll")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-aegis-border px-4 py-3 text-sm font-semibold text-aegis-text-dim transition-all duration-200 hover:border-red-500/20 hover:bg-red-500/5 hover:text-red-300"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                Revoke All Agents
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

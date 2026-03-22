"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  TREASURY_ABI,
  ERC20_ABI,
} from "@/lib/contracts";

export default function Treasury() {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Read treasury USDC balance
  const { data: treasuryBalance, refetch: refetchBalance } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "deposits",
    args: [USDC_ADDRESS],
  });

  // Read user's USDC balance
  const { data: userBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read current allowance of treasury to spend user's USDC
  const { data: currentAllowance, refetch: refetchAllowance } =
    useReadContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: address ? [address, TREASURY_ADDRESS] : undefined,
      query: { enabled: !!address },
    });

  // Read treasury owner
  const { data: owner } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "owner",
  });

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase();

  // Approve USDC
  const {
    writeContract: approve,
    data: approveTxHash,
    isPending: isApproving,
  } = useWriteContract();

  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // Deposit
  const {
    writeContract: deposit,
    data: depositTxHash,
    isPending: isDepositing,
  } = useWriteContract();

  const { isLoading: isDepositConfirming } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  });

  // Withdraw
  const {
    writeContract: withdraw,
    data: withdrawTxHash,
    isPending: isWithdrawing,
  } = useWriteContract();

  const { isLoading: isWithdrawConfirming } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
  });

  const handleDeposit = async () => {
    if (!depositAmount || !address) return;
    const amount = parseUnits(depositAmount, USDC_DECIMALS);

    // Check if we need to approve first
    if (!currentAllowance || currentAllowance < amount) {
      approve(
        {
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [TREASURY_ADDRESS, amount],
        },
        {
          onSuccess: () => {
            // After approval, do the deposit
            setTimeout(() => {
              refetchAllowance();
              deposit(
                {
                  address: TREASURY_ADDRESS,
                  abi: TREASURY_ABI,
                  functionName: "deposit",
                  args: [USDC_ADDRESS, amount],
                },
                {
                  onSuccess: () => {
                    setDepositAmount("");
                    setTimeout(() => refetchBalance(), 2000);
                  },
                }
              );
            }, 2000);
          },
        }
      );
    } else {
      deposit(
        {
          address: TREASURY_ADDRESS,
          abi: TREASURY_ABI,
          functionName: "deposit",
          args: [USDC_ADDRESS, amount],
        },
        {
          onSuccess: () => {
            setDepositAmount("");
            setTimeout(() => refetchBalance(), 2000);
          },
        }
      );
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    const amount = parseUnits(withdrawAmount, USDC_DECIMALS);
    withdraw(
      {
        address: TREASURY_ADDRESS,
        abi: TREASURY_ABI,
        functionName: "withdraw",
        args: [USDC_ADDRESS, amount],
      },
      {
        onSuccess: () => {
          setWithdrawAmount("");
          setTimeout(() => refetchBalance(), 2000);
        },
      }
    );
  };

  const formattedTreasuryBalance = treasuryBalance
    ? formatUnits(treasuryBalance, USDC_DECIMALS)
    : "0";

  const formattedUserBalance = userBalance
    ? formatUnits(userBalance, USDC_DECIMALS)
    : "0";

  return (
    <div className="card space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aegis-accent/10">
            <svg
              className="h-5 w-5 text-aegis-accent"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-aegis-text">Treasury</h2>
            <p className="text-xs text-aegis-muted">USDC on Base Sepolia</p>
          </div>
        </div>
        {isOwner && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            Owner
          </span>
        )}
      </div>

      {/* Balance display */}
      <div className="rounded-lg bg-aegis-bg/60 p-4">
        <p className="label">Treasury Balance</p>
        <p className="text-3xl font-bold tracking-tight text-white">
          {Number(formattedTreasuryBalance).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          <span className="ml-2 text-base font-medium text-aegis-muted">
            USDC
          </span>
        </p>
        {isConnected && (
          <p className="mt-2 text-xs text-aegis-text-dim">
            Your wallet:{" "}
            {Number(formattedUserBalance).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USDC
          </p>
        )}
      </div>

      {/* Deposit / Withdraw */}
      {isConnected && isOwner && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="label">Deposit USDC</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                min="0"
                step="0.01"
              />
              <button
                onClick={handleDeposit}
                disabled={
                  !depositAmount ||
                  isApproving ||
                  isApproveConfirming ||
                  isDepositing ||
                  isDepositConfirming
                }
                className="btn-primary shrink-0"
              >
                {isApproving || isApproveConfirming
                  ? "Approving..."
                  : isDepositing || isDepositConfirming
                    ? "Depositing..."
                    : "Deposit"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="label">Withdraw USDC</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="0"
                step="0.01"
              />
              <button
                onClick={handleWithdraw}
                disabled={
                  !withdrawAmount || isWithdrawing || isWithdrawConfirming
                }
                className="btn-ghost shrink-0"
              >
                {isWithdrawing || isWithdrawConfirming
                  ? "Withdrawing..."
                  : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract address */}
      <div className="flex items-center gap-2 border-t border-aegis-border pt-4 text-xs text-aegis-muted">
        <span>Contract:</span>
        <code className="mono text-aegis-text-dim">
          {TREASURY_ADDRESS.slice(0, 6)}...{TREASURY_ADDRESS.slice(-4)}
        </code>
        <a
          href={`https://sepolia.basescan.org/address/${TREASURY_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-aegis-accent transition-colors hover:text-aegis-accent-hover"
        >
          View on BaseScan
        </a>
      </div>
    </div>
  );
}

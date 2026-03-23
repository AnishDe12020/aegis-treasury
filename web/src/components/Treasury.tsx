"use client";

import { useState, useEffect } from "react";
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
  MOCK_USDC_ABI,
} from "@/lib/contracts";

function MintButton({ address, refetchBalance }: { address: `0x${string}`; refetchBalance: () => void }) {
  const { writeContract: mint, data: mintTxHash, isPending: isMinting } = useWriteContract();
  const { isLoading: isMintConfirming, isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({ hash: mintTxHash });

  useEffect(() => {
    if (isMintConfirmed) {
      setTimeout(refetchBalance, 2000);
    }
  }, [isMintConfirmed, refetchBalance]);

  const handleMint = () => {
    mint({
      address: USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: "mint",
      args: [address, parseUnits("1000", USDC_DECIMALS)],
    });
  };

  return (
    <button
      onClick={handleMint}
      disabled={isMinting || isMintConfirming}
      className="w-full rounded-xl py-2.5 text-sm font-medium transition-all duration-200"
      style={{
        background: "linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(59,130,246,0.12) 100%)",
        border: "1px solid rgba(52,211,153,0.2)",
        color: isMintConfirmed ? "#22c55e" : "#5eead4",
      }}
    >
      {isMinting ? "Minting..." : isMintConfirming ? "Confirming..." : isMintConfirmed ? "✓ 1,000 USDC Minted!" : "🪙 Mint 1,000 Test USDC"}
    </button>
  );
}

export default function Treasury() {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Read treasury USDC balance
  const { data: treasuryBalance, refetch: refetchBalance, isFetched: isBalanceFetched } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "deposits",
    args: [USDC_ADDRESS],
  });

  // Read user's USDC balance
  const { data: userBalance, refetch: refetchUserBalance } = useReadContract({
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

  useEffect(() => {
    if (isBalanceFetched) setIsInitialLoad(false);
  }, [isBalanceFetched]);

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
                    setTimeout(() => { refetchBalance(); refetchUserBalance(); }, 2000);
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
            setTimeout(() => { refetchBalance(); refetchUserBalance(); }, 2000);
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
          setTimeout(() => { refetchBalance(); refetchUserBalance(); }, 2000);
        },
      }
    );
  };

  const formattedTreasuryBalance = treasuryBalance
    ? Number(formatUnits(treasuryBalance, USDC_DECIMALS)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

  const rawTreasuryBalance = treasuryBalance
    ? formatUnits(treasuryBalance, USDC_DECIMALS)
    : "0";

  const formattedUserBalance = userBalance
    ? Number(formatUnits(userBalance, USDC_DECIMALS)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

  const rawUserBalance = userBalance
    ? formatUnits(userBalance, USDC_DECIMALS)
    : "0";

  const isDepositBusy =
    isApproving || isApproveConfirming || isDepositing || isDepositConfirming;
  const isWithdrawBusy = isWithdrawing || isWithdrawConfirming;

  return (
    <div className="glass-card-glow animate-fade-in-up space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.15) 100%)",
            }}
          >
            <svg
              className="h-5 w-5 text-blue-400"
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
            <h2 className="text-base font-semibold text-white">Treasury</h2>
            <p className="text-[11px] text-aegis-muted">USDC on Base Sepolia</p>
          </div>
        </div>
        {isOwner && (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400"
            style={{
              background: "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.15)",
            }}
          >
            Owner
          </span>
        )}
      </div>

      {/* Balance */}
      {isInitialLoad ? (
        <div
          className="rounded-xl p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.04) 100%)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="skeleton mb-3 h-3 w-28" />
          <div className="skeleton mb-2 h-8 w-40" />
          <div className="skeleton h-4 w-48" />
        </div>
      ) : (
        <div
          className="rounded-xl p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.04) 100%)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-aegis-muted">
            Treasury Balance
          </p>
          <p className="stat-number">
            {formattedTreasuryBalance}
            <span className="ml-2 text-sm font-medium text-aegis-text-dim">
              USDC
            </span>
          </p>
          {isConnected && (
            <div className="mt-3 flex items-center gap-2 text-xs text-aegis-text-dim">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
              </svg>
              <span>
                Your wallet:{" "}
                <span className="font-medium text-aegis-text">
                  {formattedUserBalance}{" "}
                  USDC
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mint Test USDC */}
      {isConnected && (
        <MintButton address={address!} refetchBalance={() => { refetchBalance(); refetchUserBalance(); }} />
      )}

      {/* Deposit / Withdraw tabs */}
      {isConnected && (
        <div className="space-y-4">
          {/* Tab switcher */}
          <div
            className="flex rounded-xl p-1"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <button
              onClick={() => setActiveTab("deposit")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === "deposit"
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-sm"
                  : "text-aegis-text-dim hover:text-aegis-text"
              }`}
            >
              Deposit
            </button>
            <button
              onClick={() => setActiveTab("withdraw")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === "withdraw"
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-sm"
                  : "text-aegis-text-dim hover:text-aegis-text"
              }`}
            >
              Withdraw
            </button>
          </div>

          {/* Deposit */}
          {activeTab === "deposit" && (
            <div className="space-y-3">
              <label className="label">Amount (USDC)</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    className="pr-16"
                  />
                  <button
                    onClick={() => setDepositAmount(rawUserBalance)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400 transition-colors hover:bg-blue-500/10"
                  >
                    Max
                  </button>
                </div>
                <button
                  onClick={handleDeposit}
                  disabled={!depositAmount || isDepositBusy}
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
          )}

          {/* Withdraw */}
          {activeTab === "withdraw" && (
            <div className="space-y-3">
              <label className="label">Amount (USDC)</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    className="pr-16"
                  />
                  <button
                    onClick={() => setWithdrawAmount(rawTreasuryBalance)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400 transition-colors hover:bg-blue-500/10"
                  >
                    Max
                  </button>
                </div>
                <button
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || isWithdrawBusy}
                  className="btn-ghost shrink-0"
                >
                  {isWithdrawBusy ? "Withdrawing..." : "Withdraw"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent Permissions (MetaMask Delegation Framework) */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(59,130,246,0.04) 100%)",
          border: "1px solid rgba(139,92,246,0.1)",
        }}
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          <h3 className="text-xs font-semibold text-white">Agent Permissions (MetaMask Delegation Framework)</h3>
        </div>
        <p className="text-[11px] text-aegis-text-dim leading-relaxed">
          Allowances are managed via scoped delegations. Each agent receives a cryptographic delegation
          signed with EIP-712 typed data, enforced by on-chain caveat enforcers.
        </p>
        <div className="space-y-1.5 text-[10px]">
          <div className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">&#x2022;</span>
            <span className="text-aegis-text-dim">
              Creates a scoped delegation with <span className="text-white font-medium">EIP-712 signing</span>
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">&#x2022;</span>
            <span className="text-aegis-text-dim">
              DelegationManager: <code className="font-mono text-[9px] text-blue-400/80">0xdb9B...7dB3</code>
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">&#x2022;</span>
            <span className="text-aegis-text-dim">
              Caveats: <span className="text-white font-medium">ERC20TransferAmount</span> (max X USDC) + <span className="text-white font-medium">AllowedTargets</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold text-purple-300"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            Powered by MetaMask Delegation Framework
          </span>
        </div>
      </div>

      {/* Contract address */}
      <a
        href={`https://sepolia.basescan.org/address/${TREASURY_ADDRESS}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs text-aegis-muted transition-all duration-200 hover:border-blue-500/20"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid transparent" }}
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
        <code className="font-mono text-[11px] text-aegis-text-dim transition-colors group-hover:text-blue-400">
          {TREASURY_ADDRESS.slice(0, 6)}...{TREASURY_ADDRESS.slice(-4)}
        </code>
        <span className="ml-auto text-blue-400/70 transition-colors hover:text-blue-400">
          View on BaseScan &#8599;
        </span>
      </a>
    </div>
  );
}

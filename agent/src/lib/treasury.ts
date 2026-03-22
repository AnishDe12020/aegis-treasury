import { type PublicClient, type WalletClient, type Address, getContract } from 'viem';
import type { AllowanceInfo } from './types.js';

export const AEGIS_TREASURY_ABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'agentTransfer',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getRemainingAllowance',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentAllowance',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [
      { name: 'maxAmount', type: 'uint256' },
      { name: 'spent', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'allowedTargets', type: 'address[]' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deposits',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgents',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setAgentAllowance',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'maxAmount', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'allowedTargets', type: 'address[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeAgentAllowance',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ─── Read Functions ───────────────────────────────────────────────

export async function getDeposits(
  publicClient: PublicClient,
  treasuryAddress: Address,
  token: Address
): Promise<bigint> {
  return publicClient.readContract({
    address: treasuryAddress,
    abi: AEGIS_TREASURY_ABI,
    functionName: 'deposits',
    args: [token],
  });
}

export async function getRemainingAllowance(
  publicClient: PublicClient,
  treasuryAddress: Address,
  agent: Address,
  token: Address
): Promise<bigint> {
  return publicClient.readContract({
    address: treasuryAddress,
    abi: AEGIS_TREASURY_ABI,
    functionName: 'getRemainingAllowance',
    args: [agent, token],
  });
}

export async function getAgentAllowance(
  publicClient: PublicClient,
  treasuryAddress: Address,
  agent: Address,
  token: Address
): Promise<AllowanceInfo> {
  const [maxAmount, spent, expiry, allowedTargets, active] = await publicClient.readContract({
    address: treasuryAddress,
    abi: AEGIS_TREASURY_ABI,
    functionName: 'getAgentAllowance',
    args: [agent, token],
  });

  return { maxAmount, spent, expiry, allowedTargets, active };
}

export async function getAgents(
  publicClient: PublicClient,
  treasuryAddress: Address
): Promise<readonly Address[]> {
  return publicClient.readContract({
    address: treasuryAddress,
    abi: AEGIS_TREASURY_ABI,
    functionName: 'getAgents',
  });
}

export async function getAgentCount(
  publicClient: PublicClient,
  treasuryAddress: Address
): Promise<bigint> {
  return publicClient.readContract({
    address: treasuryAddress,
    abi: AEGIS_TREASURY_ABI,
    functionName: 'getAgentCount',
  });
}

// ─── Write Functions ──────────────────────────────────────────────

export async function agentTransfer(
  walletClient: WalletClient,
  treasuryAddress: Address,
  token: Address,
  to: Address,
  amount: bigint,
  reason: string
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: treasuryAddress,
    abi: AEGIS_TREASURY_ABI,
    functionName: 'agentTransfer',
    args: [token, to, amount, reason],
  });
}

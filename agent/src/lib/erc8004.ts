/**
 * ERC-8004 Agent Identity Integration
 *
 * Implements the ERC-8004 / Protocol Labs agent identity standard for the
 * Aegis agent. Provides the Identity Registry ABI, typed manifest and
 * execution-log structures, and helper functions that produce spec-compliant
 * agent.json and agent_log.json objects.
 */

import { type Address } from 'viem';

// ─── Types ───────────────────────────────────────────────────────────

export interface AgentCapability {
  name: string;
  description: string;
  version: string;
}

export interface AgentProtocol {
  name: string;
  version: string;
  network: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  url: string;
}

/** ERC-8004 agent.json manifest. */
export interface AgentManifest {
  name: string;
  description: string;
  version: string;
  capabilities: AgentCapability[];
  protocols: AgentProtocol[];
  serviceEndpoints: ServiceEndpoint[];
}

/** A single action entry for the execution log. */
export interface ActionEntry {
  action: 'analyze' | 'transfer' | 'swap' | 'delegate';
  params: Record<string, unknown>;
  result: {
    txHash?: `0x${string}`;
    amounts?: Record<string, string>;
    [key: string]: unknown;
  };
  reasoning: string;
}

/** A timestamped log entry persisted in the execution log. */
export interface ExecutionLogEntry {
  timestamp: string;
  action: ActionEntry['action'];
  params: Record<string, unknown>;
  result: ActionEntry['result'];
  reasoning: string;
}

/** ERC-8004 agent_log.json execution log. */
export interface ExecutionLog {
  agentId: string;
  entries: ExecutionLogEntry[];
}

// ─── ERC-8004 Identity Registry ABI ──────────────────────────────────

export const ERC8004_IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAgentURI',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newURI', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
      { name: 'metadataValue', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ─── Loose client types (match project convention) ───────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PC = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WC = any;

// ─── Registry helpers ────────────────────────────────────────────────

export async function registerAgent(
  walletClient: WC,
  registryAddress: Address,
  agentURI: string,
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: registryAddress,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI],
  });
}

export async function setAgentURI(
  walletClient: WC,
  registryAddress: Address,
  agentId: bigint,
  newURI: string,
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: registryAddress,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'setAgentURI',
    args: [agentId, newURI],
  });
}

export async function getMetadata(
  publicClient: PC,
  registryAddress: Address,
  agentId: bigint,
  metadataKey: string,
): Promise<`0x${string}`> {
  return publicClient.readContract({
    address: registryAddress,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'getMetadata',
    args: [agentId, metadataKey],
  });
}

export async function setMetadata(
  walletClient: WC,
  registryAddress: Address,
  agentId: bigint,
  metadataKey: string,
  metadataValue: `0x${string}`,
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: registryAddress,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'setMetadata',
    args: [agentId, metadataKey, metadataValue],
  });
}

// ─── Manifest generation ─────────────────────────────────────────────

const AEGIS_VERSION = '1.0.0';

/**
 * Generates an ERC-8004-compliant agent.json manifest for the Aegis agent.
 */
export function generateAgentManifest(): AgentManifest {
  return {
    name: 'Aegis',
    description:
      'Autonomous treasury management agent with DCA, momentum trading, and portfolio rebalancing capabilities.',
    version: AEGIS_VERSION,
    capabilities: [
      {
        name: 'treasury-management',
        description: 'Manage on-chain treasury deposits, allowances, and agent transfers.',
        version: AEGIS_VERSION,
      },
      {
        name: 'dca',
        description: 'Dollar-cost averaging strategy that splits large orders into smaller chunks over time.',
        version: AEGIS_VERSION,
      },
      {
        name: 'momentum-trading',
        description: 'Momentum-based trade sizing that analyzes on-chain price trends and liquidity.',
        version: AEGIS_VERSION,
      },
      {
        name: 'rebalancing',
        description: 'Portfolio rebalancing toward configurable target weight allocations.',
        version: AEGIS_VERSION,
      },
    ],
    protocols: [
      {
        name: 'Uniswap V3',
        version: '3.0.0',
        network: 'base-sepolia',
      },
      {
        name: 'MetaMask Delegation',
        version: '1.0.0',
        network: 'base-sepolia',
      },
    ],
    serviceEndpoints: [
      {
        id: 'venice-ai',
        type: 'AI Inference',
        url: 'https://api.venice.ai/api/v1',
      },
    ],
  };
}

// ─── Execution log generation ────────────────────────────────────────

/**
 * Generates an ERC-8004-compliant agent_log.json from a list of action entries.
 *
 * @param agentId - The on-chain agent ID (as a string or numeric identifier).
 * @param actions - An ordered list of actions performed by the agent.
 * @returns An {@link ExecutionLog} object ready to be serialised as agent_log.json.
 */
export function generateExecutionLog(
  agentId: string,
  actions: ActionEntry[],
): ExecutionLog {
  const entries: ExecutionLogEntry[] = actions.map((entry) => ({
    timestamp: new Date().toISOString(),
    action: entry.action,
    params: entry.params,
    result: entry.result,
    reasoning: entry.reasoning,
  }));

  return {
    agentId,
    entries,
  };
}

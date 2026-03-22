import { formatUnits, type Address } from 'viem';
import { getAgentAllowance, getRemainingAllowance } from './treasury.js';
import { getTokenBalance } from './uniswap.js';
import type { AllowanceInfo } from './types.js';

// Use loose types to avoid viem chain-specific type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PC = any;

export interface BatchAllowanceResult {
  agent: Address;
  remaining: bigint;
  allowance: AllowanceInfo;
}

export interface BatchBalanceResult {
  token: Address;
  balance: bigint;
}

export async function batchGetAllowances(
  publicClient: PC,
  treasuryAddress: Address,
  token: Address,
  agents: readonly Address[],
): Promise<BatchAllowanceResult[]> {
  return Promise.all(
    agents.map(async (agent) => {
      const [allowance, remaining] = await Promise.all([
        getAgentAllowance(publicClient, treasuryAddress, agent, token),
        getRemainingAllowance(publicClient, treasuryAddress, agent, token),
      ]);

      return {
        agent,
        allowance,
        remaining,
      };
    }),
  );
}

export async function batchGetBalances(
  publicClient: PC,
  tokens: readonly Address[],
  account: Address,
): Promise<BatchBalanceResult[]> {
  return Promise.all(
    tokens.map(async (token) => ({
      token,
      balance: await getTokenBalance(publicClient, token, account),
    })),
  );
}

export function formatAllowanceReport(
  results: readonly BatchAllowanceResult[],
  decimals = 6,
): string {
  if (results.length === 0) {
    return 'No allowances found.';
  }

  const lines: string[] = ['=== Agent Allowance Report ==='];

  for (const item of results) {
    const expiry =
      item.allowance.expiry === 0n
        ? 'none'
        : new Date(Number(item.allowance.expiry) * 1000).toISOString();

    lines.push(`Agent: ${item.agent}`);
    lines.push(`  Active: ${item.allowance.active ? 'yes' : 'no'}`);
    lines.push(`  Remaining: ${formatUnits(item.remaining, decimals)}`);
    lines.push(`  Max: ${formatUnits(item.allowance.maxAmount, decimals)}`);
    lines.push(`  Spent: ${formatUnits(item.allowance.spent, decimals)}`);
    lines.push(`  Expiry: ${expiry}`);
    lines.push(
      `  Allowed targets: ${
        item.allowance.allowedTargets.length === 0
          ? 'any'
          : item.allowance.allowedTargets.join(', ')
      }`,
    );
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

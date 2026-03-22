import { formatUnits, parseAbi, type Address } from 'viem';

// Use loose types to avoid viem chain-specific type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PC = any;

const AGENT_EXECUTED_EVENT_ABI = parseAbi([
  'event AgentExecuted(address indexed agent, address indexed token, address indexed to, uint256 amount, string reason)',
]);

export interface AgentTransaction {
  txHash: `0x${string}`;
  blockNumber: bigint;
  blockTimestamp: number;
  agent: Address;
  token: Address;
  to: Address;
  amount: bigint;
  reason: string;
}

export interface AgentPerformance {
  totalSpent: bigint;
  transactionCount: number;
  averageTransactionSize: bigint;
  averageSecondsBetweenTransactions: number | null;
  firstTransactionAt: string | null;
  lastTransactionAt: string | null;
}

export async function getAgentTransactionHistory(
  publicClient: PC,
  treasury: Address,
  agent: Address,
  token: Address,
  fromBlock: bigint,
): Promise<AgentTransaction[]> {
  const logs = await publicClient.getLogs({
    address: treasury,
    event: AGENT_EXECUTED_EVENT_ABI[0],
    fromBlock,
    toBlock: 'latest',
  });

  const filtered = logs.filter((log: PC) => {
    const logAgent = (log.args?.agent as string | undefined)?.toLowerCase();
    const logToken = (log.args?.token as string | undefined)?.toLowerCase();
    return logAgent === agent.toLowerCase() && logToken === token.toLowerCase();
  });

  const blockNumberStrings = Array.from(
    new Set(filtered.map((log: PC) => log.blockNumber.toString())),
  ) as string[];
  const blockNumbers = blockNumberStrings.map((value) => BigInt(value));

  const blockTimestampByNumber = new Map<string, number>();
  await Promise.all(
    blockNumbers.map(async (blockNumber) => {
      const block = await publicClient.getBlock({ blockNumber });
      blockTimestampByNumber.set(blockNumber.toString(), Number(block.timestamp));
    }),
  );

  return filtered
    .map((log: PC): AgentTransaction => {
      const args = log.args as {
        agent: Address;
        token: Address;
        to: Address;
        amount: bigint;
        reason?: string;
      };

      return {
        txHash: log.transactionHash as `0x${string}`,
        blockNumber: log.blockNumber as bigint,
        blockTimestamp: blockTimestampByNumber.get(log.blockNumber.toString()) ?? 0,
        agent: args.agent,
        token: args.token,
        to: args.to,
        amount: args.amount,
        reason: args.reason ?? '',
      };
    })
    .sort((a: AgentTransaction, b: AgentTransaction) => {
      if (a.blockNumber === b.blockNumber) {
        return a.txHash.localeCompare(b.txHash);
      }
      return a.blockNumber < b.blockNumber ? -1 : 1;
    });
}

export function calculateAgentPerformance(history: readonly AgentTransaction[]): AgentPerformance {
  if (history.length === 0) {
    return {
      totalSpent: 0n,
      transactionCount: 0,
      averageTransactionSize: 0n,
      averageSecondsBetweenTransactions: null,
      firstTransactionAt: null,
      lastTransactionAt: null,
    };
  }

  const ordered = [...history].sort((a, b) => {
    if (a.blockTimestamp === b.blockTimestamp) {
      return a.txHash.localeCompare(b.txHash);
    }
    return a.blockTimestamp - b.blockTimestamp;
  });

  const totalSpent = ordered.reduce((sum, tx) => sum + tx.amount, 0n);
  const transactionCount = ordered.length;
  const averageTransactionSize = totalSpent / BigInt(transactionCount);

  let averageSecondsBetweenTransactions: number | null = null;
  if (ordered.length > 1) {
    let gapTotal = 0;
    for (let i = 1; i < ordered.length; i += 1) {
      gapTotal += Math.max(0, ordered[i].blockTimestamp - ordered[i - 1].blockTimestamp);
    }
    averageSecondsBetweenTransactions = gapTotal / (ordered.length - 1);
  }

  return {
    totalSpent,
    transactionCount,
    averageTransactionSize,
    averageSecondsBetweenTransactions,
    firstTransactionAt: new Date(ordered[0].blockTimestamp * 1000).toISOString(),
    lastTransactionAt: new Date(ordered[ordered.length - 1].blockTimestamp * 1000).toISOString(),
  };
}

export function formatPerformanceReport(performance: AgentPerformance): string {
  const interval =
    performance.averageSecondsBetweenTransactions === null
      ? 'N/A'
      : `${performance.averageSecondsBetweenTransactions.toFixed(1)}s`;

  return [
    '=== Agent Performance Report ===',
    `Transactions: ${performance.transactionCount}`,
    `Total spent: ${formatUnits(performance.totalSpent, 6)} tokens`,
    `Average transaction size: ${formatUnits(performance.averageTransactionSize, 6)} tokens`,
    `Average time between tx: ${interval}`,
    `First transaction: ${performance.firstTransactionAt ?? 'N/A'}`,
    `Last transaction: ${performance.lastTransactionAt ?? 'N/A'}`,
  ].join('\n');
}

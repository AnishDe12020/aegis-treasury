import 'dotenv/config';
import type { Delegation } from '@metamask/smart-accounts-kit';
import { formatUnits, parseUnits, type Address } from 'viem';
import { createClients } from './lib/client.js';
import {
  agentTransfer,
  getAgentAllowance,
  getDeposits,
  getRemainingAllowance,
} from './lib/treasury.js';
import { analyzeStrategy, createVeniceClient } from './lib/venice.js';
import { SWAP_ROUTER_ADDRESS, WETH_ADDRESS, executeSwap } from './lib/uniswap.js';
import {
  createDelegationWithCaveats,
  getEnvironment,
  signDelegationWithKey,
} from './lib/delegation.js';

// Use loose types to avoid viem chain-specific type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PC = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WC = any;

interface ActionLog {
  timestamp: string;
  actor: string;
  message: string;
}

interface OrchestratorConfig {
  treasuryAddress: Address;
  usdcAddress: Address;
  recipientAddress: Address;
  orchestratorPrivateKey: `0x${string}`;
  swapAgentPrivateKey?: `0x${string}`;
  transferAgentPrivateKey?: `0x${string}`;
  delegatorPrivateKey?: `0x${string}`;
  veniceApiKey: string;
  veniceModel?: string;
}

interface TreasurySnapshot {
  treasuryBalance: bigint;
  remainingAllowance: bigint;
  strategy: Awaited<ReturnType<typeof analyzeStrategy>>;
}

export class SwapAgent {
  readonly name = 'SwapAgent';
  readonly address: Address;
  private delegation: Delegation | null = null;

  constructor(
    private readonly walletClient: WC,
    private readonly publicClient: PC,
    private readonly tokenIn: Address,
    private readonly tokenOut: Address = WETH_ADDRESS,
  ) {
    this.address = this.walletClient.account.address;
  }

  assignDelegation(delegation: Delegation) {
    this.delegation = delegation;
  }

  getScopedTargets(): Address[] {
    return [SWAP_ROUTER_ADDRESS];
  }

  async execute(amountIn: bigint): Promise<`0x${string}`> {
    if (!this.delegation) {
      throw new Error('SwapAgent requires a scoped delegation before execution.');
    }

    const { txHash } = await executeSwap(this.walletClient, this.publicClient, {
      tokenIn: this.tokenIn,
      tokenOut: this.tokenOut,
      amountIn,
      fee: 3000,
      slippageBps: 100,
      recipient: this.address,
    });

    return txHash;
  }
}

export class TransferAgent {
  readonly name = 'TransferAgent';
  readonly address: Address;
  private delegation: Delegation | null = null;

  constructor(
    private readonly walletClient: WC,
    private readonly treasuryAddress: Address,
    private readonly usdcAddress: Address,
  ) {
    this.address = this.walletClient.account.address;
  }

  assignDelegation(delegation: Delegation) {
    this.delegation = delegation;
  }

  getScopedTargets(recipient: Address): Address[] {
    return [recipient];
  }

  async execute(to: Address, amount: bigint, reason: string): Promise<`0x${string}`> {
    if (!this.delegation) {
      throw new Error('TransferAgent requires a scoped delegation before execution.');
    }

    return agentTransfer(
      this.walletClient,
      this.treasuryAddress,
      this.usdcAddress,
      to,
      amount,
      reason,
    );
  }
}

export class OrchestratorAgent {
  readonly address: Address;
  private readonly publicClient: PC;
  private readonly swapAgent: SwapAgent;
  private readonly transferAgent: TransferAgent;
  private readonly veniceClient;
  private readonly logs: ActionLog[] = [];

  constructor(
    private readonly config: OrchestratorConfig,
    private readonly mainDelegation: Delegation,
  ) {
    const orchestratorClients = createClients(config.orchestratorPrivateKey);
    const swapClients = createClients(config.swapAgentPrivateKey ?? config.orchestratorPrivateKey);
    const transferClients = createClients(config.transferAgentPrivateKey ?? config.orchestratorPrivateKey);

    this.address = orchestratorClients.account.address;
    this.publicClient = orchestratorClients.publicClient;
    this.swapAgent = new SwapAgent(
      swapClients.walletClient,
      swapClients.publicClient,
      config.usdcAddress,
    );
    this.transferAgent = new TransferAgent(
      transferClients.walletClient,
      config.treasuryAddress,
      config.usdcAddress,
    );
    this.veniceClient = createVeniceClient(config.veniceApiKey);

    this.log('OrchestratorAgent', `Initialized with main delegation from ${mainDelegation.delegator}`);
    if (mainDelegation.delegate.toLowerCase() !== this.address.toLowerCase()) {
      this.log(
        'OrchestratorAgent',
        `Warning: main delegation delegate ${mainDelegation.delegate} does not match orchestrator ${this.address}`,
      );
    }
  }

  private log(actor: string, message: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      actor,
      message,
    };
    this.logs.push(entry);
    console.log(`[${entry.timestamp}] [${actor}] ${message}`);
  }

  getActionLog(): readonly ActionLog[] {
    return this.logs;
  }

  private async analyzeTreasuryState(): Promise<TreasurySnapshot> {
    const [treasuryBalance, remainingAllowance, allowance] = await Promise.all([
      getDeposits(this.publicClient, this.config.treasuryAddress, this.config.usdcAddress),
      getRemainingAllowance(
        this.publicClient,
        this.config.treasuryAddress,
        this.address,
        this.config.usdcAddress,
      ),
      getAgentAllowance(
        this.publicClient,
        this.config.treasuryAddress,
        this.address,
        this.config.usdcAddress,
      ),
    ]);

    const context = [
      'Treasury analysis context:',
      `- Treasury USDC balance: ${formatUnits(treasuryBalance, 6)}`,
      `- Orchestrator remaining allowance: ${formatUnits(remainingAllowance, 6)}`,
      `- Allowance active: ${allowance.active}`,
      `- Max amount: ${formatUnits(allowance.maxAmount, 6)}`,
      `- Spent: ${formatUnits(allowance.spent, 6)}`,
      `- Allowed targets: ${
        allowance.allowedTargets.length === 0 ? 'any' : allowance.allowedTargets.join(', ')
      }`,
      'Choose one: transfer, rebalance, or hold.',
    ].join('\n');

    const strategy = await analyzeStrategy(
      this.veniceClient,
      context,
      this.config.veniceModel ?? 'llama-3.3-70b',
    );

    this.log(
      'OrchestratorAgent',
      `Treasury analyzed. Strategy=${strategy.action} confidence=${(strategy.confidence * 100).toFixed(1)}%`,
    );

    return { treasuryBalance, remainingAllowance, strategy };
  }

  private async createScopedSubDelegation(
    delegateAddress: Address,
    maxAmount: bigint,
    allowedTargets: Address[],
  ): Promise<Delegation> {
    const expiryTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const unsignedDelegation = await createDelegationWithCaveats({
      delegatorAddress: this.mainDelegation.delegator as `0x${string}`,
      delegateAddress: delegateAddress as `0x${string}`,
      tokenAddress: this.config.usdcAddress as `0x${string}`,
      maxAmount,
      allowedTargets: allowedTargets as `0x${string}`[],
      expiryTimestamp,
    });

    this.log(
      'OrchestratorAgent',
      `Created sub-delegation for ${delegateAddress} with max ${formatUnits(maxAmount, 6)} USDC`,
    );

    if (!this.config.delegatorPrivateKey) {
      this.log(
        'OrchestratorAgent',
        'No delegator key configured, using unsigned sub-delegation for dry orchestration demo.',
      );
      return unsignedDelegation;
    }

    const environment = await getEnvironment();
    const signedDelegation = await signDelegationWithKey(
      unsignedDelegation,
      this.config.delegatorPrivateKey,
      environment.DelegationManager as `0x${string}`,
    );

    this.log('OrchestratorAgent', `Signed sub-delegation for ${delegateAddress}`);
    return signedDelegation;
  }

  async runCycle(): Promise<void> {
    this.log('OrchestratorAgent', 'Starting orchestration cycle');

    const snapshot = await this.analyzeTreasuryState();
    if (snapshot.remainingAllowance === 0n) {
      this.log('OrchestratorAgent', 'No remaining allowance. Ending cycle.');
      return;
    }

    if (snapshot.strategy.action === 'transfer') {
      const amount = parseUnits('1', 6) <= snapshot.remainingAllowance
        ? parseUnits('1', 6)
        : snapshot.remainingAllowance;
      const delegation = await this.createScopedSubDelegation(
        this.transferAgent.address,
        amount,
        this.transferAgent.getScopedTargets(this.config.recipientAddress),
      );
      this.transferAgent.assignDelegation(delegation);

      this.log('OrchestratorAgent', `Delegated transfer authority to ${this.transferAgent.name}`);
      const txHash = await this.transferAgent.execute(
        this.config.recipientAddress,
        amount,
        'Orchestrated transfer from treasury strategy',
      );
      this.log(
        this.transferAgent.name,
        `Executed USDC transfer of ${formatUnits(amount, 6)}. tx=${txHash}`,
      );
      return;
    }

    if (snapshot.strategy.action === 'rebalance') {
      const amount = snapshot.remainingAllowance / 10n;
      if (amount === 0n) {
        this.log('OrchestratorAgent', 'Rebalance selected but computed swap amount is 0. Ending cycle.');
        return;
      }

      const delegation = await this.createScopedSubDelegation(
        this.swapAgent.address,
        amount,
        this.swapAgent.getScopedTargets(),
      );
      this.swapAgent.assignDelegation(delegation);

      this.log('OrchestratorAgent', `Delegated swap authority to ${this.swapAgent.name}`);
      const txHash = await this.swapAgent.execute(amount);
      this.log(
        this.swapAgent.name,
        `Executed Uniswap swap with ${formatUnits(amount, 6)} USDC. tx=${txHash}`,
      );
      return;
    }

    this.log('OrchestratorAgent', `No specialist action selected (strategy=${snapshot.strategy.action}).`);
  }
}

export async function runMultiAgentDemo() {
  const orchestratorPrivateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
  if (!orchestratorPrivateKey) {
    throw new Error('Missing AGENT_PRIVATE_KEY');
  }

  const { account } = createClients(orchestratorPrivateKey);
  const orchestratorAddress = account.address;

  const mainDelegation = {
    delegate: orchestratorAddress,
    delegator: (process.env.DELEGATOR_ADDRESS ?? orchestratorAddress) as `0x${string}`,
    authority: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as const,
    caveats: [],
    salt: '0x0000000000000000000000000000000000000000000000000000000000000000' as const,
    signature: '0x' as const,
  } satisfies Delegation;

  const orchestrator = new OrchestratorAgent(
    {
      treasuryAddress: process.env.TREASURY_ADDRESS as `0x${string}`,
      usdcAddress: (process.env.USDC_ADDRESS ??
        '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`,
      recipientAddress: process.env.RECIPIENT_ADDRESS as `0x${string}`,
      orchestratorPrivateKey,
      swapAgentPrivateKey: process.env.SWAP_AGENT_PRIVATE_KEY as `0x${string}` | undefined,
      transferAgentPrivateKey: process.env.TRANSFER_AGENT_PRIVATE_KEY as `0x${string}` | undefined,
      delegatorPrivateKey: process.env.DELEGATOR_PRIVATE_KEY as `0x${string}` | undefined,
      veniceApiKey: process.env.VENICE_API_KEY || '',
      veniceModel: process.env.VENICE_MODEL || 'llama-3.3-70b',
    },
    mainDelegation,
  );

  await orchestrator.runCycle();
  return orchestrator.getActionLog();
}

if (
  process.argv[1]?.endsWith('multi-agent.ts') ||
  process.argv[1]?.endsWith('multi-agent.js')
) {
  runMultiAgentDemo().catch((err) => {
    console.error('Multi-agent demo failed:', err);
    process.exit(1);
  });
}

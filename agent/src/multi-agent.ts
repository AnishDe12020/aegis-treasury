import 'dotenv/config';
import type { Delegation } from '@metamask/smart-accounts-kit';
import { formatUnits, parseUnits, type Address } from 'viem';
import { createClients } from './lib/client.js';
import {
  createDelegationWithCaveats,
  getEnvironment,
  signDelegationWithKey,
} from './lib/delegation.js';
import {
  DCAStrategy,
  MomentumStrategy,
  RiskManager,
  type DCAAction,
  type MomentumAnalysis,
} from './lib/trading.js';
import {
  agentTransfer,
  getAgentAllowance,
  getDeposits,
  getRemainingAllowance,
} from './lib/treasury.js';
import { SWAP_ROUTER_ADDRESS, WETH_ADDRESS, executeSwap } from './lib/uniswap.js';
import { analyzeStrategy, createVeniceClient } from './lib/venice.js';

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
  dcaChunks?: number;
  dcaIntervalMs?: number;
  momentumFeeTier?: number;
  maxSingleTradeUsd?: number;
  maxDailyVolumeUsd?: number;
  maxSlippageBps?: number;
  minConfidence?: number;
}

interface TreasurySnapshot {
  treasuryBalance: bigint;
  remainingAllowance: bigint;
  strategy: Awaited<ReturnType<typeof analyzeStrategy>>;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function amountUsdFromUsdc(amount: bigint): number {
  return Number(formatUnits(amount, 6));
}

export class SwapAgent {
  readonly name = 'SwapAgent';
  readonly address: Address;
  private delegation: Delegation | null = null;
  private readonly momentumStrategy: MomentumStrategy;

  constructor(
    private readonly walletClient: WC,
    private readonly publicClient: PC,
    private readonly tokenIn: Address,
    private readonly tokenOut: Address = WETH_ADDRESS,
    momentumFeeTier = 3000,
  ) {
    this.address = this.walletClient.account.address;
    this.momentumStrategy = new MomentumStrategy(this.publicClient, momentumFeeTier);
  }

  assignDelegation(delegation: Delegation) {
    this.delegation = delegation;
  }

  getScopedTargets(): Address[] {
    return [SWAP_ROUTER_ADDRESS];
  }

  async analyzeMomentum(amountIn: bigint): Promise<MomentumAnalysis> {
    const s1 = amountIn / 4n > 0n ? amountIn / 4n : 1n;
    const s2 = amountIn / 2n > 0n ? amountIn / 2n : 1n;
    return this.momentumStrategy.analyzeMomentum(this.tokenIn, this.tokenOut, [s1, s2, amountIn]);
  }

  async execute(
    amountIn: bigint,
    momentumAnalysis?: MomentumAnalysis,
  ): Promise<`0x${string}`> {
    if (!this.delegation) {
      throw new Error('SwapAgent requires a scoped delegation before execution.');
    }

    const momentum = momentumAnalysis ?? (await this.analyzeMomentum(amountIn));
    if (momentum.trend === 'down' && momentum.confidence >= 0.6) {
      throw new Error(
        `Momentum check failed. trend=${momentum.trend}, confidence=${momentum.confidence.toFixed(2)}`,
      );
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
  private dcaStrategy: DCAStrategy | null = null;
  private dcaKey: string | null = null;

  constructor(
    private readonly walletClient: WC,
    private readonly treasuryAddress: Address,
    private readonly usdcAddress: Address,
    private readonly dcaChunks = 4,
    private readonly dcaIntervalMs = 60_000,
  ) {
    this.address = this.walletClient.account.address;
  }

  assignDelegation(delegation: Delegation) {
    this.delegation = delegation;
  }

  getScopedTargets(recipient: Address): Address[] {
    return [recipient];
  }

  private ensureDca(totalAmount: bigint) {
    const key = `${this.usdcAddress}:${totalAmount}:${this.dcaChunks}:${this.dcaIntervalMs}`;
    if (!this.dcaStrategy || this.dcaKey !== key) {
      this.dcaStrategy = new DCAStrategy({
        totalAmount,
        numChunks: this.dcaChunks,
        intervalMs: this.dcaIntervalMs,
        tokenIn: this.usdcAddress,
        tokenOut: this.usdcAddress,
      });
      this.dcaKey = key;
    }
  }

  planNextChunk(totalAmount: bigint): DCAAction | null {
    if (!this.delegation) {
      throw new Error('TransferAgent requires a scoped delegation before execution.');
    }

    if (totalAmount <= 0n) {
      return null;
    }

    this.ensureDca(totalAmount);
    return this.dcaStrategy?.getNextAction() ?? null;
  }

  async executeChunk(to: Address, chunk: DCAAction, reason: string): Promise<`0x${string}`> {
    if (!this.delegation) {
      throw new Error('TransferAgent requires a scoped delegation before execution.');
    }

    return agentTransfer(
      this.walletClient,
      this.treasuryAddress,
      this.usdcAddress,
      to,
      chunk.amount,
      `${reason} (DCA ${chunk.chunkIndex}/${chunk.totalChunks})`,
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
  private readonly riskManager: RiskManager;
  private dailyVolumeUsd = 0;
  private dailyVolumeDate = '';

  constructor(
    private readonly config: OrchestratorConfig,
    private readonly mainDelegation: Delegation,
  ) {
    const orchestratorClients = createClients(config.orchestratorPrivateKey);
    const swapClients = createClients(config.swapAgentPrivateKey ?? config.orchestratorPrivateKey);
    const transferClients = createClients(
      config.transferAgentPrivateKey ?? config.orchestratorPrivateKey,
    );

    this.address = orchestratorClients.account.address;
    this.publicClient = orchestratorClients.publicClient;
    this.swapAgent = new SwapAgent(
      swapClients.walletClient,
      swapClients.publicClient,
      config.usdcAddress,
      WETH_ADDRESS,
      config.momentumFeeTier ?? 3000,
    );
    this.transferAgent = new TransferAgent(
      transferClients.walletClient,
      config.treasuryAddress,
      config.usdcAddress,
      config.dcaChunks ?? 4,
      config.dcaIntervalMs ?? 60_000,
    );
    this.veniceClient = createVeniceClient(config.veniceApiKey);
    this.riskManager = new RiskManager({
      maxSingleTradeUsd: config.maxSingleTradeUsd ?? 2_500,
      maxDailyVolumeUsd: config.maxDailyVolumeUsd ?? 10_000,
      maxSlippageBps: config.maxSlippageBps ?? 150,
      minConfidence: config.minConfidence ?? 0.7,
    });

    this.log(
      'OrchestratorAgent',
      `Initialized with main delegation from ${mainDelegation.delegator}`,
    );
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

  private resetDailyVolumeIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.dailyVolumeDate) {
      this.dailyVolumeDate = today;
      this.dailyVolumeUsd = 0;
    }
  }

  private validateRisk(
    amountUsd: number,
    slippageBps: number,
    confidence: number,
    tokenIn: Address,
    tokenOut: Address,
    amount: bigint,
  ): { approved: boolean; reason: string } {
    this.resetDailyVolumeIfNeeded();
    return this.riskManager.validateAction(
      {
        tokenIn,
        tokenOut,
        amount,
        amountUsd,
        slippageBps,
        confidence,
      },
      { dailyVolumeUsd: this.dailyVolumeUsd },
    );
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
      const totalAmount =
        parseUnits('1', 6) <= snapshot.remainingAllowance
          ? parseUnits('1', 6)
          : snapshot.remainingAllowance;

      const delegation = await this.createScopedSubDelegation(
        this.transferAgent.address,
        totalAmount,
        this.transferAgent.getScopedTargets(this.config.recipientAddress),
      );
      this.transferAgent.assignDelegation(delegation);
      this.log('OrchestratorAgent', `Delegated transfer authority to ${this.transferAgent.name}`);

      const plannedChunk = this.transferAgent.planNextChunk(totalAmount);
      if (!plannedChunk || plannedChunk.amount === 0n) {
        this.log('OrchestratorAgent', 'DCA transfer plan has no executable chunk this cycle.');
        return;
      }

      const riskDecision = this.validateRisk(
        amountUsdFromUsdc(plannedChunk.amount),
        0,
        snapshot.strategy.confidence,
        this.config.usdcAddress,
        this.config.usdcAddress,
        plannedChunk.amount,
      );
      if (!riskDecision.approved) {
        this.log('OrchestratorAgent', `RiskManager rejected transfer action: ${riskDecision.reason}`);
        return;
      }

      const txHash = await this.transferAgent.executeChunk(
        this.config.recipientAddress,
        plannedChunk,
        'Orchestrated transfer from treasury strategy',
      );

      this.dailyVolumeUsd += amountUsdFromUsdc(plannedChunk.amount);
      this.log(
        this.transferAgent.name,
        `Executed DCA transfer chunk ${plannedChunk.chunkIndex}/${plannedChunk.totalChunks} for ${formatUnits(plannedChunk.amount, 6)} USDC. tx=${txHash}`,
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

      const momentum = await this.swapAgent.analyzeMomentum(amount);
      this.log(
        this.swapAgent.name,
        `Momentum check: trend=${momentum.trend} confidence=${(momentum.confidence * 100).toFixed(1)}% impact=${momentum.priceImpactBps.toFixed(2)}bps`,
      );
      if (momentum.trend === 'down' && momentum.confidence >= 0.6) {
        this.log(this.swapAgent.name, 'Momentum check blocked swap execution.');
        return;
      }

      const riskDecision = this.validateRisk(
        amountUsdFromUsdc(amount),
        momentum.priceImpactBps,
        Math.min(snapshot.strategy.confidence, momentum.confidence),
        this.config.usdcAddress,
        WETH_ADDRESS,
        amount,
      );
      if (!riskDecision.approved) {
        this.log('OrchestratorAgent', `RiskManager rejected swap action: ${riskDecision.reason}`);
        return;
      }

      const txHash = await this.swapAgent.execute(amount, momentum);
      this.dailyVolumeUsd += amountUsdFromUsdc(amount);

      this.log(
        this.swapAgent.name,
        `Executed Uniswap swap with ${formatUnits(amount, 6)} USDC. tx=${txHash}`,
      );
      return;
    }

    this.log(
      'OrchestratorAgent',
      `No specialist action selected (strategy=${snapshot.strategy.action}).`,
    );
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
      transferAgentPrivateKey: process.env.TRANSFER_AGENT_PRIVATE_KEY as
        | `0x${string}`
        | undefined,
      delegatorPrivateKey: process.env.DELEGATOR_PRIVATE_KEY as `0x${string}` | undefined,
      veniceApiKey: process.env.VENICE_API_KEY || '',
      veniceModel: process.env.VENICE_MODEL || 'llama-3.3-70b',
      dcaChunks: Math.floor(parsePositiveNumber(process.env.DCA_CHUNKS, 4)),
      dcaIntervalMs: Math.floor(parsePositiveNumber(process.env.DCA_INTERVAL_MS, 60_000)),
      momentumFeeTier: Math.floor(parsePositiveNumber(process.env.MOMENTUM_FEE_TIER, 3000)),
      maxSingleTradeUsd: parsePositiveNumber(process.env.MAX_SINGLE_TRADE_USD, 2_500),
      maxDailyVolumeUsd: parsePositiveNumber(process.env.MAX_DAILY_VOLUME_USD, 10_000),
      maxSlippageBps: parsePositiveNumber(process.env.MAX_SLIPPAGE_BPS, 150),
      minConfidence: parsePositiveNumber(process.env.MIN_CONFIDENCE, 0.7),
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

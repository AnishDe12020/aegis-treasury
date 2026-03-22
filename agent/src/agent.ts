import 'dotenv/config';
import { formatUnits, parseUnits, type Address } from 'viem';
import { createClients } from './lib/client.js';
import { getUniswapV3Price } from './lib/price-feed.js';
import {
  DCAStrategy,
  MomentumStrategy,
  RebalanceStrategy,
  RiskManager,
  type RiskValidationAction,
} from './lib/trading.js';
import {
  agentTransfer,
  getAgentAllowance,
  getDeposits,
  getRemainingAllowance,
} from './lib/treasury.js';
import { WETH_ADDRESS } from './lib/uniswap.js';
import { analyzeStrategy, createVeniceClient } from './lib/venice.js';

type StrategyFlag = 'dca' | 'momentum' | 'rebalance';

interface Flags {
  dryRun: boolean;
  loop: boolean;
  intervalSec: number;
  strategy?: StrategyFlag;
}

interface PlannedExecution {
  token: Address;
  to: Address;
  amount: bigint;
  reason: string;
  confidence: number;
  slippageBps: number;
}

interface VeniceRecommendation {
  action: string;
  reasoning: string;
  confidence: number;
  suggestedAmount?: number;
}

const STRATEGY_VALUES: readonly StrategyFlag[] = ['dca', 'momentum', 'rebalance'];

let activeDcaKey: string | null = null;
let activeDcaStrategy: DCAStrategy | null = null;
let dailyVolumeUsdDate = '';
let dailyVolumeUsd = 0;

// ─── Logging ─────────────────────────────────────────────────────────
function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ERROR: ${msg}`);
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseStrategyFlag(args: string[]): StrategyFlag | undefined {
  const inline = args.find((arg) => arg.startsWith('--strategy='));
  const next = args.find((arg, idx) => arg === '--strategy' && typeof args[idx + 1] === 'string');

  const raw = inline
    ? inline.split('=')[1]
    : next
      ? args[args.indexOf(next) + 1]
      : undefined;

  if (!raw) {
    return undefined;
  }

  if (STRATEGY_VALUES.includes(raw as StrategyFlag)) {
    return raw as StrategyFlag;
  }

  throw new Error(`Invalid --strategy value "${raw}". Use one of: ${STRATEGY_VALUES.join(', ')}`);
}

function clampAmountToAllowance(amount: bigint, remaining: bigint): bigint {
  if (amount <= 0n || remaining <= 0n) return 0n;
  return amount > remaining ? remaining : amount;
}

function getSuggestedAmount(remaining: bigint, recommendation: VeniceRecommendation): bigint {
  if (
    typeof recommendation.suggestedAmount === 'number' &&
    Number.isFinite(recommendation.suggestedAmount) &&
    recommendation.suggestedAmount > 0
  ) {
    return clampAmountToAllowance(parseUnits(String(recommendation.suggestedAmount), 6), remaining);
  }

  return clampAmountToAllowance(remaining / 10n, remaining);
}

function resetDailyVolumeIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyVolumeUsdDate) {
    dailyVolumeUsdDate = today;
    dailyVolumeUsd = 0;
  }
}

async function estimateUsdNotional(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any,
  token: Address,
  amount: bigint,
  usdcAddress: Address,
): Promise<number> {
  if (amount <= 0n) {
    return 0;
  }

  if (token.toLowerCase() === usdcAddress.toLowerCase()) {
    return Number(formatUnits(amount, 6));
  }

  if (token.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
    const wethUsd = await getUniswapV3Price(publicClient, WETH_ADDRESS, usdcAddress, 3000);
    return Number(formatUnits(amount, 18)) * wethUsd;
  }

  return 0;
}

// ─── CLI flags ───────────────────────────────────────────────────────
function parseFlags(): Flags {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--no-dry-run');
  const loop = args.includes('--loop');
  const intervalArg = args.find((arg) => arg.startsWith('--interval='));
  const intervalSec = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : 60;
  const strategy = parseStrategyFlag(args);
  return { dryRun, loop, intervalSec, strategy };
}

// ─── Config ──────────────────────────────────────────────────────────
const config = {
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  treasuryAddress: process.env.TREASURY_ADDRESS as `0x${string}`,
  veniceApiKey: process.env.VENICE_API_KEY || '',
  usdcAddress: (process.env.USDC_ADDRESS ||
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`,
  recipientAddress: process.env.RECIPIENT_ADDRESS as `0x${string}` | undefined,
  rebalanceTokenAddress: (process.env.REBALANCE_TOKEN_ADDRESS || WETH_ADDRESS) as `0x${string}`,
  targetUsdcWeight: parsePositiveNumber(process.env.TARGET_USDC_WEIGHT, 0.7),
  targetSecondaryWeight: parsePositiveNumber(process.env.TARGET_SECONDARY_WEIGHT, 0.3),
  dcaChunks: Math.floor(parsePositiveNumber(process.env.DCA_CHUNKS, 4)),
  dcaIntervalMs: Math.floor(parsePositiveNumber(process.env.DCA_INTERVAL_MS, 60_000)),
  momentumFeeTier: Math.floor(parsePositiveNumber(process.env.MOMENTUM_FEE_TIER, 3000)),
  maxSingleTradeUsd: parsePositiveNumber(process.env.MAX_SINGLE_TRADE_USD, 2_500),
  maxDailyVolumeUsd: parsePositiveNumber(process.env.MAX_DAILY_VOLUME_USD, 10_000),
  maxSlippageBps: parsePositiveNumber(process.env.MAX_SLIPPAGE_BPS, 150),
  minConfidence: parsePositiveNumber(process.env.MIN_CONFIDENCE, 0.7),
};

const riskManager = new RiskManager({
  maxSingleTradeUsd: config.maxSingleTradeUsd,
  maxDailyVolumeUsd: config.maxDailyVolumeUsd,
  maxSlippageBps: config.maxSlippageBps,
  minConfidence: config.minConfidence,
});

async function buildPlannedExecution(
  flags: Flags,
  recommendation: VeniceRecommendation,
  remainingUsdc: bigint,
  treasuryBalanceUsdc: bigint,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any,
  recipient?: Address,
): Promise<PlannedExecution | null> {
  const baseAmount = getSuggestedAmount(remainingUsdc, recommendation);

  if (!flags.strategy) {
    if (recommendation.action !== 'transfer' || recommendation.confidence <= 0.7) {
      return null;
    }
    if (!recipient) {
      throw new Error(
        'Venice recommends transfer but RECIPIENT_ADDRESS is not set in env. Skipping execution.',
      );
    }

    return {
      token: config.usdcAddress,
      to: recipient,
      amount: baseAmount,
      reason: recommendation.reasoning,
      confidence: recommendation.confidence,
      slippageBps: 0,
    };
  }

  if (recommendation.action !== 'transfer' && recommendation.action !== 'rebalance') {
    return null;
  }

  if (flags.strategy === 'dca') {
    if (baseAmount === 0n) {
      return null;
    }
    if (!recipient) {
      throw new Error(
        'Strategy execution requires RECIPIENT_ADDRESS in env for transfer routing.',
      );
    }

    const strategyKey = `${config.usdcAddress}:${baseAmount}:${config.dcaChunks}:${config.dcaIntervalMs}`;
    if (!activeDcaStrategy || activeDcaKey !== strategyKey) {
      activeDcaStrategy = new DCAStrategy({
        totalAmount: baseAmount,
        numChunks: config.dcaChunks,
        intervalMs: config.dcaIntervalMs,
        tokenIn: config.usdcAddress,
        tokenOut: config.usdcAddress,
      });
      activeDcaKey = strategyKey;
    }

    const next = activeDcaStrategy.getNextAction();
    if (!next || next.amount === 0n) {
      return null;
    }

    return {
      token: config.usdcAddress,
      to: recipient,
      amount: next.amount,
      reason: `${recommendation.reasoning} (DCA chunk ${next.chunkIndex}/${next.totalChunks})`,
      confidence: recommendation.confidence,
      slippageBps: 0,
    };
  }

  if (flags.strategy === 'momentum') {
    if (baseAmount === 0n) {
      return null;
    }
    if (!recipient) {
      throw new Error(
        'Strategy execution requires RECIPIENT_ADDRESS in env for transfer routing.',
      );
    }

    const q1 = baseAmount / 4n > 0n ? baseAmount / 4n : 1n;
    const q2 = baseAmount / 2n > 0n ? baseAmount / 2n : 1n;
    const momentumStrategy = new MomentumStrategy(publicClient, config.momentumFeeTier);
    const analysis = await momentumStrategy.analyzeMomentum(
      config.usdcAddress,
      config.rebalanceTokenAddress,
      [q1, q2, baseAmount],
    );

    log(
      `Momentum analysis: trend=${analysis.trend}, confidence=${(analysis.confidence * 100).toFixed(1)}%, impact=${analysis.priceImpactBps.toFixed(2)}bps`,
    );

    if (analysis.trend === 'down' && analysis.confidence >= 0.6) {
      log('Momentum strategy blocked execution due to bearish trend.');
      return null;
    }

    const scaleBps = analysis.trend === 'up' ? 10_000n : analysis.trend === 'sideways' ? 7_500n : 5_000n;
    const adjusted = (baseAmount * scaleBps) / 10_000n;
    if (adjusted === 0n) {
      return null;
    }

    return {
      token: config.usdcAddress,
      to: recipient,
      amount: adjusted,
      reason: `${recommendation.reasoning} (momentum=${analysis.trend})`,
      confidence: Math.min(recommendation.confidence, analysis.confidence),
      slippageBps: analysis.priceImpactBps,
    };
  }

  const rebalanceTokenBalance = await getDeposits(
    publicClient,
    config.treasuryAddress,
    config.rebalanceTokenAddress,
  );

  const rebalanceStrategy = new RebalanceStrategy({
    [config.usdcAddress]: config.targetUsdcWeight,
    [config.rebalanceTokenAddress]: config.targetSecondaryWeight,
  });

  const actions = rebalanceStrategy.getRebalanceActions({
    [config.usdcAddress]: treasuryBalanceUsdc,
    [config.rebalanceTokenAddress]: rebalanceTokenBalance,
  });

  if (actions.length === 0) {
    return null;
  }

  const chosen = actions[0];
  const amount = chosen.amount;
  if (amount === 0n) {
    return null;
  }
  if (!recipient) {
    throw new Error(
      'Strategy execution requires RECIPIENT_ADDRESS in env for transfer routing.',
    );
  }

  return {
    token: chosen.tokenIn,
    to: recipient,
    amount,
    reason: `${recommendation.reasoning} (rebalance ${chosen.tokenIn} -> ${chosen.tokenOut})`,
    confidence: recommendation.confidence,
    slippageBps: 0,
  };
}

// ─── Single cycle ────────────────────────────────────────────────────
async function runCycle(flags: Flags) {
  log('Aegis Agent cycle starting...');

  const { account, publicClient, walletClient } = createClients(config.privateKey);
  log(`Agent address: ${account.address}`);

  const venice = createVeniceClient(config.veniceApiKey);

  const remaining = await getRemainingAllowance(
    publicClient,
    config.treasuryAddress,
    account.address,
    config.usdcAddress,
  );

  const allowance = await getAgentAllowance(
    publicClient,
    config.treasuryAddress,
    account.address,
    config.usdcAddress,
  );

  const treasuryBalance = await getDeposits(
    publicClient,
    config.treasuryAddress,
    config.usdcAddress,
  );

  log(`Treasury balance: ${formatUnits(treasuryBalance, 6)} USDC`);
  log(`Agent allowance: ${formatUnits(remaining, 6)} USDC remaining`);
  log(`Allowance active: ${allowance.active}`);

  if (!allowance.active || remaining === 0n) {
    log('No active allowance. Waiting for owner to set one.');
    return;
  }

  const context = `
Treasury State:
- Total deposits: ${formatUnits(treasuryBalance, 6)} USDC
- My remaining allowance: ${formatUnits(remaining, 6)} USDC
- Max allowed: ${formatUnits(allowance.maxAmount, 6)} USDC
- Already spent: ${formatUnits(allowance.spent, 6)} USDC
- Expiry: ${allowance.expiry === 0n ? 'None' : new Date(Number(allowance.expiry) * 1000).toISOString()}
- Allowed targets: ${allowance.allowedTargets.length === 0 ? 'Any' : allowance.allowedTargets.join(', ')}

Given this treasury state, what action should I take? Consider market conditions and risk management.
If you recommend a transfer or rebalance, include a "suggestedAmount" field (in USDC, as a number) in your JSON response.
  `.trim();

  log('Analyzing strategy with Venice AI (private inference)...');
  const recommendation = (await analyzeStrategy(venice, context)) as VeniceRecommendation;

  log('Strategy recommendation:');
  log(`  Action: ${recommendation.action}`);
  log(`  Reasoning: ${recommendation.reasoning}`);
  log(`  Confidence: ${(recommendation.confidence * 100).toFixed(1)}%`);

  let plan: PlannedExecution | null = null;
  try {
    plan = await buildPlannedExecution(
      flags,
      recommendation,
      remaining,
      treasuryBalance,
      publicClient,
      config.recipientAddress,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError(message);
    return;
  }

  if (!plan) {
    log(
      `No execution action taken (action=${recommendation.action}, confidence=${recommendation.confidence}, strategy=${flags.strategy ?? 'none'}).`,
    );
    return;
  }

  const tokenAllowance = await getAgentAllowance(
    publicClient,
    config.treasuryAddress,
    account.address,
    plan.token,
  );
  const tokenRemaining = await getRemainingAllowance(
    publicClient,
    config.treasuryAddress,
    account.address,
    plan.token,
  );

  if (!tokenAllowance.active || tokenRemaining === 0n) {
    logError(`No active allowance for token ${plan.token}. Skipping.`);
    return;
  }

  const amount = clampAmountToAllowance(plan.amount, tokenRemaining);
  if (amount === 0n) {
    log('Computed transfer amount is 0 after allowance checks. Skipping.');
    return;
  }

  if (
    tokenAllowance.allowedTargets.length > 0 &&
    !tokenAllowance.allowedTargets.some((target) => target.toLowerCase() === plan.to.toLowerCase())
  ) {
    logError(`Recipient ${plan.to} is not in allowed targets for token ${plan.token}. Skipping.`);
    return;
  }

  resetDailyVolumeIfNeeded();

  const amountUsd = await estimateUsdNotional(publicClient, plan.token, amount, config.usdcAddress);
  const riskAction: RiskValidationAction = {
    tokenIn: plan.token,
    tokenOut: plan.token,
    amount,
    amountUsd,
    slippageBps: plan.slippageBps,
    confidence: plan.confidence,
  };

  const riskDecision = riskManager.validateAction(riskAction, { dailyVolumeUsd });
  if (!riskDecision.approved) {
    logError(`RiskManager rejected action: ${riskDecision.reason}`);
    return;
  }

  if (flags.dryRun) {
    log('[DRY RUN] Would execute agentTransfer:');
    log(`  Token:     ${plan.token}`);
    log(`  To:        ${plan.to}`);
    log(`  Amount:    ${formatUnits(amount, plan.token.toLowerCase() === config.usdcAddress.toLowerCase() ? 6 : 18)}`);
    log(`  Reason:    ${plan.reason}`);
    log(`  Risk:      ${riskDecision.reason}`);
  } else {
    const decimals = plan.token.toLowerCase() === config.usdcAddress.toLowerCase() ? 6 : 18;
    log(`Executing agentTransfer of ${formatUnits(amount, decimals)} token units to ${plan.to}...`);
    try {
      const txHash = await agentTransfer(
        walletClient,
        config.treasuryAddress,
        plan.token,
        plan.to,
        amount,
        plan.reason,
      );
      log(`Transaction submitted: ${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'success') {
        dailyVolumeUsd += amountUsd;
        log(`Transaction confirmed in block ${receipt.blockNumber}`);
      } else {
        logError(`Transaction reverted in block ${receipt.blockNumber}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`agentTransfer failed: ${message}`);
    }
  }

  log('Aegis Agent cycle complete.');
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const flags = parseFlags();

  log(
    `Mode: dryRun=${flags.dryRun}, loop=${flags.loop}, interval=${flags.intervalSec}s, strategy=${flags.strategy ?? 'none'}`,
  );

  if (flags.loop) {
    log(`Starting continuous loop (every ${flags.intervalSec}s). Press Ctrl+C to stop.`);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await runCycle(flags);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logError(`Cycle failed: ${message}`);
      }
      log(`Sleeping ${flags.intervalSec}s until next cycle...`);
      await new Promise((resolve) => setTimeout(resolve, flags.intervalSec * 1000));
    }
  } else {
    await runCycle(flags);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logError(`Fatal: ${message}`);
  process.exit(1);
});

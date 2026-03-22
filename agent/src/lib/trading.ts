import { type Address } from 'viem';
import { getPriceImpact, getQuote } from './price-feed.js';

// Use loose types to avoid viem chain-specific type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PC = any;

export interface TradeAction {
  tokenIn: Address;
  tokenOut: Address;
  amount: bigint;
}

export interface DCAConfig {
  totalAmount: bigint;
  numChunks: number;
  intervalMs: number;
  tokenIn: Address;
  tokenOut: Address;
}

export interface DCAAction extends TradeAction {
  chunkIndex: number;
  totalChunks: number;
}

export type MomentumTrend = 'up' | 'down' | 'sideways';

export interface MomentumAnalysis {
  trend: MomentumTrend;
  confidence: number;
  priceImpactBps: number;
}

export interface RebalanceAction {
  tokenIn: Address;
  tokenOut: Address;
  amount: bigint;
}

export interface RiskLimits {
  maxSingleTradeUsd: number;
  maxDailyVolumeUsd: number;
  maxSlippageBps: number;
  minConfidence: number;
}

export interface RiskValidationAction {
  tokenIn: Address;
  tokenOut: Address;
  amount: bigint;
  amountUsd?: number;
  slippageBps?: number;
  confidence?: number;
}

export interface RiskValidationContext {
  dailyVolumeUsd: number;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export class DCAStrategy {
  private readonly totalAmount: bigint;
  private readonly numChunks: number;
  private readonly intervalMs: number;
  private readonly tokenIn: Address;
  private readonly tokenOut: Address;
  private readonly baseChunk: bigint;
  private readonly remainder: bigint;

  private currentChunk = 0;
  private lastExecutionAt: number | null = null;

  constructor(config: DCAConfig) {
    if (config.totalAmount <= 0n) {
      throw new Error('DCA totalAmount must be greater than 0');
    }
    if (config.numChunks <= 0 || !Number.isInteger(config.numChunks)) {
      throw new Error('DCA numChunks must be a positive integer');
    }
    if (config.intervalMs < 0) {
      throw new Error('DCA intervalMs cannot be negative');
    }

    this.totalAmount = config.totalAmount;
    this.numChunks = config.numChunks;
    this.intervalMs = config.intervalMs;
    this.tokenIn = config.tokenIn;
    this.tokenOut = config.tokenOut;
    this.baseChunk = this.totalAmount / BigInt(this.numChunks);
    this.remainder = this.totalAmount % BigInt(this.numChunks);
  }

  getNextAction(nowMs = Date.now()): DCAAction | null {
    if (this.currentChunk >= this.numChunks) {
      return null;
    }

    if (this.lastExecutionAt !== null && nowMs - this.lastExecutionAt < this.intervalMs) {
      return null;
    }

    const nextChunkIndex = this.currentChunk + 1;
    const amount =
      nextChunkIndex === this.numChunks
        ? this.baseChunk + this.remainder
        : this.baseChunk;

    this.currentChunk = nextChunkIndex;
    this.lastExecutionAt = nowMs;

    return {
      tokenIn: this.tokenIn,
      tokenOut: this.tokenOut,
      amount,
      chunkIndex: nextChunkIndex,
      totalChunks: this.numChunks,
    };
  }
}

export class MomentumStrategy {
  constructor(
    private readonly publicClient: PC,
    private readonly fee = 3000,
  ) {}

  async analyzeMomentum(
    tokenIn: Address,
    tokenOut: Address,
    sampleAmounts: readonly bigint[],
  ): Promise<MomentumAnalysis> {
    const amounts = Array.from(
      new Set(sampleAmounts.filter((amount) => amount > 0n).map((amount) => amount.toString())),
    )
      .map((value) => BigInt(value))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    if (amounts.length < 2) {
      return { trend: 'sideways', confidence: 0, priceImpactBps: 0 };
    }

    const quotes = await Promise.all(
      amounts.map((amount) => getQuote(this.publicClient, tokenIn, tokenOut, amount, this.fee)),
    );

    const unitPrices = quotes.map((quote, idx) => {
      const amountIn = amounts[idx];
      return amountIn === 0n ? 0 : Number((quote * 10n ** 18n) / amountIn) / 1e18;
    });

    const first = unitPrices[0];
    const last = unitPrices[unitPrices.length - 1];
    if (first <= 0) {
      return { trend: 'sideways', confidence: 0, priceImpactBps: 0 };
    }

    const deltaBps = ((last - first) / first) * 10_000;
    const trendThresholdBps = 20;

    let trend: MomentumTrend = 'sideways';
    if (deltaBps > trendThresholdBps) {
      trend = 'up';
    } else if (deltaBps < -trendThresholdBps) {
      trend = 'down';
    }

    let sameDirectionMoves = 0;
    for (let i = 1; i < unitPrices.length; i += 1) {
      const diff = unitPrices[i] - unitPrices[i - 1];
      if ((trend === 'up' && diff > 0) || (trend === 'down' && diff < 0)) {
        sameDirectionMoves += 1;
      }
      if (trend === 'sideways' && Math.abs(diff) <= first * 0.002) {
        sameDirectionMoves += 1;
      }
    }

    const consistency = unitPrices.length > 1 ? sameDirectionMoves / (unitPrices.length - 1) : 0;

    const priceImpactBps = await getPriceImpact(
      this.publicClient,
      tokenIn,
      tokenOut,
      amounts[amounts.length - 1],
      this.fee,
    );

    const directionalStrength = clamp01(Math.abs(deltaBps) / 200);
    const liquidityPenalty = clamp01(priceImpactBps / 2_000);
    const confidence = clamp01(directionalStrength * 0.6 + consistency * 0.4 - liquidityPenalty * 0.5);

    return {
      trend,
      confidence,
      priceImpactBps,
    };
  }
}

export class RebalanceStrategy {
  private readonly normalizedWeights: Record<Address, bigint>;
  private readonly totalWeight: bigint;

  constructor(targetAllocations: Record<Address, number>) {
    const SCALE = 1_000_000;
    const weightEntries: [Address, bigint][] = Object.entries(targetAllocations)
      .map(([token, weight]): [Address, bigint] => [token as Address, BigInt(Math.max(0, Math.round(weight * SCALE)))])
      .filter(([, weight]) => weight > 0n);

    if (weightEntries.length === 0) {
      throw new Error('RebalanceStrategy requires at least one positive target allocation.');
    }

    this.normalizedWeights = Object.fromEntries(weightEntries) as Record<Address, bigint>;
    this.totalWeight = weightEntries.reduce((acc, [, weight]) => acc + weight, 0n);
  }

  getRebalanceActions(currentBalances: Record<Address, bigint>): RebalanceAction[] {
    const tokens = new Set<Address>([
      ...Object.keys(this.normalizedWeights).map((token) => token as Address),
      ...Object.keys(currentBalances).map((token) => token as Address),
    ]);

    let totalBalance = 0n;
    for (const token of tokens) {
      totalBalance += currentBalances[token] ?? 0n;
    }

    if (totalBalance === 0n) {
      return [];
    }

    const sellers: Array<{ token: Address; amount: bigint }> = [];
    const buyers: Array<{ token: Address; amount: bigint }> = [];

    for (const token of tokens) {
      const current = currentBalances[token] ?? 0n;
      const weight = this.normalizedWeights[token] ?? 0n;
      const target = (totalBalance * weight) / this.totalWeight;

      if (current > target) {
        sellers.push({ token, amount: current - target });
      } else if (target > current) {
        buyers.push({ token, amount: target - current });
      }
    }

    const actions: RebalanceAction[] = [];
    let buyerIdx = 0;

    for (const seller of sellers) {
      let remaining = seller.amount;
      while (remaining > 0n && buyerIdx < buyers.length) {
        const buyer = buyers[buyerIdx];
        const tradeAmount = remaining <= buyer.amount ? remaining : buyer.amount;

        if (tradeAmount > 0n && seller.token.toLowerCase() !== buyer.token.toLowerCase()) {
          actions.push({
            tokenIn: seller.token,
            tokenOut: buyer.token,
            amount: tradeAmount,
          });
        }

        remaining -= tradeAmount;
        buyer.amount -= tradeAmount;
        if (buyer.amount === 0n) {
          buyerIdx += 1;
        }
      }
    }

    return actions;
  }
}

export class RiskManager {
  constructor(private readonly limits: RiskLimits) {}

  validateAction(
    action: RiskValidationAction,
    context: RiskValidationContext,
  ): { approved: boolean; reason: string } {
    const amountUsd = action.amountUsd;
    if (typeof amountUsd !== 'number' || Number.isNaN(amountUsd) || amountUsd <= 0) {
      return {
        approved: false,
        reason: 'Missing or invalid USD notional for risk checks.',
      };
    }

    if (amountUsd > this.limits.maxSingleTradeUsd) {
      return {
        approved: false,
        reason: `Trade notional ${amountUsd.toFixed(2)} exceeds single-trade limit ${this.limits.maxSingleTradeUsd.toFixed(2)}.`,
      };
    }

    const dailyVolumeAfter = context.dailyVolumeUsd + amountUsd;
    if (dailyVolumeAfter > this.limits.maxDailyVolumeUsd) {
      return {
        approved: false,
        reason: `Daily volume ${dailyVolumeAfter.toFixed(2)} exceeds limit ${this.limits.maxDailyVolumeUsd.toFixed(2)}.`,
      };
    }

    const slippageBps = action.slippageBps ?? 0;
    if (slippageBps > this.limits.maxSlippageBps) {
      return {
        approved: false,
        reason: `Estimated slippage ${slippageBps.toFixed(2)} bps exceeds limit ${this.limits.maxSlippageBps} bps.`,
      };
    }

    const confidence = action.confidence ?? 1;
    if (confidence < this.limits.minConfidence) {
      return {
        approved: false,
        reason: `Confidence ${confidence.toFixed(2)} is below minimum ${this.limits.minConfidence.toFixed(2)}.`,
      };
    }

    return {
      approved: true,
      reason: 'Approved by risk policy.',
    };
  }
}

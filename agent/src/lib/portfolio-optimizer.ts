import OpenAI from 'openai';
import { createVeniceClient } from './venice.js';

export type PortfolioRiskTolerance = 'low' | 'medium' | 'high';
export type PortfolioTimeHorizon = 'short-term' | 'medium-term' | 'long-term';

export interface HoldingInput {
  token: string;
  amount?: number;
  valueUsd: number;
}

export interface AllocationRecommendation {
  token: string;
  targetWeightPct: number;
  reasoning: string;
}

export interface PortfolioOptimizationResult {
  summary: string;
  recommendations: AllocationRecommendation[];
  confidence: number;
}

export interface BacktestStrategy {
  allocations: Array<{
    token: string;
    weightPct: number;
  }>;
  initialCapital?: number;
}

export interface BacktestMetrics {
  daysSimulated: number;
  startValue: number;
  endValue: number;
  totalReturnPct: number;
  annualizedReturnPct: number;
  volatilityPct: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  dailyReturns: number[];
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeWeights(
  allocations: BacktestStrategy['allocations'],
): Array<{ token: string; weight: number }> {
  const filtered = allocations
    .map((entry) => ({ token: entry.token, weight: Math.max(0, entry.weightPct) / 100 }))
    .filter((entry) => entry.weight > 0);

  const total = filtered.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    return [];
  }

  return filtered.map((entry) => ({
    token: entry.token,
    weight: entry.weight / total,
  }));
}

export class PortfolioOptimizer {
  private readonly veniceClient: OpenAI;

  constructor(
    veniceApiKey: string,
    private readonly model = 'gemini-3-flash-preview',
  ) {
    this.veniceClient = createVeniceClient(veniceApiKey);
  }

  async optimize(
    currentHoldings: HoldingInput[],
    riskTolerance: PortfolioRiskTolerance,
    timeHorizon: PortfolioTimeHorizon,
  ): Promise<PortfolioOptimizationResult> {
    const fallback: PortfolioOptimizationResult = {
      summary: 'Optimization unavailable. Returning baseline allocation from current holdings.',
      recommendations: this.buildFallbackAllocation(currentHoldings),
      confidence: 0,
    };

    const completion = await this.veniceClient.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a quantitative portfolio optimizer.
Given holdings, risk tolerance, and time horizon, return an allocation plan.
Respond ONLY as JSON with this schema:
{
  "summary": "string",
  "recommendations": [
    { "token": "string", "targetWeightPct": 0-100, "reasoning": "string" }
  ],
  "confidence": 0-1
}
Rules:
- targetWeightPct values must be non-negative and total approximately 100.
- Use concise, execution-oriented reasoning for each allocation.
- If uncertainty is high, lower confidence.
`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            currentHoldings,
            riskTolerance,
            timeHorizon,
          }),
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(content) as PortfolioOptimizationResult;
      const recommendations = Array.isArray(parsed.recommendations)
        ? parsed.recommendations
            .filter((item) => item && typeof item.token === 'string')
            .map((item) => ({
              token: item.token,
              targetWeightPct: clamp(Number(item.targetWeightPct) || 0, 0, 100),
              reasoning: typeof item.reasoning === 'string' ? item.reasoning : '',
            }))
        : [];

      if (recommendations.length === 0) {
        return fallback;
      }

      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary : fallback.summary,
        recommendations,
        confidence: clamp(Number(parsed.confidence) || 0, 0, 1),
      };
    } catch {
      return fallback;
    }
  }

  backtest(
    strategy: BacktestStrategy,
    historicalPrices: Record<string, number[]>,
    days: number,
  ): BacktestMetrics {
    const weights = normalizeWeights(strategy.allocations);
    if (weights.length === 0) {
      return {
        daysSimulated: 0,
        startValue: strategy.initialCapital ?? 1,
        endValue: strategy.initialCapital ?? 1,
        totalReturnPct: 0,
        annualizedReturnPct: 0,
        volatilityPct: 0,
        sharpeRatio: 0,
        maxDrawdownPct: 0,
        dailyReturns: [],
      };
    }

    const maxDays = Math.max(2, Math.floor(days));
    const availableDays = Math.min(
      maxDays,
      ...weights.map((entry) => historicalPrices[entry.token]?.length ?? 0),
    );

    if (availableDays < 2) {
      return {
        daysSimulated: 0,
        startValue: strategy.initialCapital ?? 1,
        endValue: strategy.initialCapital ?? 1,
        totalReturnPct: 0,
        annualizedReturnPct: 0,
        volatilityPct: 0,
        sharpeRatio: 0,
        maxDrawdownPct: 0,
        dailyReturns: [],
      };
    }

    const dailyReturns: number[] = [];
    const startValue = strategy.initialCapital ?? 1;
    let portfolioValue = startValue;
    let peak = portfolioValue;
    let maxDrawdown = 0;

    for (let i = 1; i < availableDays; i += 1) {
      let dayReturn = 0;

      for (const { token, weight } of weights) {
        const prices = historicalPrices[token];
        if (!prices || prices[i - 1] <= 0 || prices[i] <= 0) {
          continue;
        }

        const tokenReturn = prices[i] / prices[i - 1] - 1;
        dayReturn += tokenReturn * weight;
      }

      dailyReturns.push(dayReturn);
      portfolioValue *= 1 + dayReturn;
      if (portfolioValue > peak) {
        peak = portfolioValue;
      }

      if (peak > 0) {
        const drawdown = (peak - portfolioValue) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    const totalReturn = startValue > 0 ? portfolioValue / startValue - 1 : 0;
    const annualizedReturn =
      dailyReturns.length > 0
        ? (1 + totalReturn) ** (365 / dailyReturns.length) - 1
        : 0;
    const mean =
      dailyReturns.length > 0
        ? dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length
        : 0;
    const variance =
      dailyReturns.length > 1
        ? dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
          (dailyReturns.length - 1)
        : 0;

    return {
      daysSimulated: dailyReturns.length,
      startValue,
      endValue: portfolioValue,
      totalReturnPct: totalReturn * 100,
      annualizedReturnPct: annualizedReturn * 100,
      volatilityPct: Math.sqrt(Math.max(variance, 0)) * Math.sqrt(365) * 100,
      sharpeRatio: this.calculateSharpeRatio(dailyReturns),
      maxDrawdownPct: maxDrawdown * 100,
      dailyReturns,
    };
  }

  calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) {
      return 0;
    }

    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance =
      returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
    const stdev = Math.sqrt(Math.max(variance, 0));

    if (stdev === 0) {
      return 0;
    }

    return (mean / stdev) * Math.sqrt(365);
  }

  private buildFallbackAllocation(holdings: HoldingInput[]): AllocationRecommendation[] {
    const totalValue = holdings.reduce((sum, holding) => sum + Math.max(0, holding.valueUsd), 0);

    if (totalValue <= 0) {
      return [];
    }

    return holdings
      .filter((holding) => holding.valueUsd > 0)
      .map((holding) => ({
        token: holding.token,
        targetWeightPct: (holding.valueUsd / totalValue) * 100,
        reasoning: 'Maintains current portfolio weighting as a conservative fallback.',
      }));
  }
}

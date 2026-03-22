import OpenAI from 'openai';

export type StrategyAction = 'transfer' | 'hold' | 'rebalance';
export type TimeHorizon = 'immediate' | 'short-term' | 'long-term';

export interface StrategyAnalysis {
  action: StrategyAction | string;
  reasoning: string;
  confidence: number;
}

export interface MarketPairRecommendation {
  buyToken: string;
  sellToken: string;
  positionSizePct: number;
  riskScore: number;
  timeHorizon: TimeHorizon;
  rationale: string;
}

export interface MarketConditionsAnalysis {
  summary: string;
  recommendations: MarketPairRecommendation[];
  portfolioRiskScore: number;
  confidence: number;
}

export interface PortfolioHealthAnalysis {
  healthScore: number;
  riskScore: number;
  diversificationScore: number;
  utilizationPct: number;
  recommendations: string[];
  summary: string;
}

export function createVeniceClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.venice.ai/api/v1',
  });
}

export async function analyzeStrategy(
  client: OpenAI,
  context: string,
  model = 'gemini-3-flash-preview'
): Promise<{ action: string; reasoning: string; confidence: number }> {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are an AI agent treasury analyst. Analyze the given on-chain data and treasury state.
Respond in JSON format with: {"action": "transfer|hold|rebalance", "reasoning": "...", "confidence": 0.0-1.0}
Be conservative. Only recommend actions with high confidence.`,
      },
      { role: 'user', content: context },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const content = completion.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    return { action: 'hold', reasoning: 'Failed to parse response', confidence: 0 };
  }
}

export async function analyzeMarketConditions(
  client: OpenAI,
  context: string,
  model = 'gemini-3-flash-preview',
): Promise<MarketConditionsAnalysis> {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a quantitative market analyst focused on on-chain treasury execution.
Use only the provided context, reason numerically, and prioritize risk-adjusted return.
Respond ONLY in JSON with this schema:
{
  "summary": "string",
  "recommendations": [
    {
      "buyToken": "token symbol or address",
      "sellToken": "token symbol or address",
      "positionSizePct": 0-100,
      "riskScore": 1-10,
      "timeHorizon": "immediate|short-term|long-term",
      "rationale": "string"
    }
  ],
  "portfolioRiskScore": 1-10,
  "confidence": 0-1
}
Requirements:
- Provide specific buy/sell token pairs.
- Position size must be a percent of available allowance.
- Risk scores are integers from 1 (low) to 10 (high).
- Time horizon must be immediate, short-term, or long-term.
- If no trade is attractive, return an empty recommendations array and explain why in summary.`,
      },
      { role: 'user', content: context },
    ],
    temperature: 0.2,
    max_tokens: 900,
  });

  const fallback: MarketConditionsAnalysis = {
    summary: 'Failed to parse response.',
    recommendations: [],
    portfolioRiskScore: 10,
    confidence: 0,
  };

  const content = completion.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content) as MarketConditionsAnalysis;
  } catch {
    return fallback;
  }
}

export async function analyzePortfolioHealth(
  client: OpenAI,
  balances: string,
  allowances: string,
  model = 'gemini-3-flash-preview',
): Promise<PortfolioHealthAnalysis> {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a quantitative portfolio risk analyst for an autonomous treasury.
Assess portfolio health using concentration, liquidity, allowance utilization, and operational risk.
Respond ONLY in JSON with this schema:
{
  "healthScore": 1-10,
  "riskScore": 1-10,
  "diversificationScore": 1-10,
  "utilizationPct": 0-100,
  "recommendations": ["string", "string"],
  "summary": "string"
}
Requirements:
- Use integer scores from 1 to 10.
- Include concrete, actionable recommendations tied to balances/allowances.
- Keep recommendations concise and execution-oriented.`,
      },
      {
        role: 'user',
        content: `Balances:\n${balances}\n\nAllowances:\n${allowances}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 700,
  });

  const fallback: PortfolioHealthAnalysis = {
    healthScore: 1,
    riskScore: 10,
    diversificationScore: 1,
    utilizationPct: 0,
    recommendations: ['Failed to parse AI response.'],
    summary: 'Portfolio analysis unavailable due to parse failure.',
  };

  const content = completion.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content) as PortfolioHealthAnalysis;
  } catch {
    return fallback;
  }
}

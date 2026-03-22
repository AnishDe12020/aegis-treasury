import OpenAI from 'openai';
import { createVeniceClient } from './venice.js';

export type SentimentLabel = 'bullish' | 'neutral' | 'bearish';

export interface TokenSentiment {
  token: string;
  sentiment: SentimentLabel;
  score: number;
  rationale: string;
}

export interface MarketSentimentResult {
  overallSentiment: SentimentLabel;
  confidence: number;
  summary: string;
  tokens: TokenSentiment[];
}

export interface FearGreedResult {
  score: number;
  label: 'extreme fear' | 'fear' | 'neutral' | 'greed' | 'extreme greed';
  reasoning: string;
}

export interface TrendingTokenAnalysis {
  token: string;
  momentum: 'rising' | 'stable' | 'fading';
  confidence: number;
  rationale: string;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeSentiment(value: unknown): SentimentLabel {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if (normalized === 'bullish' || normalized === 'neutral' || normalized === 'bearish') {
    return normalized;
  }
  return 'neutral';
}

function fearGreedLabel(score: number): FearGreedResult['label'] {
  if (score <= 20) return 'extreme fear';
  if (score <= 40) return 'fear';
  if (score <= 60) return 'neutral';
  if (score <= 80) return 'greed';
  return 'extreme greed';
}

function normalizeMomentum(value: unknown): TrendingTokenAnalysis['momentum'] {
  if (value === 'rising' || value === 'stable' || value === 'fading') {
    return value;
  }
  return 'stable';
}

export class MarketSentimentAnalyzer {
  private readonly veniceClient: OpenAI;
  private readonly model: string;

  constructor(veniceApiKey: string, model = 'gemini-3-flash-preview') {
    this.veniceClient = createVeniceClient(veniceApiKey);
    this.model = model;
  }

  async analyzeSentiment(tokens: string[], context: string): Promise<MarketSentimentResult> {
    const fallback: MarketSentimentResult = {
      overallSentiment: 'neutral',
      confidence: 0,
      summary: 'Sentiment analysis unavailable.',
      tokens: tokens.map((token) => ({
        token,
        sentiment: 'neutral',
        score: 50,
        rationale: 'Fallback sentiment due to unavailable model response.',
      })),
    };

    const completion = await this.veniceClient.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a crypto market sentiment analyst.
Respond ONLY in JSON with this schema:
{
  "overallSentiment": "bullish|neutral|bearish",
  "confidence": 0-1,
  "summary": "string",
  "tokens": [
    {
      "token": "string",
      "sentiment": "bullish|neutral|bearish",
      "score": 1-100,
      "rationale": "string"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: JSON.stringify({ tokens, context }),
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(content) as Partial<MarketSentimentResult>;
      const tokenSentiment = Array.isArray(parsed.tokens)
        ? parsed.tokens
            .filter((entry) => entry && typeof entry.token === 'string')
            .map((entry) => ({
              token: entry.token,
              sentiment: normalizeSentiment(entry.sentiment),
              score: clamp(Number(entry.score) || 50, 1, 100),
              rationale: typeof entry.rationale === 'string' ? entry.rationale : '',
            }))
        : [];

      return {
        overallSentiment: normalizeSentiment(parsed.overallSentiment),
        confidence: clamp(Number(parsed.confidence) || 0, 0, 1),
        summary:
          typeof parsed.summary === 'string' ? parsed.summary : 'Sentiment summary unavailable.',
        tokens: tokenSentiment.length > 0 ? tokenSentiment : fallback.tokens,
      };
    } catch {
      return fallback;
    }
  }

  async getFearGreedIndex(marketData: Record<string, unknown>): Promise<FearGreedResult> {
    const completion = await this.veniceClient.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a crypto risk sentiment model.
Compute a Fear & Greed score from 1 to 100 based on the provided market data.
Respond ONLY as JSON:
{
  "score": 1-100,
  "reasoning": "string"
}`,
        },
        {
          role: 'user',
          content: JSON.stringify(marketData),
        },
      ],
      temperature: 0.1,
      max_tokens: 400,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(content) as { score?: number; reasoning?: string };
      const score = clamp(Number(parsed.score) || 50, 1, 100);
      return {
        score,
        label: fearGreedLabel(score),
        reasoning:
          typeof parsed.reasoning === 'string'
            ? parsed.reasoning
            : 'Fear & Greed model returned limited context.',
      };
    } catch {
      const score = 50;
      return {
        score,
        label: fearGreedLabel(score),
        reasoning: 'Fear & Greed calculation unavailable. Returning neutral fallback.',
      };
    }
  }

  async getTrendingTokens(count: number): Promise<TrendingTokenAnalysis[]> {
    const safeCount = Math.max(1, Math.floor(count));

    const completion = await this.veniceClient.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a crypto market trend analyst.
List top trending tokens and why.
Respond ONLY as JSON:
{
  "tokens": [
    {
      "token": "string",
      "momentum": "rising|stable|fading",
      "confidence": 0-1,
      "rationale": "string"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Return exactly ${safeCount} tokens ranked by current trend strength.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(content) as {
        tokens?: Array<Partial<TrendingTokenAnalysis>>;
      };

      const tokens = Array.isArray(parsed.tokens)
        ? parsed.tokens
            .filter((entry) => entry && typeof entry.token === 'string')
            .map((entry) => ({
              token: entry.token as string,
              momentum: normalizeMomentum(entry.momentum),
              confidence: clamp(Number(entry.confidence) || 0, 0, 1),
              rationale: typeof entry.rationale === 'string' ? entry.rationale : '',
            }))
            .slice(0, safeCount)
        : [];

      if (tokens.length === 0) {
        return [
          {
            token: 'BTC',
            momentum: 'stable' as const,
            confidence: 0,
            rationale: 'Trending token output unavailable. Returning fallback.',
          },
        ].slice(0, safeCount);
      }

      return tokens;
    } catch {
      return [
        {
          token: 'BTC',
          momentum: 'stable' as const,
          confidence: 0,
          rationale: 'Trending token output unavailable. Returning fallback.',
        },
      ].slice(0, safeCount);
    }
  }
}

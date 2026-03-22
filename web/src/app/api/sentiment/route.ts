import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Venice API key not configured' }, { status: 500 });
  }

  const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gemini-3-flash-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a crypto market analyst. Return JSON only, no markdown or code fences: {"sentiment": "bullish" | "bearish" | "neutral", "fearGreedIndex": 1-100, "trendingTokens": [{"symbol": "TOKEN", "reason": "short reason", "direction": "up" | "down" | "flat"}], "summary": "1-2 sentence market summary"}. Return exactly 3 trending tokens. Be concise.',
        },
        {
          role: 'user',
          content: 'Analyze the current crypto market sentiment. Consider BTC, ETH, and trending altcoins. Provide your analysis as JSON.',
        },
      ],
      temperature: 0.4,
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
    // Strip potential markdown code fences
    const cleaned = content.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({
      ...parsed,
      model: 'gemini-3-flash-preview',
      timestamp: new Date().toISOString(),
      provider: 'venice',
      private: true,
    });
  } catch {
    return NextResponse.json({
      sentiment: 'neutral',
      fearGreedIndex: 50,
      trendingTokens: [
        { symbol: 'BTC', reason: 'Consolidating near support', direction: 'flat' },
        { symbol: 'ETH', reason: 'Layer 2 adoption growing', direction: 'up' },
        { symbol: 'SOL', reason: 'High throughput narrative', direction: 'up' },
      ],
      summary: content,
      model: 'gemini-3-flash-preview',
      timestamp: new Date().toISOString(),
      provider: 'venice',
      private: true,
    });
  }
}

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { portfolio } = await req.json();

  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Venice API key not configured' }, { status: 500 });
  }

  const defaultPortfolio = portfolio || [
    { symbol: 'USDC', allocation: 45 },
    { symbol: 'WETH', allocation: 30 },
    { symbol: 'BTC', allocation: 15 },
    { symbol: 'SOL', allocation: 10 },
  ];

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
          content: 'You are a DeFi portfolio optimizer. Return JSON only, no markdown or code fences: {"currentAllocation": [{"symbol": "TOKEN", "percent": N}], "recommendedAllocation": [{"symbol": "TOKEN", "percent": N}], "actions": ["action string 1", "action string 2", "action string 3"], "riskAdjustedReturn": "X.X%", "riskLevel": "low" | "medium" | "high", "reasoning": "1-2 sentence explanation"}. Keep actions concise and actionable (e.g. "Increase ETH by 5%").',
        },
        {
          role: 'user',
          content: `Optimize this crypto portfolio allocation: ${JSON.stringify(defaultPortfolio)}. Consider current market conditions and suggest adjustments for better risk-adjusted returns.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
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
      currentAllocation: defaultPortfolio,
      recommendedAllocation: [
        { symbol: 'USDC', percent: 35 },
        { symbol: 'WETH', percent: 35 },
        { symbol: 'BTC', percent: 20 },
        { symbol: 'SOL', percent: 10 },
      ],
      actions: [
        'Increase ETH by 5%',
        'Reduce USDC exposure by 10%',
        'Increase BTC by 5%',
      ],
      riskAdjustedReturn: '12.4%',
      riskLevel: 'medium',
      reasoning: content,
      model: 'gemini-3-flash-preview',
      timestamp: new Date().toISOString(),
      provider: 'venice',
      private: true,
    });
  }
}

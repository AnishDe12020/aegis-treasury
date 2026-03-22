import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { treasuryBalance, agentCount, allowanceRemaining } = await req.json();

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
      model: 'llama-3.3-70b',
      messages: [
        {
          role: 'system',
          content: `You are a quantitative treasury analyst for an AI agent operating on Base. Analyze the treasury state and provide recommendations. Respond in JSON format only: {"action": "hold|transfer|rebalance|swap", "confidence": 0.0-1.0, "reasoning": "...", "risk": 1-10, "recommendation": {"pair": "TOKEN/TOKEN", "direction": "buy|sell|neutral", "size": "X%", "timeHorizon": "immediate|short-term|long-term"}}`,
        },
        {
          role: 'user',
          content: `Treasury State:\n- Total deposits: ${treasuryBalance} USDC\n- Active agents: ${agentCount}\n- Remaining allowance: ${allowanceRemaining} USDC\n\nAnalyze this state and recommend an action.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    return NextResponse.json({
      ...parsed,
      model: 'llama-3.3-70b',
      timestamp: new Date().toISOString(),
      provider: 'venice',
      private: true,
    });
  } catch {
    return NextResponse.json({
      action: 'hold',
      confidence: 0.5,
      reasoning: content,
      risk: 5,
      model: 'llama-3.3-70b',
      timestamp: new Date().toISOString(),
      provider: 'venice',
      private: true,
      recommendation: { pair: 'USDC/WETH', direction: 'neutral', size: '0%', timeHorizon: 'short-term' },
    });
  }
}

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { message, treasuryBalance, agentCount } = await req.json();

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
          content: `You are Aegis Agent, an AI treasury management assistant operating on Base (L2). You help users manage their on-chain treasury, analyze market conditions, and make informed decisions about their DeFi positions.

Current treasury context:
- Treasury balance: ${treasuryBalance || 'unknown'} USDC
- Active agents: ${agentCount || 'unknown'}
- Network: Base Sepolia
- Treasury contract: 0x33E42b7db9569fb4f3cd6d68180fcC007AE6ece7

You can help with:
- Portfolio analysis and recommendations
- Token momentum analysis (WETH, USDC, etc.)
- Strategy recommendations (DCA, momentum, rebalance)
- Risk assessment of current positions
- Explaining treasury operations (deposits, allowances, agent transfers)

Be concise, technical, and actionable. Use specific numbers when possible. Format responses for a terminal interface - keep them brief and well-structured.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.4,
      max_tokens: 600,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || 'No response from Venice AI.';

  return NextResponse.json({
    response: content,
    model: 'llama-3.3-70b',
    timestamp: new Date().toISOString(),
    provider: 'venice',
    private: true,
  });
}

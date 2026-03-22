import OpenAI from 'openai';

export function createVeniceClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.venice.ai/api/v1',
  });
}

export async function analyzeStrategy(
  client: OpenAI,
  context: string,
  model = 'llama-3.3-70b'
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

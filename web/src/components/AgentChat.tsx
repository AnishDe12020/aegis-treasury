'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import {
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  TREASURY_ABI,
} from '@/lib/contracts';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
}

const PREBUILT_COMMANDS = [
  { label: 'analyze portfolio', command: 'Analyze the current portfolio and treasury state. What is the health of the treasury and what should we do?' },
  { label: 'check momentum WETH', command: 'Analyze WETH momentum on Base. What are the current trends, support/resistance levels, and should we be buying or selling?' },
  { label: 'recommend strategy', command: 'Based on the current treasury state, which trading strategy should I use? Compare DCA, momentum, and rebalance strategies.' },
  { label: 'risk assessment', command: 'Evaluate the current risk profile of the treasury. Consider concentration risk, liquidity risk, and market risk.' },
];

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'system-init',
      role: 'system',
      content: 'Aegis Agent connected. Venice AI private inference active. Type a command or click a suggestion below.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Read treasury data
  const { data: treasuryBalance } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: 'deposits',
    args: [USDC_ADDRESS],
  });

  const { data: agentCount } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: 'getAgentCount',
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const balance = treasuryBalance
        ? formatUnits(treasuryBalance as bigint, USDC_DECIMALS)
        : '0';
      const agents = agentCount ? Number(agentCount) : 0;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText.trim(),
          treasuryBalance: balance,
          agentCount: agents,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get response');
      }

      const data = await res.json();

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: data.response,
        timestamp: data.timestamp,
      };

      setMessages(prev => [...prev, agentMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `system-err-${Date.now()}`,
        role: 'system',
        content: 'Error: Failed to reach Venice AI. Check API configuration.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, treasuryBalance, agentCount]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="terminal-panel flex flex-col h-full">
      {/* Header */}
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">
            Agent Chat
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] px-2 py-0.5 text-[9px] font-semibold text-purple-400">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Private
          </span>
          {loading && (
            <span className="text-[9px] text-purple-400 animate-pulse">
              Thinking...
            </span>
          )}
        </div>
        <span className="text-[10px] text-aegis-muted font-mono">venice / gemini-3-flash (private)</span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 space-y-2 text-[11px] font-mono min-h-[300px] max-h-[500px]"
      >
        {messages.map(msg => (
          <div key={msg.id} className="leading-relaxed">
            {msg.role === 'system' && (
              <div className="text-emerald-400">
                <span className="text-emerald-600">[system]</span> {msg.content}
              </div>
            )}
            {msg.role === 'user' && (
              <div className="text-white">
                <span className="text-blue-400">&gt;</span> {msg.content}
              </div>
            )}
            {msg.role === 'agent' && (
              <div className="text-cyan-400 whitespace-pre-wrap pl-2 border-l border-cyan-400/20">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="text-purple-400 animate-pulse">
            <span className="text-purple-600">[agent]</span> Thinking
            <span className="inline-block w-4 text-left animate-[ellipsis_1.5s_steps(4,end)_infinite]">...</span>
          </div>
        )}
      </div>

      {/* Pre-built commands */}
      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {PREBUILT_COMMANDS.map(cmd => (
          <button
            key={cmd.label}
            onClick={() => sendMessage(cmd.command)}
            disabled={loading}
            className="rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[9px] font-mono text-aegis-text-dim transition-colors hover:border-purple-400/30 hover:text-purple-400 hover:bg-[rgba(139,92,246,0.08)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            /{cmd.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-[rgba(255,255,255,0.06)] p-2">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-[11px] font-mono">&gt;</span>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            disabled={loading}
            className="flex-1 bg-transparent text-[11px] font-mono text-white placeholder-aegis-muted outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="rounded px-2 py-1 text-[9px] font-semibold text-purple-400 bg-[rgba(139,92,246,0.1)] hover:bg-[rgba(139,92,246,0.2)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

# Aegis — Agent Treasury with Scoped Delegations

**Aegis** is a treasury system that lets humans safely delegate spending authority to AI agents on Base. Agents operate within human-defined bounds — spending caps, allowed targets, and time windows — while every action is logged on-chain for full auditability.

## The Problem

AI agents need to spend money on behalf of humans. Today, the options are:

1. **Give the agent your private key** — full trust, full risk. If the agent is compromised, everything is gone.
2. **Co-sign every transaction** — safe but defeats the purpose of an autonomous agent.

There's no middle ground: scoped, revocable spending authority that lets agents act autonomously within bounds.

## How Aegis Works

```
Human                          Aegis Treasury                    AI Agent
  │                                 │                                │
  ├──── Deposit USDC ──────────────►│                                │
  │                                 │                                │
  ├──── Set Agent Allowance ───────►│  (500 USDC, expires in 24h,   │
  │     (token, max, expiry,        │   only send to Uniswap)       │
  │      allowed targets)           │                                │
  │                                 │                                │
  │                                 │◄─── agentTransfer() ──────────┤
  │                                 │     (within bounds,            │
  │                                 │      reason logged on-chain)   │
  │                                 │                                │
  ├──── Revoke (anytime) ─────────►│  ✗ Agent can no longer spend   │
  │                                 │                                │
  ├──── Monitor (events) ◄─────────│  📋 Full audit trail           │
```

### Key Properties

- **Bounded risk**: Agents can only spend up to their allowance. If compromised, damage is capped.
- **Target restrictions**: Limit which addresses the agent can send to (e.g., only DEX routers).
- **Time-bound**: Allowances can expire automatically.
- **Instant revocation**: Owner can revoke any agent's access immediately.
- **On-chain audit trail**: Every agent action emits events with the agent's stated reason.
- **Private strategy**: Agent uses Venice AI for private inference — strategy analysis never leaves the agent.

## Architecture

```
contracts/          Solidity — AegisTreasury vault (Foundry)
agent/              TypeScript — Autonomous agent SDK + Venice AI integration
web/                Next.js — Dashboard for managing delegations
```

## Smart Contract: AegisTreasury

The contract is deliberately thin:

- `deposit(token, amount)` — Owner deposits ERC-20 tokens
- `withdraw(token, amount)` — Owner withdraws tokens
- `setAgentAllowance(agent, token, maxAmount, expiry, allowedTargets)` — Scope an agent's spending
- `revokeAgentAllowance(agent, token)` — Revoke immediately
- `agentTransfer(token, to, amount, reason)` — Agent spends within bounds (reason logged on-chain)

## Agent SDK

```typescript
import { createClients, getRemainingAllowance, agentTransfer } from '@aegis/agent';

const { account, publicClient, walletClient } = createClients(privateKey);

// Check what the agent is allowed to do
const remaining = await getRemainingAllowance(publicClient, treasury, account.address, usdc);

// Execute within bounds — reason is logged on-chain
await agentTransfer(walletClient, publicClient, treasury, usdc, recipient, amount, 'Rebalancing portfolio');
```

## Quick Start

### Prerequisites
- Node.js 18+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A Base Sepolia RPC URL

### Deploy Contract
```bash
cd contracts
forge build
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --private-key $PRIVATE_KEY
```

### Run Agent
```bash
cd agent
npm install
cp .env.example .env  # Fill in your keys
npm start
```

### Run Dashboard
```bash
cd web
npm install
npm run dev
```

## Bounty Tracks

- **MetaMask Delegation** — Scoped, revocable spending permissions for AI agents
- **Venice** — Private inference for agent strategy analysis
- **Protocol Labs** — Autonomous agent with on-chain identity and execution logs
- **Open Track** — Agent treasury infrastructure

## Tech Stack

- **Solidity** (Foundry) — AegisTreasury contract on Base
- **TypeScript** — Agent SDK with viem
- **Venice AI** — Private inference via OpenAI-compatible API
- **Next.js** — Web dashboard with wagmi
- **Base** — L2 deployment (low gas, fast finality)

## License

MIT

---

*Built at [The Synthesis](https://synthesis.md) — the first hackathon you can enter without a body.*

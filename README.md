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

## Deployed Contracts (Base Sepolia)

| Contract | Address | Explorer |
|----------|---------|----------|
| AegisTreasury | `0x33E42b7db9569fb4f3cd6d68180fcC007AE6ece7` | [BaseScan](https://sepolia.basescan.org/address/0x33E42b7db9569fb4f3cd6d68180fcC007AE6ece7) |
| MockUSDC | `0x62932909ab43336B6710444DA8232333157a6f7c` | [BaseScan](https://sepolia.basescan.org/address/0x62932909ab43336B6710444DA8232333157a6f7c) |

### On-Chain Proof

- **Agent Transfer** (10 USDC, reason logged on-chain): [`0x7421a7...`](https://sepolia.basescan.org/tx/0x7421a7528b4a1f863be14d91fab0cffdee7369f6790a551750c829117ef8e1a0)
- **Treasury Deposit** (1000 USDC): [`0x468a63...`](https://sepolia.basescan.org/tx/0x468a63a5834311af4957826cc989bb6e772aa8b6ebdfcc645e1bf2d0b37aab2f)
- **Agent Allowance Set** (500 USDC scope): [`0x6f2e1e...`](https://sepolia.basescan.org/tx/0x6f2e1e26275489720bb9a3c122f8a0ce1899b6f1e233ce40e3eeba08a982deea)

## MetaMask Delegation Framework

Aegis integrates the MetaMask Delegation Framework (`@metamask/smart-accounts-kit`) for production-grade scoped delegations:

- **CaveatBuilder** — combine `allowedTargets`, `timestamp`, and `erc20TransferAmount` enforcers
- **EIP-712 signed delegations** — off-chain creation, on-chain enforcement
- **Sub-delegations** — agents can further delegate narrowed authority to specialist sub-agents
- **Instant revocation** — delegator can disable any delegation at any time

See [`agent/src/lib/delegation.ts`](agent/src/lib/delegation.ts) and [`agent/src/lib/metamask-integration.ts`](agent/src/lib/metamask-integration.ts) for the full integration.

## Uniswap Integration

The agent can execute token swaps via Uniswap V3 on Base:

- **SwapRouter02** direct integration for `exactInputSingle` swaps
- **Uniswap Trading API** support for optimal routing across V2/V3/V4 + UniswapX
- **Automatic approval** management for ERC-20 tokens

See [`agent/src/lib/uniswap.ts`](agent/src/lib/uniswap.ts).

## Venice AI (Private Inference)

The agent uses Venice AI for privacy-preserving strategy analysis. Venice runs open-source models with zero data retention — the agent's strategy reasoning is never stored or visible to third parties.

## Bounty Tracks

| Track | Prize | Why Aegis Qualifies |
|-------|-------|-------------------|
| **MetaMask Delegation** | $5,000 | Creative use of CaveatBuilder with scoped ERC-20 permissions, time bounds, and target restrictions |
| **Venice** | $11,500 | Private inference for treasury analysis — strategy stays confidential |
| **Protocol Labs** | $16,000 | Autonomous agent with on-chain execution logs, ERC-8004 identity |
| **Uniswap** | $5,000 | Real swap integration via SwapRouter02 and Trading API |
| **Open Track** | $14,500 | Cross-sponsor agent treasury infrastructure |

## Tech Stack

- **Solidity** (Foundry) — AegisTreasury contract, 19 passing tests
- **TypeScript** — Agent SDK with viem, real on-chain execution
- **MetaMask Smart Accounts Kit** — Delegation framework with caveat enforcers
- **Venice AI** — Private inference via OpenAI-compatible API
- **Uniswap V3** — Token swap execution on Base
- **Next.js + wagmi** — Web dashboard with wallet connection
- **Base Sepolia** — L2 deployment (low gas, fast finality)

## License

MIT

---

*Built at [The Synthesis](https://synthesis.md) by [Anish De](https://x.com/AnishDe12020) and Opus (Claude Opus 4.6).*

<p align="center">
  <h1 align="center">Aegis</h1>
  <p align="center"><strong>Scoped treasury delegations for autonomous AI agents on Base</strong></p>
  <p align="center">
    <img src="https://img.shields.io/badge/Base-Sepolia-0052FF?style=flat-square&logo=ethereum" alt="Base Sepolia" />
    <img src="https://img.shields.io/badge/Foundry-Solidity%200.8.28-363636?style=flat-square" alt="Foundry" />
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
    <img src="https://img.shields.io/badge/Tests-50%20passing-brightgreen?style=flat-square" alt="Tests" />
  </p>
</p>

---

## The Problem

AI agents need to spend money on behalf of humans. Today there are only two options:

1. **Hand over your private key** -- the agent has full access. If it hallucinates, gets exploited, or its key leaks, your entire wallet is drained.
2. **Co-sign every transaction** -- safe, but you just became the agent's babysitter. Autonomy is gone.

There is no middle ground: a way to say *"spend up to 500 USDC, only on Uniswap, only until midnight, and I can pull the plug instantly."*

## The Solution

Aegis is a treasury vault that sits between the human and the agent. The human deposits funds and creates **scoped allowances** -- spending caps, allowed targets, and expiry windows. The agent operates autonomously within those bounds. Every action is logged on-chain with the agent's stated reason. The human can revoke access in a single transaction.

```
 ┌──────────┐         ┌──────────────────────┐         ┌──────────────┐
 │          │         │    Aegis Treasury     │         │   AI Agent   │
 │  Human   │         │                      │         │              │
 │ (Owner)  │         │  ┌────────────────┐  │         │  SwapAgent   │
 │          ├────────►│  │ Deposit USDC   │  │         │  Transfer    │
 │          │         │  └────────────────┘  │         │  Agent       │
 │          │         │                      │◄────────┤              │
 │          ├────────►│  ┌────────────────┐  │         │  agentTransfer()
 │          │         │  │ Set Allowance  │  │         │  "reason logged
 │          │         │  │ 500 USDC       │  │────────►│   on-chain"  │
 │          │         │  │ expires: 24h   │  │         │              │
 │          │         │  │ target: Uni V3 │  │         │  Momentum    │
 │          ├────────►│  └────────────────┘  │         │  analysis    │
 │          │         │                      │         │  via Venice  │
 │  Revoke  ├────────►│  ┌────────────────┐  │         │  (private)   │
 │  Pause   │         │  │ Agent BLOCKED  │  │         │              │
 │  Withdraw│         │  └────────────────┘  │         └──────────────┘
 └──────────┘         │                      │
                      │  Full audit trail    │
                      │  via on-chain events │
                      └──────────────────────┘
```

**Key properties:**
- **Bounded risk** -- damage from a compromised agent is capped at its allowance, not your entire wallet.
- **Target restrictions** -- lock the agent to specific contract addresses (e.g., only the Uniswap SwapRouter).
- **Time-bound** -- allowances expire automatically. No forgotten permissions.
- **Instant revocation** -- one transaction to cut off any agent, or `revokeAllAgents()` to shut down everything.
- **On-chain audit trail** -- every `agentTransfer` and `agentExecute` emits events with the agent's stated reason.
- **Private strategy** -- the agent's reasoning runs through Venice AI with zero data retention.

---

## Features

- **Scoped Allowances** -- configure per-agent spending caps, allowed recipient addresses, and Unix timestamp expiry. Allowances are per-token, so you can give one agent 500 USDC and another 0.1 WETH with completely independent controls.

- **Emergency Controls** -- `pause()` freezes all agent operations instantly. `emergencyWithdraw()` pulls all tokens of a given type back to the owner. `revokeAllAgents()` disables every active allowance for a token in one call.

- **Multi-Agent Orchestration** -- an `OrchestratorAgent` coordinates specialist `SwapAgent` and `TransferAgent` sub-agents. The orchestrator creates scoped sub-delegations so each specialist only has authority for its specific task.

- **Trading Strategies** -- three built-in strategies: Dollar-Cost Averaging (DCA), Momentum-based trading, and Portfolio Rebalancing. Each runs autonomously within the treasury's scoped allowance.

- **Risk Management** -- a `RiskManager` enforces max single-trade size, daily volume limits, slippage thresholds, and minimum confidence scores before any trade executes.

- **Private Inference (Venice AI)** -- strategy analysis runs on Venice AI's privacy-preserving infrastructure using open-source models (Llama 3.3 70B). Zero data retention -- the agent's reasoning is never stored or visible to third parties.

- **MetaMask Delegation Framework** -- integrates `@metamask/smart-accounts-kit` for production-grade EIP-712 signed delegations with `CaveatBuilder`, combining `allowedTargets`, `timestamp`, and `erc20TransferAmount` enforcers. Supports sub-delegations from orchestrator to specialist agents.

- **Uniswap V3 Integration** -- direct `SwapRouter02` integration for `exactInputSingle` swaps on Base, plus Uniswap Trading API support for optimal routing across V2/V3/V4 and UniswapX. Automatic ERC-20 approval management.

- **On-Chain Price Feeds** -- real-time price discovery via Uniswap V3 pool `quoteExactInputSingle`, including price impact calculation for risk assessment.

- **ERC-8004 Agent Identity** -- spec-compliant `agent.json` manifests and `agent_log.json` execution logs. Includes Identity Registry ABI helpers for on-chain agent registration and metadata management.

- **Factory Pattern** -- `AegisTreasuryFactory` deploys one vault per user and tracks all created vaults. Each vault is a standalone `AegisTreasury` with its own owner, agents, and allowances.

---

## Deployed Contracts (Base Sepolia)

| Contract | Address | Explorer |
|----------|---------|----------|
| AegisTreasury | `0x33E42b7db9569fb4f3cd6d68180fcC007AE6ece7` | [BaseScan](https://sepolia.basescan.org/address/0x33E42b7db9569fb4f3cd6d68180fcC007AE6ece7) |
| AegisTreasuryV2 | `0xF3c6Aec3125A45B10d074f19d3EE3D124e9F50D9` | [BaseScan](https://sepolia.basescan.org/address/0xF3c6Aec3125A45B10d074f19d3EE3D124e9F50D9) |
| AegisTreasuryFactory | `0x43EF4a074C9A00437B536533d6b6a95D7Bc0D9Fe` | [BaseScan](https://sepolia.basescan.org/address/0x43EF4a074C9A00437B536533d6b6a95D7Bc0D9Fe) |
| MockUSDC | `0x62932909ab43336B6710444DA8232333157a6f7c` | [BaseScan](https://sepolia.basescan.org/address/0x62932909ab43336B6710444DA8232333157a6f7c) |

### On-Chain Proof

Real transactions on Base Sepolia demonstrating the full flow:

| Action | Transaction | What It Proves |
|--------|-------------|----------------|
| Treasury Deposit (1,000 USDC) | [`0x468a63...`](https://sepolia.basescan.org/tx/0x468a63a5834311af4957826cc989bb6e772aa8b6ebdfcc645e1bf2d0b37aab2f) | Owner deposited funds into the vault |
| Agent Allowance Set (500 USDC scope) | [`0x6f2e1e...`](https://sepolia.basescan.org/tx/0x6f2e1e26275489720bb9a3c122f8a0ce1899b6f1e233ce40e3eeba08a982deea) | Scoped delegation created with spending cap |
| Agent Transfer (10 USDC, reason on-chain) | [`0x7421a7...`](https://sepolia.basescan.org/tx/0x7421a7528b4a1f863be14d91fab0cffdee7369f6790a551750c829117ef8e1a0) | Agent spent within bounds, reason logged in event |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A Base Sepolia RPC URL and funded wallet

### 1. Deploy Contracts

```bash
cd contracts
forge build
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --private-key $PRIVATE_KEY
```

### 2. Run the Agent

```bash
cd agent
npm install
cp .env.example .env  # Fill in AGENT_PRIVATE_KEY, TREASURY_ADDRESS, VENICE_API_KEY

# Single strategy run (dry-run by default)
npm start

# Live execution with a specific strategy
npm run start:live

# Multi-agent orchestration demo
npx tsx src/multi-agent.ts

# End-to-end demo with colored output
npx tsx src/demo.ts
```

### 3. Run the Dashboard

```bash
cd web
npm install
npm run dev
# Open http://localhost:3000
```

---

## Project Structure

```
aegis/
├── contracts/                    Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── AegisTreasury.sol          Core vault — deposits, allowances, agent transfers
│   │   ├── AegisTreasuryFactory.sol   Factory — one vault per user
│   │   ├── MockUSDC.sol               Test token (6 decimals)
│   │   └── interfaces/
│   │       └── IAegisTreasury.sol     Interface for external integrations
│   ├── test/
│   │   ├── AegisTreasury.t.sol        33 tests — allowances, transfers, edge cases, emergency controls
│   │   └── AegisTreasuryFactory.t.sol 5 tests — factory deployment and ownership
│   └── script/
│       └── Deploy.s.sol               Deployment script for Base Sepolia
│
├── agent/                        TypeScript autonomous agent
│   └── src/
│       ├── agent.ts                   Main agent loop (--strategy, --dry-run, --loop)
│       ├── multi-agent.ts             Multi-agent orchestration (Orchestrator → SwapAgent + TransferAgent)
│       ├── demo.ts                    E2E demo with colored terminal output
│       ├── index.ts                   SDK entry point
│       └── lib/
│           ├── client.ts              Viem client setup for Base Sepolia
│           ├── treasury.ts            AegisTreasury contract interactions
│           ├── trading.ts             DCA, Momentum, Rebalance, and RiskManager strategies
│           ├── delegation.ts          MetaMask Delegation Framework integration
│           ├── metamask-integration.ts CaveatBuilder + EIP-712 signing
│           ├── uniswap.ts             Uniswap V3 SwapRouter02 integration
│           ├── price-feed.ts          On-chain price discovery via Uniswap V3 pools
│           ├── venice.ts              Venice AI private inference client
│           ├── erc8004.ts             ERC-8004 agent identity manifests + execution logs
│           ├── batch.ts               Parallel batch queries
│           └── types.ts               Shared TypeScript types
│
└── web/                          Next.js dashboard
    └── src/
        ├── app/                       Pages and layout
        └── components/
            ├── Treasury.tsx           Deposit/withdraw UI
            ├── AllowanceList.tsx       View and revoke agent allowances
            ├── CreateAllowance.tsx     Create scoped delegations
            ├── AgentActivity.tsx       Real-time agent activity feed
            ├── ConnectButton.tsx       Wallet connection (ConnectKit)
            └── Providers.tsx           wagmi + React providers
```

---

## Trading Strategies

| Strategy | How It Works |
|----------|--------------|
| **DCA (Dollar-Cost Averaging)** | Splits a large order into `n` equal chunks executed at fixed intervals. The last chunk absorbs any remainder from integer division. Reduces timing risk. |
| **Momentum** | Queries Uniswap V3 pools at multiple sample amounts to build a unit-price curve. Classifies the trend as `up`, `down`, or `sideways` based on a 20 bps threshold. Calculates a confidence score from directional strength, consistency, and liquidity penalty. Blocks trades when the trend is `down` with high confidence. |
| **Rebalance** | Takes target weight allocations (e.g., 60% USDC / 40% WETH) and current balances. Computes the minimal set of trades to move from current to target weights. Pairs sellers with buyers to generate swap actions. |
| **Risk Manager** | Gate that every trade must pass. Enforces max single-trade USD notional, daily volume caps, slippage limits (in bps), and minimum confidence thresholds. Rejects trades that violate any constraint. |

---

## Bounty Tracks

| Track | Prize | Why Aegis Qualifies |
|-------|-------|---------------------|
| **MetaMask Delegation** | $5,000 | Creative use of CaveatBuilder with scoped ERC-20 permissions, time bounds, target restrictions, and sub-delegations from orchestrator to specialist agents |
| **Venice** | $11,500 | Private inference for treasury strategy analysis -- agent reasoning runs on Llama 3.3 70B with zero data retention |
| **Protocol Labs** | $16,000 | Autonomous agent with on-chain execution logs, ERC-8004 identity manifests, and verifiable action trails |
| **Uniswap** | $5,000 | Real swap integration via SwapRouter02 with `exactInputSingle`, on-chain price feeds from V3 pools, and momentum analysis using pool quotes |
| **Open Track** | $14,500 | Cross-sponsor agent treasury infrastructure combining delegations, private AI, DEX execution, and risk management into a single system |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.28, Foundry, OpenZeppelin (Ownable, Pausable, ReentrancyGuard, SafeERC20) |
| Agent Runtime | TypeScript, viem, Node.js 18+ |
| Delegation | MetaMask Smart Accounts Kit (`@metamask/smart-accounts-kit`), EIP-712 |
| AI Inference | Venice AI (OpenAI-compatible API), Llama 3.3 70B |
| DEX | Uniswap V3 SwapRouter02, QuoterV2 |
| Dashboard | Next.js 14, Tailwind CSS, wagmi, ConnectKit |
| Network | Base Sepolia (Chain ID 84532) -- low gas, fast finality |
| Identity | ERC-8004 agent manifests and execution logs |

---

## Testing

Aegis has **50 passing tests** covering the full contract surface:

```bash
cd contracts
forge test -vv
```

Tests cover:
- Deposits, withdrawals, and balance tracking
- Agent allowance creation, revocation, and expiry
- Scoped target restrictions (single and multiple targets)
- Cumulative spending enforcement
- Pause/unpause and emergency withdraw
- `revokeAllAgents()` bulk revocation
- `agentExecute()` for arbitrary calldata (DEX swaps)
- Factory deployment and per-user vault ownership
- Edge cases: zero addresses, zero amounts, expiry boundaries, re-setting allowances

---

## Built By

Built at [The Synthesis](https://synthesis.md) by:

- **[Anish De](https://x.com/AnishDe12020)** -- design, architecture, and implementation
- **Claude Opus 4.6** (Anthropic) -- pair programming, contract and agent development
- **OpenAI Codex** -- code generation assistance

---

## License

MIT

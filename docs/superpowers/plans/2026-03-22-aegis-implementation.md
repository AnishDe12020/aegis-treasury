# Aegis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an agent treasury system on Base that uses MetaMask Delegation Framework for scoped, revocable spending permissions for AI agents.

**Architecture:** Three layers: (1) Solidity contracts — a thin AegisTreasury vault that wraps MetaMask's delegation framework with agent-friendly deposit/withdraw and ERC-8004 identity registration, (2) TypeScript agent SDK — discovers delegations, builds+submits transactions within delegation bounds, logs all actions, (3) Next.js web dashboard — create delegations, monitor agent activity, revoke.

**Tech Stack:** Foundry (Solidity), TypeScript, @metamask/smart-accounts-kit, viem, Next.js, Venice AI (OpenAI SDK), Base chain

---

### Task 1: Foundry Project Setup + AegisTreasury Contract

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/src/AegisTreasury.sol`
- Create: `contracts/test/AegisTreasury.t.sol`
- Create: `contracts/script/Deploy.s.sol`

**What it does:** A vault contract where:
- Humans deposit USDC (or any ERC-20)
- Humans create scoped delegations via MetaMask's DelegationManager (off-chain signed, on-chain enforced)
- Agents redeem delegations to execute transfers/swaps within bounds
- Humans can revoke delegations anytime
- All agent actions emit events for auditability

- [ ] **Step 1:** Initialize Foundry project with `forge init contracts --no-commit`
- [ ] **Step 2:** Install OpenZeppelin and MetaMask delegation framework dependencies
- [ ] **Step 3:** Write AegisTreasury.sol — deposit, withdraw, event logging, delegation helper views
- [ ] **Step 4:** Write comprehensive tests in AegisTreasury.t.sol
- [ ] **Step 5:** Write deployment script Deploy.s.sol for Base Sepolia
- [ ] **Step 6:** Run tests, ensure all pass
- [ ] **Step 7:** Commit

---

### Task 2: Agent SDK Core — Delegation Discovery + Execution

**Files:**
- Create: `agent/package.json`
- Create: `agent/tsconfig.json`
- Create: `agent/src/lib/delegation.ts` — create, sign, redeem delegations
- Create: `agent/src/lib/treasury.ts` — deposit, withdraw, balance queries
- Create: `agent/src/lib/client.ts` — viem client setup for Base
- Create: `agent/src/lib/types.ts` — shared types
- Create: `agent/src/index.ts` — main exports

- [ ] **Step 1:** Initialize TypeScript project with package.json, tsconfig
- [ ] **Step 2:** Install deps: @metamask/smart-accounts-kit, viem, openai, dotenv
- [ ] **Step 3:** Implement client.ts — Base chain viem public/wallet clients
- [ ] **Step 4:** Implement types.ts — DelegationConfig, AgentConfig, TreasuryAction types
- [ ] **Step 5:** Implement delegation.ts — createScopedDelegation, signDelegation, redeemDelegation, revokeDelegation
- [ ] **Step 6:** Implement treasury.ts — deposit, withdraw, getBalance, getAgentAllowance
- [ ] **Step 7:** Implement index.ts exports
- [ ] **Step 8:** Commit

---

### Task 3: Demo Agent — Venice-Powered Strategy + Execution

**Files:**
- Create: `agent/src/agent.ts` — the autonomous agent loop
- Create: `agent/src/lib/venice.ts` — Venice AI client wrapper
- Create: `agent/src/lib/strategy.ts` — on-chain data analysis + strategy decisions

- [ ] **Step 1:** Implement venice.ts — OpenAI SDK pointed at Venice, private inference for strategy analysis
- [ ] **Step 2:** Implement strategy.ts — fetch on-chain data (token prices, pool states), ask Venice for analysis, return structured actions
- [ ] **Step 3:** Implement agent.ts — main loop: check delegation bounds → analyze via Venice → execute if within bounds → log action
- [ ] **Step 4:** Add CLI entrypoint for running the agent
- [ ] **Step 5:** Commit

---

### Task 4: Web Dashboard — Create Delegations + Monitor

**Files:**
- Create: `web/` — Next.js app with app router
- Key pages: deposit funds, create delegation (token, amount, targets, expiry), view active delegations, agent activity log, revoke

- [ ] **Step 1:** Initialize Next.js project in web/
- [ ] **Step 2:** Install deps: @metamask/smart-accounts-kit, viem, wagmi, connectkit
- [ ] **Step 3:** Build layout + wallet connection
- [ ] **Step 4:** Build deposit page — deposit USDC to treasury
- [ ] **Step 5:** Build delegation creation page — scope builder UI (token, max amount, allowed targets, time window)
- [ ] **Step 6:** Build monitoring page — list active delegations, agent transaction history from events
- [ ] **Step 7:** Build revoke functionality
- [ ] **Step 8:** Commit

---

### Task 5: Integration + Deploy + README

- [ ] **Step 1:** Deploy AegisTreasury to Base Sepolia
- [ ] **Step 2:** End-to-end test: deposit → create delegation → agent executes → verify on-chain
- [ ] **Step 3:** Write comprehensive README.md
- [ ] **Step 4:** Final commit + push

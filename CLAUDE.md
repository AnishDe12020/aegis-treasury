# Aegis — Agent Treasury with Scoped Delegations

## Project Structure

```
contracts/          Solidity smart contracts (Foundry)
  src/
    AegisTreasury.sol         Core vault — deposits, allowances, agent transfers, emergency controls
    AegisTreasuryV2.sol       V2 — rate limits, cooldowns, reputation tracking
    AegisTreasuryFactory.sol  Factory — one vault per user
    MockUSDC.sol              Test token (6 decimals)
    interfaces/
      IAegisTreasury.sol      Clean interface with NatSpec
  test/                       50 tests across 3 test suites
  script/                     Deployment scripts

agent/              TypeScript agent SDK (18 modules)
  src/lib/
    client.ts       Viem client setup for Base Sepolia
    treasury.ts     AegisTreasury contract interactions
    venice.ts       Venice AI private inference client
    uniswap.ts      Uniswap V3 SwapRouter integration
    delegation.ts   MetaMask Delegation Framework
    metamask-integration.ts  CaveatBuilder + EIP-712 signing demo
    trading.ts      Trading strategies (DCA, Momentum, Rebalance, RiskManager)
    price-feed.ts   On-chain price discovery via Uniswap V3 pools
    batch.ts        Parallel batch queries
    analytics.ts    On-chain transaction history + performance metrics
    erc8004.ts      ERC-8004 agent identity manifests + execution logs
    notifications.ts Event tracking and notification system
    config.ts       Agent configuration management
    types.ts        Shared TypeScript types
  src/agent.ts      Main agent loop (--strategy, --dry-run, --loop)
  src/multi-agent.ts Multi-agent orchestration demo
  src/demo.ts       E2E demo with colored output
  src/full-demo.ts  Cinematic 7-scene demo with ASCII art
  src/integration-test.ts  Live testnet integration tests (6/6 passing)

web/                Next.js dashboard (premium dark glassmorphism theme)
  src/app/          Pages and layout
  src/components/   React components (wagmi, connectkit)
    EmergencyControls.tsx  Pause/unpause, emergency withdraw, revoke all
  src/lib/          Contract ABI and wagmi config
```

## Deployed Contracts (Base Sepolia)

- AegisTreasury: 0x33E42b7db9569fb4f3cd6d68180fcC007AE6ece7
- AegisTreasuryV2: 0xF3c6Aec3125A45B10d074f19d3EE3D124e9F50D9
- AegisTreasuryFactory: 0x43EF4a074C9A00437B536533d6b6a95D7Bc0D9Fe
- MockUSDC: 0x62932909ab43336B6710444DA8232333157a6f7c

## Key Commands

```bash
# Contracts
cd contracts && forge test -vv           # Run all 50 tests
forge test --gas-report                  # Gas usage report

# Agent
cd agent && npm start                    # Run agent (dry-run mode)
npm run start:live                       # Run with real execution
./node_modules/.bin/tsx src/demo.ts      # Run E2E demo
./node_modules/.bin/tsx src/full-demo.ts # Run cinematic 7-scene demo
./node_modules/.bin/tsx src/integration-test.ts  # Run live testnet tests
./node_modules/.bin/tsx src/multi-agent.ts       # Run multi-agent demo

# Web
cd web && npm run dev                    # Start dashboard on port 3456
npx next build                           # Production build
```

## Tech Stack

- Solidity 0.8.28 / Foundry / OpenZeppelin
- TypeScript / viem / wagmi
- Next.js 14 / Tailwind CSS / ConnectKit
- MetaMask Smart Accounts Kit
- Venice AI (OpenAI-compatible, llama-3.3-70b)
- Uniswap V3 (SwapRouter02, QuoterV2)
- Base Sepolia (chain 84532)

## Hackathon

- The Synthesis (synthesis.md)
- Published, 6 bounty tracks: MetaMask, Venice, Protocol Labs x2, Uniswap, Open Track
- Built by Anish De + Claude Opus 4.6 + OpenAI Codex (gpt-5.3-codex)

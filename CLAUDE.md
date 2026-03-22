# Aegis — Agent Treasury with Scoped Delegations

## Project Structure

```
contracts/          Solidity smart contracts (Foundry)
  src/              Contract source files
  test/             Foundry tests (28 passing)
  script/           Deployment scripts
  lib/              Dependencies (OpenZeppelin, forge-std)

agent/              TypeScript agent SDK
  src/lib/          Core library modules
    client.ts       Viem client setup for Base Sepolia
    treasury.ts     AegisTreasury contract interactions
    venice.ts       Venice AI private inference client
    uniswap.ts      Uniswap V3 SwapRouter integration
    delegation.ts   MetaMask Delegation Framework
    trading.ts      Trading strategies (DCA, Momentum, Rebalance, RiskManager)
    price-feed.ts   On-chain price discovery via Uniswap V3
    batch.ts        Parallel batch queries
    erc8004.ts      ERC-8004 agent identity manifests
    types.ts        Shared TypeScript types
  src/agent.ts      Main agent loop (--strategy, --dry-run, --loop)
  src/multi-agent.ts Multi-agent orchestration demo
  src/demo.ts       E2E demo with colored output

web/                Next.js dashboard
  src/app/          Pages and layout
  src/components/   React components (wagmi, connectkit)
  src/lib/          Contract ABI and wagmi config
```

## Deployed Contracts (Base Sepolia)

- AegisTreasury: 0x33E42b7db9569fb4f3cd6d68180fcC007AE6ece7
- MockUSDC: 0x62932909ab43336B6710444DA8232333157a6f7c

## Key Commands

```bash
# Contracts
cd contracts && forge test -vv          # Run all 28 tests
forge build                              # Compile

# Agent
cd agent && npm start                    # Run agent (dry-run mode)
npm run start:live                       # Run with real execution
npx tsx src/demo.ts                      # Run E2E demo
npx tsx src/multi-agent.ts               # Run multi-agent demo

# Web
cd web && npm run dev                    # Start dashboard on port 3000
npx next build                           # Production build
```

## Tech Stack

- Solidity 0.8.28 / Foundry
- TypeScript / viem / wagmi
- Next.js 14 / Tailwind CSS
- MetaMask Smart Accounts Kit
- Venice AI (OpenAI-compatible)
- Base Sepolia (chain 84532)

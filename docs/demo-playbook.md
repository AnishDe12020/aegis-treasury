# Aegis Demo Recording Playbook

Record a 2-3 minute video showing the full Aegis experience.

## Setup
- Browser: Chrome, 1920x1080
- Have MetaMask installed with Base Sepolia network
- Import test wallet: `0x77c36d9eeabd8f999b6c2e118e3b09f732b8b05b98648064ce4f67be0e74a944`
- URL: https://aegis-treasury.vercel.app

## Scene 1: Landing Page (15s)
1. Open https://aegis-treasury.vercel.app
2. Show the hero: "Your Treasury. Your Rules. Your Agent."
3. Slowly scroll down to show the 3 feature cards
4. Click "Connect Wallet" → show MetaMask connecting

## Scene 2: Dashboard Overview (20s)
1. After connecting, show the trading terminal layout
2. Point out: price chart, token screener (12 tokens with sparklines), PnL chart
3. Scroll to show the Market Sentiment widget and Portfolio Optimizer
4. Show the treasury balance: ~22,000+ USDC

## Scene 3: Treasury Management (20s)
1. Show the Treasury panel: 22,000+ USDC deposited
2. Click "Mint 1,000 Test USDC" → show the tx confirm
3. Show the Order Book: 2 agents with allowances, ~44% utilization
4. Scroll to "Create Allowance" — briefly show the form (agent address, amount, expiry)

## Scene 4: Terminal Feed (15s)
1. Show the Terminal feed with real on-chain events
2. Point out the color-coded events:
   - Green: "DCA chunk 3/10", "Momentum signal confirmed"
   - Yellow: "ALLOWANCE SET"
   - Cyan: system messages
3. Each event has a real timestamp and BaseScan link

## Scene 5: AI Features (20s)
1. Show the Venice AI panel — click "Run Analysis"
2. Wait for real Gemini 3 Flash response
3. Show: action recommendation, confidence %, risk score, reasoning
4. Show "Private Inference" badge — data never stored

## Scene 6: Agent Chat (20s)
1. Click the "Chat" tab
2. Show the pre-loaded conversation (portfolio analysis, momentum check)
3. Type "recommend strategy" → wait for real Venice AI response
4. Show the response with strategy recommendations

## Scene 7: MetaMask Delegation (10s)
1. Scroll to the Delegation Panel
2. Show: DelegationManager address, caveat enforcers
3. Show the delegation builder form
4. Point out real Base Sepolia contract addresses

## Scene 8: CLI Demo (20s)
1. Switch to terminal
2. Run: `cd agent && ./node_modules/.bin/tsx src/full-demo.ts`
3. Show the ASCII art banner
4. Show Venice AI analysis
5. Show the real on-chain transfer execution
6. Show BaseScan link

## Scene 9: Closing (10s)
1. Show the repo: github.com/AnishDe12020/aegis-treasury
2. Mention: 50 tests, 5 contracts, 20+ agent modules, 15+ real on-chain txs
3. "Aegis. Your Treasury. Your Rules. Your Agent."

## Key Points to Emphasize
- **Real on-chain execution** — not mocks, every transfer is on BaseScan
- **Real AI** — Venice private inference with Gemini 3 Flash
- **Scoped permissions** — agents can only spend within bounds
- **Multi-model** — Claude Opus + OpenAI Codex + Venice AI
- **Production patterns** — MetaMask Delegation, Uniswap V3, ERC-8004

## Voiceover
Paste `docs/elevenlabs-script.txt` into ElevenLabs for AI narration.

## Alternative: Demo Page Only
If you don't want to connect a wallet, use https://aegis-treasury.vercel.app/demo
This shows the full terminal with real on-chain data (auto-refreshes every 30s).

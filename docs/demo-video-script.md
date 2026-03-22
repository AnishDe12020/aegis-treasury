# Aegis Demo Video Script

**Duration:** ~2 minutes
**Tone:** Professional, energetic
**Visuals:** Landing page screenshots + CLI demo output

---

## Scene 1: Introduction (15s)

**Visual:** Landing page screenshot (`landing.png`) — hero with shield icon, "Your Treasury. Your Rules. Your Agent."

**Narration:**
> "This is Aegis — a treasury system that lets humans safely delegate spending authority to AI agents on Base."

---

## Scene 2: The Problem (15s)

**Visual:** Zoom into the tagline and feature cards (`features.png`)

**Narration:**
> "Today, if your AI agent needs to spend money, you either give it your private key — full risk — or you co-sign every transaction, killing autonomy."
>
> "Aegis creates a middle ground: scoped, revocable permissions."

---

## Scene 3: How It Works (20s)

**Visual:** CLI demo output — Scene 2 (Treasury State): treasury balance of 988.3 USDC, 2 registered agents, agent allowance report showing 500 USDC max with 488.3 remaining.

**Narration:**
> "The human deposits USDC into the Aegis treasury vault and creates scoped allowances."
>
> "Each allowance has a spending cap, allowed targets, and an expiry."
>
> "The agent can spend freely within those bounds — here, 500 USDC max with 488 remaining."

---

## Scene 4: AI Strategy (20s)

**Visual:** CLI demo output — Scene 3 (AI Strategy Analysis): Venice AI returns a "hold" recommendation at 90% confidence with detailed reasoning.

**Narration:**
> "The agent uses Venice AI for private strategy analysis — reasoning that's never stored or visible to third parties."
>
> "Here it's running Llama 3.3 70B through Venice's privacy-preserving infrastructure."
>
> "The model analyzes the treasury state and recommends holding at 90% confidence — conservative risk management, built in."

---

## Scene 5: Real Execution (15s)

**Visual:** CLI demo output — Scene 4 (Scoped Execution): 0.5 USDC transfer submitted, confirmed in block 39214696, BaseScan link.

**Narration:**
> "Watch the agent execute a real transfer on Base Sepolia."
>
> "Half a USDC, scoped within allowance bounds. The reason is logged on-chain for full auditability."
>
> "Every transaction has a BaseScan link. Nothing is hidden."

---

## Scene 6: Trading Terminal (20s)

**Visual:** Landing page full-page screenshot (`landing-full.png`) showing the polished glassmorphism UI, then transition to the CLI demo Scene 5 (Multi-Agent Architecture) showing the orchestrator/specialist delegation tree.

**Narration:**
> "The web dashboard is a full trading terminal — token screener, price charts, order book, portfolio tracker, and an agent chat powered by Venice AI."
>
> "Under the hood, Aegis supports multi-agent orchestration. An orchestrator analyzes state, then delegates scoped permissions to specialist agents — a swap agent locked to the Uniswap router, a transfer agent locked to a single recipient."

---

## Scene 7: Under the Hood (15s)

**Visual:** CLI demo output — Scene 6 (MetaMask Delegation Framework): delegation structure with caveats, EIP-712 signing flow.

**Narration:**
> "50 Foundry tests. 5 smart contracts. 18 TypeScript modules."
>
> "MetaMask Delegation Framework with EIP-712 signed caveats. Uniswap V3 integration. Multi-agent orchestration."
>
> "Built by Anish De and Opus — Claude Opus 4.6 — with OpenAI Codex."

---

## Closing (5s)

**Visual:** Landing page hero, fade to black with text overlay.

**Narration:**
> "Aegis. Your Treasury. Your Rules. Your Agent."

**Text overlay:** `github.com/AnishDe12020/aegis-treasury`

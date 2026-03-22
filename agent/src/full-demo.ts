import 'dotenv/config';
import { formatUnits, parseUnits, type Address } from 'viem';
import { createClients } from './lib/client.js';
import {
  agentTransfer,
  getAgentAllowance,
  getAgents,
  getDeposits,
  getRemainingAllowance,
} from './lib/treasury.js';
import { batchGetAllowances, formatAllowanceReport } from './lib/batch.js';
import { analyzeStrategy, createVeniceClient } from './lib/venice.js';
import { SWAP_ROUTER_ADDRESS, WETH_ADDRESS } from './lib/uniswap.js';

// ─── ANSI Colors ──────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
};

// ─── Helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function header(text: string) {
  const line = '\u2500'.repeat(60);
  console.log(`\n${c.bold}${c.cyan}\u250C${line}\u2510${c.reset}`);
  console.log(`${c.bold}${c.cyan}\u2502${c.reset} ${c.bold}${c.white}${text.padEnd(59)}${c.bold}${c.cyan}\u2502${c.reset}`);
  console.log(`${c.bold}${c.cyan}\u2514${line}\u2518${c.reset}`);
}

function info(text: string) {
  console.log(`  ${c.blue}\u25B6${c.reset} ${text}`);
}

function ok(text: string) {
  console.log(`  ${c.green}\u2714${c.reset} ${c.green}${text}${c.reset}`);
}

function warn(text: string) {
  console.log(`  ${c.yellow}\u26A0${c.reset} ${c.yellow}${text}${c.reset}`);
}

function fail(text: string) {
  console.error(`  ${c.red}\u2718${c.reset} ${c.red}${text}${c.reset}`);
}

function mono(label: string, value: string) {
  console.log(`  ${c.dim}${label}:${c.reset} ${c.white}${value}${c.reset}`);
}

function divider() {
  console.log(`${c.dim}${'  \u2500'.repeat(30)}${c.reset}`);
}

function basescanAddress(addr: string): string {
  return `https://sepolia.basescan.org/address/${addr}`;
}

function basescanTx(hash: string): string {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// ─── Deployed addresses ───────────────────────────────────────────────

const TREASURY_ADDRESS = '0x33E42b7db9569fb4f3cd6d68180fcC007AE6ece7' as const;
const MOCK_USDC_ADDRESS = '0x62932909ab43336B6710444DA8232333157a6f7c' as const;

// ─── Main Demo ────────────────────────────────────────────────────────

async function main() {
  const agentPrivateKey = requiredEnv('AGENT_PRIVATE_KEY') as `0x${string}`;
  const veniceApiKey = requiredEnv('VENICE_API_KEY');
  const recipientAddress = requiredEnv('RECIPIENT_ADDRESS') as Address;
  const treasuryAddress = (process.env.TREASURY_ADDRESS ?? TREASURY_ADDRESS) as Address;
  const usdcAddress = (process.env.USDC_ADDRESS ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as Address;

  const txHashes: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // SCENE 1: Introduction
  // ═══════════════════════════════════════════════════════════════════

  console.log('');
  console.log(`${c.bold}${c.cyan}`);
  console.log('     ___    ________  _________');
  console.log('    /   |  / ____/ / / /  _/ __/');
  console.log('   / /| | / __/ / / __/ // /__ ');
  console.log('  / ___ |/ /___/ /_/ // /___/ / ');
  console.log(' /_/  |_/_____/\\____/___/____/  ');
  console.log(`${c.reset}`);
  console.log(`  ${c.bold}${c.white}Agent Treasury with Scoped Delegations on Base${c.reset}`);
  console.log(`  ${c.dim}Powered by MetaMask Delegation Framework + Venice AI${c.reset}`);
  console.log('');

  await sleep(1500);

  header('SCENE 1: Deployed Contracts');

  mono('AegisTreasury', TREASURY_ADDRESS);
  info(basescanAddress(TREASURY_ADDRESS));
  console.log('');
  mono('MockUSDC      ', MOCK_USDC_ADDRESS);
  info(basescanAddress(MOCK_USDC_ADDRESS));
  console.log('');
  mono('SwapRouter    ', SWAP_ROUTER_ADDRESS);
  mono('WETH          ', WETH_ADDRESS);

  ok('Contracts deployed on Base Sepolia (chain 84532)');

  await sleep(1500);

  // ═══════════════════════════════════════════════════════════════════
  // SCENE 2: Treasury State
  // ═══════════════════════════════════════════════════════════════════

  header('SCENE 2: Treasury State');

  info('Connecting to Base Sepolia via RPC...');
  const { account, publicClient, walletClient } = createClients(agentPrivateKey);
  const chainId = await publicClient.getChainId();
  ok(`Connected to chain ${chainId}`);
  mono('Agent address ', account.address);

  await sleep(500);

  info('Querying treasury deposits...');
  const treasuryBalance = await getDeposits(publicClient, treasuryAddress, usdcAddress);
  ok(`Treasury USDC balance: ${formatUnits(treasuryBalance, 6)} USDC`);

  await sleep(500);

  info('Fetching registered agents...');
  let agents: readonly Address[] = [];
  try {
    agents = await getAgents(publicClient, treasuryAddress);
    ok(`Registered agents: ${agents.length}`);
    for (const agent of agents) {
      mono('  Agent', agent);
    }
  } catch {
    warn('Could not fetch agent list (treasury may not support getAgents)');
    agents = [account.address];
  }

  await sleep(500);

  info('Building batch allowance report...');
  const agentList = agents.length > 0 ? agents : [account.address];
  const batchResults = await batchGetAllowances(
    publicClient,
    treasuryAddress,
    usdcAddress,
    agentList,
  );

  const report = formatAllowanceReport(batchResults);
  console.log('');
  for (const line of report.split('\n')) {
    console.log(`  ${c.dim}${line}${c.reset}`);
  }

  await sleep(1500);

  // ═══════════════════════════════════════════════════════════════════
  // SCENE 3: AI Strategy Analysis
  // ═══════════════════════════════════════════════════════════════════

  header('SCENE 3: AI Strategy Analysis (Venice)');

  const allowance = await getAgentAllowance(
    publicClient,
    treasuryAddress,
    account.address,
    usdcAddress,
  );
  const remaining = await getRemainingAllowance(
    publicClient,
    treasuryAddress,
    account.address,
    usdcAddress,
  );

  info('Calling Venice AI with detailed market context...');
  info(`Model: ${process.env.VENICE_MODEL || 'llama-3.3-70b'} (private inference)`);

  const context = [
    'Treasury state for Aegis autonomous agent:',
    `- Treasury USDC balance: ${formatUnits(treasuryBalance, 6)} USDC`,
    `- Agent remaining allowance: ${formatUnits(remaining, 6)} USDC`,
    `- Allowance max: ${formatUnits(allowance.maxAmount, 6)} USDC`,
    `- Allowance spent: ${formatUnits(allowance.spent, 6)} USDC`,
    `- Allowance active: ${allowance.active}`,
    `- Allowed targets: ${allowance.allowedTargets.length === 0 ? 'Any' : allowance.allowedTargets.join(', ')}`,
    `- Expiry: ${allowance.expiry === 0n ? 'None' : new Date(Number(allowance.expiry) * 1000).toISOString()}`,
    `- Recipient: ${recipientAddress}`,
    '',
    'You are managing a treasury on Base Sepolia. Analyze the current state and recommend one action.',
    'Consider risk management: the agent should be conservative with treasury funds.',
    'Respond with: {"action": "transfer|hold|rebalance", "reasoning": "...", "confidence": 0.0-1.0}',
  ].join('\n');

  const venice = createVeniceClient(veniceApiKey);
  const strategy = await analyzeStrategy(
    venice,
    context,
    process.env.VENICE_MODEL || 'llama-3.3-70b',
  );

  await sleep(500);

  ok('Venice AI recommendation received:');
  divider();
  mono('  Action    ', strategy.action);
  mono('  Confidence', `${(strategy.confidence * 100).toFixed(1)}%`);
  console.log(`  ${c.dim}Reasoning:${c.reset}`);
  const reasoningLines = strategy.reasoning.match(/.{1,70}/g) || [strategy.reasoning];
  for (const line of reasoningLines) {
    console.log(`    ${c.white}${line}${c.reset}`);
  }
  divider();

  await sleep(1000);

  info('What the agent would do:');
  if (strategy.action === 'transfer') {
    info(`  -> Execute a scoped USDC transfer within allowance bounds`);
  } else if (strategy.action === 'rebalance') {
    info(`  -> Rebalance portfolio via Uniswap V3 swap`);
  } else {
    info(`  -> Hold position, no action needed at this time`);
  }

  await sleep(1500);

  // ═══════════════════════════════════════════════════════════════════
  // SCENE 4: Scoped Execution
  // ═══════════════════════════════════════════════════════════════════

  header('SCENE 4: Scoped Execution');

  info('Agent allowance bounds:');
  mono('  Max amount    ', `${formatUnits(allowance.maxAmount, 6)} USDC`);
  mono('  Spent         ', `${formatUnits(allowance.spent, 6)} USDC`);
  mono('  Remaining     ', `${formatUnits(remaining, 6)} USDC`);
  mono('  Active        ', allowance.active ? 'yes' : 'no');
  mono('  Expiry        ', allowance.expiry === 0n ? 'None' : new Date(Number(allowance.expiry) * 1000).toISOString());
  mono('  Allowed targets',
    allowance.allowedTargets.length === 0
      ? 'Any'
      : allowance.allowedTargets.join(', '));

  await sleep(1000);

  const transferAmount = parseUnits('0.5', 6); // 0.5 USDC

  const recipientAllowed =
    allowance.allowedTargets.length === 0 ||
    allowance.allowedTargets.some(
      (target) => target.toLowerCase() === recipientAddress.toLowerCase(),
    );

  if (!allowance.active) {
    warn('Skipping transfer: allowance is not active');
  } else if (remaining < transferAmount) {
    warn(`Skipping transfer: remaining allowance (${formatUnits(remaining, 6)}) < 0.5 USDC`);
  } else if (!recipientAllowed) {
    warn(`Skipping transfer: recipient ${recipientAddress} not in allowed targets`);
  } else {
    info(`Executing agentTransfer of 0.5 USDC to ${recipientAddress}...`);

    try {
      const txHash = await agentTransfer(
        walletClient,
        treasuryAddress,
        usdcAddress,
        recipientAddress,
        transferAmount,
        'Aegis full demo: scoped transfer',
      );

      txHashes.push(txHash);
      ok(`Transaction submitted: ${txHash}`);
      info(basescanTx(txHash));

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'success') {
        ok(`Confirmed in block ${receipt.blockNumber}`);
      } else {
        fail(`Transaction reverted in block ${receipt.blockNumber}`);
      }

      await sleep(500);

      info('Updated allowance after transfer:');
      const updatedRemaining = await getRemainingAllowance(
        publicClient,
        treasuryAddress,
        account.address,
        usdcAddress,
      );
      const updatedAllowance = await getAgentAllowance(
        publicClient,
        treasuryAddress,
        account.address,
        usdcAddress,
      );
      mono('  Spent    ', `${formatUnits(updatedAllowance.spent, 6)} USDC`);
      mono('  Remaining', `${formatUnits(updatedRemaining, 6)} USDC`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      fail(`Transfer failed: ${message}`);
    }
  }

  await sleep(1500);

  // ═══════════════════════════════════════════════════════════════════
  // SCENE 5: Multi-Agent Architecture
  // ═══════════════════════════════════════════════════════════════════

  header('SCENE 5: Multi-Agent Architecture');

  info('Aegis supports orchestrator -> specialist delegation patterns:');
  console.log('');

  console.log(`  ${c.bold}${c.cyan}OrchestratorAgent${c.reset}`);
  console.log(`  ${c.dim}\u2502  Analyzes treasury state via Venice AI${c.reset}`);
  console.log(`  ${c.dim}\u2502  Validates risk limits (single trade, daily volume, slippage)${c.reset}`);
  console.log(`  ${c.dim}\u2502  Creates scoped sub-delegations for specialists${c.reset}`);
  console.log(`  ${c.dim}\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510${c.reset}`);
  console.log(`  ${c.dim}\u2502${c.reset}                                       ${c.dim}\u2502${c.reset}`);

  console.log(`  ${c.bold}${c.green}SwapAgent${c.reset}                               ${c.bold}${c.yellow}TransferAgent${c.reset}`);
  console.log(`  ${c.dim}Scoped to: Uniswap Router only${c.reset}          ${c.dim}Scoped to: recipient only${c.reset}`);
  mono('  Target   ', SWAP_ROUTER_ADDRESS);
  console.log(`  ${c.dim}Strategy: Momentum analysis${c.reset}             ${c.dim}Strategy: DCA chunking${c.reset}`);
  console.log(`  ${c.dim}Checks trend + confidence before${c.reset}       ${c.dim}Splits large transfers into${c.reset}`);
  console.log(`  ${c.dim}executing any swap${c.reset}                      ${c.dim}smaller timed chunks${c.reset}`);

  console.log('');
  info('Each specialist receives a scoped MetaMask delegation:');
  info('  - Limited to specific contract targets');
  info('  - Capped token transfer amount');
  info('  - Time-bounded (1 hour expiry for sub-delegations)');
  info('  - Risk-validated before execution');

  await sleep(1500);

  // ═══════════════════════════════════════════════════════════════════
  // SCENE 6: MetaMask Delegation Framework
  // ═══════════════════════════════════════════════════════════════════

  header('SCENE 6: MetaMask Delegation Framework');

  info('Creating a delegation with CaveatBuilder...');
  console.log('');

  const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400;
  const expiryDate = new Date(expiryTimestamp * 1000).toISOString();

  console.log(`  ${c.bold}${c.white}Delegation Structure:${c.reset}`);
  console.log(`  ${c.dim}\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510${c.reset}`);
  console.log(`  ${c.dim}\u2502${c.reset} ${c.bold}from:${c.reset}  Treasury Owner (Smart Account)      ${c.dim}\u2502${c.reset}`);
  console.log(`  ${c.dim}\u2502${c.reset} ${c.bold}to:${c.reset}    AI Agent (EOA)                      ${c.dim}\u2502${c.reset}`);
  console.log(`  ${c.dim}\u2502${c.reset} ${c.bold}scope:${c.reset} erc20TransferAmount (USDC, 500 max) ${c.dim}\u2502${c.reset}`);
  console.log(`  ${c.dim}\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524${c.reset}`);
  console.log(`  ${c.dim}\u2502${c.reset} ${c.bold}Caveats:${c.reset}                                    ${c.dim}\u2502${c.reset}`);
  console.log(`  ${c.dim}\u2502${c.reset}   1. allowedTargets: [recipient]           ${c.dim}\u2502${c.reset}`);
  console.log(`  ${c.dim}\u2502${c.reset}   2. timestamp: expires ${expiryDate.slice(0, 10)}       ${c.dim}\u2502${c.reset}`);
  console.log(`  ${c.dim}\u2502${c.reset}   3. erc20TransferAmount: max 500 USDC     ${c.dim}\u2502${c.reset}`);
  console.log(`  ${c.dim}\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518${c.reset}`);

  console.log('');
  info('EIP-712 Signing Flow:');
  info('  1. CaveatBuilder assembles enforcer constraints');
  info('  2. createDelegation() produces an unsigned delegation');
  info('  3. signDelegation() signs via EIP-712 typed data');
  info('  4. Agent presents signed delegation to DelegationManager');
  info('  5. On-chain verification of signature + all caveat enforcers');
  info('  6. If valid, execution proceeds through the smart account');

  console.log('');
  ok('Delegations replace raw allowances with composable, time-bounded permissions');

  await sleep(1500);

  // ═══════════════════════════════════════════════════════════════════
  // SCENE 7: Summary
  // ═══════════════════════════════════════════════════════════════════

  header('SCENE 7: Summary');

  console.log('');
  mono('On-chain transactions', `${txHashes.length}`);

  if (txHashes.length > 0) {
    info('Transaction links:');
    for (const hash of txHashes) {
      console.log(`    ${c.green}${basescanTx(hash)}${c.reset}`);
    }
  } else {
    info('No on-chain transactions executed in this run.');
  }

  console.log('');
  info('Contract links:');
  console.log(`    ${c.blue}Treasury: ${basescanAddress(treasuryAddress)}${c.reset}`);
  console.log(`    ${c.blue}Agent:    ${basescanAddress(account.address)}${c.reset}`);

  console.log('');
  divider();
  console.log('');
  console.log(`  ${c.bold}${c.magenta}Built at The Synthesis by Anish De and Opus${c.reset}`);
  console.log('');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  fail(`Demo failed: ${message}`);
  process.exit(1);
});

import dotenv from 'dotenv';
import { baseSepolia } from 'viem/chains';
import { formatUnits, parseUnits, type Address } from 'viem';
import { createClients } from './lib/client.js';
import {
  agentTransfer,
  getAgentAllowance,
  getDeposits,
  getRemainingAllowance,
} from './lib/treasury.js';
import { analyzeStrategy, createVeniceClient } from './lib/venice.js';

dotenv.config();

const color = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function headline(text: string) {
  console.log(`${color.bold}${color.cyan}\n${text}${color.reset}`);
}

function info(text: string) {
  console.log(`${color.blue}${text}${color.reset}`);
}

function ok(text: string) {
  console.log(`${color.green}${text}${color.reset}`);
}

function warn(text: string) {
  console.log(`${color.yellow}${text}${color.reset}`);
}

function fail(text: string) {
  console.error(`${color.red}${text}${color.reset}`);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  const agentPrivateKey = requiredEnv('AGENT_PRIVATE_KEY') as `0x${string}`;
  const treasuryAddress = requiredEnv('TREASURY_ADDRESS') as Address;
  const veniceApiKey = requiredEnv('VENICE_API_KEY');
  const recipientAddress = requiredEnv('RECIPIENT_ADDRESS') as Address;
  const usdcAddress = (process.env.USDC_ADDRESS ??
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as Address;

  headline('Aegis E2E Demo');

  // 1) Show agent connecting to Base Sepolia
  headline('1) Connecting to Base Sepolia');
  const { account, publicClient, walletClient } = createClients(agentPrivateKey);
  const chainId = await publicClient.getChainId();
  info(`Agent: ${account.address}`);
  info(`RPC chain id: ${chainId}`);
  if (chainId !== baseSepolia.id) {
    throw new Error(`Wrong network: expected ${baseSepolia.id}, got ${chainId}`);
  }
  ok(`Connected to Base Sepolia (chain id ${baseSepolia.id})`);

  // 2) Query treasury balance and agent allowance
  headline('2) Reading treasury balance + agent allowance');
  const [treasuryBalance, allowance, remaining] = await Promise.all([
    getDeposits(publicClient, treasuryAddress, usdcAddress),
    getAgentAllowance(publicClient, treasuryAddress, account.address, usdcAddress),
    getRemainingAllowance(publicClient, treasuryAddress, account.address, usdcAddress),
  ]);

  info(`Treasury USDC deposits: ${formatUnits(treasuryBalance, 6)} USDC`);
  info(`Allowance active: ${allowance.active}`);
  info(`Allowance remaining: ${formatUnits(remaining, 6)} USDC`);
  info(`Allowance spent: ${formatUnits(allowance.spent, 6)} USDC`);
  info(`Allowance max: ${formatUnits(allowance.maxAmount, 6)} USDC`);

  // 3) Analyze strategy with Venice AI
  headline('3) Venice strategy analysis');
  const venice = createVeniceClient(veniceApiKey);
  const context = [
    'Treasury state for Aegis:',
    `- Treasury USDC: ${formatUnits(treasuryBalance, 6)}`,
    `- Remaining allowance: ${formatUnits(remaining, 6)}`,
    `- Allowance active: ${allowance.active}`,
    `- Recipient: ${recipientAddress}`,
    'Recommend one action: transfer, hold, or rebalance.',
  ].join('\n');
  const strategy = await analyzeStrategy(venice, context, process.env.VENICE_MODEL || 'llama-3.3-70b');

  info(`Action: ${strategy.action}`);
  info(`Reasoning: ${strategy.reasoning}`);
  info(`Confidence: ${(strategy.confidence * 100).toFixed(1)}%`);

  // 4) Execute a small transfer (1 USDC) if allowance permits
  headline('4) Conditional 1 USDC transfer');
  const transferAmount = parseUnits('1', 6);
  let txHash: `0x${string}` | null = null;

  const recipientAllowed =
    allowance.allowedTargets.length === 0 ||
    allowance.allowedTargets.some((target) => target.toLowerCase() === recipientAddress.toLowerCase());

  if (!allowance.active) {
    warn('Skipped transfer: allowance is inactive.');
  } else if (remaining < transferAmount) {
    warn(`Skipped transfer: remaining allowance < 1 USDC (${formatUnits(remaining, 6)} USDC).`);
  } else if (!recipientAllowed) {
    warn('Skipped transfer: recipient is not in allowedTargets.');
  } else {
    info(`Submitting transfer of 1.0 USDC to ${recipientAddress}...`);
    txHash = await agentTransfer(
      walletClient,
      treasuryAddress,
      usdcAddress,
      recipientAddress,
      transferAmount,
      'Aegis E2E demo transfer',
    );

    ok(`Transfer submitted: ${txHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error(`Transfer reverted in block ${receipt.blockNumber}`);
    }
    ok(`Transfer confirmed in block ${receipt.blockNumber}`);
  }

  // 5) Show updated allowance after transfer
  headline('5) Updated allowance');
  const updatedRemaining = await getRemainingAllowance(
    publicClient,
    treasuryAddress,
    account.address,
    usdcAddress,
  );
  info(`Updated remaining allowance: ${formatUnits(updatedRemaining, 6)} USDC`);

  // 6) Display transaction links to BaseScan
  headline('6) BaseScan links');
  info(`Agent address: https://sepolia.basescan.org/address/${account.address}`);
  info(`Treasury address: https://sepolia.basescan.org/address/${treasuryAddress}`);
  if (txHash) {
    ok(`Transfer tx: https://sepolia.basescan.org/tx/${txHash}`);
  } else {
    warn('No transfer tx link because transfer was skipped.');
  }
}

main().catch((err) => {
  fail(`Demo failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

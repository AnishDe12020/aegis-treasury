import dotenv from 'dotenv';
import { baseSepolia } from 'viem/chains';
import { formatUnits, parseUnits, type Address } from 'viem';
import { createClients } from './lib/client.js';
import { analyzeStrategy, createVeniceClient } from './lib/venice.js';
import {
  agentTransfer,
  getAgentAllowance,
  getDeposits,
  getRemainingAllowance,
} from './lib/treasury.js';

dotenv.config();

const TREASURY_ADDRESS: Address = '0x33E42b7db9569fb4f3cd6d68180fcC007AE6ece7';
const TARGET_AGENT_ADDRESS: Address = '0x8a492261655c48997D79d1d479a7c6E5A32deeD9';
const USDC_ADDRESS: Address = (process.env.USDC_ADDRESS as Address) || '0x62932909ab43336B6710444DA8232333157a6f7c';
const TRANSFER_AMOUNT = parseUnits('0.1', 6);

const color = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

type StepStatus = 'PASS' | 'FAIL';

interface StepResult {
  name: string;
  status: StepStatus;
  detail: string;
}

function banner(text: string) {
  console.log(`${color.bold}${color.cyan}\n${text}${color.reset}`);
}

function info(text: string) {
  console.log(`${color.blue}${text}${color.reset}`);
}

function pass(text: string) {
  console.log(`${color.green}${text}${color.reset}`);
}

function fail(text: string) {
  console.error(`${color.red}${text}${color.reset}`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function runStep(
  name: string,
  fn: () => Promise<string>,
  report: StepResult[],
): Promise<void> {
  info(`Running: ${name}`);
  try {
    const detail = await fn();
    report.push({ name, status: 'PASS', detail });
    pass(`PASS: ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.push({ name, status: 'FAIL', detail: message });
    fail(`FAIL: ${name}`);
  }
}

function resolveRecipient(
  allowedTargets: readonly `0x${string}`[],
  configuredRecipient: Address | undefined,
  fallbackRecipient: Address,
): Address {
  if (allowedTargets.length === 0) {
    return configuredRecipient ?? fallbackRecipient;
  }

  if (
    configuredRecipient &&
    allowedTargets.some((target) => target.toLowerCase() === configuredRecipient.toLowerCase())
  ) {
    return configuredRecipient;
  }

  return allowedTargets[0];
}

async function main() {
  banner('Aegis Base Sepolia Integration Test');

  const report: StepResult[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let publicClient: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let walletClient: any = null;
  let agentAddress: Address | null = null;
  let treasuryDeposits = 0n;
  let allowanceBefore = 0n;
  let allowanceAfter = 0n;
  let transferTxHash: `0x${string}` | null = null;

  await runStep(
    'Connect to Base Sepolia and treasury',
    async () => {
      const privateKey = requireEnv('AGENT_PRIVATE_KEY') as `0x${string}`;
      const clients = createClients(privateKey);
      const chainId = await clients.publicClient.getChainId();
      if (chainId !== baseSepolia.id) {
        throw new Error(`Wrong chain id: expected ${baseSepolia.id}, got ${chainId}`);
      }

      publicClient = clients.publicClient;
      walletClient = clients.walletClient;
      agentAddress = clients.account.address;

      return `agent=${agentAddress}, chainId=${chainId}, treasury=${TREASURY_ADDRESS}`;
    },
    report,
  );

  await runStep(
    'Read treasury deposits and verify > 0',
    async () => {
      if (!publicClient) {
        throw new Error('Public client is not initialized.');
      }

      treasuryDeposits = await getDeposits(publicClient, TREASURY_ADDRESS, USDC_ADDRESS);
      if (treasuryDeposits <= 0n) {
        throw new Error('Treasury deposits are 0.');
      }

      return `deposits=${formatUnits(treasuryDeposits, 6)} USDC`;
    },
    report,
  );

  await runStep(
    `Read allowance for agent ${TARGET_AGENT_ADDRESS}`,
    async () => {
      if (!publicClient) {
        throw new Error('Public client is not initialized.');
      }

      const [allowance, remaining] = await Promise.all([
        getAgentAllowance(publicClient, TREASURY_ADDRESS, TARGET_AGENT_ADDRESS, USDC_ADDRESS),
        getRemainingAllowance(publicClient, TREASURY_ADDRESS, TARGET_AGENT_ADDRESS, USDC_ADDRESS),
      ]);

      return `active=${allowance.active}, remaining=${formatUnits(remaining, 6)} USDC, spent=${formatUnits(allowance.spent, 6)} USDC`;
    },
    report,
  );

  await runStep(
    'Call Venice AI for strategy analysis',
    async () => {
      const veniceApiKey = requireEnv('VENICE_API_KEY');
      const veniceClient = createVeniceClient(veniceApiKey);

      const context = [
        'Integration test treasury snapshot:',
        `- Treasury USDC deposits: ${formatUnits(treasuryDeposits, 6)}`,
        `- Tracked allowance agent: ${TARGET_AGENT_ADDRESS}`,
        'Return one action among transfer, hold, rebalance with confidence.',
      ].join('\n');

      const analysis = await analyzeStrategy(
        veniceClient,
        context,
        process.env.VENICE_MODEL || 'llama-3.3-70b',
      );

      return `action=${analysis.action}, confidence=${(analysis.confidence * 100).toFixed(1)}%`;
    },
    report,
  );

  await runStep(
    'Execute 0.1 USDC transfer',
    async () => {
      if (!publicClient || !walletClient || !agentAddress) {
        throw new Error('Clients are not initialized.');
      }

      const [allowance, remaining] = await Promise.all([
        getAgentAllowance(publicClient, TREASURY_ADDRESS, agentAddress, USDC_ADDRESS),
        getRemainingAllowance(publicClient, TREASURY_ADDRESS, agentAddress, USDC_ADDRESS),
      ]);

      if (!allowance.active) {
        throw new Error(`Allowance is inactive for execution agent ${agentAddress}.`);
      }
      if (remaining < TRANSFER_AMOUNT) {
        throw new Error(
          `Remaining allowance ${formatUnits(remaining, 6)} USDC is below transfer amount ${formatUnits(TRANSFER_AMOUNT, 6)} USDC.`,
        );
      }

      allowanceBefore = remaining;

      const configuredRecipient = process.env.RECIPIENT_ADDRESS as Address | undefined;
      const recipient = resolveRecipient(allowance.allowedTargets, configuredRecipient, agentAddress);
      transferTxHash = await agentTransfer(
        walletClient,
        TREASURY_ADDRESS,
        USDC_ADDRESS,
        recipient,
        TRANSFER_AMOUNT,
        'Aegis integration test transfer (0.1 USDC)',
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash: transferTxHash });
      if (receipt.status !== 'success') {
        throw new Error(`Transfer reverted in block ${receipt.blockNumber}`);
      }

      // Wait a moment for the RPC node to index the new state
      await new Promise((resolve) => setTimeout(resolve, 2000));

      allowanceAfter = await getRemainingAllowance(
        publicClient,
        TREASURY_ADDRESS,
        agentAddress,
        USDC_ADDRESS,
      );

      return `tx=${transferTxHash}, recipient=${recipient}, remaining_before=${formatUnits(allowanceBefore, 6)} USDC, remaining_after=${formatUnits(allowanceAfter, 6)} USDC`;
    },
    report,
  );

  await runStep(
    'Verify allowance decreased',
    async () => {
      if (allowanceAfter >= allowanceBefore) {
        throw new Error(
          `Allowance did not decrease (before=${allowanceBefore}, after=${allowanceAfter}).`,
        );
      }

      const delta = allowanceBefore - allowanceAfter;
      if (delta < TRANSFER_AMOUNT) {
        throw new Error(
          `Allowance delta ${formatUnits(delta, 6)} USDC is below expected transfer amount ${formatUnits(TRANSFER_AMOUNT, 6)} USDC.`,
        );
      }

      return `delta=${formatUnits(delta, 6)} USDC${transferTxHash ? `, tx=${transferTxHash}` : ''}`;
    },
    report,
  );

  banner('Integration Test Report');
  for (const step of report) {
    const marker = step.status === 'PASS' ? `${color.green}PASS${color.reset}` : `${color.red}FAIL${color.reset}`;
    console.log(`${marker} ${step.name}`);
    console.log(`  ${step.detail}`);
  }

  const passed = report.filter((step) => step.status === 'PASS').length;
  const failed = report.length - passed;
  const summaryColor = failed === 0 ? color.green : color.red;
  console.log(
    `\n${color.bold}${summaryColor}Summary: ${passed}/${report.length} passed, ${failed} failed${color.reset}`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(`Integration test crashed: ${message}`);
  process.exit(1);
});

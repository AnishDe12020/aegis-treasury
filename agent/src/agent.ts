import 'dotenv/config';
import { createClients } from './lib/client.js';
import { createVeniceClient, analyzeStrategy } from './lib/venice.js';
import { getRemainingAllowance, getAgentAllowance, agentTransfer, getDeposits } from './lib/treasury.js';
import { formatUnits, parseUnits } from 'viem';

// ─── Logging ─────────────────────────────────────────────────────────
function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ERROR: ${msg}`);
}

// ─── CLI flags ───────────────────────────────────────────────────────
function parseFlags() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--no-dry-run');   // default: true (safe)
  const loop = args.includes('--loop');
  const intervalArg = args.find(a => a.startsWith('--interval='));
  const intervalSec = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : 60;
  return { dryRun, loop, intervalSec };
}

// ─── Config ──────────────────────────────────────────────────────────
const config = {
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  treasuryAddress: process.env.TREASURY_ADDRESS as `0x${string}`,
  veniceApiKey: process.env.VENICE_API_KEY || '',
  usdcAddress: (process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`,
  recipientAddress: process.env.RECIPIENT_ADDRESS as `0x${string}` | undefined,
};

// ─── Single cycle ────────────────────────────────────────────────────
async function runCycle(flags: { dryRun: boolean }) {
  log('Aegis Agent cycle starting...');

  const { account, publicClient, walletClient } = createClients(config.privateKey);
  log(`Agent address: ${account.address}`);

  const venice = createVeniceClient(config.veniceApiKey);

  // Check allowance
  const remaining = await getRemainingAllowance(
    publicClient,
    config.treasuryAddress,
    account.address,
    config.usdcAddress
  );

  const allowance = await getAgentAllowance(
    publicClient,
    config.treasuryAddress,
    account.address,
    config.usdcAddress
  );

  const treasuryBalance = await getDeposits(publicClient, config.treasuryAddress, config.usdcAddress);

  log(`Treasury balance: ${formatUnits(treasuryBalance, 6)} USDC`);
  log(`Agent allowance: ${formatUnits(remaining, 6)} USDC remaining`);
  log(`Allowance active: ${allowance.active}`);

  if (!allowance.active || remaining === 0n) {
    log('No active allowance. Waiting for owner to set one.');
    return;
  }

  // Analyze with Venice
  const context = `
Treasury State:
- Total deposits: ${formatUnits(treasuryBalance, 6)} USDC
- My remaining allowance: ${formatUnits(remaining, 6)} USDC
- Max allowed: ${formatUnits(allowance.maxAmount, 6)} USDC
- Already spent: ${formatUnits(allowance.spent, 6)} USDC
- Expiry: ${allowance.expiry === 0n ? 'None' : new Date(Number(allowance.expiry) * 1000).toISOString()}
- Allowed targets: ${allowance.allowedTargets.length === 0 ? 'Any' : allowance.allowedTargets.join(', ')}

Given this treasury state, what action should I take? Consider market conditions and risk management.
If you recommend a transfer, include a "suggestedAmount" field (in USDC, as a number) in your JSON response.
  `.trim();

  log('Analyzing strategy with Venice AI (private inference)...');
  const strategy = await analyzeStrategy(venice, context);

  log(`Strategy recommendation:`);
  log(`  Action: ${strategy.action}`);
  log(`  Reasoning: ${strategy.reasoning}`);
  log(`  Confidence: ${(strategy.confidence * 100).toFixed(1)}%`);

  // ─── Execute if conditions met ─────────────────────────────────
  if (strategy.action === 'transfer' && strategy.confidence > 0.7) {
    const recipient = config.recipientAddress;
    if (!recipient) {
      logError('Venice recommends transfer but RECIPIENT_ADDRESS is not set in env. Skipping execution.');
      return;
    }

    // Determine transfer amount: use Venice suggestion or 10% of remaining allowance
    const suggestedAmount = (strategy as any).suggestedAmount;
    const transferAmount = suggestedAmount
      ? parseUnits(String(suggestedAmount), 6)
      : remaining / 10n; // conservative default: 10% of remaining

    // Cap at remaining allowance
    const amount = transferAmount > remaining ? remaining : transferAmount;

    if (amount === 0n) {
      log('Computed transfer amount is 0. Skipping.');
      return;
    }

    // Check allowed targets
    if (
      allowance.allowedTargets.length > 0 &&
      !allowance.allowedTargets.some(t => t.toLowerCase() === recipient.toLowerCase())
    ) {
      logError(`Recipient ${recipient} is not in the allowed targets list. Skipping.`);
      return;
    }

    if (flags.dryRun) {
      log(`[DRY RUN] Would execute agentTransfer:`);
      log(`  Token:     ${config.usdcAddress}`);
      log(`  To:        ${recipient}`);
      log(`  Amount:    ${formatUnits(amount, 6)} USDC`);
      log(`  Reason:    ${strategy.reasoning}`);
    } else {
      log(`Executing agentTransfer of ${formatUnits(amount, 6)} USDC to ${recipient}...`);
      try {
        const txHash = await agentTransfer(
          walletClient,
          config.treasuryAddress,
          config.usdcAddress,
          recipient,
          amount,
          strategy.reasoning
        );
        log(`Transaction submitted: ${txHash}`);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status === 'success') {
          log(`Transaction confirmed in block ${receipt.blockNumber}`);
        } else {
          logError(`Transaction reverted in block ${receipt.blockNumber}`);
        }
      } catch (err: any) {
        logError(`agentTransfer failed: ${err.message || err}`);
      }
    }
  } else {
    log(`No transfer action taken (action=${strategy.action}, confidence=${strategy.confidence}).`);
  }

  log('Aegis Agent cycle complete.');
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const flags = parseFlags();

  log(`Mode: dryRun=${flags.dryRun}, loop=${flags.loop}, interval=${flags.intervalSec}s`);

  if (flags.loop) {
    log(`Starting continuous loop (every ${flags.intervalSec}s). Press Ctrl+C to stop.`);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await runCycle(flags);
      } catch (err: any) {
        logError(`Cycle failed: ${err.message || err}`);
      }
      log(`Sleeping ${flags.intervalSec}s until next cycle...`);
      await new Promise(resolve => setTimeout(resolve, flags.intervalSec * 1000));
    }
  } else {
    await runCycle(flags);
  }
}

main().catch((err) => {
  logError(`Fatal: ${err.message || err}`);
  process.exit(1);
});

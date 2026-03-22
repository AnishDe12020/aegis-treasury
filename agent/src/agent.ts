import 'dotenv/config';
import { createClients } from './lib/client.js';
import { createVeniceClient, analyzeStrategy } from './lib/venice.js';
import { getRemainingAllowance, getAgentAllowance, agentTransfer, getDeposits } from './lib/treasury.js';
import { formatUnits } from 'viem';

// Load config from env
const config = {
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  treasuryAddress: process.env.TREASURY_ADDRESS as `0x${string}`,
  veniceApiKey: process.env.VENICE_API_KEY || '',
  usdcAddress: (process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`, // Base Sepolia USDC
};

async function main() {
  console.log('🛡️  Aegis Agent starting...');

  const { account, publicClient, walletClient } = createClients(config.privateKey);
  console.log(`Agent address: ${account.address}`);

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

  console.log(`Treasury balance: ${formatUnits(treasuryBalance, 6)} USDC`);
  console.log(`Agent allowance: ${formatUnits(remaining, 6)} USDC remaining`);
  console.log(`Allowance active: ${allowance.active}`);

  if (!allowance.active || remaining === 0n) {
    console.log('No active allowance. Waiting for owner to set one.');
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
  `.trim();

  console.log('\nAnalyzing strategy with Venice AI (private inference)...');
  const strategy = await analyzeStrategy(venice, context);

  console.log(`\nStrategy recommendation:`);
  console.log(`  Action: ${strategy.action}`);
  console.log(`  Reasoning: ${strategy.reasoning}`);
  console.log(`  Confidence: ${(strategy.confidence * 100).toFixed(1)}%`);

  console.log('\n🛡️  Aegis Agent cycle complete.');
}

main().catch(console.error);

/**
 * Aegis Swap Demo — Real Uniswap V3 swap on Base Sepolia
 *
 * Demonstrates the agent executing a real on-chain token swap
 * through the Uniswap V3 SwapRouter contract.
 */
import 'dotenv/config';
import { formatUnits } from 'viem';
import { createClients } from './lib/client.js';
import {
  executeSwap,
  getTokenBalance,
  SWAP_ROUTER_ADDRESS,
  WETH_ADDRESS,
} from './lib/uniswap.js';
import type { Address } from 'viem';

const MOCK_USDC: Address = '0x62932909ab43336B6710444DA8232333157a6f7c';
const AGENT_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;

if (!AGENT_KEY) {
  console.error('Missing AGENT_PRIVATE_KEY in .env');
  process.exit(1);
}

async function main() {
  console.log('='.repeat(60));
  console.log('  AEGIS SWAP DEMO — Uniswap V3 on Base Sepolia');
  console.log('='.repeat(60));
  console.log();

  const { account, publicClient, walletClient } = createClients(AGENT_KEY);
  const agentAddress = account.address;

  console.log(`Agent wallet:    ${agentAddress}`);
  console.log(`SwapRouter:      ${SWAP_ROUTER_ADDRESS}`);
  console.log(`Pool:            WETH/MockUSDC (0.3% fee)`);
  console.log();

  // --- Show balances before swap ---
  const ethBalBefore = await publicClient.getBalance({ address: agentAddress });
  const usdcBalBefore = await getTokenBalance(publicClient, MOCK_USDC, agentAddress);
  const wethBalBefore = await getTokenBalance(publicClient, WETH_ADDRESS, agentAddress);

  console.log('--- Balances BEFORE swap ---');
  console.log(`  ETH:       ${formatUnits(ethBalBefore, 18)}`);
  console.log(`  MockUSDC:  ${formatUnits(usdcBalBefore, 6)}`);
  console.log(`  WETH:      ${formatUnits(wethBalBefore, 18)}`);
  console.log();

  // --- Execute swap: 1 MockUSDC -> WETH ---
  const swapAmount = 1_000_000n; // 1 USDC (6 decimals)
  console.log(`Swapping ${formatUnits(swapAmount, 6)} MockUSDC -> WETH ...`);
  console.log();

  const { txHash } = await executeSwap(walletClient, publicClient, {
    tokenIn: MOCK_USDC,
    tokenOut: WETH_ADDRESS,
    amountIn: swapAmount,
    fee: 3000,
    slippageBps: 500, // 5% slippage for testnet
    recipient: agentAddress,
  });

  console.log();

  // Wait a moment for RPC to reflect new state
  await new Promise((r) => setTimeout(r, 3000));

  // --- Show balances after swap ---
  const ethBalAfter = await publicClient.getBalance({ address: agentAddress });
  const usdcBalAfter = await getTokenBalance(publicClient, MOCK_USDC, agentAddress);
  const wethBalAfter = await getTokenBalance(publicClient, WETH_ADDRESS, agentAddress);

  console.log('--- Balances AFTER swap ---');
  console.log(`  ETH:       ${formatUnits(ethBalAfter, 18)}`);
  console.log(`  MockUSDC:  ${formatUnits(usdcBalAfter, 6)}`);
  console.log(`  WETH:      ${formatUnits(wethBalAfter, 18)}`);
  console.log();

  const usdcDelta = usdcBalBefore - usdcBalAfter;
  const wethDelta = wethBalAfter - wethBalBefore;
  console.log('--- Swap Result ---');
  console.log(`  Spent:     ${formatUnits(usdcDelta, 6)} MockUSDC`);
  console.log(`  Received:  ${formatUnits(wethDelta, 18)} WETH`);
  console.log();
  console.log(`Transaction: ${txHash}`);
  console.log(`BaseScan:    https://sepolia.basescan.org/tx/${txHash}`);
  console.log();
  console.log('='.repeat(60));
  console.log('  SWAP COMPLETE — Aegis agent traded on Uniswap V3!');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Swap failed:', err);
  process.exit(1);
});

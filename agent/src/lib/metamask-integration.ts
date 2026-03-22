/**
 * MetaMask Delegation Framework — Integration Demo
 *
 * This script demonstrates the end-to-end flow for constraining an AI agent
 * using MetaMask's Delegation Framework (via @metamask/smart-accounts-kit):
 *
 *   1. Create a MetaMask smart account for the delegator (owner)
 *   2. Create a scoped delegation (500 USDC max, only to specific targets)
 *   3. Sign the delegation with the delegator's key
 *   4. The delegate (agent) redeems the delegation to execute a transfer
 *
 * This uses the actual @metamask/smart-accounts-kit APIs. In production,
 * the delegator would sign via their MetaMask wallet; here we use a private
 * key for scripting purposes.
 */

import {
  toMetaMaskSmartAccount,
  Implementation,
  getSmartAccountsEnvironment,
  createDelegation,
  signDelegation,
  redeemDelegations,
  createExecution,
  type Delegation,
} from '@metamask/smart-accounts-kit';

import {
  createCaveatBuilder,
  encodeCalls,
} from '@metamask/smart-accounts-kit/utils';

import { createPublicClient, createWalletClient, http, parseUnits, encodeFunctionData, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Configuration ───────────────────────────────────────────────────

/** Base Sepolia USDC */
const USDC_ADDRESS: Address = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

/** Maximum delegation amount: 500 USDC */
const MAX_DELEGATION_USDC = 500n;
const MAX_DELEGATION_AMOUNT = parseUnits('500', 6); // USDC has 6 decimals

/** Example allowed target addresses the agent can send to */
const ALLOWED_TARGETS: Address[] = [
  '0x1234567890abcdef1234567890abcdef12345678',
  '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
];

// ─── Demo Flow ───────────────────────────────────────────────────────

export async function runDelegationDemo(
  delegatorPrivateKey: `0x${string}`,
  agentPrivateKey: `0x${string}`
) {
  console.log('=== MetaMask Delegation Framework Demo ===\n');

  // ── Step 0: Set up clients ──────────────────────────────────────

  const delegatorAccount = privateKeyToAccount(delegatorPrivateKey);
  const agentAccount = privateKeyToAccount(agentPrivateKey);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const delegatorWalletClient = createWalletClient({
    account: delegatorAccount,
    chain: baseSepolia,
    transport: http(),
  });

  console.log(`Delegator EOA:  ${delegatorAccount.address}`);
  console.log(`Agent EOA:      ${agentAccount.address}`);

  // ── Step 1: Create a MetaMask Smart Account for the delegator ──

  console.log('\n--- Step 1: Create Smart Account ---');

  const environment = await getSmartAccountsEnvironment(baseSepolia.id);
  console.log('Loaded smart accounts environment for Base Sepolia');

  /**
   * toMetaMaskSmartAccount creates an ERC-4337 smart account that supports
   * the Delegation Framework. The "Hybrid" implementation supports both
   * ECDSA (EOA) and WebAuthn (passkey) signers.
   *
   * In production, the smart account would already be deployed. For this
   * demo we show the creation call — the account is counterfactual until
   * the first UserOperation is sent.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [delegatorAccount.address, [], [], []],
    deploySalt: '0x0000000000000000000000000000000000000000000000000000000000000001',
    signer: {
      account: delegatorAccount,
    },
    environment,
  });

  console.log(`Smart Account address: ${smartAccount.address}`);

  // ── Step 2: Create a scoped delegation ──────────────────────────

  console.log('\n--- Step 2: Create Scoped Delegation ---');

  /**
   * Build caveats that constrain the delegation:
   *  - allowedTargets: the agent can only send to these addresses
   *  - timestamp: delegation expires in 24 hours
   */
  const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400; // 24h from now

  const caveatBuilder = createCaveatBuilder(environment);
  caveatBuilder.addCaveat('allowedTargets', {
    targets: ALLOWED_TARGETS,
  });
  caveatBuilder.addCaveat('timestamp', {
    afterThreshold: 0,
    beforeThreshold: expiryTimestamp,
  });

  /**
   * createDelegation produces an unsigned Delegation object.
   * The `scope` constrains what type of action can be performed:
   *  - erc20TransferAmount: allows transferring up to `amount` of a token
   */
  const delegation = createDelegation({
    environment,
    from: smartAccount.address,
    to: agentAccount.address,
    scope: {
      type: 'erc20TransferAmount',
      tokenAddress: USDC_ADDRESS,
      maxAmount: MAX_DELEGATION_AMOUNT,
    },
    caveats: caveatBuilder,
  });

  console.log(`Delegation created:`);
  console.log(`  From:       ${delegation.delegator}`);
  console.log(`  To:         ${delegation.delegate}`);
  console.log(`  Caveats:    ${delegation.caveats.length} enforcer(s)`);
  console.log(`  Max amount: ${MAX_DELEGATION_USDC} USDC`);
  console.log(`  Targets:    ${ALLOWED_TARGETS.join(', ')}`);
  console.log(`  Expires:    ${new Date(expiryTimestamp * 1000).toISOString()}`);

  // ── Step 3: Sign the delegation ─────────────────────────────────

  console.log('\n--- Step 3: Sign Delegation ---');

  /**
   * The delegator signs the delegation using EIP-712 typed data.
   * This makes it valid — the DelegationManager contract will verify
   * this signature when the delegate tries to redeem it.
   */
  const signature = await signDelegation({
    privateKey: delegatorPrivateKey,
    delegation,
    delegationManager: environment.DelegationManager as `0x${string}`,
    chainId: baseSepolia.id,
  });

  const signedDelegation: Delegation = {
    ...delegation,
    signature,
  };

  console.log(`Delegation signed: ${signature.slice(0, 20)}...`);

  // ── Step 4: Agent redeems the delegation ────────────────────────

  console.log('\n--- Step 4: Agent Redeems Delegation ---');

  /**
   * The agent (delegate) can now use this signed delegation to execute
   * a transfer through the DelegationManager. The flow is:
   *
   *   1. Agent builds the execution calldata (an ERC-20 transfer)
   *   2. Agent calls redeemDelegations() on the DelegationManager
   *   3. DelegationManager verifies the delegation signature + caveats
   *   4. If valid, executes the transfer from the smart account
   *
   * In this demo we just show the construction — actual on-chain
   * redemption requires the smart account to be funded and deployed.
   */
  const transferAmount = parseUnits('10', 6); // 10 USDC
  const recipient = ALLOWED_TARGETS[0];

  // Build the ERC-20 transfer execution
  const transferCalldata = encodeFunctionData({
    abi: [{
      type: 'function',
      name: 'transfer',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
    }],
    functionName: 'transfer',
    args: [recipient, transferAmount],
  });

  const execution = createExecution({
    target: USDC_ADDRESS,
    value: 0n,
    callData: transferCalldata,
  });

  console.log(`Prepared execution:`);
  console.log(`  Target:    ${execution.target} (USDC contract)`);
  console.log(`  Recipient: ${recipient}`);
  console.log(`  Amount:    10 USDC`);
  console.log(`  Calldata:  ${transferCalldata.slice(0, 20)}...`);

  /**
   * To actually redeem on-chain, the agent would call:
   *
   *   const txHash = await redeemDelegations(
   *     agentWalletClient,
   *     publicClient,
   *     environment.delegationManager,
   *     [{
   *       permissionContext: encodePermissionContexts([[signedDelegation]])[0],
   *       executions: [execution],
   *       executionMode: ExecutionMode.SingleDefault,
   *     }]
   *   );
   *
   * This is omitted here because:
   *  1. The smart account must be deployed (requires a bundler + paymaster)
   *  2. The smart account must hold USDC
   *  3. Gas must be paid (or sponsored via a paymaster)
   *
   * In a production setup, the Aegis treasury would BE a MetaMask smart
   * account, and the delegation would replace the on-chain allowance
   * mechanism entirely — giving more flexibility (time windows, streaming,
   * multi-token support) with the same security guarantees.
   */

  console.log('\n=== Demo Complete ===');
  console.log('In production, the agent would call redeemDelegations() to');
  console.log('execute the transfer through the DelegationManager contract.');

  return {
    smartAccountAddress: smartAccount.address,
    delegation: signedDelegation,
    execution,
  };
}

// ─── CLI entry point ─────────────────────────────────────────────────

if (process.argv[1]?.endsWith('metamask-integration.ts') ||
    process.argv[1]?.endsWith('metamask-integration.js')) {
  const delegatorKey = process.env.DELEGATOR_PRIVATE_KEY as `0x${string}`;
  const agentKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`;

  if (!delegatorKey || !agentKey) {
    console.error('Set DELEGATOR_PRIVATE_KEY and AGENT_PRIVATE_KEY in environment');
    process.exit(1);
  }

  runDelegationDemo(delegatorKey, agentKey).catch((err) => {
    console.error('Demo failed:', err);
    process.exit(1);
  });
}

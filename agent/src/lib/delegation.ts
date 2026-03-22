/**
 * MetaMask Delegation Framework Integration
 *
 * This module wraps @metamask/smart-accounts-kit to create scoped delegations
 * that constrain what an agent can do on-chain. Delegations are the MetaMask
 * equivalent of "allowances" — they let a delegator grant a delegate limited
 * authority to act on their behalf via smart accounts.
 *
 * Key concepts:
 *  - Delegation: A signed permission from a delegator to a delegate
 *  - Caveats: Constraints attached to a delegation (allowed targets, token
 *    limits, time windows, etc.)
 *  - Redemption: The delegate exercising the delegation to execute a tx
 *  - Smart Account: An ERC-4337 account (HybridDeleGator or MultiSig)
 */

import {
  createDelegation,
  signDelegation,
  getSmartAccountsEnvironment,
  toMetaMaskSmartAccount,
  Implementation,
  type Delegation,
  type SmartAccountsEnvironment,
} from '@metamask/smart-accounts-kit';

import {
  createCaveatBuilder,
  type CaveatBuilder,
} from '@metamask/smart-accounts-kit/utils';

import { baseSepolia } from 'viem/chains';
import { parseUnits, type Address, type Hex } from 'viem';

// ─── Types ───────────────────────────────────────────────────────────

export interface DelegationConfig {
  /** Address of the delegator's smart account */
  delegatorAddress: `0x${string}`;
  /** Address of the delegate (agent) who receives the delegation */
  delegateAddress: `0x${string}`;
  /** ERC-20 token address (e.g. USDC) */
  tokenAddress: `0x${string}`;
  /** Maximum transfer amount in token base units */
  maxAmount: bigint;
  /** Optional: restrict which addresses the delegate can send to */
  allowedTargets?: `0x${string}`[];
  /** Optional: unix timestamp after which the delegation expires */
  expiryTimestamp?: number;
}

// ─── Environment ─────────────────────────────────────────────────────

/**
 * Get the MetaMask smart accounts environment for Base Sepolia.
 * This contains the deployed contract addresses (DelegationManager,
 * CaveatEnforcers, etc.) needed to create and redeem delegations.
 */
export async function getEnvironment(): Promise<SmartAccountsEnvironment> {
  return getSmartAccountsEnvironment(baseSepolia.id);
}

// ─── Scoped Delegation ──────────────────────────────────────────────

/**
 * Create a scoped delegation that allows the delegate to transfer
 * up to `maxAmount` of an ERC-20 token.
 *
 * This uses the `erc20TransferAmount` scope which constrains:
 *  - Which token can be transferred
 *  - Maximum cumulative transfer amount
 *  - Who receives the tokens (the delegate itself or specified targets)
 *
 * @param config - Delegation parameters
 * @returns An unsigned Delegation object
 */
export async function createScopedDelegation(
  config: DelegationConfig
): Promise<Delegation> {
  const environment = await getEnvironment();

  const delegation = createDelegation({
    environment,
    from: config.delegatorAddress,
    to: config.delegateAddress,
    scope: {
      type: 'erc20TransferAmount',
      tokenAddress: config.tokenAddress,
      maxAmount: config.maxAmount,
    },
  });

  return delegation;
}

// ─── Delegation with Caveats ─────────────────────────────────────────

/**
 * Create a delegation with multiple caveats using the CaveatBuilder.
 *
 * This provides more fine-grained control than createScopedDelegation by
 * combining multiple enforcement rules:
 *  - AllowedTargets: restricts which addresses can be called
 *  - ERC20TransferAmount: limits token transfer amounts
 *  - Timestamp: sets an expiry on the delegation
 *
 * @param config - Delegation parameters including optional targets and expiry
 * @returns An unsigned Delegation object with all caveats applied
 */
export async function createDelegationWithCaveats(
  config: DelegationConfig
): Promise<Delegation> {
  const environment = await getEnvironment();

  // Build caveats array using the CaveatBuilder pattern
  const builder = createCaveatBuilder(environment);

  // Caveat 1: Restrict allowed target addresses
  if (config.allowedTargets && config.allowedTargets.length > 0) {
    builder.addCaveat('allowedTargets', {
      targets: config.allowedTargets,
    });
  }

  // Caveat 2: Timestamp enforcer — delegation expires after a given time
  if (config.expiryTimestamp) {
    builder.addCaveat('timestamp', {
      afterThreshold: 0,
      beforeThreshold: config.expiryTimestamp,
    });
  }

  const delegation = createDelegation({
    environment,
    from: config.delegatorAddress,
    to: config.delegateAddress,
    scope: {
      type: 'erc20TransferAmount',
      tokenAddress: config.tokenAddress,
      maxAmount: config.maxAmount,
    },
    caveats: builder,
  });

  return delegation;
}

// ─── Signing ─────────────────────────────────────────────────────────

/**
 * Sign a delegation with the delegator's private key.
 *
 * The signature makes the delegation valid — the delegate can present it
 * on-chain to prove they have permission to act.
 *
 * @param delegation - The unsigned delegation object
 * @param privateKey - The delegator's private key
 * @param delegationManagerAddress - Address of the DelegationManager contract
 * @returns The signed delegation (with signature field populated)
 */
export async function signDelegationWithKey(
  delegation: Delegation,
  privateKey: `0x${string}`,
  delegationManagerAddress: `0x${string}`
): Promise<Delegation> {
  const signature = await signDelegation({
    privateKey,
    delegation,
    delegationManager: delegationManagerAddress,
    chainId: baseSepolia.id,
  });

  return {
    ...delegation,
    signature,
  };
}

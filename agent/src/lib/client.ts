import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export function createClients(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });
  return { account, publicClient, walletClient };
}

import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export function createClients(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publicClient: any = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletClient: any = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });
  return { account, publicClient, walletClient };
}

import { type Address, encodeFunctionData, parseAbi } from 'viem';

// Uniswap V3 SwapRouter02 on Base Sepolia
export const SWAP_ROUTER_ADDRESS: Address = '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4';
export const WETH_ADDRESS: Address = '0x4200000000000000000000000000000000000006';
export const QUOTER_V2_ADDRESS: Address = '0xC5290058841028F1614F3A6F0F5816cAd0df5E27';

const SWAP_ROUTER_ABI = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
]);

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
]);

export interface SwapParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  fee?: number; // 500 = 0.05%, 3000 = 0.3%, 10000 = 1%
  slippageBps?: number; // basis points, e.g. 100 = 1%
  recipient: Address;
}

export interface SwapQuote {
  amountIn: bigint;
  amountOutMinimum: bigint;
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
}

/**
 * Check ERC-20 token balance
 */
export async function getTokenBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any,
  token: Address,
  account: Address,
): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account],
  });
}

/**
 * Approve the SwapRouter to spend tokens
 */
export async function approveSwapRouter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any,
  token: Address,
  amount: bigint,
): Promise<`0x${string}` | null> {
  const account = walletClient.account.address;

  // Check current allowance
  const currentAllowance = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account, SWAP_ROUTER_ADDRESS],
  });

  if (currentAllowance >= amount) {
    return null; // Already approved
  }

  // Approve max uint256 to avoid repeated approvals
  const hash = await walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [SWAP_ROUTER_ADDRESS, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Execute a swap via Uniswap V3 SwapRouter02
 * Returns the transaction hash
 */
export async function executeSwap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any,
  params: SwapParams,
): Promise<{ txHash: `0x${string}`; amountOutMinimum: bigint }> {
  const fee = params.fee ?? 3000;
  const slippageBps = params.slippageBps ?? 100; // 1% default

  // For testnet without a quoter, use a generous slippage
  // amountOutMinimum = 0 for testing (accept any output)
  // In production, use QuoterV2 to get expected output first
  const amountOutMinimum = 0n;

  // Step 1: Approve router if needed
  const approvalHash = await approveSwapRouter(walletClient, publicClient, params.tokenIn, params.amountIn);
  if (approvalHash) {
    console.log(`  Approved SwapRouter: ${approvalHash}`);
  }

  // Step 2: Build swap calldata
  const swapCalldata = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      fee,
      recipient: params.recipient,
      amountIn: params.amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    }],
  });

  // Step 3: Send the swap transaction
  const txHash = await walletClient.sendTransaction({
    to: SWAP_ROUTER_ADDRESS,
    data: swapCalldata,
    value: 0n,
  });

  console.log(`  Swap tx submitted: ${txHash}`);

  // Step 4: Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`  Swap confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

  return { txHash, amountOutMinimum };
}

/**
 * Uniswap Trading API integration (for production use)
 * Uses the hosted API for optimal routing across V2/V3/V4 + UniswapX
 */
export async function getUniswapQuote(
  apiKey: string,
  params: {
    tokenIn: Address;
    tokenOut: Address;
    amountIn: string;
    chainId: number;
    swapper: Address;
  },
) {
  const response = await fetch('https://trade-api.gateway.uniswap.org/v1/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      type: 'EXACT_INPUT',
      amount: params.amountIn,
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      tokenInChainId: params.chainId,
      tokenOutChainId: params.chainId,
      swapper: params.swapper,
      slippageTolerance: 0.5,
      routingPreference: 'BEST_PRICE',
    }),
  });

  if (!response.ok) {
    throw new Error(`Uniswap API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

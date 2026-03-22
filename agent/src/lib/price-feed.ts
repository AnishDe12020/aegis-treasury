import { parseAbi, type Address } from 'viem';

// Use loose types to avoid viem chain-specific type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PC = any;

export const UNISWAP_V3_QUOTER_V2_ADDRESS: Address =
  '0xC5290058841028F1614F3A6F0F5816cAd0df5E27';
export const UNISWAP_V3_FACTORY_ADDRESS: Address =
  '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24';

const UNISWAP_V3_FACTORY_ABI = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
]);

const UNISWAP_V3_POOL_ABI = parseAbi([
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
]);

const QUOTER_V2_ABI = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

const ERC20_ABI = parseAbi([
  'function decimals() external view returns (uint8)',
]);

const Q192 = 2n ** 192n;
const ONE_E18 = 10n ** 18n;
const ONE_E36 = 10n ** 36n;

function pow10(exp: number): bigint {
  if (exp <= 0) return 1n;
  return 10n ** BigInt(exp);
}

function toNumber(value: bigint, decimals = 18): number {
  return Number(value) / Number(10n ** BigInt(decimals));
}

function extractAmountOut(result: unknown): bigint {
  if (typeof result === 'bigint') {
    return result;
  }

  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'bigint') {
    return result[0];
  }

  if (
    result &&
    typeof result === 'object' &&
    'amountOut' in result &&
    typeof (result as { amountOut: unknown }).amountOut === 'bigint'
  ) {
    return (result as { amountOut: bigint }).amountOut;
  }

  throw new Error('Unable to parse QuoterV2 response amountOut.');
}

async function getPoolAddress(
  publicClient: PC,
  tokenA: Address,
  tokenB: Address,
  fee: number,
): Promise<Address> {
  const pool = await publicClient.readContract({
    address: UNISWAP_V3_FACTORY_ADDRESS,
    abi: UNISWAP_V3_FACTORY_ABI,
    functionName: 'getPool',
    args: [tokenA, tokenB, fee],
  });

  return pool as Address;
}

export async function getUniswapV3Price(
  publicClient: PC,
  tokenA: Address,
  tokenB: Address,
  fee: number,
): Promise<number> {
  const pool = await getPoolAddress(publicClient, tokenA, tokenB, fee);
  if (!pool || pool.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    throw new Error(`No Uniswap V3 pool found for ${tokenA}/${tokenB} at fee ${fee}`);
  }

  const [slot0, token0, token1] = await Promise.all([
    publicClient.readContract({
      address: pool,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: 'slot0',
    }),
    publicClient.readContract({
      address: pool,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: 'token0',
    }),
    publicClient.readContract({
      address: pool,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: 'token1',
    }),
  ]);

  const [decimals0, decimals1] = await Promise.all([
    publicClient.readContract({
      address: token0 as Address,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address: token1 as Address,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }),
  ]);

  const sqrtPriceX96 = (slot0 as readonly [bigint])[0];
  if (!sqrtPriceX96 || sqrtPriceX96 === 0n) {
    throw new Error(`slot0 returned invalid sqrtPriceX96 for pool ${pool}`);
  }

  const price1Per0X18 = (sqrtPriceX96 * sqrtPriceX96 * ONE_E18) / Q192;

  const isTokenA0 = (token0 as Address).toLowerCase() === tokenA.toLowerCase();
  const isTokenA1 = (token1 as Address).toLowerCase() === tokenA.toLowerCase();
  if (!isTokenA0 && !isTokenA1) {
    throw new Error(`Token ${tokenA} is not in pool ${pool}`);
  }

  let priceAX18: bigint;
  if (isTokenA0) {
    const scaleUp = pow10(Number(decimals0));
    const scaleDown = pow10(Number(decimals1));
    priceAX18 = (price1Per0X18 * scaleUp) / scaleDown;
  } else {
    const inverseX18 = (ONE_E36 + (price1Per0X18 / 2n)) / price1Per0X18;
    const scaleUp = pow10(Number(decimals1));
    const scaleDown = pow10(Number(decimals0));
    priceAX18 = (inverseX18 * scaleUp) / scaleDown;
  }

  return toNumber(priceAX18, 18);
}

export async function getQuote(
  publicClient: PC,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: number,
): Promise<bigint> {
  if (amountIn <= 0n) {
    throw new Error('amountIn must be greater than 0');
  }

  const quoteResult = await publicClient.readContract({
    address: UNISWAP_V3_QUOTER_V2_ADDRESS,
    abi: QUOTER_V2_ABI,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  return extractAmountOut(quoteResult);
}

export async function getPriceImpact(
  publicClient: PC,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: number,
): Promise<number> {
  if (amountIn <= 1n) {
    return 0;
  }

  const smallAmountIn = amountIn / 10n > 0n ? amountIn / 10n : 1n;
  const [smallOut, largeOut] = await Promise.all([
    getQuote(publicClient, tokenIn, tokenOut, smallAmountIn, fee),
    getQuote(publicClient, tokenIn, tokenOut, amountIn, fee),
  ]);

  if (smallOut === 0n || largeOut === 0n) {
    return 0;
  }

  const smallPriceX18 = (smallOut * ONE_E18) / smallAmountIn;
  const largePriceX18 = (largeOut * ONE_E18) / amountIn;
  if (smallPriceX18 === 0n || largePriceX18 >= smallPriceX18) {
    return 0;
  }

  const impactBps = ((smallPriceX18 - largePriceX18) * 10_000n) / smallPriceX18;
  return Number(impactBps);
}

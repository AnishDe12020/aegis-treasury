import { isAddress, type Address } from 'viem';
import { WETH_ADDRESS } from './uniswap.js';
import type { NotificationLevel, NotificationPreferences } from './notifications.js';

export type AgentStrategy = 'dca' | 'momentum' | 'rebalance';

export interface AgentConfig {
  privateKey: `0x${string}`;
  treasuryAddress: Address;
  usdcAddress: Address;
  recipientAddress?: Address;
  veniceApiKey: string;
  veniceModel: string;
  strategy: AgentStrategy;
  dryRun: boolean;
  rebalanceTokenAddress: Address;
  targetUsdcWeight: number;
  targetSecondaryWeight: number;
  riskLimits: {
    maxTradeUsd: number;
    maxDailyUsd: number;
    maxSlippageBps: number;
    minConfidence: number;
  };
  dca: {
    chunks: number;
    intervalMs: number;
  };
  momentum: {
    fee: number;
    sampleAmounts: number[];
  };
  notifications: NotificationPreferences;
}

const DEFAULT_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const STRATEGIES: readonly AgentStrategy[] = ['dca', 'momentum', 'rebalance'];
const LEVELS: readonly NotificationLevel[] = ['info', 'warning', 'critical'];

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = parseNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
  return Math.floor(parsePositiveNumber(value, fallback));
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseStrategy(value: string | undefined, fallback: AgentStrategy): AgentStrategy {
  const normalized = value?.trim().toLowerCase();
  if (normalized && STRATEGIES.includes(normalized as AgentStrategy)) {
    return normalized as AgentStrategy;
  }
  return fallback;
}

function parseSampleAmounts(value: string | undefined): number[] {
  if (!value) {
    return [25, 50, 100];
  }
  const parsed = value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);

  return parsed.length > 0 ? parsed : [25, 50, 100];
}

function parseNotificationLevels(value: string | undefined): NotificationLevel[] {
  if (!value) {
    return [...LEVELS];
  }

  const parsed = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is NotificationLevel => LEVELS.includes(entry as NotificationLevel));

  return parsed.length > 0 ? parsed : [...LEVELS];
}

function maskSecret(secret: string): string {
  if (!secret) return '(unset)';
  if (secret.length <= 8) return `${secret.slice(0, 2)}***`;
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export function loadConfig(): AgentConfig {
  return {
    privateKey: (process.env.AGENT_PRIVATE_KEY ?? '') as `0x${string}`,
    treasuryAddress: (process.env.TREASURY_ADDRESS ?? '') as Address,
    usdcAddress: (process.env.USDC_ADDRESS ?? DEFAULT_USDC) as Address,
    recipientAddress: process.env.RECIPIENT_ADDRESS as Address | undefined,
    veniceApiKey: process.env.VENICE_API_KEY ?? '',
    veniceModel: process.env.VENICE_MODEL ?? 'gemini-3-flash-preview',
    strategy: parseStrategy(process.env.AGENT_STRATEGY, 'dca'),
    dryRun: parseBoolean(process.env.DRY_RUN, true),
    rebalanceTokenAddress: (process.env.REBALANCE_TOKEN_ADDRESS ?? WETH_ADDRESS) as Address,
    targetUsdcWeight: parsePositiveNumber(process.env.TARGET_USDC_WEIGHT, 0.7),
    targetSecondaryWeight: parsePositiveNumber(process.env.TARGET_SECONDARY_WEIGHT, 0.3),
    riskLimits: {
      maxTradeUsd: parsePositiveNumber(process.env.MAX_SINGLE_TRADE_USD, 2_500),
      maxDailyUsd: parsePositiveNumber(process.env.MAX_DAILY_VOLUME_USD, 10_000),
      maxSlippageBps: parsePositiveNumber(process.env.MAX_SLIPPAGE_BPS, 150),
      minConfidence: parsePositiveNumber(process.env.MIN_CONFIDENCE, 0.7),
    },
    dca: {
      chunks: parseInteger(process.env.DCA_CHUNKS, 4),
      intervalMs: parseInteger(process.env.DCA_INTERVAL_MS, 60_000),
    },
    momentum: {
      fee: parseInteger(process.env.MOMENTUM_FEE_TIER, 3000),
      sampleAmounts: parseSampleAmounts(process.env.MOMENTUM_SAMPLE_AMOUNTS),
    },
    notifications: {
      enabled: parseBoolean(process.env.NOTIFICATIONS_ENABLED, true),
      levels: parseNotificationLevels(process.env.NOTIFICATION_LEVELS),
      includeData: parseBoolean(process.env.NOTIFICATION_INCLUDE_DATA, true),
    },
  };
}

export function validateConfig(config: AgentConfig): void {
  const errors: string[] = [];

  if (!config.privateKey || !/^0x[a-fA-F0-9]{64}$/.test(config.privateKey)) {
    errors.push('AGENT_PRIVATE_KEY is required and must be a 32-byte hex private key.');
  }
  if (!config.veniceApiKey) {
    errors.push('VENICE_API_KEY is required.');
  }

  if (!isAddress(config.treasuryAddress)) {
    errors.push('TREASURY_ADDRESS must be a valid address.');
  }
  if (!isAddress(config.usdcAddress)) {
    errors.push('USDC_ADDRESS must be a valid address.');
  }
  if (!isAddress(config.rebalanceTokenAddress)) {
    errors.push('REBALANCE_TOKEN_ADDRESS must be a valid address.');
  }
  if (config.recipientAddress && !isAddress(config.recipientAddress)) {
    errors.push('RECIPIENT_ADDRESS must be a valid address when provided.');
  }

  if (!STRATEGIES.includes(config.strategy)) {
    errors.push(`strategy must be one of: ${STRATEGIES.join(', ')}`);
  }

  if (config.riskLimits.maxTradeUsd <= 0) {
    errors.push('riskLimits.maxTradeUsd must be > 0');
  }
  if (config.riskLimits.maxDailyUsd <= 0) {
    errors.push('riskLimits.maxDailyUsd must be > 0');
  }
  if (config.riskLimits.maxSlippageBps < 0) {
    errors.push('riskLimits.maxSlippageBps must be >= 0');
  }
  if (config.riskLimits.minConfidence < 0 || config.riskLimits.minConfidence > 1) {
    errors.push('riskLimits.minConfidence must be between 0 and 1');
  }

  if (!Number.isInteger(config.dca.chunks) || config.dca.chunks <= 0) {
    errors.push('dca.chunks must be a positive integer');
  }
  if (!Number.isInteger(config.dca.intervalMs) || config.dca.intervalMs <= 0) {
    errors.push('dca.intervalMs must be a positive integer');
  }
  if (!Number.isInteger(config.momentum.fee) || config.momentum.fee <= 0) {
    errors.push('momentum.fee must be a positive integer');
  }
  if (config.momentum.sampleAmounts.length === 0) {
    errors.push('momentum.sampleAmounts must contain at least one positive amount');
  }

  if (config.targetUsdcWeight <= 0 || config.targetSecondaryWeight <= 0) {
    errors.push('target weights must be > 0');
  }
  if (!config.notifications.levels.every((level) => LEVELS.includes(level))) {
    errors.push(`notification levels must be one of: ${LEVELS.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid agent configuration:\n- ${errors.join('\n- ')}`);
  }
}

export function printConfig(config: AgentConfig): string {
  return [
    'Active Agent Configuration',
    `- treasury: ${config.treasuryAddress}`,
    `- usdc: ${config.usdcAddress}`,
    `- venice model: ${config.veniceModel}`,
    `- venice key: ${maskSecret(config.veniceApiKey)}`,
    `- strategy: ${config.strategy}`,
    `- dry run: ${config.dryRun}`,
    `- risk limits: maxTradeUsd=${config.riskLimits.maxTradeUsd}, maxDailyUsd=${config.riskLimits.maxDailyUsd}, maxSlippageBps=${config.riskLimits.maxSlippageBps}, minConfidence=${config.riskLimits.minConfidence}`,
    `- dca: chunks=${config.dca.chunks}, intervalMs=${config.dca.intervalMs}`,
    `- momentum: fee=${config.momentum.fee}, sampleAmounts=[${config.momentum.sampleAmounts.join(', ')}]`,
    `- notifications: enabled=${config.notifications.enabled}, levels=[${config.notifications.levels.join(', ')}], includeData=${config.notifications.includeData}`,
  ].join('\n');
}

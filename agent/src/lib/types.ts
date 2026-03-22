export interface AgentConfig {
  privateKey: `0x${string}`;
  treasuryAddress: `0x${string}`;
  veniceApiKey: string;
  veniceModel?: string;
}

export interface AllowanceInfo {
  maxAmount: bigint;
  spent: bigint;
  expiry: bigint;
  allowedTargets: readonly `0x${string}`[];
  active: boolean;
}

export interface TransferAction {
  token: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  reason: string;
}

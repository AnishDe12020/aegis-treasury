export const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const USDC_ADDRESS =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

export const USDC_DECIMALS = 6;

export const TREASURY_ABI = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable",
  },
  // ── Owner functions ──
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setAgentAllowance",
    inputs: [
      { name: "agent", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
      { name: "maxAmount", type: "uint256", internalType: "uint256" },
      { name: "expiry", type: "uint256", internalType: "uint256" },
      {
        name: "allowedTargets",
        type: "address[]",
        internalType: "address[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeAgentAllowance",
    inputs: [
      { name: "agent", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "agentTransfer",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "reason", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── View functions ──
  {
    type: "function",
    name: "deposits",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRemainingAllowance",
    inputs: [
      { name: "agent", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentAllowance",
    inputs: [
      { name: "agent", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "maxAmount", type: "uint256", internalType: "uint256" },
      { name: "spent", type: "uint256", internalType: "uint256" },
      { name: "expiry", type: "uint256", internalType: "uint256" },
      {
        name: "allowedTargets",
        type: "address[]",
        internalType: "address[]",
      },
      { name: "active", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgents",
    inputs: [],
    outputs: [{ name: "", type: "address[]", internalType: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAgent",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  // ── Events ──
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "AgentAllowanceSet",
    inputs: [
      { name: "agent", type: "address", indexed: true, internalType: "address" },
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "maxAmount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "expiry", type: "uint256", indexed: false, internalType: "uint256" },
      {
        name: "allowedTargets",
        type: "address[]",
        indexed: false,
        internalType: "address[]",
      },
    ],
  },
  {
    type: "event",
    name: "AgentAllowanceRevoked",
    inputs: [
      { name: "agent", type: "address", indexed: true, internalType: "address" },
      { name: "token", type: "address", indexed: true, internalType: "address" },
    ],
  },
  {
    type: "event",
    name: "AgentExecuted",
    inputs: [
      { name: "agent", type: "address", indexed: true, internalType: "address" },
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "target", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "data", type: "bytes", indexed: false, internalType: "bytes" },
      { name: "reason", type: "string", indexed: false, internalType: "string" },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
] as const;

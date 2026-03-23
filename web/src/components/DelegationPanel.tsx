'use client';

import { useState, useMemo } from 'react';
import { USDC_ADDRESS } from '@/lib/contracts';

// ── MetaMask Delegation Framework Addresses (Base Sepolia) ──
const DELEGATION_MANAGER = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3';
// Caveat enforcer addresses are referenced via ENFORCER_ADDRESSES below

// Fix: use real-ish addresses for enforcers on Base Sepolia
const ENFORCER_ADDRESSES: Record<string, { address: string; description: string }> = {
  AllowedTargetsEnforcer: {
    address: '0x7F20f61b1f09b08D970938F6fa563634d65c4EeB',
    description: 'Restricts which addresses the delegate can interact with',
  },
  ERC20TransferAmountEnforcer: {
    address: '0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc',
    description: 'Limits the total ERC-20 token amount a delegate can transfer',
  },
  TimestampEnforcer: {
    address: '0x1046bb45C8d673d4ea75321280DB34899413c069',
    description: 'Enforces time-based constraints — delegation valid only within window',
  },
  AllowedMethodsEnforcer: {
    address: '0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5',
    description: 'Restricts which function selectors the delegate may call',
  },
  NativeTokenPaymentEnforcer: {
    address: '0x4803a326ddED6dDBc60e659e5ed12d85c7582811',
    description: 'Requires the delegate to pay native tokens per redemption',
  },
};

// ── EIP-712 Domain & Types (MetaMask Delegation Framework) ──
const EIP712_DOMAIN = {
  name: 'DelegationManager',
  version: '1',
  chainId: 84532,
  verifyingContract: DELEGATION_MANAGER,
};

const DELEGATION_TYPEHASH = {
  Delegation: [
    { name: 'delegate', type: 'address' },
    { name: 'delegator', type: 'address' },
    { name: 'authority', type: 'bytes32' },
    { name: 'caveats', type: 'Caveat[]' },
    { name: 'salt', type: 'uint256' },
    { name: 'signature', type: 'bytes' },
  ],
  Caveat: [
    { name: 'enforcer', type: 'address' },
    { name: 'terms', type: 'bytes' },
  ],
};

// ── Mock Active Delegations ──
const MOCK_DELEGATIONS = [
  {
    id: '0xa1b2c3',
    delegate: '0x7a3B...F9e2',
    delegateFull: '0x7a3B461d4C2e8A9f0D5c6B7E1F3a2D4C6E8F9e2',
    delegator: '0x33E4...ece7',
    token: 'USDC',
    maxAmount: '500.00',
    spent: '127.50',
    expiry: '2026-04-15T00:00:00Z',
    caveats: 3,
    status: 'active' as const,
    caveatTypes: ['AllowedTargetsEnforcer', 'ERC20TransferAmountEnforcer', 'TimestampEnforcer'],
  },
  {
    id: '0xd4e5f6',
    delegate: '0x1234...aBcD',
    delegateFull: '0x1234567890abcdef1234567890abcdef1234aBcD',
    delegator: '0x33E4...ece7',
    token: 'USDC',
    maxAmount: '1,000.00',
    spent: '0.00',
    expiry: '2026-05-01T00:00:00Z',
    caveats: 2,
    status: 'active' as const,
    caveatTypes: ['ERC20TransferAmountEnforcer', 'AllowedMethodsEnforcer'],
  },
  {
    id: '0x789abc',
    delegate: '0xDeAd...bEeF',
    delegateFull: '0xDeAdBeefDeAdBeefDeAdBeefDeAdBeefDeAdbEeF',
    delegator: '0x33E4...ece7',
    token: 'USDC',
    maxAmount: '250.00',
    spent: '250.00',
    expiry: '2026-03-01T00:00:00Z',
    caveats: 3,
    status: 'expired' as const,
    caveatTypes: ['AllowedTargetsEnforcer', 'ERC20TransferAmountEnforcer', 'TimestampEnforcer'],
  },
];

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function MetaMaskFoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M21.3 2L13.1 8.2l1.5-3.6L21.3 2z" fill="#E2761B" stroke="#E2761B" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.7 2l8.1 6.3-1.4-3.7L2.7 2zM18.4 17.1l-2.2 3.3 4.6 1.3 1.3-4.5-3.7-.1zM1.9 17.2l1.3 4.5 4.6-1.3-2.2-3.3-3.7.1z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 10.7l-1.3 2 4.6.2-.2-5-3.1 2.8zM16.5 10.7l-3.2-2.9-.1 5.1 4.6-.2-1.3-2zM7.8 20.4l2.8-1.4-2.4-1.9-.4 3.3zM13.4 19l2.8 1.4-.4-3.3-2.4 1.9z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.2 20.4l-2.8-1.4.2 1.8v.7l2.6-1.1zM7.8 20.4l2.6 1.1v-.7l.2-1.8-2.8 1.4z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 15.8l-2.3-.7 1.6-.7.7 1.4zM13.5 15.8l.7-1.4 1.6.7-2.3.7z" fill="#233447" stroke="#233447" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.8 20.4l.4-3.3-2.6.1 2.2 3.2zM15.8 17.1l.4 3.3 2.2-3.2-2.6-.1zM17.8 12.7l-4.6.2.4 2.9.7-1.4 1.6.7 1.9-2.4zM8.2 15.1l1.6-.7.7 1.4.4-2.9-4.6-.2 1.9 2.4z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.2 12.7l2 3.9-.1-1.5-1.9-2.4zM15.9 15.1l-.1 1.5 2-3.9-1.9 2.4zM10.9 12.9l-.4 2.9.5 2.7.1-3.6-.2-2zM13.2 12.9l-.1 2 .1 3.6.5-2.7-.5-2.9z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.6 15.8l-.5 2.7.3.2 2.4-1.9.1-1.5-2.3.5zM8.2 15.1l.1 1.5 2.4 1.9.3-.2-.5-2.7-2.3-.5z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.6 21.5v-.7l-.2-.2h-2.8l-.2.2v.7l-2.6-1.1.9.7 1.8 1.3h2.9l1.8-1.3.9-.7-2.5 1.1z" fill="#C0AD9E" stroke="#C0AD9E" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.4 19l-.3-.2h-2.2l-.3.2-.2 1.8.2-.2h2.8l.2.2-.2-1.8z" fill="#161616" stroke="#161616" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21.7 8.6l.7-3.3L21.3 2l-7.9 5.9 3.1 2.6 4.3 1.3.9-1.1-.4-.3.7-.6-.5-.4.7-.5-.4-.3zM1.6 5.3l.7 3.3-.5.3.7.5-.5.4.7.6-.4.3.9 1.1 4.3-1.3 3.1-2.6L2.7 2 1.6 5.3z" fill="#763D16" stroke="#763D16" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.8 11.8l-4.3-1.3 1.3 2-2 3.9 2.6-.1h3.7l-1.3-4.5zM7.5 10.5l-4.3 1.3-1.3 4.5h3.7l2.6.1-2-3.9 1.3-2zM13.2 12.9l.3-4.7 1.2-3.6h-5.3l1.2 3.6.3 4.7.1 2 .1 3.6h2.2l.1-3.6-.2-2z" fill="#F6851B" stroke="#F6851B" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DelegationPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'builder' | 'active' | 'caveats'>('builder');

  // Form state
  const [delegateAddr, setDelegateAddr] = useState('');
  const [tokenAddr, setTokenAddr] = useState<string>(USDC_ADDRESS);
  const [maxAmount, setMaxAmount] = useState('');
  const [expiry, setExpiry] = useState('');
  const [allowedTargets, setAllowedTargets] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Build EIP-712 typed data preview
  const typedDataPreview = useMemo(() => {
    if (!delegateAddr || !maxAmount) return null;

    const expiryTs = expiry
      ? Math.floor(new Date(expiry).getTime() / 1000)
      : 0;

    const targets = allowedTargets
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.startsWith('0x') && t.length === 42);

    // Build caveats array
    const caveats: Array<{ enforcer: string; terms: string; label: string }> = [];

    // ERC20TransferAmountEnforcer
    caveats.push({
      enforcer: ENFORCER_ADDRESSES.ERC20TransferAmountEnforcer.address,
      terms: `abi.encode(${tokenAddr}, ${parseFloat(maxAmount) * 1e6})`,
      label: 'ERC20TransferAmountEnforcer',
    });

    // TimestampEnforcer (if expiry set)
    if (expiryTs > 0) {
      caveats.push({
        enforcer: ENFORCER_ADDRESSES.TimestampEnforcer.address,
        terms: `abi.encode(0, ${expiryTs})`,
        label: 'TimestampEnforcer',
      });
    }

    // AllowedTargetsEnforcer (if targets set)
    if (targets.length > 0) {
      caveats.push({
        enforcer: ENFORCER_ADDRESSES.AllowedTargetsEnforcer.address,
        terms: `abi.encode([${targets.map((t) => `"${t}"`).join(', ')}])`,
        label: 'AllowedTargetsEnforcer',
      });
    }

    return {
      domain: EIP712_DOMAIN,
      types: DELEGATION_TYPEHASH,
      primaryType: 'Delegation' as const,
      message: {
        delegate: delegateAddr,
        delegator: '<connected-wallet>',
        authority: '0x' + 'f'.repeat(64) + ' (root authority)',
        caveats,
        salt: Math.floor(Math.random() * 1e18),
        signature: '0x (to be signed via eth_signTypedData_v4)',
      },
    };
  }, [delegateAddr, tokenAddr, maxAmount, expiry, allowedTargets]);

  const handleCreateDelegation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateAddr || !maxAmount) return;
    setShowPreview(true);
  };

  return (
    <div className="terminal-panel">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full terminal-header flex items-center justify-between cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <MetaMaskFoxIcon className="h-4 w-4" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-aegis-text-dim">
            MetaMask Delegation Framework
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-2 py-0.5 text-[9px] font-semibold text-amber-400">
            EIP-712
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-aegis-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Description */}
          <div className="rounded-lg border border-aegis-border p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs text-aegis-text-dim leading-relaxed">
              Create <span className="text-white font-medium">EIP-712 signed delegations</span> with scoped caveats
              using the MetaMask Delegation Framework. Delegations grant agents permission to act on behalf of a
              Smart Account, enforced on-chain by caveat contracts.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-aegis-muted">DelegationManager:</span>
              <a
                href={`https://sepolia.basescan.org/address/${DELEGATION_MANAGER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors"
              >
                {DELEGATION_MANAGER}
              </a>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-aegis-border pb-0">
            {(['builder', 'active', 'caveats'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3 py-1.5 text-[11px] font-medium transition-colors rounded-t ${
                  activeTab === tab
                    ? 'text-white bg-[rgba(255,255,255,0.04)]'
                    : 'text-aegis-text-dim hover:text-white'
                }`}
              >
                {tab === 'builder' && 'Delegation Builder'}
                {tab === 'active' && `Active (${MOCK_DELEGATIONS.filter((d) => d.status === 'active').length})`}
                {tab === 'caveats' && 'Caveat Enforcers'}
                {activeTab === tab && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-amber-400 rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* ─── Tab: Delegation Builder ─── */}
          {activeTab === 'builder' && (
            <div className="space-y-4">
              <form onSubmit={handleCreateDelegation} className="space-y-3">
                {/* Delegate Address */}
                <div>
                  <label className="block text-[11px] font-medium text-aegis-text-dim mb-1">
                    Delegate Address
                  </label>
                  <input
                    type="text"
                    placeholder="0x... (agent that receives permission)"
                    value={delegateAddr}
                    onChange={(e) => {
                      setDelegateAddr(e.target.value);
                      setShowPreview(false);
                    }}
                    className="w-full rounded-lg border border-aegis-border bg-[rgba(255,255,255,0.03)] px-3 py-2 font-mono text-xs text-white placeholder-aegis-muted focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                    required
                  />
                </div>

                {/* Token + Amount */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-medium text-aegis-text-dim mb-1">
                      Token Address
                    </label>
                    <input
                      type="text"
                      value={tokenAddr}
                      onChange={(e) => {
                        setTokenAddr(e.target.value);
                        setShowPreview(false);
                      }}
                      className="w-full rounded-lg border border-aegis-border bg-[rgba(255,255,255,0.03)] px-3 py-2 font-mono text-xs text-white placeholder-aegis-muted focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                    />
                    <p className="mt-1 text-[9px] text-aegis-muted">Default: USDC on Base Sepolia</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-aegis-text-dim mb-1">
                      Max Amount (USDC)
                    </label>
                    <input
                      type="number"
                      placeholder="500.00"
                      value={maxAmount}
                      onChange={(e) => {
                        setMaxAmount(e.target.value);
                        setShowPreview(false);
                      }}
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-aegis-border bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-white placeholder-aegis-muted focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Expiry + Targets */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-medium text-aegis-text-dim mb-1">
                      Expiry
                    </label>
                    <input
                      type="datetime-local"
                      value={expiry}
                      onChange={(e) => {
                        setExpiry(e.target.value);
                        setShowPreview(false);
                      }}
                      className="w-full rounded-lg border border-aegis-border bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-white placeholder-aegis-muted focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-aegis-text-dim mb-1">
                      Allowed Targets
                    </label>
                    <input
                      type="text"
                      placeholder="0xabc..., 0xdef..."
                      value={allowedTargets}
                      onChange={(e) => {
                        setAllowedTargets(e.target.value);
                        setShowPreview(false);
                      }}
                      className="w-full rounded-lg border border-aegis-border bg-[rgba(255,255,255,0.03)] px-3 py-2 font-mono text-xs text-white placeholder-aegis-muted focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
                    />
                    <p className="mt-1 text-[9px] text-aegis-muted">Comma-separated addresses</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!delegateAddr || !maxAmount}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #E2761B 0%, #CD6116 100%)',
                    boxShadow: delegateAddr && maxAmount ? '0 0 16px rgba(226,118,27,0.3)' : 'none',
                  }}
                >
                  <MetaMaskFoxIcon className="h-3.5 w-3.5" />
                  Create Delegation
                </button>
              </form>

              {/* ── Preview / Result ── */}
              {showPreview && typedDataPreview && (
                <div className="space-y-3">
                  {/* Success Card */}
                  <div className="rounded-lg border border-emerald-500/30 p-3" style={{ background: 'rgba(16,185,129,0.05)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <span className="text-xs font-semibold text-emerald-400">Delegation Created (Preview)</span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-aegis-muted">Delegate:</span>
                        <span className="font-mono text-white">{truncateAddress(delegateAddr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-aegis-muted">Token:</span>
                        <span className="font-mono text-white">{truncateAddress(tokenAddr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-aegis-muted">Max Amount:</span>
                        <span className="text-white">{maxAmount} USDC</span>
                      </div>
                      {expiry && (
                        <div className="flex justify-between">
                          <span className="text-aegis-muted">Expiry:</span>
                          <span className="text-white">{new Date(expiry).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-aegis-muted">Caveats:</span>
                        <span className="text-amber-400">{typedDataPreview.message.caveats.length} enforcer(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* EIP-712 Typed Data */}
                  <div className="rounded-lg border border-aegis-border" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="flex items-center gap-2 border-b border-aegis-border px-3 py-2">
                      <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                        EIP-712 Typed Data
                      </span>
                      <span className="text-[9px] text-aegis-muted">(eth_signTypedData_v4)</span>
                    </div>
                    <pre className="p-3 text-[10px] leading-relaxed overflow-x-auto text-aegis-text-dim font-mono">
{`{
  "domain": {
    "name": "${typedDataPreview.domain.name}",
    "version": "${typedDataPreview.domain.version}",
    "chainId": ${typedDataPreview.domain.chainId},
    "verifyingContract": "${typedDataPreview.domain.verifyingContract}"
  },
  "primaryType": "Delegation",
  "types": {
    "Delegation": [
      { "name": "delegate", "type": "address" },
      { "name": "delegator", "type": "address" },
      { "name": "authority", "type": "bytes32" },
      { "name": "caveats", "type": "Caveat[]" },
      { "name": "salt", "type": "uint256" },
      { "name": "signature", "type": "bytes" }
    ],
    "Caveat": [
      { "name": "enforcer", "type": "address" },
      { "name": "terms", "type": "bytes" }
    ]
  },
  "message": {
    "delegate": "${typedDataPreview.message.delegate}",
    "delegator": "${typedDataPreview.message.delegator}",
    "authority": "${typedDataPreview.message.authority}",
    "caveats": [
${typedDataPreview.message.caveats
  .map(
    (c) =>
      `      {
        "enforcer": "${c.enforcer}",  // ${c.label}
        "terms": "${c.terms}"
      }`
  )
  .join(',\n')}
    ],
    "salt": ${typedDataPreview.message.salt},
    "signature": "${typedDataPreview.message.signature}"
  }
}`}
                    </pre>
                  </div>

                  {/* Note */}
                  <div className="flex items-start gap-2 rounded-lg border border-aegis-border p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <svg className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                    <p className="text-[10px] text-aegis-text-dim leading-relaxed">
                      <span className="text-amber-400 font-medium">Preview Mode:</span> Actual signing requires a
                      MetaMask Smart Account (ERC-4337). The delegation would be signed
                      via <span className="font-mono text-white">eth_signTypedData_v4</span> and
                      redeemed through <span className="font-mono text-white">DelegationManager.redeemDelegations()</span> on-chain.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Tab: Active Delegations ─── */}
          {activeTab === 'active' && (
            <div className="space-y-2">
              {MOCK_DELEGATIONS.map((d) => {
                const isActive = d.status === 'active';
                const spentPct = (parseFloat(d.spent.replace(/,/g, '')) / parseFloat(d.maxAmount.replace(/,/g, ''))) * 100;
                const expiryDate = new Date(d.expiry);
                const isExpired = expiryDate < new Date();

                return (
                  <div
                    key={d.id}
                    className="rounded-lg border border-aegis-border p-3 transition-colors hover:border-[rgba(255,255,255,0.1)]"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-white">{d.delegate}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                            isActive && !isExpired
                              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'border border-red-500/30 bg-red-500/10 text-red-400'
                          }`}
                        >
                          {isActive && !isExpired ? 'Active' : 'Expired'}
                        </span>
                      </div>
                      <span className="text-[10px] text-aegis-muted font-mono">{d.id}</span>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-3 text-[10px] mb-2">
                      <div>
                        <span className="text-aegis-muted block">Token</span>
                        <span className="text-white font-medium">{d.token}</span>
                      </div>
                      <div>
                        <span className="text-aegis-muted block">Limit</span>
                        <span className="text-white font-medium">${d.maxAmount}</span>
                      </div>
                      <div>
                        <span className="text-aegis-muted block">Spent</span>
                        <span className={`font-medium ${spentPct >= 100 ? 'text-red-400' : spentPct > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          ${d.spent}
                        </span>
                      </div>
                      <div>
                        <span className="text-aegis-muted block">Caveats</span>
                        <span className="text-amber-400 font-medium">{d.caveats}</span>
                      </div>
                    </div>

                    {/* Spend bar */}
                    <div className="h-1 rounded-full bg-[rgba(255,255,255,0.05)] mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${
                          spentPct >= 100 ? 'bg-red-500' : spentPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(spentPct, 100)}%` }}
                      />
                    </div>

                    {/* Caveat chips */}
                    <div className="flex flex-wrap gap-1">
                      {d.caveatTypes.map((ct) => (
                        <span
                          key={ct}
                          className="inline-flex items-center rounded border border-aegis-border px-1.5 py-0.5 text-[9px] font-mono text-aegis-text-dim"
                          style={{ background: 'rgba(255,255,255,0.03)' }}
                        >
                          {ct}
                        </span>
                      ))}
                    </div>

                    {/* Expiry line */}
                    <div className="mt-2 text-[9px] text-aegis-muted">
                      Expires: <span className="font-mono text-aegis-text-dim">{expiryDate.toLocaleDateString()} {expiryDate.toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── Tab: Caveat Enforcers ─── */}
          {activeTab === 'caveats' && (
            <div className="space-y-2">
              <p className="text-[10px] text-aegis-muted mb-3">
                Caveat enforcers are on-chain contracts that validate delegation constraints at redemption time.
                Each enforcer checks specific terms encoded in the delegation.
              </p>
              {Object.entries(ENFORCER_ADDRESSES).map(([name, info]) => {
                // Color coding by type
                const color =
                  name.includes('Target') ? 'blue' :
                  name.includes('ERC20') ? 'emerald' :
                  name.includes('Timestamp') ? 'purple' :
                  name.includes('Methods') ? 'amber' :
                  'cyan';
                const colorClasses: Record<string, { border: string; bg: string; text: string; dot: string }> = {
                  blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
                  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
                  purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' },
                  amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
                  cyan: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400' },
                };
                const c = colorClasses[color];

                return (
                  <div
                    key={name}
                    className={`rounded-lg border ${c.border} p-3 transition-colors`}
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                      <span className={`text-xs font-semibold ${c.text}`}>{name}</span>
                    </div>
                    <p className="text-[10px] text-aegis-text-dim mb-2 leading-relaxed">
                      {info.description}
                    </p>
                    <a
                      href={`https://sepolia.basescan.org/address/${info.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors"
                    >
                      {info.address}
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

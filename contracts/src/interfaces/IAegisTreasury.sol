// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IAegisTreasury
/// @notice Interface for Aegis treasury vaults managed by human owners.
interface IAegisTreasury {
    /// @notice Emitted when tokens are deposited into the treasury.
    event Deposited(address indexed token, uint256 amount);

    /// @notice Emitted when tokens are withdrawn from the treasury.
    event Withdrawn(address indexed token, uint256 amount);

    /// @notice Emitted when an agent allowance is created or reset.
    event AgentAllowanceSet(
        address indexed agent,
        address indexed token,
        uint256 maxAmount,
        uint256 expiry,
        address[] allowedTargets
    );

    /// @notice Emitted when an agent allowance is revoked.
    event AgentAllowanceRevoked(address indexed agent, address indexed token);

    /// @notice Emitted when an agent executes a token spend.
    event AgentExecuted(
        address indexed agent,
        address indexed token,
        address indexed target,
        uint256 amount,
        bytes data,
        string reason
    );

    /// @notice Emitted when treasury ownership is transferred.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice Deposits `amount` of `token` from the owner into the treasury.
    /// @param token ERC-20 token address to deposit.
    /// @param amount Amount of tokens to deposit.
    function deposit(address token, uint256 amount) external;

    /// @notice Withdraws `amount` of `token` from the treasury to the owner.
    /// @param token ERC-20 token address to withdraw.
    /// @param amount Amount of tokens to withdraw.
    function withdraw(address token, uint256 amount) external;

    /// @notice Sets or resets a scoped allowance for `agent` on `token`.
    /// @param agent Address of the AI agent.
    /// @param token ERC-20 token address the allowance applies to.
    /// @param maxAmount Maximum cumulative spend amount.
    /// @param expiry Expiration timestamp (`0` means no expiry).
    /// @param allowedTargets Allowed recipient contracts/accounts (`[]` means no target restriction).
    function setAgentAllowance(
        address agent,
        address token,
        uint256 maxAmount,
        uint256 expiry,
        address[] calldata allowedTargets
    ) external;

    /// @notice Revokes an existing allowance for `agent` on `token`.
    /// @param agent Address of the AI agent.
    /// @param token ERC-20 token address the allowance applies to.
    function revokeAgentAllowance(address agent, address token) external;

    /// @notice Performs a direct token transfer under the caller agent's allowance.
    /// @param token ERC-20 token address to spend.
    /// @param to Recipient address for the transfer.
    /// @param amount Token amount to transfer.
    /// @param reason Human-readable reason emitted in logs.
    function agentTransfer(address token, address to, uint256 amount, string calldata reason) external;

    /// @notice Performs an arbitrary contract call under the caller agent's allowance.
    /// @param token ERC-20 token address to spend.
    /// @param target Target contract address to call.
    /// @param amount Token amount to approve for the target.
    /// @param data Calldata passed to the target call.
    /// @param reason Human-readable reason emitted in logs.
    function agentExecute(address token, address target, uint256 amount, bytes calldata data, string calldata reason)
        external;

    /// @notice Returns the remaining spendable amount for `agent` on `token`.
    /// @param agent Address of the AI agent.
    /// @param token ERC-20 token address.
    /// @return remaining Remaining amount available to spend.
    function getRemainingAllowance(address agent, address token) external view returns (uint256 remaining);

    /// @notice Returns the full stored allowance configuration for `agent` on `token`.
    /// @param agent Address of the AI agent.
    /// @param token ERC-20 token address.
    /// @return maxAmount Maximum cumulative spend amount.
    /// @return spent Amount already spent.
    /// @return expiry Expiration timestamp (`0` means no expiry).
    /// @return allowedTargets Explicitly allowed target addresses.
    /// @return active Whether the allowance is currently marked active.
    function getAgentAllowance(address agent, address token)
        external
        view
        returns (uint256 maxAmount, uint256 spent, uint256 expiry, address[] memory allowedTargets, bool active);

    /// @notice Returns the list of all agents that have ever been registered.
    /// @return agentAddresses Registered agent addresses.
    function getAgents() external view returns (address[] memory agentAddresses);

    /// @notice Returns the number of registered agents.
    /// @return count Number of registered agents.
    function getAgentCount() external view returns (uint256 count);

    /// @notice Returns remaining allowances for all registered agents for a token.
    /// @param token ERC-20 token address.
    /// @return agentAddresses Registered agent addresses.
    /// @return remaining Remaining spendable amount per agent.
    /// @return activeStatus Active status per agent.
    function getAllAgentAllowances(address token)
        external
        view
        returns (address[] memory agentAddresses, uint256[] memory remaining, bool[] memory activeStatus);

    /// @notice Returns the deposited balance tracked by the treasury for a token.
    /// @param token ERC-20 token address.
    /// @return balance Tracked deposited balance.
    function deposits(address token) external view returns (uint256 balance);

    /// @notice Returns whether `agent` is registered in the treasury.
    /// @param agent Address to check.
    /// @return registered True if registered.
    function isAgent(address agent) external view returns (bool registered);

    /// @notice Returns a registered agent address at index `index`.
    /// @param index Position in the agent registry.
    /// @return agent Registered agent address.
    function agents(uint256 index) external view returns (address agent);

    /// @notice Returns raw allowance storage fields for `agent` and `token`.
    /// @param agent AI agent address.
    /// @param token ERC-20 token address.
    /// @return maxAmount Maximum cumulative spend amount.
    /// @return spent Amount already spent.
    /// @return expiry Expiration timestamp (`0` means no expiry).
    /// @return active Whether the allowance is currently active.
    function allowances(address agent, address token)
        external
        view
        returns (uint256 maxAmount, uint256 spent, uint256 expiry, bool active);

    /// @notice Returns the current treasury owner.
    /// @return currentOwner Current owner address.
    function owner() external view returns (address currentOwner);

    /// @notice Renounces treasury ownership.
    function renounceOwnership() external;

    /// @notice Transfers treasury ownership to `newOwner`.
    /// @param newOwner Address of the new owner.
    function transferOwnership(address newOwner) external;
}

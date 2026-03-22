// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AegisTreasury
/// @notice A treasury vault where humans deposit funds and create scoped spending
/// allowances for AI agents. Agents can spend within their allowance bounds.
/// Humans retain full control and can revoke agent access at any time.
/// @dev This is a simplified treasury that manages per-agent, per-token allowances
/// directly. For production use with MetaMask Delegation Framework, the delegation
/// signing and redemption happens off-chain/via the DelegationManager contract.
/// This contract handles the deposit/withdraw/allowance layer.
contract AegisTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct AgentAllowance {
        uint256 maxAmount;
        uint256 spent;
        uint256 expiry;
        address[] allowedTargets;
        bool active;
    }

    /// @notice Token balances deposited by the owner
    mapping(address token => uint256 balance) public deposits;

    /// @notice Agent allowances: agent address => token address => allowance config
    mapping(address agent => mapping(address token => AgentAllowance)) public allowances;

    /// @notice List of registered agent addresses
    address[] public agents;
    mapping(address => bool) public isAgent;

    // Events
    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);
    event AgentAllowanceSet(
        address indexed agent,
        address indexed token,
        uint256 maxAmount,
        uint256 expiry,
        address[] allowedTargets
    );
    event AgentAllowanceRevoked(address indexed agent, address indexed token);
    event AgentExecuted(
        address indexed agent,
        address indexed token,
        address indexed target,
        uint256 amount,
        bytes data,
        string reason
    );

    constructor() Ownable(msg.sender) {}

    // ─── Owner Functions ───────────────────────────────────────────────

    /// @notice Deposit ERC-20 tokens into the treasury
    function deposit(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        deposits[token] += amount;
        emit Deposited(token, amount);
    }

    /// @notice Withdraw ERC-20 tokens from the treasury
    function withdraw(address token, uint256 amount) external onlyOwner nonReentrant {
        require(deposits[token] >= amount, "Insufficient balance");
        deposits[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(token, amount);
    }

    /// @notice Grant an agent a scoped spending allowance
    /// @param agent The agent's address
    /// @param token The ERC-20 token the agent can spend
    /// @param maxAmount Maximum cumulative amount the agent can spend
    /// @param expiry Unix timestamp when this allowance expires (0 = no expiry)
    /// @param allowedTargets Addresses the agent can send to (empty = any target)
    function setAgentAllowance(
        address agent,
        address token,
        uint256 maxAmount,
        uint256 expiry,
        address[] calldata allowedTargets
    ) external onlyOwner {
        require(agent != address(0), "Invalid agent");
        require(maxAmount > 0, "Amount must be > 0");

        if (!isAgent[agent]) {
            agents.push(agent);
            isAgent[agent] = true;
        }

        allowances[agent][token] = AgentAllowance({
            maxAmount: maxAmount,
            spent: 0,
            expiry: expiry,
            allowedTargets: allowedTargets,
            active: true
        });

        emit AgentAllowanceSet(agent, token, maxAmount, expiry, allowedTargets);
    }

    /// @notice Revoke an agent's allowance for a specific token
    function revokeAgentAllowance(address agent, address token) external onlyOwner {
        allowances[agent][token].active = false;
        emit AgentAllowanceRevoked(agent, token);
    }

    // ─── Agent Functions ───────────────────────────────────────────────

    /// @notice Execute a token transfer within the agent's allowance bounds
    /// @param token The token to transfer
    /// @param to The recipient address
    /// @param amount The amount to transfer
    /// @param reason Human-readable reason for the transfer (logged on-chain)
    function agentTransfer(
        address token,
        address to,
        uint256 amount,
        string calldata reason
    ) external nonReentrant {
        AgentAllowance storage allowance = allowances[msg.sender][token];

        require(allowance.active, "Allowance not active");
        require(allowance.expiry == 0 || block.timestamp <= allowance.expiry, "Allowance expired");
        require(allowance.spent + amount <= allowance.maxAmount, "Exceeds allowance");
        require(deposits[token] >= amount, "Insufficient treasury balance");

        // Check target restrictions
        if (allowance.allowedTargets.length > 0) {
            bool targetAllowed = false;
            for (uint256 i = 0; i < allowance.allowedTargets.length; i++) {
                if (allowance.allowedTargets[i] == to) {
                    targetAllowed = true;
                    break;
                }
            }
            require(targetAllowed, "Target not allowed");
        }

        allowance.spent += amount;
        deposits[token] -= amount;
        IERC20(token).safeTransfer(to, amount);

        emit AgentExecuted(msg.sender, token, to, amount, "", reason);
    }

    // ─── View Functions ────────────────────────────────────────────────

    /// @notice Get remaining allowance for an agent on a specific token
    function getRemainingAllowance(address agent, address token) external view returns (uint256) {
        AgentAllowance storage a = allowances[agent][token];
        if (!a.active) return 0;
        if (a.expiry != 0 && block.timestamp > a.expiry) return 0;
        return a.maxAmount - a.spent;
    }

    /// @notice Get full allowance details for an agent on a token
    function getAgentAllowance(address agent, address token)
        external
        view
        returns (uint256 maxAmount, uint256 spent, uint256 expiry, address[] memory allowedTargets, bool active)
    {
        AgentAllowance storage a = allowances[agent][token];
        return (a.maxAmount, a.spent, a.expiry, a.allowedTargets, a.active);
    }

    /// @notice Get all registered agents
    function getAgents() external view returns (address[] memory) {
        return agents;
    }

    /// @notice Get the number of registered agents
    function getAgentCount() external view returns (uint256) {
        return agents.length;
    }

    /// @notice Batch query: get remaining allowances for all agents on a specific token
    function getAllAgentAllowances(address token)
        external
        view
        returns (address[] memory agentAddresses, uint256[] memory remaining, bool[] memory activeStatus)
    {
        uint256 len = agents.length;
        agentAddresses = new address[](len);
        remaining = new uint256[](len);
        activeStatus = new bool[](len);

        for (uint256 i = 0; i < len; i++) {
            address agent = agents[i];
            AgentAllowance storage a = allowances[agent][token];
            agentAddresses[i] = agent;
            activeStatus[i] = a.active && (a.expiry == 0 || block.timestamp <= a.expiry);
            remaining[i] = activeStatus[i] ? a.maxAmount - a.spent : 0;
        }
    }

    /// @notice Execute a token transfer to a contract with arbitrary calldata (for swaps, etc.)
    /// @dev The agent must have an allowance for the token being spent.
    ///      This allows agents to interact with DEXes and other contracts.
    function agentExecute(
        address token,
        address target,
        uint256 amount,
        bytes calldata data,
        string calldata reason
    ) external nonReentrant {
        AgentAllowance storage allowance = allowances[msg.sender][token];

        require(allowance.active, "Allowance not active");
        require(allowance.expiry == 0 || block.timestamp <= allowance.expiry, "Allowance expired");
        require(allowance.spent + amount <= allowance.maxAmount, "Exceeds allowance");
        require(deposits[token] >= amount, "Insufficient treasury balance");

        // Check target restrictions
        if (allowance.allowedTargets.length > 0) {
            bool targetAllowed = false;
            for (uint256 i = 0; i < allowance.allowedTargets.length; i++) {
                if (allowance.allowedTargets[i] == target) {
                    targetAllowed = true;
                    break;
                }
            }
            require(targetAllowed, "Target not allowed");
        }

        allowance.spent += amount;
        deposits[token] -= amount;

        // Approve the target to spend the token, then call it
        IERC20(token).safeIncreaseAllowance(target, amount);

        // Execute the call (e.g., a swap on Uniswap)
        (bool success,) = target.call(data);
        require(success, "Execution failed");

        emit AgentExecuted(msg.sender, token, target, amount, data, reason);
    }
}

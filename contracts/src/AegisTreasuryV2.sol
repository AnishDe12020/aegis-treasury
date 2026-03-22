// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AegisTreasury} from "./AegisTreasury.sol";

/// @title AegisTreasuryV2
/// @notice Extension of AegisTreasury with rate limits, cooldowns, batch allowance setup,
/// and per-agent reputation tracking.
contract AegisTreasuryV2 is AegisTreasury {
    using SafeERC20 for IERC20;

    /// @notice Maximum spend per hour by agent and token (0 means no hourly cap).
    mapping(address agent => mapping(address token => uint256 amount)) public maxSpendPerHour;

    /// @notice Amount spent by agent/token in the current hour window.
    mapping(address agent => mapping(address token => uint256 amount)) public spentThisHour;

    /// @notice Hour window id (`block.timestamp / 1 hours`) for `spentThisHour`.
    mapping(address agent => mapping(address token => uint256 windowId)) public spendHourWindow;

    /// @notice Cooldown (in seconds) required between successful agent transactions.
    mapping(address agent => uint256 cooldownSeconds) public cooldownPeriod;

    /// @notice Timestamp of the last successful transaction by each agent.
    mapping(address agent => uint256 timestamp) public lastAgentTxTimestamp;

    /// @notice Reputation counters per agent.
    mapping(address agent => uint256 count) public successCount;
    mapping(address agent => uint256 count) public failCount;

    event AgentMaxSpendPerHourSet(address indexed agent, address indexed token, uint256 maxPerHour);
    event AgentCooldownSet(address indexed agent, uint256 cooldownSeconds);
    event AgentReputationUpdated(address indexed agent, uint256 successCount, uint256 failCount);

    /// @notice Configure hourly spend cap for an agent/token.
    function setAgentMaxSpendPerHour(address agent, address token, uint256 maxPerHour) external onlyOwner {
        require(agent != address(0), "Invalid agent");
        require(token != address(0), "Invalid token");

        maxSpendPerHour[agent][token] = maxPerHour;
        emit AgentMaxSpendPerHourSet(agent, token, maxPerHour);
    }

    /// @notice Configure minimum time between successful agent transactions.
    function setAgentCooldown(address agent, uint256 cooldownSeconds) external onlyOwner {
        require(agent != address(0), "Invalid agent");

        cooldownPeriod[agent] = cooldownSeconds;
        emit AgentCooldownSet(agent, cooldownSeconds);
    }

    /// @notice Batch set per-token allowances for one agent in a single transaction.
    function setAgentMultiTokenAllowance(
        address agent,
        address[] calldata tokens,
        uint256[] calldata maxAmounts,
        uint256[] calldata expiries,
        address[][] calldata allowedTargets
    ) external onlyOwner {
        require(agent != address(0), "Invalid agent");

        uint256 len = tokens.length;
        require(len > 0, "No tokens");
        require(len == maxAmounts.length, "Length mismatch");
        require(len == expiries.length, "Length mismatch");
        require(len == allowedTargets.length, "Length mismatch");

        for (uint256 i = 0; i < len; i++) {
            _setAgentAllowanceInternal(agent, tokens[i], maxAmounts[i], expiries[i], allowedTargets[i]);
        }
    }

    /// @notice Executes a transfer attempt and updates reputation on success/failure.
    /// @dev Failed attempts are counted and do not revert, so reputation can be persisted.
    function agentTransfer(address token, address to, uint256 amount, string calldata reason) external override nonReentrant {
        try this._agentTransferAttempt(msg.sender, token, to, amount, reason) {
            successCount[msg.sender] += 1;
            emit AgentReputationUpdated(msg.sender, successCount[msg.sender], failCount[msg.sender]);
        } catch {
            failCount[msg.sender] += 1;
            emit AgentReputationUpdated(msg.sender, successCount[msg.sender], failCount[msg.sender]);
        }
    }

    /// @notice Execute a token transfer attempt on behalf of `agent`.
    /// @dev Restricted to self-calls so outer `agentTransfer` can catch failures.
    function _agentTransferAttempt(address agent, address token, address to, uint256 amount, string calldata reason)
        external
    {
        require(msg.sender == address(this), "Only self");
        require(!paused(), "Pausable: paused");

        _enforceCooldown(agent);
        _consumeHourlyLimit(agent, token, amount);

        AgentAllowance storage allowance = allowances[agent][token];

        require(allowance.active, "Allowance not active");
        require(allowance.expiry == 0 || block.timestamp <= allowance.expiry, "Allowance expired");
        require(allowance.spent + amount <= allowance.maxAmount, "Exceeds allowance");
        require(deposits[token] >= amount, "Insufficient treasury balance");

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
        lastAgentTxTimestamp[agent] = block.timestamp;
        IERC20(token).safeTransfer(to, amount);

        emit AgentExecuted(agent, token, to, amount, "", reason);
    }

    /// @notice Execute arbitrary target call with allowance checks and V2 controls.
    function agentExecute(address token, address target, uint256 amount, bytes calldata data, string calldata reason)
        external
        override
        nonReentrant
        whenNotPaused
    {
        _enforceCooldown(msg.sender);
        _consumeHourlyLimit(msg.sender, token, amount);

        AgentAllowance storage allowance = allowances[msg.sender][token];

        require(allowance.active, "Allowance not active");
        require(allowance.expiry == 0 || block.timestamp <= allowance.expiry, "Allowance expired");
        require(allowance.spent + amount <= allowance.maxAmount, "Exceeds allowance");
        require(deposits[token] >= amount, "Insufficient treasury balance");

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

        IERC20(token).safeIncreaseAllowance(target, amount);
        (bool success,) = target.call(data);
        require(success, "Execution failed");

        lastAgentTxTimestamp[msg.sender] = block.timestamp;

        emit AgentExecuted(msg.sender, token, target, amount, data, reason);
    }

    /// @notice Return reputation counters for an agent.
    function getAgentReputation(address agent) external view returns (uint256 successes, uint256 failures) {
        return (successCount[agent], failCount[agent]);
    }

    function _setAgentAllowanceInternal(
        address agent,
        address token,
        uint256 maxAmount,
        uint256 expiry,
        address[] calldata allowedTargets
    ) internal {
        require(token != address(0), "Invalid token");
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

    function _enforceCooldown(address agent) internal view {
        uint256 cooldownSeconds = cooldownPeriod[agent];
        if (cooldownSeconds == 0) {
            return;
        }

        uint256 lastTx = lastAgentTxTimestamp[agent];
        require(lastTx == 0 || block.timestamp >= lastTx + cooldownSeconds, "Cooldown active");
    }

    function _consumeHourlyLimit(address agent, address token, uint256 amount) internal {
        uint256 maxPerHour = maxSpendPerHour[agent][token];
        if (maxPerHour == 0) {
            return;
        }

        uint256 currentWindow = block.timestamp / 1 hours;
        if (spendHourWindow[agent][token] != currentWindow) {
            spendHourWindow[agent][token] = currentWindow;
            spentThisHour[agent][token] = 0;
        }

        require(spentThisHour[agent][token] + amount <= maxPerHour, "Hourly spend limit exceeded");
        spentThisHour[agent][token] += amount;
    }
}

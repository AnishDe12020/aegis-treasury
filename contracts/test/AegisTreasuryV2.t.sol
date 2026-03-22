// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AegisTreasuryV2} from "../src/AegisTreasuryV2.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract AegisTreasuryV2Test is Test {
    AegisTreasuryV2 internal treasury;
    MockUSDC internal usdc;
    MockUSDC internal usdt;

    address internal agent = address(0xA1);
    address internal agent2 = address(0xA2);
    address internal recipient = address(0xB1);

    function setUp() public {
        treasury = new AegisTreasuryV2();
        usdc = new MockUSDC();
        usdt = new MockUSDC();

        usdc.mint(address(this), 1_000_000 * 1e6);
        usdt.mint(address(this), 1_000_000 * 1e6);

        usdc.approve(address(treasury), type(uint256).max);
        usdt.approve(address(treasury), type(uint256).max);
    }

    function test_rateLimit_blocksSecondTransferWithinHour() public {
        treasury.deposit(address(usdc), 1_000e6);
        _setAllowance(agent, address(usdc), 500e6);
        treasury.setAgentMaxSpendPerHour(agent, address(usdc), 100e6);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 60e6, "first");

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 50e6, "second");

        assertEq(usdc.balanceOf(recipient), 60e6);
        assertEq(treasury.successCount(agent), 1);
        assertEq(treasury.failCount(agent), 1);
        assertEq(treasury.spentThisHour(agent, address(usdc)), 60e6);
    }

    function test_rateLimit_resetsAfterHourWindow() public {
        treasury.deposit(address(usdc), 1_000e6);
        _setAllowance(agent, address(usdc), 500e6);
        treasury.setAgentMaxSpendPerHour(agent, address(usdc), 100e6);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 80e6, "window-1");

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 80e6, "window-2");

        assertEq(usdc.balanceOf(recipient), 160e6);
        assertEq(treasury.successCount(agent), 2);
        assertEq(treasury.failCount(agent), 0);
        assertEq(treasury.spentThisHour(agent, address(usdc)), 80e6);
    }

    function test_rateLimit_isPerToken() public {
        treasury.deposit(address(usdc), 1_000e6);
        treasury.deposit(address(usdt), 1_000e6);
        _setAllowance(agent, address(usdc), 500e6);
        _setAllowance(agent, address(usdt), 500e6);

        treasury.setAgentMaxSpendPerHour(agent, address(usdc), 100e6);
        treasury.setAgentMaxSpendPerHour(agent, address(usdt), 200e6);

        vm.startPrank(agent);
        treasury.agentTransfer(address(usdc), recipient, 90e6, "usdc-ok");
        treasury.agentTransfer(address(usdt), recipient, 150e6, "usdt-ok");
        treasury.agentTransfer(address(usdc), recipient, 20e6, "usdc-fail");
        treasury.agentTransfer(address(usdt), recipient, 40e6, "usdt-ok-2");
        vm.stopPrank();

        assertEq(usdc.balanceOf(recipient), 90e6);
        assertEq(usdt.balanceOf(recipient), 190e6);
        assertEq(treasury.successCount(agent), 3);
        assertEq(treasury.failCount(agent), 1);
    }

    function test_cooldown_blocksRapidTransfers() public {
        treasury.deposit(address(usdc), 1_000e6);
        _setAllowance(agent, address(usdc), 500e6);
        treasury.setAgentCooldown(agent, 300);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 40e6, "first");

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 40e6, "blocked");

        vm.warp(block.timestamp + 300);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 40e6, "after-cooldown");

        assertEq(usdc.balanceOf(recipient), 80e6);
        assertEq(treasury.successCount(agent), 2);
        assertEq(treasury.failCount(agent), 1);
    }

    function test_cooldown_isPerAgent() public {
        treasury.deposit(address(usdc), 1_000e6);
        _setAllowance(agent, address(usdc), 300e6);
        _setAllowance(agent2, address(usdc), 300e6);
        treasury.setAgentCooldown(agent, 600);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 50e6, "agent1-first");

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 50e6, "agent1-blocked");

        vm.prank(agent2);
        treasury.agentTransfer(address(usdc), recipient, 50e6, "agent2-ok");

        assertEq(treasury.successCount(agent), 1);
        assertEq(treasury.failCount(agent), 1);
        assertEq(treasury.successCount(agent2), 1);
        assertEq(treasury.failCount(agent2), 0);
    }

    function test_setAgentMultiTokenAllowance_setsAllAllowances() public {
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(usdt);

        uint256[] memory maxAmounts = new uint256[](2);
        maxAmounts[0] = 120e6;
        maxAmounts[1] = 340e6;

        uint256[] memory expiries = new uint256[](2);
        expiries[0] = 0;
        expiries[1] = block.timestamp + 1 days;

        address[][] memory targetLists = new address[][](2);
        targetLists[0] = new address[](0);
        targetLists[1] = new address[](1);
        targetLists[1][0] = recipient;

        treasury.setAgentMultiTokenAllowance(agent, tokens, maxAmounts, expiries, targetLists);

        (uint256 maxUsdc,,, address[] memory targetsUsdc, bool activeUsdc) = treasury.getAgentAllowance(agent, address(usdc));
        (uint256 maxUsdt,,, address[] memory targetsUsdt, bool activeUsdt) = treasury.getAgentAllowance(agent, address(usdt));

        assertEq(maxUsdc, 120e6);
        assertEq(maxUsdt, 340e6);
        assertEq(targetsUsdc.length, 0);
        assertEq(targetsUsdt.length, 1);
        assertEq(targetsUsdt[0], recipient);
        assertTrue(activeUsdc);
        assertTrue(activeUsdt);
        assertEq(treasury.getAgentCount(), 1);
    }

    function test_setAgentMultiTokenAllowance_revertsOnLengthMismatch() public {
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(usdt);

        uint256[] memory maxAmounts = new uint256[](1);
        maxAmounts[0] = 100e6;

        uint256[] memory expiries = new uint256[](2);
        expiries[0] = 0;
        expiries[1] = 0;

        address[][] memory targetLists = new address[][](2);
        targetLists[0] = new address[](0);
        targetLists[1] = new address[](0);

        vm.expectRevert("Length mismatch");
        treasury.setAgentMultiTokenAllowance(agent, tokens, maxAmounts, expiries, targetLists);
    }

    function test_setAgentMultiTokenAllowance_revertsOnNoTokens() public {
        address[] memory tokens = new address[](0);
        uint256[] memory maxAmounts = new uint256[](0);
        uint256[] memory expiries = new uint256[](0);
        address[][] memory targetLists = new address[][](0);

        vm.expectRevert("No tokens");
        treasury.setAgentMultiTokenAllowance(agent, tokens, maxAmounts, expiries, targetLists);
    }

    function test_reputation_incrementsOnSuccess() public {
        treasury.deposit(address(usdc), 1_000e6);
        _setAllowance(agent, address(usdc), 500e6);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 100e6, "success");

        assertEq(treasury.successCount(agent), 1);
        assertEq(treasury.failCount(agent), 0);
    }

    function test_reputation_incrementsOnFailedAttempt() public {
        treasury.deposit(address(usdc), 1_000e6);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 100e6, "no allowance");

        assertEq(treasury.successCount(agent), 0);
        assertEq(treasury.failCount(agent), 1);
        assertEq(usdc.balanceOf(recipient), 0);
    }

    function test_reputationEvent_emitsOnFailureAfterSuccess() public {
        treasury.deposit(address(usdc), 1_000e6);
        _setAllowance(agent, address(usdc), 500e6);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 20e6, "ok");

        treasury.setAgentMaxSpendPerHour(agent, address(usdc), 20e6);

        vm.prank(agent);
        vm.expectEmit(true, false, false, true);
        emit AegisTreasuryV2.AgentReputationUpdated(agent, 1, 1);
        treasury.agentTransfer(address(usdc), recipient, 1e6, "blocked");

        assertEq(treasury.successCount(agent), 1);
        assertEq(treasury.failCount(agent), 1);
    }

    function test_agentExecute_obeysCooldownAndRateLimit() public {
        vm.warp(1_000_000);

        treasury.deposit(address(usdc), 1_000e6);
        _setAllowance(agent, address(usdc), 500e6);

        treasury.setAgentMaxSpendPerHour(agent, address(usdc), 200e6);
        treasury.setAgentCooldown(agent, 300);

        vm.prank(agent);
        treasury.agentExecute(address(usdc), recipient, 100e6, "", "execute-1");

        vm.prank(agent);
        vm.expectRevert("Cooldown active");
        treasury.agentExecute(address(usdc), recipient, 50e6, "", "execute-2");

        vm.warp(block.timestamp + 301);

        vm.prank(agent);
        treasury.agentExecute(address(usdc), recipient, 90e6, "", "execute-3");

        vm.warp(block.timestamp + 301);

        vm.prank(agent);
        vm.expectRevert("Hourly spend limit exceeded");
        treasury.agentExecute(address(usdc), recipient, 20e6, "", "execute-4");
    }

    function _setAllowance(address _agent, address token, uint256 maxAmount) internal {
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(_agent, token, maxAmount, 0, targets);
    }
}

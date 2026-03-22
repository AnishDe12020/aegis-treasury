// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {AegisTreasury} from "../src/AegisTreasury.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1_000_000 * 1e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract AegisTreasuryTest is Test {
    AegisTreasury public treasury;
    MockUSDC public usdc;

    address public owner = address(this);
    address public agent = address(0xA1);
    address public agent2 = address(0xA2);
    address public recipient = address(0xB1);
    address public recipient2 = address(0xB2);

    function setUp() public {
        treasury = new AegisTreasury();
        usdc = new MockUSDC();

        // Approve treasury to spend owner's USDC
        usdc.approve(address(treasury), type(uint256).max);
    }

    // ─── Deposit Tests ─────────────────────────────────────────────

    function test_deposit() public {
        treasury.deposit(address(usdc), 1000e6);
        assertEq(treasury.deposits(address(usdc)), 1000e6);
        assertEq(usdc.balanceOf(address(treasury)), 1000e6);
    }

    function test_deposit_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit AegisTreasury.Deposited(address(usdc), 500e6);
        treasury.deposit(address(usdc), 500e6);
    }

    function test_deposit_onlyOwner() public {
        vm.prank(agent);
        vm.expectRevert();
        treasury.deposit(address(usdc), 100e6);
    }

    // ─── Withdraw Tests ────────────────────────────────────────────

    function test_withdraw() public {
        treasury.deposit(address(usdc), 1000e6);
        uint256 balBefore = usdc.balanceOf(owner);
        treasury.withdraw(address(usdc), 400e6);
        assertEq(treasury.deposits(address(usdc)), 600e6);
        assertEq(usdc.balanceOf(owner) - balBefore, 400e6);
    }

    function test_withdraw_insufficientBalance() public {
        treasury.deposit(address(usdc), 100e6);
        vm.expectRevert("Insufficient balance");
        treasury.withdraw(address(usdc), 200e6);
    }

    // ─── Set Allowance Tests ───────────────────────────────────────

    function test_setAgentAllowance() public {
        address[] memory targets = new address[](1);
        targets[0] = recipient;

        treasury.setAgentAllowance(agent, address(usdc), 500e6, 0, targets);

        (uint256 maxAmt, uint256 spent, uint256 expiry, address[] memory allowedTargets, bool active) =
            treasury.getAgentAllowance(agent, address(usdc));

        assertEq(maxAmt, 500e6);
        assertEq(spent, 0);
        assertEq(expiry, 0);
        assertEq(allowedTargets.length, 1);
        assertEq(allowedTargets[0], recipient);
        assertTrue(active);
    }

    function test_setAgentAllowance_registersAgent() public {
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 100e6, 0, targets);

        assertTrue(treasury.isAgent(agent));
        assertEq(treasury.getAgentCount(), 1);
        assertEq(treasury.getAgents()[0], agent);
    }

    function test_setAgentAllowance_rejectsZeroAddress() public {
        address[] memory targets = new address[](0);
        vm.expectRevert("Invalid agent");
        treasury.setAgentAllowance(address(0), address(usdc), 100e6, 0, targets);
    }

    function test_setAgentAllowance_rejectsZeroAmount() public {
        address[] memory targets = new address[](0);
        vm.expectRevert("Amount must be > 0");
        treasury.setAgentAllowance(agent, address(usdc), 0, 0, targets);
    }

    // ─── Agent Transfer Tests ──────────────────────────────────────

    function test_agentTransfer() public {
        treasury.deposit(address(usdc), 1000e6);
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 500e6, 0, targets);

        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 100e6, "Test transfer");

        assertEq(usdc.balanceOf(recipient), 100e6);
        assertEq(treasury.getRemainingAllowance(agent, address(usdc)), 400e6);
        assertEq(treasury.deposits(address(usdc)), 900e6);
    }

    function test_agentTransfer_exceedsAllowance() public {
        treasury.deposit(address(usdc), 1000e6);
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 100e6, 0, targets);

        vm.prank(agent);
        vm.expectRevert("Exceeds allowance");
        treasury.agentTransfer(address(usdc), recipient, 200e6, "Too much");
    }

    function test_agentTransfer_expired() public {
        treasury.deposit(address(usdc), 1000e6);
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 500e6, block.timestamp + 100, targets);

        vm.warp(block.timestamp + 200);

        vm.prank(agent);
        vm.expectRevert("Allowance expired");
        treasury.agentTransfer(address(usdc), recipient, 50e6, "Expired");
    }

    function test_agentTransfer_targetRestriction() public {
        treasury.deposit(address(usdc), 1000e6);
        address[] memory targets = new address[](1);
        targets[0] = recipient;
        treasury.setAgentAllowance(agent, address(usdc), 500e6, 0, targets);

        // Allowed target works
        vm.prank(agent);
        treasury.agentTransfer(address(usdc), recipient, 50e6, "Allowed target");
        assertEq(usdc.balanceOf(recipient), 50e6);

        // Disallowed target reverts
        vm.prank(agent);
        vm.expectRevert("Target not allowed");
        treasury.agentTransfer(address(usdc), recipient2, 50e6, "Disallowed target");
    }

    function test_agentTransfer_noAllowance() public {
        treasury.deposit(address(usdc), 1000e6);

        vm.prank(agent);
        vm.expectRevert("Allowance not active");
        treasury.agentTransfer(address(usdc), recipient, 50e6, "No allowance");
    }

    function test_agentTransfer_emitsEvent() public {
        treasury.deposit(address(usdc), 1000e6);
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 500e6, 0, targets);

        vm.prank(agent);
        vm.expectEmit(true, true, true, true);
        emit AegisTreasury.AgentExecuted(agent, address(usdc), recipient, 100e6, "", "Buying tokens");
        treasury.agentTransfer(address(usdc), recipient, 100e6, "Buying tokens");
    }

    // ─── Revoke Tests ──────────────────────────────────────────────

    function test_revokeAllowance() public {
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 500e6, 0, targets);

        treasury.revokeAgentAllowance(agent, address(usdc));
        assertEq(treasury.getRemainingAllowance(agent, address(usdc)), 0);
    }

    function test_revokeAllowance_preventsTransfer() public {
        treasury.deposit(address(usdc), 1000e6);
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 500e6, 0, targets);

        treasury.revokeAgentAllowance(agent, address(usdc));

        vm.prank(agent);
        vm.expectRevert("Allowance not active");
        treasury.agentTransfer(address(usdc), recipient, 50e6, "Should fail");
    }

    // ─── View Function Tests ───────────────────────────────────────

    function test_getRemainingAllowance_expired() public {
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 500e6, block.timestamp + 100, targets);

        assertEq(treasury.getRemainingAllowance(agent, address(usdc)), 500e6);

        vm.warp(block.timestamp + 200);
        assertEq(treasury.getRemainingAllowance(agent, address(usdc)), 0);
    }

    function test_multipleAgents() public {
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 100e6, 0, targets);
        treasury.setAgentAllowance(agent2, address(usdc), 200e6, 0, targets);

        assertEq(treasury.getAgentCount(), 2);
        assertEq(treasury.getRemainingAllowance(agent, address(usdc)), 100e6);
        assertEq(treasury.getRemainingAllowance(agent2, address(usdc)), 200e6);
    }

    // ─── Batch Query Tests ─────────────────────────────────────────

    function test_getAllAgentAllowances() public {
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 100e6, 0, targets);
        treasury.setAgentAllowance(agent2, address(usdc), 200e6, 0, targets);

        (address[] memory addrs, uint256[] memory remaining, bool[] memory active) =
            treasury.getAllAgentAllowances(address(usdc));

        assertEq(addrs.length, 2);
        assertEq(remaining[0], 100e6);
        assertEq(remaining[1], 200e6);
        assertTrue(active[0]);
        assertTrue(active[1]);
    }

    function test_getAllAgentAllowances_withExpired() public {
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 100e6, block.timestamp + 100, targets);
        treasury.setAgentAllowance(agent2, address(usdc), 200e6, 0, targets);

        vm.warp(block.timestamp + 200);

        (, uint256[] memory remaining, bool[] memory active) =
            treasury.getAllAgentAllowances(address(usdc));

        assertEq(remaining[0], 0); // expired
        assertEq(remaining[1], 200e6); // still active
        assertFalse(active[0]);
        assertTrue(active[1]);
    }

    // ─── Agent Execute Tests ───────────────────────────────────────

    function test_agentExecute_noAllowance() public {
        treasury.deposit(address(usdc), 1000e6);

        vm.prank(agent);
        vm.expectRevert("Allowance not active");
        treasury.agentExecute(address(usdc), recipient, 50e6, "", "No allowance");
    }

    function test_agentExecute_exceedsAllowance() public {
        treasury.deposit(address(usdc), 1000e6);
        address[] memory targets = new address[](0);
        treasury.setAgentAllowance(agent, address(usdc), 100e6, 0, targets);

        vm.prank(agent);
        vm.expectRevert("Exceeds allowance");
        treasury.agentExecute(address(usdc), recipient, 200e6, "", "Too much");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AegisTreasuryFactory} from "../src/AegisTreasuryFactory.sol";
import {AegisTreasury} from "../src/AegisTreasury.sol";

contract AegisTreasuryFactoryTest is Test {
    AegisTreasuryFactory internal factory;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);

    function setUp() public {
        factory = new AegisTreasuryFactory();
    }

    function test_createMultipleTreasuries() public {
        vm.prank(alice);
        address aliceTreasury = factory.createTreasury();

        vm.prank(bob);
        address bobTreasury = factory.createTreasury();

        vm.prank(carol);
        address carolTreasury = factory.createTreasury();

        assertTrue(aliceTreasury != address(0));
        assertTrue(bobTreasury != address(0));
        assertTrue(carolTreasury != address(0));

        assertTrue(aliceTreasury != bobTreasury);
        assertTrue(aliceTreasury != carolTreasury);
        assertTrue(bobTreasury != carolTreasury);
    }

    function test_eachTreasuryHasCorrectOwner() public {
        vm.prank(alice);
        address aliceTreasury = factory.createTreasury();

        vm.prank(bob);
        address bobTreasury = factory.createTreasury();

        assertEq(AegisTreasury(aliceTreasury).owner(), alice);
        assertEq(AegisTreasury(bobTreasury).owner(), bob);
    }

    function test_getTreasuryReturnsRightAddress() public {
        vm.prank(alice);
        address aliceTreasury = factory.createTreasury();

        vm.prank(bob);
        address bobTreasury = factory.createTreasury();

        assertEq(factory.getTreasury(alice), aliceTreasury);
        assertEq(factory.getTreasury(bob), bobTreasury);
        assertEq(factory.getTreasury(carol), address(0));
    }

    function test_getAllTreasuriesReturnsAllDeployedInstances() public {
        vm.prank(alice);
        address aliceTreasury = factory.createTreasury();

        vm.prank(bob);
        address bobTreasury = factory.createTreasury();

        vm.prank(carol);
        address carolTreasury = factory.createTreasury();

        address[] memory all = factory.getAllTreasuries();

        assertEq(all.length, 3);
        assertEq(all[0], aliceTreasury);
        assertEq(all[1], bobTreasury);
        assertEq(all[2], carolTreasury);
    }
}

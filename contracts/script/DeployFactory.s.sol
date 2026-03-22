// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AegisTreasuryFactory} from "../src/AegisTreasuryFactory.sol";

contract DeployFactoryScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        AegisTreasuryFactory factory = new AegisTreasuryFactory();
        console.log("AegisTreasuryFactory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}

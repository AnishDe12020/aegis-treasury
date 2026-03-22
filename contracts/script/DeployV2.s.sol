// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AegisTreasuryV2} from "../src/AegisTreasuryV2.sol";

contract DeployV2Script is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        AegisTreasuryV2 treasuryV2 = new AegisTreasuryV2();
        console.log("AegisTreasuryV2 deployed at:", address(treasuryV2));

        vm.stopBroadcast();
    }
}

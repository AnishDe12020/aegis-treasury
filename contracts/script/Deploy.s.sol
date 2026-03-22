// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AegisTreasury} from "../src/AegisTreasury.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        AegisTreasury treasury = new AegisTreasury();
        console.log("AegisTreasury deployed at:", address(treasury));

        vm.stopBroadcast();
    }
}

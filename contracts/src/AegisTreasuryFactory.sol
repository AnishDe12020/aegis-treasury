// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AegisTreasury} from "./AegisTreasury.sol";

/// @title AegisTreasuryFactory
/// @notice Deploys one AegisTreasury vault per owner and tracks all created vaults.
contract AegisTreasuryFactory {
    mapping(address owner => address treasury) private ownerTreasury;
    address[] private allTreasuries;

    event TreasuryCreated(address indexed owner, address treasury);

    /// @notice Deploys a new treasury for the caller.
    /// @dev Reverts if the caller already has a treasury.
    /// @return treasury Address of the deployed treasury.
    function createTreasury() external returns (address treasury) {
        require(ownerTreasury[msg.sender] == address(0), "Treasury already exists");

        AegisTreasury deployedTreasury = new AegisTreasury();
        deployedTreasury.transferOwnership(msg.sender);

        treasury = address(deployedTreasury);
        ownerTreasury[msg.sender] = treasury;
        allTreasuries.push(treasury);

        emit TreasuryCreated(msg.sender, treasury);
    }

    /// @notice Returns the treasury deployed for a specific owner.
    /// @param owner Address of the owner.
    /// @return treasury Treasury address or zero address if none exists.
    function getTreasury(address owner) external view returns (address treasury) {
        return ownerTreasury[owner];
    }

    /// @notice Returns all treasury addresses created by this factory.
    /// @return treasuries Array of deployed treasury addresses.
    function getAllTreasuries() external view returns (address[] memory treasuries) {
        return allTreasuries;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {BatchAuctionDEX} from "../src/core/BatchAuctionDEX.sol";
import {ConfidentialToken} from "../src/tokens/ConfidentialToken.sol";

/// @title Deploy
/// @notice Deploys the confidential token legs and the BatchAuctionDEX, and seeds test liquidity.
contract Deploy is Script {
    uint256 constant BATCH_DURATION = 5 minutes;
    uint64 constant LIQUIDITY = 1_000_000; // scaled integer units (fits euint64 with price math)

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address keeper = vm.envOr("KEEPER_ADDRESS", deployer);

        console.log("Deployer:", deployer);
        console.log("Keeper:  ", keeper);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        ConfidentialToken baseToken = new ConfidentialToken("Confidential ETH", "cETH");
        ConfidentialToken quoteToken = new ConfidentialToken("Confidential USD", "cUSD");
        console.log("Base Token: ", address(baseToken));
        console.log("Quote Token:", address(quoteToken));

        BatchAuctionDEX dex = new BatchAuctionDEX(keeper, address(baseToken), address(quoteToken), BATCH_DURATION);
        console.log("DEX:        ", address(dex));

        // Seed the DEX (central counterparty) and the deployer with both legs for demoing.
        baseToken.mint(address(dex), LIQUIDITY);
        quoteToken.mint(address(dex), LIQUIDITY);
        baseToken.mint(deployer, LIQUIDITY);
        quoteToken.mint(deployer, LIQUIDITY);

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("Base Token: ", address(baseToken));
        console.log("Quote Token:", address(quoteToken));
        console.log("DEX:        ", address(dex));
        console.log("Batch Duration (s):", BATCH_DURATION);
    }
}

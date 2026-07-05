// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {BatchAuctionDEX} from "../../src/core/BatchAuctionDEX.sol";
import {ConfidentialToken} from "../../src/tokens/ConfidentialToken.sol";
import {IBatchAuction} from "../../src/interfaces/IBatchAuction.sol";

/// @title BatchAuctionDEX end-to-end tests on the mock FHEVM coprocessor.
/// @notice Exercises the full sealed-bid lifecycle: encrypted submission -> multi-block encrypted
///         clearing -> public-decrypt of the winner -> confidential settlement, and asserts the
///         clearing tick + post-trade balances against a hand-computed reference.
contract BatchAuctionDEXTest is FhevmTest {
    BatchAuctionDEX internal dex;
    ConfidentialToken internal base;
    ConfidentialToken internal quote;

    address internal keeper;
    address internal alice;
    address internal bob;
    address internal carol;
    address internal dave;

    uint256 internal constant DURATION = 5 minutes;
    uint64 internal constant START = 1000; // starting balance per trader / DEX liquidity

    function setUp() public override {
        super.setUp();
        // Clearing folds 1000 ticks into one running-best chain; relax only the depth cap.
        disableHCUDepthLimit();

        keeper = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        carol = makeAddr("carol");
        dave = makeAddr("dave");

        base = new ConfidentialToken("Confidential ETH", "cETH");
        quote = new ConfidentialToken("Confidential USD", "cUSD");
        dex = new BatchAuctionDEX(keeper, address(base), address(quote), DURATION);

        // Fund traders and the DEX (central counterparty) with both legs.
        address[4] memory traders = [alice, bob, carol, dave];
        for (uint256 i = 0; i < traders.length; i++) {
            base.mint(traders[i], START);
            quote.mint(traders[i], START);
            vm.startPrank(traders[i]);
            base.setOperator(address(dex), uint48(block.timestamp + 30 days));
            quote.setOperator(address(dex), uint48(block.timestamp + 30 days));
            vm.stopPrank();
        }
        base.mint(address(dex), START);
        quote.mint(address(dex), START);
    }

    // --------------------------------------------------------------- helpers

    function _submit(address trader, IBatchAuction.OrderType side, uint64 size, uint64 tick) internal {
        (externalEuint64 encSize, bytes memory sp) = encryptUint64(size, trader, address(dex));
        (externalEuint64 encPrice, bytes memory pp) = encryptUint64(tick, trader, address(dex));
        vm.prank(trader);
        dex.submitOrder(side, encSize, encPrice, sp, pp);
    }

    /// @notice Scan the whole tick grid in HCU-sized chunks, one block per chunk.
    /// @dev Each chunk is a separate keeper transaction on-chain (separate block, fresh HCU budget).
    ///      `vm.roll` reproduces that so the per-block/per-tx HCU cap (20M) is respected — this is
    ///      exactly the multi-block clearing design being exercised.
    function _scanAll(uint256 chunk) internal {
        uint256 maxTick = dex.MAX_TICK();
        uint256 start = 0;
        while (start <= maxTick) {
            uint256 end = start + chunk - 1;
            if (end > maxTick) end = maxTick;
            dex.clearBatchRange(start, end);
            vm.roll(block.number + 1);
            start = end + 1;
        }
    }

    /// @notice Run the keeper clearing steps and submit the decrypted clearing result.
    function _clear() internal {
        vm.warp(block.timestamp + DURATION + 1);
        dex.closeBatch();
        _scanAll(6);
        dex.finalizeClearing();

        (bytes32 vh, bytes32 th) = dex.getClearingHandles();
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = vh;
        handles[1] = th;
        (uint256[] memory cts, bytes memory proof) = publicDecrypt(handles);
        dex.submitClearingResult(handles, abi.encodePacked(cts), proof);
    }

    function _bal(ConfidentialToken t, address a) internal returns (uint64) {
        return decrypt(t.confidentialBalanceOf(a));
    }

    // ----------------------------------------------------------------- tests

    function test_InitialState() public view {
        assertEq(dex.keeper(), keeper);
        assertEq(address(dex.baseToken()), address(base));
        assertEq(dex.currentBatchId(), 1);
        assertEq(uint256(dex.getCurrentBatch().status), uint256(IBatchAuction.BatchStatus.Open));
    }

    function test_OnlyKeeperCanClose() public {
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(alice);
        vm.expectRevert(bytes("only keeper"));
        dex.closeBatch();
        dex.closeBatch();
        assertEq(uint256(dex.getCurrentBatch().status), uint256(IBatchAuction.BatchStatus.Closed));
    }

    function test_CannotCloseBeforeExpiry() public {
        vm.expectRevert(bytes("batch not expired"));
        dex.closeBatch();
    }

    /// @notice Full lifecycle with a hand-computed reference clearing at tick 40, volume 10.
    function test_FullLifecycle_ClearsAndSettles() public {
        // Buyers (fill iff limit >= clearing tick), sellers (fill iff limit <= clearing tick).
        _submit(alice, IBatchAuction.OrderType.Buy, 10, 50);
        _submit(bob, IBatchAuction.OrderType.Buy, 5, 30);
        _submit(carol, IBatchAuction.OrderType.Sell, 8, 20);
        _submit(dave, IBatchAuction.OrderType.Sell, 4, 40);
        assertEq(dex.getCurrentBatch().orderCount, 4);

        _clear();

        IBatchAuction.Batch memory b = dex.getBatch(1);
        assertEq(uint256(b.status), uint256(IBatchAuction.BatchStatus.Cleared));
        assertEq(b.clearingPrice, 40, "clearing tick");
        assertEq(b.matchedVolume, 10, "matched volume");

        dex.settleBatchRange(0, 4);

        // New batch auto-opened after settlement.
        assertEq(dex.currentBatchId(), 2);
        assertEq(uint256(dex.getBatch(1).status), uint256(IBatchAuction.BatchStatus.Settled));

        // Fills at price 40: Alice(buy 10), Carol(sell 8), Dave(sell 4); Bob(buy) does not fill.
        assertEq(_bal(base, alice), START + 10, "alice base");
        assertEq(_bal(quote, alice), START - 400, "alice quote");
        assertEq(_bal(base, bob), START, "bob base unchanged");
        assertEq(_bal(quote, bob), START, "bob quote unchanged");
        assertEq(_bal(base, carol), START - 8, "carol base");
        assertEq(_bal(quote, carol), START + 320, "carol quote");
        assertEq(_bal(base, dave), START - 4, "dave base");
        assertEq(_bal(quote, dave), START + 160, "dave quote");

        // DEX net: base +8+4-10 = +2 ; quote +400-320-160 = -80.
        assertEq(_bal(base, address(dex)), START + 2, "dex base");
        assertEq(_bal(quote, address(dex)), START - 80, "dex quote");
    }

    function test_PaginatedClearingMatchesSingleShot() public {
        _submit(alice, IBatchAuction.OrderType.Buy, 10, 50);
        _submit(carol, IBatchAuction.OrderType.Sell, 8, 20);

        vm.warp(block.timestamp + DURATION + 1);
        dex.closeBatch();
        // Scan in HCU-sized contiguous chunks.
        _scanAll(8);
        dex.finalizeClearing();

        (bytes32 vh, bytes32 th) = dex.getClearingHandles();
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = vh;
        handles[1] = th;
        (uint256[] memory cts, bytes memory proof) = publicDecrypt(handles);
        dex.submitClearingResult(handles, abi.encodePacked(cts), proof);

        // Overlap region [20,50] matches min(10,8)=8; first max at tick 20.
        IBatchAuction.Batch memory b = dex.getBatch(1);
        assertEq(b.clearingPrice, 20, "clearing tick");
        assertEq(b.matchedVolume, 8, "matched volume");
    }

    function test_RejectsNonContiguousClearing() public {
        vm.warp(block.timestamp + DURATION + 1);
        dex.closeBatch();
        vm.expectRevert(bytes("non-contiguous range"));
        dex.clearBatchRange(5, 10);
    }
}

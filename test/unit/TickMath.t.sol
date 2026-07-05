// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";

/// @dev Harness exposing the internal library functions to the test.
contract TickMathHarness {
    function tickToPrice(uint256 tick) external pure returns (uint256) {
        return TickMath.tickToPrice(tick);
    }

    function priceToTick(uint256 price) external pure returns (uint256) {
        return TickMath.priceToTick(price);
    }
}

contract TickMathTest is Test {
    TickMathHarness h;

    function setUp() public {
        h = new TickMathHarness();
    }

    function test_Bounds() public view {
        assertEq(TickMath.MIN_TICK, 0);
        assertEq(TickMath.MAX_TICK, 31);
        assertEq(TickMath.TICK_COUNT, 32);
        assertEq(h.tickToPrice(0), TickMath.MIN_PRICE);
        assertEq(h.tickToPrice(TickMath.MAX_TICK), TickMath.MAX_PRICE);
    }

    function test_Monotonic() public view {
        assertGt(h.tickToPrice(16), h.tickToPrice(0));
        assertLt(h.tickToPrice(16), h.tickToPrice(TickMath.MAX_TICK));
    }

    function test_RevertTickOutOfBounds() public {
        vm.expectRevert(bytes("tick out of bounds"));
        h.tickToPrice(TickMath.MAX_TICK + 1);
    }

    function test_RevertPriceOutOfRange() public {
        vm.expectRevert(bytes("price out of range"));
        h.priceToTick(TickMath.MIN_PRICE - 1);
        vm.expectRevert(bytes("price out of range"));
        h.priceToTick(TickMath.MAX_PRICE + 1);
    }

    /// @notice The core invariant: tick -> price -> tick is exact for every valid tick.
    function testFuzz_RoundTrip(uint256 tick) public view {
        tick = bound(tick, 0, TickMath.MAX_TICK);
        assertEq(h.priceToTick(h.tickToPrice(tick)), tick);
    }
}

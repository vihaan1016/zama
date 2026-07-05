// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title TickMath
/// @notice Pure price-grid math for the batch auction. Prices are discretized into a fixed
///         grid of ticks so clearing is "test K candidate prices" instead of sorting a continuum.
/// @dev MAX_PRICE is DERIVED from (MIN_PRICE, TICK_SPACING, MAX_TICK) so that the mapping is
///      exactly round-trip safe: priceToTick(tickToPrice(t)) == t for every valid t.
library TickMath {
    /// @notice Lowest tick index.
    uint256 internal constant MIN_TICK = 0;
    /// @notice Highest tick index (32 ticks total: 0..31).
    /// @dev The grid size is a pure gas/precision knob: raising MAX_TICK/TICK_COUNT widens the
    ///      price grid, and the keeper simply folds more tick chunks per batch (clearing is already
    ///      paginated and content-independent). 32 keeps clearing to a handful of keeper transactions.
    uint256 internal constant MAX_TICK = 31;
    /// @notice Number of ticks in the grid.
    uint256 internal constant TICK_COUNT = 32;

    /// @notice Price of tick 0, in 18-decimal units ($0.01).
    uint256 internal constant MIN_PRICE = 1e16;
    /// @notice Price delta between adjacent ticks, in 18-decimal units ($0.10).
    uint256 internal constant TICK_SPACING = 1e17;
    /// @notice Price of tick MAX_TICK, derived so the grid is exact. == 1e16 + 999*1e17 ≈ $99.91.
    uint256 internal constant MAX_PRICE = MIN_PRICE + (MAX_TICK * TICK_SPACING);

    /// @notice Convert a tick index to its 18-decimal price.
    /// @param tick Tick index in [MIN_TICK, MAX_TICK].
    /// @return price Price in 18-decimal units.
    function tickToPrice(uint256 tick) internal pure returns (uint256 price) {
        require(tick <= MAX_TICK, "tick out of bounds");
        return MIN_PRICE + (tick * TICK_SPACING);
    }

    /// @notice Convert a price to its tick index (floored to the nearest tick at or below the price).
    /// @param price Price in 18-decimal units, in [MIN_PRICE, MAX_PRICE].
    /// @return tick Tick index in [MIN_TICK, MAX_TICK].
    function priceToTick(uint256 price) internal pure returns (uint256 tick) {
        require(price >= MIN_PRICE && price <= MAX_PRICE, "price out of range");
        return (price - MIN_PRICE) / TICK_SPACING;
    }
}

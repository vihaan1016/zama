// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {TickMath} from "../libraries/TickMath.sol";

/// @title ClearingEngine
/// @notice Encrypted primitives for uniform-price batch clearing on a discrete tick grid.
/// @dev Clearing never sorts. For each candidate tick it counts encrypted demand and supply,
///      takes matched = min(demand, supply), and folds the running argmax entirely under FHE so
///      that only the final winner (tick + volume) is ever decrypted. All operations are bounded
///      and independent of ciphertext contents (no data-dependent branching), so a keeper can
///      split the scan across transactions with predictable gas — the multi-block clearing design.
abstract contract ClearingEngine {
    // Re-export the grid so tests and the frontend can read it off the DEX.
    uint256 public constant MIN_TICK = TickMath.MIN_TICK;
    uint256 public constant MAX_TICK = TickMath.MAX_TICK;
    uint256 public constant TICK_COUNT = TickMath.TICK_COUNT;
    uint256 public constant MIN_PRICE = TickMath.MIN_PRICE;
    uint256 public constant MAX_PRICE = TickMath.MAX_PRICE;
    uint256 public constant TICK_SPACING = TickMath.TICK_SPACING;

    /// @notice Convert a tick index to its 18-decimal price.
    function tickToPrice(uint256 tick) public pure returns (uint256) {
        return TickMath.tickToPrice(tick);
    }

    /// @notice Convert a price to its tick index.
    function priceToTick(uint256 price) public pure returns (uint256) {
        return TickMath.priceToTick(price);
    }

    /// @notice Demand contributed by one BUY order at candidate `tickEnc`.
    /// @dev A buy with limit L clears at price p iff L >= p. Contributes its full size, else 0.
    function _demandContribution(euint64 limit, euint64 size, euint64 tickEnc) internal returns (euint64) {
        ebool willBuy = FHE.ge(limit, tickEnc);
        return FHE.select(willBuy, size, FHE.asEuint64(0));
    }

    /// @notice Supply contributed by one SELL order at candidate `tickEnc`.
    /// @dev A sell with limit L clears at price p iff L <= p. Contributes its full size, else 0.
    function _supplyContribution(euint64 limit, euint64 size, euint64 tickEnc) internal returns (euint64) {
        ebool willSell = FHE.le(limit, tickEnc);
        return FHE.select(willSell, size, FHE.asEuint64(0));
    }

    /// @notice Matched volume at a tick is the short side: min(demand, supply).
    function _matched(euint64 demand, euint64 supply) internal returns (euint64) {
        return FHE.min(demand, supply);
    }

    /// @notice Fold one candidate tick into the running encrypted argmax.
    /// @param bestVol Current best matched volume (encrypted).
    /// @param bestTick Current best tick index (encrypted).
    /// @param matchedVol Matched volume at the candidate tick (encrypted).
    /// @param tickEnc Candidate tick index (encrypted).
    /// @return newBestVol Updated best volume.
    /// @return newBestTick Updated best tick.
    /// @dev Strict `gt` keeps the FIRST (lowest) tick among equal-volume maxima, a deterministic
    ///      tie-break that does not depend on order contents.
    function _argmaxStep(euint64 bestVol, euint64 bestTick, euint64 matchedVol, euint64 tickEnc)
        internal
        returns (euint64 newBestVol, euint64 newBestTick)
    {
        ebool better = FHE.gt(matchedVol, bestVol);
        newBestVol = FHE.select(better, matchedVol, bestVol);
        newBestTick = FHE.select(better, tickEnc, bestTick);
    }

    /// @notice All-or-nothing fill decision for an order at the plaintext clearing tick.
    /// @param isBuy Order side.
    /// @param limit Encrypted limit tick.
    /// @param clearingTick Plaintext clearing tick.
    /// @return shouldFill Encrypted boolean: buy fills iff limit >= clearing, sell iff limit <= clearing.
    function shouldFillOrder(bool isBuy, euint64 limit, uint256 clearingTick) internal returns (ebool shouldFill) {
        euint64 clearingEnc = FHE.asEuint64(uint64(clearingTick));
        return isBuy ? FHE.ge(limit, clearingEnc) : FHE.le(limit, clearingEnc);
    }
}

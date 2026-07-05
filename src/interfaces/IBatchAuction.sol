// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title IBatchAuction
/// @notice Interface for the Sealed-Bid Batch Auction DEX.
/// @dev Lifecycle is keeper-driven and multi-step because FHEVM public decryption is asynchronous:
///      Open -> Closed -> (paginated encrypted clearing) -> Clearing (awaiting decryption) ->
///      Cleared -> (paginated confidential settlement) -> Settled.
interface IBatchAuction {
    /// @notice Batch lifecycle states.
    enum BatchStatus {
        Open, // Accepting orders
        Closed, // No new orders; encrypted clearing scan may run
        Clearing, // Encrypted winner published for public decryption, awaiting result
        Cleared, // Clearing tick known in plaintext; settlement may run
        Settled // Confidential transfers executed

    }

    /// @notice Order side. Side is intentionally public; price and size are encrypted.
    enum OrderType {
        Buy,
        Sell
    }

    /// @notice Encrypted order. `size` and `limitPrice` (tick index) are ciphertexts.
    struct Order {
        address trader;
        OrderType orderType;
        euint64 size;
        euint64 limitPrice; // encrypted tick index in [0, MAX_TICK]
        uint256 batchId;
        bool filled; // set once the order has passed through settlement
    }

    /// @notice Batch metadata and clearing results.
    struct Batch {
        uint256 batchId;
        uint256 startTime;
        uint256 endTime;
        BatchStatus status;
        uint256 clearingPrice; // plaintext clearing tick index (valid once Cleared)
        uint256 matchedVolume; // plaintext matched volume at clearing tick
        uint256 orderCount;
        uint256 nextTick; // clearing scan cursor: next tick index expected
        uint256 settleCursor; // settlement cursor: next order index expected
    }

    // ----------------------------------------------------------------- Events
    event BatchOpened(uint256 indexed batchId, uint256 startTime, uint256 duration);
    event OrderSubmitted(uint256 indexed batchId, uint256 indexed orderId, address indexed trader, OrderType orderType);
    event BatchClosed(uint256 indexed batchId, uint256 timestamp);
    event ClearingScanned(uint256 indexed batchId, uint256 tickStart, uint256 tickEnd);
    /// @notice Emitted when the encrypted winner is published for off-chain public decryption.
    /// @param volumeHandle Ciphertext handle of the matched volume at the winning tick.
    /// @param tickHandle Ciphertext handle of the winning tick index.
    event ClearingPending(uint256 indexed batchId, bytes32 volumeHandle, bytes32 tickHandle);
    event BatchCleared(uint256 indexed batchId, uint256 clearingTick, uint256 matchedVolume);
    event OrderFilled(uint256 indexed batchId, uint256 indexed orderId, address indexed trader);
    event BatchSettled(uint256 indexed batchId, uint256 filledOrders);

    // -------------------------------------------------------------- Functions

    /// @notice Submit an encrypted order into the current open batch.
    function submitOrder(
        OrderType orderType,
        externalEuint64 encryptedSize,
        externalEuint64 encryptedPrice,
        bytes calldata sizeProof,
        bytes calldata priceProof
    ) external returns (uint256 orderId);

    /// @notice Close the current batch once its window has elapsed (keeper only).
    function closeBatch() external;

    /// @notice Scan a contiguous tick range, folding it into the encrypted running best (keeper only).
    /// @dev Must be called with ascending, contiguous ranges starting at tick 0 and ending at MAX_TICK.
    function clearBatchRange(uint256 tickStart, uint256 tickEnd) external;

    /// @notice Publish the encrypted winner for off-chain public decryption (keeper only).
    function finalizeClearing() external;

    /// @notice Submit the KMS-signed decrypted clearing result (keeper only).
    /// @param handles The two handles emitted in ClearingPending: [volumeHandle, tickHandle].
    /// @param cleartexts ABI-encoded decrypted values matching `handles` order.
    /// @param decryptionProof KMS public-decryption proof.
    function submitClearingResult(bytes32[] calldata handles, bytes calldata cleartexts, bytes calldata decryptionProof)
        external;

    /// @notice Settle a range of orders with confidential transfers (keeper only).
    function settleBatchRange(uint256 startIndex, uint256 endIndex) external;

    // --------------------------------------------------------------- Views
    function getCurrentBatch() external view returns (Batch memory);
    function getBatch(uint256 batchId) external view returns (Batch memory);
    function getOrder(uint256 orderId) external view returns (Order memory);
    function isOrderFilled(uint256 orderId) external view returns (bool);
    function getBatchOrders(uint256 batchId) external view returns (uint256[] memory);

    /// @notice Ciphertext handles of the current batch's winning (volume, tick), for the keeper to
    ///         public-decrypt off-chain. Only meaningful once finalizeClearing has run.
    function getClearingHandles() external view returns (bytes32 volumeHandle, bytes32 tickHandle);
}

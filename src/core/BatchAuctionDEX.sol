// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IBatchAuction} from "../interfaces/IBatchAuction.sol";
import {ClearingEngine} from "./ClearingEngine.sol";
import {ConfidentialToken} from "../tokens/ConfidentialToken.sol";

/// @title BatchAuctionDEX
/// @notice Sealed-bid, uniform-price batch-auction DEX. Traders submit orders whose price and size
///         are FHE ciphertexts, so nothing in the mempool is legible and nothing can be front-run or
///         sandwiched. Each batch clears at a single tick, computed entirely under FHE, and crossing
///         orders settle as confidential ERC-7984 transfers.
/// @dev Keeper-driven, multi-step lifecycle (see IBatchAuction.BatchStatus). Clearing and settlement
///      are paginated so each keeper transaction stays within block gas limits.
contract BatchAuctionDEX is IBatchAuction, ClearingEngine {
    address public keeper;
    ConfidentialToken public baseToken; // asset being bought/sold
    ConfidentialToken public quoteToken; // asset paid/received

    uint256 public batchDuration;
    uint256 public currentBatchId;
    uint256 public nextOrderId;

    mapping(uint256 => Batch) public batches;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => uint256[]) public batchOrders;

    // Per-batch encrypted running argmax carried across paginated clearing calls.
    mapping(uint256 => euint64) private _bestVol;
    mapping(uint256 => euint64) private _bestTick;

    modifier onlyKeeper() {
        require(msg.sender == keeper, "only keeper");
        _;
    }

    constructor(address _keeper, address _baseToken, address _quoteToken, uint256 _batchDuration) {
        require(_keeper != address(0), "invalid keeper");
        require(_baseToken != address(0), "invalid base token");
        require(_quoteToken != address(0), "invalid quote token");
        require(_batchDuration > 0, "invalid duration");

        FHE.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig());

        keeper = _keeper;
        baseToken = ConfidentialToken(_baseToken);
        quoteToken = ConfidentialToken(_quoteToken);
        batchDuration = _batchDuration;

        _openNewBatch();
    }

    // ------------------------------------------------------------ Submission

    /// @inheritdoc IBatchAuction
    function submitOrder(
        OrderType orderType,
        externalEuint64 encryptedSize,
        externalEuint64 encryptedPrice,
        bytes calldata sizeProof,
        bytes calldata priceProof
    ) external override returns (uint256 orderId) {
        Batch storage batch = batches[currentBatchId];
        require(batch.status == BatchStatus.Open, "batch not open");
        require(block.timestamp < batch.endTime, "batch expired");

        euint64 size = FHE.fromExternal(encryptedSize, sizeProof);
        euint64 limitPrice = FHE.fromExternal(encryptedPrice, priceProof);

        // ACL: the contract must operate on these; the trader may decrypt their own order.
        FHE.allowThis(size);
        FHE.allowThis(limitPrice);
        FHE.allow(size, msg.sender);
        FHE.allow(limitPrice, msg.sender);

        orderId = nextOrderId++;
        orders[orderId] = Order({
            trader: msg.sender,
            orderType: orderType,
            size: size,
            limitPrice: limitPrice,
            batchId: currentBatchId,
            filled: false
        });

        batchOrders[currentBatchId].push(orderId);
        batch.orderCount++;

        emit OrderSubmitted(currentBatchId, orderId, msg.sender, orderType);
    }

    // ------------------------------------------------------------- Lifecycle

    /// @inheritdoc IBatchAuction
    function closeBatch() external override onlyKeeper {
        Batch storage batch = batches[currentBatchId];
        require(batch.status == BatchStatus.Open, "batch not open");
        require(block.timestamp >= batch.endTime, "batch not expired");

        batch.status = BatchStatus.Closed;
        batch.nextTick = 0;

        // Seed the encrypted running best at (volume=0, tick=0).
        euint64 zero = FHE.asEuint64(0);
        FHE.allowThis(zero);
        _bestVol[currentBatchId] = zero;
        _bestTick[currentBatchId] = zero;

        emit BatchClosed(currentBatchId, block.timestamp);
    }

    /// @inheritdoc IBatchAuction
    function clearBatchRange(uint256 tickStart, uint256 tickEnd) external override onlyKeeper {
        uint256 batchId = currentBatchId;
        Batch storage batch = batches[batchId];
        require(batch.status == BatchStatus.Closed, "batch not closed");
        require(tickStart == batch.nextTick, "non-contiguous range");
        require(tickStart <= tickEnd && tickEnd <= MAX_TICK, "invalid tick range");

        uint256[] memory ids = batchOrders[batchId];
        euint64 bestVol = _bestVol[batchId];
        euint64 bestTick = _bestTick[batchId];

        for (uint256 tick = tickStart; tick <= tickEnd; tick++) {
            euint64 tickEnc = FHE.asEuint64(uint64(tick));
            euint64 demand = FHE.asEuint64(0);
            euint64 supply = FHE.asEuint64(0);

            for (uint256 i = 0; i < ids.length; i++) {
                Order storage o = orders[ids[i]];
                if (o.orderType == OrderType.Buy) {
                    demand = FHE.add(demand, _demandContribution(o.limitPrice, o.size, tickEnc));
                } else {
                    supply = FHE.add(supply, _supplyContribution(o.limitPrice, o.size, tickEnc));
                }
            }

            euint64 matchedVol = _matched(demand, supply);
            (bestVol, bestTick) = _argmaxStep(bestVol, bestTick, matchedVol, tickEnc);
        }

        FHE.allowThis(bestVol);
        FHE.allowThis(bestTick);
        _bestVol[batchId] = bestVol;
        _bestTick[batchId] = bestTick;
        batch.nextTick = tickEnd + 1;

        emit ClearingScanned(batchId, tickStart, tickEnd);
    }

    /// @inheritdoc IBatchAuction
    function finalizeClearing() external override onlyKeeper {
        uint256 batchId = currentBatchId;
        Batch storage batch = batches[batchId];
        require(batch.status == BatchStatus.Closed, "batch not closed");
        require(batch.nextTick > MAX_TICK, "scan incomplete");

        euint64 vol = _bestVol[batchId];
        euint64 tick = _bestTick[batchId];
        FHE.makePubliclyDecryptable(vol);
        FHE.makePubliclyDecryptable(tick);

        batch.status = BatchStatus.Clearing;

        emit ClearingPending(batchId, FHE.toBytes32(vol), FHE.toBytes32(tick));
    }

    /// @inheritdoc IBatchAuction
    function submitClearingResult(bytes32[] calldata handles, bytes calldata cleartexts, bytes calldata decryptionProof)
        external
        override
        onlyKeeper
    {
        uint256 batchId = currentBatchId;
        Batch storage batch = batches[batchId];
        require(batch.status == BatchStatus.Clearing, "batch not clearing");
        require(handles.length == 2, "bad handles");
        require(handles[0] == FHE.toBytes32(_bestVol[batchId]), "vol handle mismatch");
        require(handles[1] == FHE.toBytes32(_bestTick[batchId]), "tick handle mismatch");

        // Reverts unless the KMS signatures over (handles, cleartexts) verify.
        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        (uint256 volume, uint256 tick) = abi.decode(cleartexts, (uint256, uint256));
        require(tick <= MAX_TICK, "tick out of range");

        batch.matchedVolume = volume;
        batch.clearingPrice = tick;
        batch.settleCursor = 0;
        batch.status = BatchStatus.Cleared;

        emit BatchCleared(batchId, tick, volume);
    }

    // ------------------------------------------------------------ Settlement

    /// @inheritdoc IBatchAuction
    function settleBatchRange(uint256 startIndex, uint256 endIndex) external override onlyKeeper {
        uint256 batchId = currentBatchId;
        Batch storage batch = batches[batchId];
        require(batch.status == BatchStatus.Cleared, "batch not cleared");
        require(startIndex == batch.settleCursor, "non-contiguous range");

        uint256[] memory ids = batchOrders[batchId];
        require(endIndex <= ids.length && startIndex <= endIndex, "invalid range");

        uint256 clearingTick = batch.clearingPrice;
        euint64 priceEnc = FHE.asEuint64(uint64(clearingTick));

        uint256 processed = 0;
        for (uint256 i = startIndex; i < endIndex; i++) {
            Order storage o = orders[ids[i]];
            _executeTrade(o, priceEnc);
            o.filled = true;
            processed++;
            emit OrderFilled(batchId, ids[i], o.trader);
        }

        batch.settleCursor = endIndex;

        if (endIndex >= ids.length) {
            batch.status = BatchStatus.Settled;
            emit BatchSettled(batchId, processed);
            _openNewBatch();
        }
    }

    /// @notice Confidentially swap one order against the DEX at the clearing price.
    /// @dev Fully encrypted: the transferred amount is `size` (or `size*price`) when the order crosses
    ///      and 0 otherwise, so no fill decision is ever revealed on-chain. The DEX is the central
    ///      counterparty and must hold both-token liquidity; traders must have approved it as operator.
    function _executeTrade(Order storage o, euint64 priceEnc) internal {
        bool isBuy = o.orderType == OrderType.Buy;
        ebool fill = shouldFillOrder(isBuy, o.limitPrice, batches[o.batchId].clearingPrice);

        euint64 zero = FHE.asEuint64(0);
        euint64 baseAmt = FHE.select(fill, o.size, zero);
        euint64 quoteAmt = FHE.select(fill, FHE.mul(o.size, priceEnc), zero);

        FHE.allowThis(baseAmt);
        FHE.allowThis(quoteAmt);

        if (isBuy) {
            // Buyer pays quote to the DEX and receives base from the DEX.
            FHE.allowTransient(quoteAmt, address(quoteToken));
            quoteToken.confidentialTransferFrom(o.trader, address(this), quoteAmt);
            FHE.allowTransient(baseAmt, address(baseToken));
            baseToken.confidentialTransfer(o.trader, baseAmt);
        } else {
            // Seller delivers base to the DEX and receives quote from the DEX.
            FHE.allowTransient(baseAmt, address(baseToken));
            baseToken.confidentialTransferFrom(o.trader, address(this), baseAmt);
            FHE.allowTransient(quoteAmt, address(quoteToken));
            quoteToken.confidentialTransfer(o.trader, quoteAmt);
        }
    }

    // --------------------------------------------------------------- Internal

    function _openNewBatch() internal {
        currentBatchId++;
        batches[currentBatchId] = Batch({
            batchId: currentBatchId,
            startTime: block.timestamp,
            endTime: block.timestamp + batchDuration,
            status: BatchStatus.Open,
            clearingPrice: 0,
            matchedVolume: 0,
            orderCount: 0,
            nextTick: 0,
            settleCursor: 0
        });

        emit BatchOpened(currentBatchId, block.timestamp, batchDuration);
    }

    // ------------------------------------------------------------------ Views

    /// @inheritdoc IBatchAuction
    function getCurrentBatch() external view override returns (Batch memory) {
        return batches[currentBatchId];
    }

    /// @inheritdoc IBatchAuction
    function getBatch(uint256 batchId) external view override returns (Batch memory) {
        return batches[batchId];
    }

    /// @inheritdoc IBatchAuction
    function getOrder(uint256 orderId) external view override returns (Order memory) {
        return orders[orderId];
    }

    /// @inheritdoc IBatchAuction
    function isOrderFilled(uint256 orderId) external view override returns (bool) {
        return orders[orderId].filled;
    }

    /// @inheritdoc IBatchAuction
    function getBatchOrders(uint256 batchId) external view override returns (uint256[] memory) {
        return batchOrders[batchId];
    }

    /// @inheritdoc IBatchAuction
    function getClearingHandles() external view override returns (bytes32 volumeHandle, bytes32 tickHandle) {
        return (FHE.toBytes32(_bestVol[currentBatchId]), FHE.toBytes32(_bestTick[currentBatchId]));
    }
}

/** BatchAuctionDEX events the indexer watches, plus the current-batch view for snapshots. */
export const dexEventsAbi = [
  {
    type: 'event',
    name: 'BatchOpened',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'startTime', type: 'uint256', indexed: false },
      { name: 'duration', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OrderSubmitted',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'trader', type: 'address', indexed: true },
      { name: 'orderType', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BatchClosed',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ClearingPending',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'volumeHandle', type: 'bytes32', indexed: false },
      { name: 'tickHandle', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BatchCleared',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'clearingTick', type: 'uint256', indexed: false },
      { name: 'matchedVolume', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OrderFilled',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'trader', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BatchSettled',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'filledOrders', type: 'uint256', indexed: false },
    ],
  },
] as const

export const BatchStatusName = ['Open', 'Closed', 'Clearing', 'Cleared', 'Settled'] as const
export const OrderTypeName = ['Buy', 'Sell'] as const

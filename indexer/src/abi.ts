/** BatchAuctionDEX events the indexer watches. */
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

/** Read-only BatchAuctionDEX views used to seed state if historical events were missed. */
export const dexReadAbi = [
  {
    type: 'function',
    name: 'getCurrentBatch',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'batchId', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'clearingPrice', type: 'uint256' },
          { name: 'matchedVolume', type: 'uint256' },
          { name: 'orderCount', type: 'uint256' },
          { name: 'nextTick', type: 'uint256' },
          { name: 'settleCursor', type: 'uint256' },
        ],
      },
    ],
  },
] as const

export const BatchStatusName = ['Open', 'Closed', 'Clearing', 'Cleared', 'Settled'] as const
export const OrderTypeName = ['Buy', 'Sell'] as const

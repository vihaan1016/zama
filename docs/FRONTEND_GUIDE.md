# Frontend Build Guide

Everything the frontend developer needs to build against the deployed backend. Read this together with
the root [`README.md`](../README.md) (what/why/architecture) and [`BACKEND_AUDIT.md`](./BACKEND_AUDIT.md)
(contract behaviour).

> **The one thing the demo must prove on camera:** a trader submits an encrypted order, another trader
> opens the explorer / tries to decrypt it and **cannot**. The seal is real. Build the UI around making
> that visible.

---

## 1. Screens to build

1. **Connect + faucet** — connect wallet (Sepolia), mint test `cETH`/`cUSD`, and **approve the DEX as an
   ERC-7984 operator** on both tokens (one-time; required or settlement transfers move 0).
2. **Trade / order form** — Buy/Sell toggle, price input, size input, "Submit encrypted order". Show a
   clear "🔒 encrypted client-side" state while encrypting.
3. **Batch / round visualizer** — current batch id, countdown to close, status
   (`Open → Closed → Clearing → Cleared → Settled`), and **slot count filling** (number of orders only,
   never contents). This is the "sealed until clear" visual.
4. **Portfolio** — the connected user's own orders; after a batch clears, let them **user-decrypt only
   their own order/fill**. Attempting to view someone else's is impossible — surface that as the proof.

---

## 2. Stack & config

Reference stack: Next.js + wagmi/viem + the Zama relayer SDK.

Install the relayer SDK for encryption + decryption:

```bash
npm i @zama-fhe/relayer-sdk wagmi viem @tanstack/react-query
```

Env (`.env.local`):

```bash
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://sepolia.rpc.zama.ai   # use a dedicated RPC; public ones 429 the decrypt flow
NEXT_PUBLIC_RELAYER_URL=https://relayer.testnet.zama.org
NEXT_PUBLIC_DEX_ADDRESS=0x...
NEXT_PUBLIC_BASE_TOKEN=0x...    # cETH  (base = asset being bought/sold)
NEXT_PUBLIC_QUOTE_TOKEN=0x...   # cUSD  (quote = asset paid/received)
```

Get the three addresses from the deploy output (`forge script script/Deploy.s.sol ...`).

---

## 3. Contract surface

### Enums

```
OrderType  { Buy = 0, Sell = 1 }
BatchStatus{ Open = 0, Closed = 1, Clearing = 2, Cleared = 3, Settled = 4 }
```

### Functions the frontend calls

```solidity
// Trader
function submitOrder(
    OrderType orderType,           // 0 = Buy, 1 = Sell (plaintext)
    externalEuint64 encryptedSize, // ciphertext handle
    externalEuint64 encryptedPrice,// ciphertext handle (TICK INDEX, see §5)
    bytes sizeProof,               // proof for encryptedSize
    bytes priceProof               // proof for encryptedPrice
) returns (uint256 orderId);

// Token (OpenZeppelin ERC-7984) — call on BOTH base and quote once
function setOperator(address operator, uint48 until);      // operator = DEX address
function mint(address to, uint64 amount);                   // testnet faucet
function confidentialBalanceOf(address account) view returns (euint64); // handle for user-decrypt
```

### Views for rendering

```solidity
function getCurrentBatch() view returns (Batch);   // batchId, startTime, endTime, status, clearingPrice,
                                                    // matchedVolume, orderCount, nextTick, settleCursor
function getBatch(uint256 batchId) view returns (Batch);
function getOrder(uint256 orderId) view returns (Order);   // trader, orderType, size(handle),
                                                            // limitPrice(handle), batchId, filled
function getBatchOrders(uint256 batchId) view returns (uint256[]);
function currentBatchId() view returns (uint256);
function MAX_TICK() view returns (uint256);        // 31 today (32-tick grid)
function tickToPrice(uint256 tick) pure returns (uint256);
function priceToTick(uint256 price) pure returns (uint256);
```

### Events to subscribe to (live UI)

```solidity
event BatchOpened(uint256 indexed batchId, uint256 startTime, uint256 duration);
event OrderSubmitted(uint256 indexed batchId, uint256 indexed orderId, address indexed trader, OrderType orderType);
event BatchClosed(uint256 indexed batchId, uint256 timestamp);
event ClearingPending(uint256 indexed batchId, bytes32 volumeHandle, bytes32 tickHandle); // keeper-only concern
event BatchCleared(uint256 indexed batchId, uint256 clearingTick, uint256 matchedVolume); // show the price!
event OrderFilled(uint256 indexed batchId, uint256 indexed orderId, address indexed trader);
event BatchSettled(uint256 indexed batchId, uint256 filledOrders);
```

`OrderSubmitted` drives the slot-fill counter. `BatchCleared` reveals the uniform price. `OrderFilled`
tells a trader their order was processed (actual amount stays confidential — decrypt to see it).

> The keeper (not the frontend) handles `closeBatch` / `clearBatchRange` / `finalizeClearing` /
> `submitClearingResult` / `settleBatchRange`. The frontend only submits orders and reads/decrypts.

---

## 4. Encrypting and submitting an order

`size` and `price` are **two separate ciphertexts, each with its own proof**. Create two encrypted inputs.

```ts
import { createInstance } from '@zama-fhe/relayer-sdk/web';

const fhe = await createInstance({
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID),
  relayerUrl: process.env.NEXT_PUBLIC_RELAYER_URL,
});

async function submitOrder(side: 0 | 1, tick: number, size: number, user: `0x${string}`) {
  const dex = process.env.NEXT_PUBLIC_DEX_ADDRESS as `0x${string}`;

  // one input per value; each yields a handle + its own proof
  const sizeInput = fhe.createEncryptedInput(dex, user); sizeInput.add64(BigInt(size));
  const { handles: [sizeHandle], inputProof: sizeProof } = await sizeInput.encrypt();

  const priceInput = fhe.createEncryptedInput(dex, user); priceInput.add64(BigInt(tick));
  const { handles: [priceHandle], inputProof: priceProof } = await priceInput.encrypt();

  // writeContract via wagmi/viem
  return writeContract({
    address: dex, abi: dexAbi, functionName: 'submitOrder',
    args: [side, sizeHandle, priceHandle, sizeProof, priceProof],
  });
}
```

Before the **first** order the trader must approve the DEX as operator on both tokens:

```ts
const until = Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // 30 days
await writeContract({ address: BASE_TOKEN,  abi: erc7984Abi, functionName: 'setOperator', args: [DEX, until] });
await writeContract({ address: QUOTE_TOKEN, abi: erc7984Abi, functionName: 'setOperator', args: [DEX, until] });
```

---

## 5. Price ↔ tick and units (important)

The contract stores the encrypted limit as a **tick index**, not a raw price. The grid is **32 ticks**:

```
MIN_PRICE    = 1e16   ($0.01, 18 decimals)
TICK_SPACING = 1e17   ($0.10)
tick i price = MIN_PRICE + i * TICK_SPACING      // i in [0, 31]
```

- **Convert the user's price → tick before encrypting.** Either compute locally
  (`tick = (priceWei - 1e16) / 1e17`) or call the view `priceToTick(priceWei)`.
- Encrypt and submit the **tick index** as `encryptedPrice` (0..31).
- **Size is a small scaled integer.** Amounts and `size × tick` must fit `uint64`, so use small integer
  units on testnet (e.g. size 1..1000). Pick a display scale and keep products well under 2^64.
- Render prices back with `tickToPrice(tick)` after `BatchCleared`.

> Submitting a tick outside `[0, MAX_TICK]` will simply never cross; validate in the form.

---

## 6. Decrypting your own data (the proof of privacy)

After a batch clears/settles, a trader decrypts **only their own** handles via EIP-712 user-decryption:

```ts
// balance handle from confidentialBalanceOf, or order.size / order.limitPrice from getOrder
const keypair = fhe.generateKeypair();
const { publicKey, privateKey } = keypair;
const eip712 = fhe.createEIP712(publicKey, [DEX], startTs, durationDays);
const signature = await signTypedData(eip712);   // wallet signs

const clear = await fhe.userDecrypt(
  [{ handle, contractAddress: DEX }],
  privateKey, publicKey, signature, [DEX], user, startTs, durationDays,
);
```

Trying the same on another trader's handle **fails the ACL check** — you are not authorized. That failure
is the on-camera proof: sealed bids stay sealed to everyone but their owner.

---

## 7. End-to-end user flow

1. Connect wallet → mint `cETH` + `cUSD` → `setOperator(DEX)` on both (once).
2. Enter side/price/size → encrypt (size + tick) client-side → `submitOrder`.
3. Watch the batch: slot count rises, countdown runs; explorer shows ciphertext, not values.
4. Keeper closes + clears + settles (automatic). `BatchCleared` shows the uniform price.
5. In Portfolio: user-decrypts their own order/fill and confidential balances. Others' remain unreadable.

---

## 8. Getting the ABI

Generated at `out/BatchAuctionDEX.sol/BatchAuctionDEX.json` after `forge build` (the `abi` field).
For ERC-7984, use `out/ConfidentialToken.sol/ConfidentialToken.json`. Copy the `abi` arrays into the
frontend, or import the JSON directly.

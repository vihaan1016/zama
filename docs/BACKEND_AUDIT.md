# Backend Audit & Rebuild

This document records the audit of the original backend and the working implementation that
replaced it. It is the source of truth for how the on-chain system behaves today.

## 1. Audit of the original code

The original contracts compiled but were a non-functional mock. Findings, most severe first:

| # | Severity | Where | Problem |
|---|----------|-------|---------|
| 1 | Critical | `_mockDecrypt` (all 3 contracts) | Unwrapped a ciphertext **handle** (a bytes32 pointer) and treated it as the plaintext value. On real FHEVM this is garbage, and it defeats the entire sealed-bid premise. |
| 2 | Critical | `submitOrder` and every FHE op | No ACL (`FHE.allowThis` / `FHE.allow`). On real FHEVM the coprocessor rejects the ops and users cannot decrypt their own orders. |
| 3 | Critical | `_addToTick` | Empty body — orders were never aggregated, so clearing ran over zero data. |
| 4 | Critical | `_executeTrade` | Empty body — no token transfers, nothing settled. |
| 5 | Critical | clearing/settlement flow | Used synchronous decryption, removed in fhevm ≥ 0.4. Real clearing must use asynchronous public decryption. |
| 6 | High | 1000-tick scan | `findClearingPrice` / a 1000-iteration per-order aggregation cannot fit a single transaction's gas/HCU budget. |
| 7 | High | build | Submodules uninitialised; source imported `@fhevm-solidity-0.11.1/` but remappings defined `@fhevm/`. `forge build` failed. |
| 8 | Medium | `clearBatch` / `settleBatch` | Always operated on `currentBatchId`; opening a new batch mid-settlement would corrupt paginated progress. |
| 9 | Medium | `findClearingPrice` | Recomputed the max independently per keeper range with no persisted running best → wrong global winner across paginated calls. |
| 10 | Medium | `MockConfidentialToken` | No allowance model; unguarded `transferFrom` (drain anyone); plaintext `totalSupply` leak. |
| 11 | Low | `tickToPrice` / `priceToTick` | `MAX_PRICE` inconsistent with the grid; not round-trip safe. |

## 2. What replaced it

Real implementation on `@fhevm/solidity` 0.11.1 + OpenZeppelin confidential contracts 0.5.1.

- **`libraries/TickMath.sol`** — `MAX_PRICE` is derived from `(MIN_PRICE, TICK_SPACING, MAX_TICK)`
  so `tick → price → tick` is exactly round-trip safe (fuzz-tested).
- **`tokens/ConfidentialToken.sol`** — thin wrapper over the audited OZ `ERC7984` with a testnet mint.
- **`core/ClearingEngine.sol`** — encrypted primitives. For each candidate tick it counts encrypted
  demand and supply, takes `min`, and folds a running **argmax entirely under FHE**. Only the final
  winner (tick, volume) is ever decrypted, so the individual order book is never revealed.
- **`core/BatchAuctionDEX.sol`** — asynchronous, keeper-driven lifecycle with full ACL on every
  ciphertext and confidential ERC-7984 settlement.

### Lifecycle

```
Open ──closeBatch──▶ Closed ──clearBatchRange × N──▶ (scan done) ──finalizeClearing──▶
Clearing ──submitClearingResult──▶ Cleared ──settleBatchRange × N──▶ Settled ──▶ (new batch opens)
```

- **Clearing is multi-block by design.** `clearBatchRange(tickStart, tickEnd)` folds a contiguous
  tick chunk into the encrypted running best and persists it (`FHE.allowThis`) between transactions.
  This is what makes the 1000-tick grid survivable: each keeper transaction stays under the HCU budget.
- **Public decryption** uses `FHE.makePubliclyDecryptable` on the encrypted winner; the keeper decrypts
  it off-chain via the Zama relayer and calls `submitClearingResult`, which verifies the KMS signatures
  with `FHE.checkSignatures` before trusting the plaintext.
- **Settlement leaks nothing.** Each order transfers `select(fill, amount, 0)` confidentially, so whether
  an order crossed is never revealed on-chain. The DEX is the central counterparty and holds both-token
  liquidity; traders approve it as an ERC-7984 operator.

### Design notes / tradeoffs

- **Order side is public; price and size are encrypted.** Hiding price+size removes the front-running
  surface (you cannot sandwich what you cannot price). Encrypting the side too is a future enhancement.
- **Clearing decryption reveals only the winning (tick, volume)** — an aggregate, not any single order.
- **euint64 range**: amounts and `size × price` must fit `uint64`, so testnet uses small scaled integer
  units. The frontend scales human prices/sizes into this range.

### The gas/HCU reality (important)

Measured against the mock coprocessor (20M HCU per transaction and per block): with 4 orders, each tick
costs ~1.8M HCU (~2.2M gas), so a keeper transaction folds **~6 ticks**.

The grid is currently **32 ticks** (`TickMath.MAX_TICK = 31`), chosen so a whole batch clears in a
handful of keeper transactions:

| Grid | Clearing txs / batch (4 orders, chunk 6) |
|------|------------------------------------------|
| 32 ticks (current) | 6 |
| 1000 ticks | ~167 |

Grid size is a pure gas/precision knob — nothing else in the contract depends on it. To scale up later,
raise `MAX_TICK` / `TICK_COUNT` in `TickMath.sol`; the keeper (`CLEAR_CHUNK_TICKS`) already paginates and
the clearing math is content-independent, so no other change is needed. For a wide grid, also consider
scanning only a plausible price sub-range instead of the full grid.

## 3. Running it

### Contracts

```bash
forge build
forge test              # 11 tests: TickMath round-trip + full encrypted lifecycle
forge test --gas-report
```

Tests run under Foundry `isolate` mode (set in `foundry.toml`) so each keeper call is a separate
transaction, matching the real per-transaction HCU budget.

### Deploy (Sepolia + Zama FHEVM)

```bash
cp .env.example .env      # set PRIVATE_KEY, RPC_URL, ETHERSCAN_API_KEY
forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast --verify
```

### Keeper + observability

```bash
cp keeper/.env.example keeper/.env   # set KEEPER_PRIVATE_KEY, DEX_ADDRESS, RELAYER_URL
docker compose up --build            # keeper + postgres + prometheus (:9090) + grafana (:3001)
```

Grafana ships a provisioned "FBA DEX Keeper" dashboard; keeper metrics are at `keeper:9464/metrics`.

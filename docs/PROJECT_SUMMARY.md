# FBA DEX — Project Summary

Sealed-Bid Batch-Auction DEX for the Zama Developer Program S3 (Builder Track).

**One line:** submit your order encrypted; the batch clears at one uniform price; the mempool never
sees your bid, so nothing can front-run or sandwich you.

This document is the single-page summary of where the backend stands after the audit and rebuild.

---

## 1. What we are building

- Traders submit **encrypted limit orders** (price and size are FHE ciphertexts; side is public).
- A batch runs for a fixed window, then closes.
- The contract computes a **single uniform clearing price** over the encrypted order flow — entirely
  under FHE, revealing only the winning `(tick, volume)`.
- Crossing orders settle as **confidential ERC-7984 transfers**; nothing about individual fills leaks.

Why FHE: a ZK proof can show your bid is valid but cannot let a contract *clear a price across many
hidden bids*. FHE can. That is the differentiator versus one-sided sealed-bid sales.

---

## 2. Current status

| Area | State |
|------|-------|
| Contracts | ✅ Rebuilt on real FHEVM (`@fhevm/solidity` 0.11.1), audited |
| Tests | ✅ 11/11 green — TickMath fuzz + full encrypted lifecycle with balance assertions |
| Deploy script | ✅ Deploys tokens + DEX, seeds liquidity |
| Keeper bot | ✅ TypeScript/viem lifecycle driver, typechecks clean |
| Infra | ✅ docker-compose: keeper + Postgres + Prometheus + Grafana |
| Frontend | ⬜ Not started — backend is frontend-ready (stable ABIs, events, views) |

The previous backend was a non-functional mock (faked decryption by reading ciphertext handles as
plaintext, no ACL, no aggregation, no settlement, did not build). Full audit in
[`BACKEND_AUDIT.md`](./BACKEND_AUDIT.md).

---

## 3. Architecture

### Contracts (`src/`)

| File | Role |
|------|------|
| `libraries/TickMath.sol` | Discrete price grid. `MAX_PRICE` derived from the grid → exactly round-trip safe. **32 ticks** today. |
| `tokens/ConfidentialToken.sol` | Thin wrapper over OpenZeppelin `ERC7984` + testnet `mint`. |
| `core/ClearingEngine.sol` | Encrypted primitives: per-tick demand/supply counting, `min`, and a running **argmax under FHE**. |
| `core/BatchAuctionDEX.sol` | Async keeper lifecycle, full ACL, paginated clearing, public-decrypt of the winner, confidential settlement. |
| `interfaces/IBatchAuction.sol` | Public API + events. |

### Lifecycle (keeper-driven, multi-block)

```
Open ──closeBatch──▶ Closed ──clearBatchRange × N──▶ (scan done) ──finalizeClearing──▶
Clearing ──submitClearingResult──▶ Cleared ──settleBatchRange × N──▶ Settled ──▶ (new batch opens)
```

- **Clearing** folds a contiguous tick chunk into the encrypted running best each transaction, persisting
  it between calls (`FHE.allowThis`). This is what keeps each keeper transaction under the ~20M HCU budget.
- **Public decryption** marks only the winner publicly decryptable (`makePubliclyDecryptable`); the keeper
  decrypts it off-chain via the Zama relayer and submits it back, verified on-chain with `checkSignatures`.
- **Settlement** transfers `select(fill, amount, 0)` — a filled order moves its amount, a non-filled order
  moves 0 — so **no fill decision is ever revealed on-chain**. The DEX is the central counterparty and
  holds both-token liquidity; traders approve it as an ERC-7984 operator.

### Off-chain (`keeper/`, `infra/`)

- **Keeper**: idempotent loop — reads current batch, performs the next step only. Winston logs, Prometheus
  `/metrics`, optional Postgres bookkeeping (lifecycle only, never order contents).
- **Infra**: `docker-compose up` brings up keeper + Postgres + Prometheus (:9090) + Grafana (:3001) with a
  provisioned "FBA DEX Keeper" dashboard.

---

## 4. The grid decision (32 ticks now, scalable later)

Grid size is a pure **gas ↔ precision** knob; nothing else depends on it.

| Grid | Price precision | Clearing txs / batch (4 orders) |
|------|-----------------|---------------------------------|
| **32 (current)** | coarse (demo) | **6** |
| 128 | finer | ~22 |
| 1000 | fine | ~167 |

**To scale up:** raise `MAX_TICK` / `TICK_COUNT` in `TickMath.sol`. The keeper already paginates
(`CLEAR_CHUNK_TICKS`), and the clearing math is content-independent, so no other change is required.
For a wide grid, prefer scanning a plausible price sub-range over the full grid.

---

## 5. Design tradeoffs (stated honestly)

- **Side is public; price + size are encrypted.** Hiding price + size removes the front-running surface
  (you cannot sandwich what you cannot price). Encrypting the side is a future enhancement.
- **Clearing reveals only the winning `(tick, volume)`** — an aggregate, never a single order.
- **All-or-nothing fills** (no partial fills) — avoids encrypted division; Phase 2 item.
- **`euint64` range**: amounts and `size × price` must fit `uint64`, so testnet uses small scaled integer
  units; the frontend scales human values into this range.
- **Single keeper** — permissioned but every action is verifiable on-chain.

---

## 6. How to run

```bash
# Contracts
forge build
forge test               # 11 tests, runs in Foundry isolate mode (real per-tx HCU budgets)
forge test --gas-report

# Deploy (Sepolia + Zama FHEVM)
cp .env.example .env      # PRIVATE_KEY, RPC_URL, ETHERSCAN_API_KEY
forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast --verify

# Keeper + observability
cp keeper/.env.example keeper/.env   # KEEPER_PRIVATE_KEY, DEX_ADDRESS, RELAYER_URL
docker compose up --build            # keeper + postgres + prometheus + grafana
```

---

## 7. Next steps (frontend)

The backend exposes everything the frontend needs:

- `submitOrder(side, encSize, encPrice, sizeProof, priceProof)` — encrypt client-side with the relayer SDK.
- Events `OrderSubmitted`, `BatchClosed`, `ClearingPending`, `BatchCleared`, `OrderFilled`, `BatchSettled`
  for live batch/round visualization.
- Views `getCurrentBatch`, `getBatch`, `getOrder`, `getBatchOrders`, `getClearingHandles`.
- A trader **user-decrypts only their own order/fill** via EIP-712 (relayer SDK); they cannot decrypt
  anyone else's — this is the on-camera proof that the seal is real.

Remaining backend enhancements (post-demo): encrypt order side, partial fills, direct buyer↔seller netting
(instead of DEX-as-counterparty), and a wider tick grid.

# Sealed-Bid Batch-Auction DEX (FBA) — Zama Developer Program S3 (Builder Track)

**One line:** Submit your order encrypted; the batch clears at one uniform price; the mempool never sees your bid, so nothing can front-run or sandwich you.

**Theme fit:** Composable privacy (S3). Encrypted order flow → uniform-price clearing → confidential settlement.

**Deadline:** July 7, 2026 (23:59 AOE). Team of 3.

---

## 0. Read this before anything else — the scope verdict

**[Certain] The idea as usually pitched is NOT buildable in four days.**

The FBA's core is computing a uniform clearing price over N encrypted orders. That needs FHE comparison/sorting across the whole book — the same encrypted-comparison-under-gas wall that makes naive on-chain matching a research problem, not a sprint task. Three people do not dissolve this; they get stuck at the same gas ceiling together.

**If you build this, you build the SCOPED version below or you don't submit.**

- **Out of scope (research risk, do not attempt):** open book, arbitrary N orders, on-chain sort/cross over ciphertext, general two-sided clearing.
- **In scope (demo-viable):** a **fixed tiny batch** (e.g. exactly 8 slots per round), a **single bounded clearing computation**, one asset pair.

If a teammate says "let's make the batch size dynamic" or "let's clear an open book," that is the timeline-killer. Hold the line at fixed-8.

## 1. The pain (pitch line 1)

Every order on a transparent DEX sits in the mempool before it executes. Searchers read it, front-run it, sandwich it. The trader pays the MEV tax on every fill. Dynamic fees (Kairos-style) only *price* the attack; they don't remove the surface. Sealed bids remove the surface entirely: if no one can read your order before it clears, there is nothing to front-run.

**Who bleeds:** any retail or size trader whose limit order is legible in the mempool — i.e. everyone on a transparent DEX.

## 2. What we build (scoped)

1. A round opens with a **fixed number of encrypted order slots** (8).
2. Traders submit **encrypted limit orders** (side, price, size) into slots. Market sees that slots are filling, not their contents.
3. On round close, the contract runs **one bounded FHE clearing computation** over the 8 encrypted orders to produce a single uniform clearing price.
4. Orders that cross the clearing price settle as **confidential ERC-7984 transfers**; others expire or roll.

The theorem you can state honestly (pitch credibility, not a scored item): uniform-price clearing is incentive-compatible under sealed submission — traders bid true values because they clear at the common price, not their own bid. Cite Budish–Cramton–Shim (2015), frequent batch auctions.

## 3. The hard part, named honestly

**[Certain] Even at fixed-8, the clearing computation is the whole risk.** Before writing the frontend, PROVE the clearing math runs under gas on Sepolia with 8 encrypted orders. Build a throwaway Hardhat test that does *only* the clearing op on 8 dummy ciphertexts. If that doesn't fit gas, the project is dead — find out on day 1, not day 4.

- Prefer **encrypted threshold-counting** (how many orders clear at candidate price p) over **encrypted full sort**. Counting is cheaper than sorting.
- Consider a **discrete price grid** (fixed tick set) so clearing is "test K candidate prices" not "sort a continuum" — bounded, predictable gas.
- The clearing loop must be bounded and constant regardless of order contents (no data-dependent branching on ciphertext).

If day-1 gas test fails: fall back to the **OTC desk** (separate spec, `confidential-otc-desk.md`) which has no matching problem. Have that fallback decided *before* you start.

## 4. Architecture

### Contracts (Solidity + FHEVM)
- `BatchAuction.sol`
  - `submitOrder(externalEuint64 encPrice, externalEuint64 encSize, ebool encIsBuy, bytes proof)` — fills one of 8 slots
  - `closeRound()` — runs the bounded clearing computation, produces uniform clearing price
  - `settle()` — confidential ERC-7984 transfers for crossing orders
  - Fixed slot array of encrypted orders; ACL grants each trader decryption of *their own* fill only.
- Reuse OpenZeppelin `ERC7984` for token legs. Do not hand-roll tokens.

### Frontend (React + relayer SDK)
- Trader view: submit encrypted order into the current round; watch slots fill (count only, not contents).
- Post-clear view: trader decrypts *own* fill via EIP-712 user-decryption. Cannot see others' orders.
- A round timer / batch visualizer — makes the "sealed until clear" property visible on screen.

## 5. Three-person split

- **Contracts + the gas spike:** day 1 is the fixed-8 clearing gas test, nothing else. Then `BatchAuction.sol`, ERC-7984 settlement, tests.
- **Frontend + relayer:** submission flow, EIP-712 decrypt of own fill. **Carry the known relayer gotcha:** set an explicit `NEXT_PUBLIC_SEPOLIA_RPC_URL`; public RPCs 429 the decrypt flow (this stack has hit it before).
- **Pitch + thread + docs:** 3-min real-person video, X thread, README. Start day 2.

## 6. The pitch (3 min, real person — AI voice/video disqualifies)

1. **0:00–0:30 — the sandwich.** Show a normal DEX order getting sandwiched in the mempool. Show the money lost. Visceral.
2. **0:30–1:30 — sealed submission.** Traders submit encrypted orders. Show the mempool / explorer: orders present, contents unreadable. Nothing to front-run.
3. **1:30–2:20 — the clear.** Round closes, uniform price computed on encrypted orders, fills settle confidentially. Show a trader decrypting only their own fill.
4. **2:20–3:00 — why FHE.** ZK proves your bid is valid but can't let a *contract* clear a price across many hidden bids. FHE can. Close on composability.

## 7. Demo must-haves (S2 winner pattern)

- Live deployed URL (Sepolia).
- One-sentence pain at top of README and thread.
- On camera: a trader tries to read another trader's order and **cannot**. That's the proof the seal is real.

## 8. Honest risks

- **[Certain] The clearing gas wall is existential.** Day-1 spike or bust. This is the single reason this idea is riskier than the OTC desk.
- **[Likely] SealPad (S2 winner) already did sealed-bid mechanics.** You are entering a category with a proven prior winner. Your differentiation must be *two-sided clearing* (a DEX, not a one-sided sale) — say so explicitly or judges pattern-match "seen it."
- **[Guessing] "Why fixed-8, isn't that a toy?"** Answer honestly: it's a demonstrator of the mechanism; batch size is a gas-scaling engineering axis, not a conceptual limit. Don't oversell it as production-ready.
- **[Certain] Scope creep into dynamic batch size or open book kills the timeline.** Section 0 is the guardrail.

## 9. Open decisions (resolve day 1, before coding)

- **Go/no-go gate:** does fixed-8 clearing fit Sepolia gas? Test first. No test, no build.
- Clearing method: threshold-count on a discrete price grid (recommended) vs. any form of encrypted sort (avoid).
- Fallback: if the gas gate fails, switch to the OTC desk spec — decide the team agrees to this *now*, not mid-panic.

---

## Verdict vs. the OTC desk

**[Certain] The OTC desk is the lower-risk submission; the FBA is the higher-status one.**
The FBA has an existential day-1 gas gate the OTC desk does not. If your team's real goal is "win the money," the OTC desk is the safer four-day bet. If the goal is "win with the impressive mechanism and you accept a real chance of not shipping," the FBA is the play — but only the scoped fixed-8 version, and only if the day-1 gas test passes.

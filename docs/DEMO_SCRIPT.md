# Concord — Demonstration Video Run-of-Show

A single end-to-end script for recording the demo. At every beat it tells you what to **say**, what to
**show on the deck**, and what to **do on the live app** — plus how to start everything and how to close.

**Deck:** `docs/Concord_Deck.pdf` (14 slides)
**App:** `http://localhost:5173` (or the live URL)
**Target length:** ~4 minutes.

> **Bounty rule — read this first.** The demonstration must be a **real person** presenting with a
> **real voice**. AI-generated video or AI voiceover will not be considered. Record yourself (webcam
> bubble or intro on camera) and narrate live.

> **Why this script is shaped differently from a normal swap demo.** Concord clearing is **not** a
> single user click — it's **keeper-driven and asynchronous**. A batch runs a fixed window
> (`BATCH_DURATION = 5 minutes`), then a background keeper closes it, scans the encrypted 32-tick grid
> in gas-sized chunks, public-decrypts the winning tick, and settles orders confidentially. You cannot
> wait for a full clear inside a 4-minute take. **So: you pre-stage one fully-settled batch before
> recording**, submit a *fresh* sealed order live (to show the sealing UX), and **cut to the pre-settled
> batch** for the clearing reveal and the decrypt. The deck mirrors every beat, so any live hiccup is
> covered by a slide.

---

## 1. Pre-flight checklist (do this ~10 min before you hit record)

- [ ] **Full stack up on Sepolia** — DEX deployed; **keeper** and **indexer** running (`docker compose
      up`); frontend built with `VITE_DEX_ADDRESS` + token addresses + `VITE_RELAYER_URL` set. The
      Trade page must NOT show "Not configured".
- [ ] **Wallet funded on Sepolia** — the account you connect has Sepolia ETH for gas.
- [ ] **A pre-settled batch exists containing THIS wallet's order** — before recording, run the full
      loop once: faucet → approve operator → submit a sealed order → let the keeper carry the batch all
      the way to **Settled** (watch `/batches` until the pipeline shows Settled). This guarantees the
      **Clearing** beat (B7) has a real uniform price + matched volume, and the **Decrypt** beat (B8) has
      a real fill in `/portfolio` to reveal. Note its **batch #**.
- [ ] **A fresh open batch is accepting orders** — after the pre-stage settles, the contract auto-opens
      the next batch. You'll submit your on-camera order into this one.
- [ ] **App open, wallet connected, network = Sepolia** — header ConnectButton shows your address; not
      "Wrong network".
- [ ] **Deck open fullscreen** — `docs/Concord_Deck.pdf` in a PDF viewer, presentation mode, slide 1
      showing. (macOS: open in Preview → View → Slideshow.)
- [ ] **Browser zoom** ~110–125% so the order form + batch pipeline read clearly on video.
- [ ] **Screen recorder + mic tested** — capture the browser window and the deck window (alt-tab between
      them). Do a 5-second mic check.
- [ ] **Close noisy tabs / notifications** — no Slack/Mail popups mid-take.

App layout reminder (`CONCORD`, top nav): **Trade · Batches · Portfolio · Docs** + Connect.
- **Faucet: mint test tokens**, **Approve DEX operator**, the **Buy/Sell** toggle, the **tick slider**,
  the **Size** field, and **Submit sealed order** all live on the **Trade** page (right-hand order form).
- The **sealed-slot grid** and batch status live on the left of **Trade** and on **Batches / a batch's
  detail** page.
- **Decrypt my order** lives on the **Portfolio** page, one button per order.

---

## 2. Run of show

Each beat lists **SLIDE** (deck), **SCREEN** (app), **SAY** (narration), **DO** (clicks), and
**WATCH-FOR** (the on-screen cue that the step worked). `<fill in>` = swap in your real value.

---

### B0 · Intro — the problem & the pitch · ~30s
- **SLIDE:** 1 (Title) → 2 (Problem) → 3 (Solution).
- **SCREEN:** deck only.
- **SAY:** "Hi, I'm `<name>`. This is **Concord** — a sealed-bid batch-auction exchange built on
  Zama's FHE. On a transparent DEX, your order sits in the mempool before it executes — long enough for
  a searcher to front-run and sandwich it. That's the MEV tax. Concord removes the surface entirely:
  your order is **encrypted in your browser** before it's ever submitted, the batch clears at **one
  uniform price**, and there's simply nothing readable to trade against."
- **DO:** advance slides 1 → 2 → 3 as you speak.
- **WATCH-FOR:** land on slide 3 (Solution) before moving on.

### B1 · How it clears + the six steps · ~20s
- **SLIDE:** 4 (Lifecycle) → 5 (End-to-end, steps 01–06).
- **SCREEN:** deck only.
- **SAY:** "A batch moves through five states — **Open, Closed, Clearing, Cleared, Settled** — and a
  keeper drives every transition automatically: it scans the encrypted price grid in gas-sized chunks,
  public-decrypts only the winning tick, and settles confidentially. Everything I'm about to show is live
  on Sepolia — six steps: faucet, approve, seal an order, watch the book fill, the keeper clears, and I
  decrypt my own fill."
- **DO:** hold on slide 4 for the states, slide 5 for the six-step map.
- **WATCH-FOR:** the audience has the lifecycle + map before you switch to the app.

### B2 · Enter the app & connect · ~15s
- **SLIDE:** 6 (demo·1/6).
- **SCREEN:** app → Landing (`/`), then Connect.
- **SAY:** "Here's the app — 'trade without showing your hand.' I connect my wallet on Sepolia, and
  everything from here is real on-chain state, streamed live from our indexer."
- **DO:** show the landing; click **Connect**; pick the wallet; confirm the header shows your address on
  Sepolia; click **Trade** in the nav.
- **WATCH-FOR:** connected address in the header; Trade page loads a live **Batch #** (not "Not
  configured").

### B3 · Step 1 — Claim from the faucet · ~15s
- **SLIDE:** 7 (demo·2/6).
- **SCREEN:** app → **Trade** (order form, right).
- **SAY:** "First I need test tokens. One click on the faucet mints confidential test balances straight
  to my wallet."
- **DO:** click **Faucet: mint test tokens**; confirm the tx in the wallet.
- **WATCH-FOR:** the tx confirms (faucet button settles back from its loading state).

### B4 · Step 2 — Approve the DEX operator · ~15s
- **SLIDE:** 7 (demo·2/6).
- **SCREEN:** app → **Trade**.
- **SAY:** "Next I authorize the DEX as an operator on my confidential tokens — that's what lets it move
  my balances when a batch settles. One approval covers both sides."
- **DO:** click **Approve DEX operator**; confirm the tx (sets `setOperator` on both tokens).
- **WATCH-FOR:** the **Approve DEX operator** button disappears once `isApproved` flips true, leaving
  **Submit sealed order** enabled.

### B5 · Step 3 — Seal & submit an order · ~35s
- **SLIDE:** 7 (demo·2/6).
- **SCREEN:** app → **Trade** (order form).
- **SAY:** "Now I place a sealed order. I pick a side — Buy — I drag the limit price onto the 32-tick
  grid, say **$1.51, tick 15**, and I enter a size. When I submit, my price and size are **FHE-encrypted
  right here in the browser** — two ciphertexts with proofs — and only then does the transaction go out.
  Nobody, not even the keeper, ever sees the values."
- **DO:** click **Buy**; drag the **tick slider** to ~tick 15; type a **Size** (e.g. `250`); click
  **Submit sealed order**; confirm the tx. Narrate the button as it moves `Encrypting…` → `Confirming…`.
- **WATCH-FOR:** the toast **"Sealed order submitted 🔒"**, and on the left the **Sealed orders** count +
  the locked-cell grid tick up by one.

### B6 · Step 4 — The sealed book · ~20s
- **SLIDE:** 8 (demo·3/6).
- **SCREEN:** app → the left card on **Trade** (or **Batches → this batch**).
- **SAY:** "This is the whole point. The market watches slots **fill** — each locked cell is one order —
  but never their contents. Every price and size on the book stays encrypted on-chain. A searcher sees a
  count go up, and nothing else. There is no order flow to trade against."
- **DO:** point at the sealed-slot grid; open **Batches** and show a batch's orders — each row shows only
  **side** and **pending**, with **price 🔒 · size 🔒**.
- **WATCH-FOR:** the 🔒 rows — side visible, price/size masked.

### B7 · Step 5 — Clearing at one price (pre-staged batch) · ~35s
- **SLIDE:** 9 (demo·4/6).
- **SCREEN:** app → **Batches** → open the **pre-staged settled batch** (`#<pre-staged batch>`).
- **SAY:** "Clearing is asynchronous and keeper-driven, so let me show a batch that's already closed.
  Here's batch `#<pre-staged batch>` — the pipeline shows it's **Settled**. When the window ended, the
  keeper closed it, scanned the encrypted grid, and public-decrypted **only the winner** — one **uniform
  clearing price** and the **matched volume**. Everyone who crossed trades at that same price; the
  individual orders never leaked."
- **DO:** open the settled batch's detail; point at the **Clearing price** and **Matched volume** fields
  and the Open→Settled pipeline.
- **WATCH-FOR:** pipeline fully lit to **Settled**; a real clearing price (e.g. `$1.51`) + matched volume.

### B8 · Step 6 — Decrypt your own fill · ~30s
- **SLIDE:** 10 (demo·5/6).
- **SCREEN:** app → **Portfolio**.
- **SAY:** "And here's the payoff. In my Portfolio I see my orders — still sealed. I click **Decrypt my
  order**, sign a single **EIP-712** request to prove I'm the owner, and the price and size are revealed
  **to me only**. The public only ever saw a ciphertext handle."
- **DO:** go to **Portfolio**; on your order from the pre-staged batch click **Decrypt my order**; sign
  the EIP-712 request in the wallet.
- **WATCH-FOR:** the masked order flips to a real `price · size` line (e.g. `$1.51 · size 250`).

### B9 · The core guarantee — you can't read my order · ~20s
- **SLIDE:** 11 (Privacy proof).
- **SCREEN:** deck only (optional: a second wallet aside — see note).
- **SAY:** "This isn't UI-level privacy — it's enforced on-chain. User-decryption only authorizes handles
  the on-chain ACL granted to **you**. Point the exact same flow at another trader's order and it fails
  the access check. The seal is real."
- **DO:** hold on slide 11; name the two columns (what you can vs. cannot decrypt).
- **WATCH-FOR:** both sides of the guarantee are stated clearly.
- **OPTIONAL (2nd wallet):** if you have a second connected account, try to decrypt the first wallet's
  order handle with it and show the access-check failure.

### B10 · Extensibility & scope · ~15s
- **SLIDE:** 12 (Extensibility).
- **SCREEN:** deck only.
- **SAY:** "The 32-tick grid is a parameter, not a hard-coding — widening it is a constant change; the
  encrypted math and the keeper's chunked scan already generalize. And the indexer that streams all of
  this persists **metadata only** — never a price or size; those stay encrypted on-chain."
- **DO:** hold on slide 12; point at the two code paths (price grid / indexer).
- **WATCH-FOR:** both points (parameterized grid + metadata-only indexer) land.

### B11 · Close — criteria recap + thank you · ~20s
- **SLIDE:** 13 (Judged on) → 14 (Thank you).
- **SCREEN:** deck only.
- **SAY:** "That's Concord end to end — confidential by construction, correct FHE clearing and
  settlement, MEV-resistant because there's nothing to front-run, and a clean production UI. It's live at
  `<live URL>` and the code is at `<repo link>`. Thanks for watching."
- **DO:** advance 13 → 14; end on the thank-you slide.
- **WATCH-FOR:** stop recording on slide 14.

---

## 3. Timing budget

| Beat | Content | ~Time |
|------|---------|-------|
| B0 | Intro / problem / solution | 0:30 |
| B1 | Lifecycle + six steps | 0:20 |
| B2 | Enter app / connect | 0:15 |
| B3 | Faucet | 0:15 |
| B4 | Approve operator | 0:15 |
| B5 | Seal & submit order | 0:35 |
| B6 | The sealed book | 0:20 |
| B7 | Clearing (pre-staged batch) | 0:35 |
| B8 | Decrypt your fill | 0:30 |
| B9 | Privacy proof | 0:20 |
| B10 | Extensibility | 0:15 |
| B11 | Close | 0:20 |
| | **Total** | **~4:10** |

**Slow-transaction fallback lines** (keep talking while a tx confirms — dead air reads as broken):
- Faucet / approve pending: "While Sepolia confirms this — remember the whole point is that nothing about
  my order is ever public."
- Submit pending (`Encrypting…` / `Confirming…`): "Notice the amount and the price were encrypted
  client-side, before this transaction ever left my browser — the chain only receives ciphertext."
- Decrypt pending: "The EIP-712 signature proves ownership without exposing my key — the reveal is to me
  only, and it's cached for the session."

**If a live tx fails on camera:** don't fight it — cut to the matching deck slide (6–10), narrate the
step from the screenshot there, and move on. The deck mirrors every action.

---

## 4. Startup commands (appendix)

```bash
# 1. Backend — keeper + indexer + Postgres (+ observability)
cp keeper/.env.example  keeper/.env    # set DEX_ADDRESS, KEEPER_PRIVATE_KEY, RPC_URL, RELAYER_URL
cp indexer/.env.example indexer/.env   # set DEX_ADDRESS, RPC_URL
docker compose up --build              # postgres, keeper, indexer(:3001), prometheus(:9090), grafana(:3002)

# 2. Frontend
cd frontend
cp .env.example .env                   # set VITE_DEX_ADDRESS, token addresses, VITE_RELAYER_URL, VITE_RPC_URL
npm install                            # first time only
npm run dev                            # http://localhost:5173  → Connect, switch wallet to Sepolia

# 3. Deck
open docs/Concord_Deck.pdf           # macOS → Preview → View → Slideshow
```

Connect flow in-app: **Connect** (top-right) → pick wallet → approve → confirm the header shows your
address on **Sepolia**. If the network is wrong, switch it in the wallet. The keeper and indexer must be
running for batch state + the pre-staged settled batch to appear.

---

## 5. Fill-in list (replace before recording)

- `<name>` — your name.
- `<pre-staged batch>` — the batch number you drove to **Settled** during pre-flight (has your order).
- `<live URL>` — deployed app URL.
- `<repo link>` — public GitHub repo (github.com/vihaan1016/zama).

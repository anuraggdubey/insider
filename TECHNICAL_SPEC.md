# INSIDER: Technical Specification

Version 0.3 (design, dark mempool). Items marked **[verify]** depend on MagicBlock behaviour that
hasn't been confirmed with a prototype yet. Each one has a named fallback.

## 1. Goals and principles

1. **Players make the hidden information.** The secret is other players' pending orders, not a
   random number.
2. **The table never leaves the rollup.** Table, market, mempool, seats and Leaks are delegated
   once and play continuous rounds inside the TEE rollup. The base layer is for setup, periodic
   season commits and stake-mode money only.
3. **Privacy only where it carries weight.** Two things are private: pending orders (the dark
   mempool) and sealed Leak contents. Executed trades, positions, prices, Leak ownership and
   "who sent an order in which lane" are public, because public behaviour makes the game social.
4. **Read access is the asset.** Owning a Leak means being on its permission's member list.
5. **Everything claimed is real.** No mocked ER, VRF or PER paths. Every feature has code, a test
   and a devnet transaction.
6. **One-click play.** A browser key claims a pre-delegated seat inside the rollup. No wallet, no
   base-layer transaction.

## 2. Technology stack

| Layer                    | Choice                                                  | Notes                                                 |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------------- |
| Program                  | Rust + Anchor                                           | Anchor CLI 1.2.2                                      |
| MagicBlock SDK (program) | `ephemeral-rollups-sdk` 0.18.0 (pinned)                 | Features `anchor`, `vrf`, `access-control`            |
| Frontend                 | Next.js (App Router), TypeScript                        | Read `app/AGENTS.md`; this Next version differs       |
| Styling and motion       | Tailwind CSS, Framer Motion                             | Ghost orders, Leak cards, X-ray arrows                |
| Charts                   | `lightweight-charts`                                    | Price line, order landing markers, Leak windows       |
| Client SDK               | `@solana/kit`, `@magicblock-labs/ephemeral-rollups-kit` | Magic Router connection, TEE auth token               |
| Keys                     | In-browser burner keypair (localStorage)                | Optional Wallet Standard link for stake mode          |
| Bots                     | TypeScript service, one keypair per bot                 | Deterministic strategies, same instructions as humans |
| Tests                    | LiteSVM / `cargo test` for logic; devnet scripts for ER | Existing `programs/insider/tests`                     |

Phase 2 environment note: public devnet ERs and the TEE run validator 1.x, so the SDK stays on
0.18.x. On 0.20 the `#[vrf]` macro doesn't compile.

## 3. Architecture

```
  Browser (burner key)                        Bot service (Node)
  - trading floor UI                          - 5 strategy bots, own keypairs
  - TEE auth token per key                    - keeper fallback (ticks, drops, phases)
        |                                              |
        |  rollup txs (Magic Router / TEE RPC)          |
        v                                              v
 +--------------------------------------------------------------+
 |  MagicBlock TEE rollup (devnet-tee)                           |
 |   public : Table, Market (vAMM), Board, Seats[8], Tape, Xray  |
 |   private: Mempool (no reader), LeakVault[6] (owner on open)  |
 |   VRF    : round seed (whales, noise), Leak drops             |
 |   Cranks : 500 ms tick (mature orders, auctions, phases)      |
 +-------------------------------+------------------------------+
                                 | periodic commit (Season, Table)
                                 v
 +--------------------------------------------------------------+
 |  Solana devnet: program, delegation, Season leaderboard,      |
 |  stake-mode vault (P2, Ephemeral SPL / Private Payments)      |
 +--------------------------------------------------------------+
```

Endpoints and programs (devnet):

- Router: `https://devnet-router.magicblock.app`
- TEE validator: `devnet-tee.magicblock.app`, identity `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`
- Permission program: `ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1`
- Delegation program: `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`
- Ephemeral VRF queue (in rollup): `5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc`
- Program: `5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ`

## 4. MagicBlock integration: what is proven, what is not

Proven in Phase 2 (devnet, see `docs/proofs`):

| Need in INSIDER                        | Mechanism                                                                 | Proven by                            |
| -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------ |
| Delegate about 20 table accounts once  | `#[delegate]`, 6 delegates per tx, 1.4M CU limit                          | `pnpm lab:slots` (E)                 |
| VRF inside the TEE                     | `create_request_scoped_randomness_ix` + `#[vrf_callback]`, const identity | `pnpm lab:vrf --validator tee` (A)   |
| Account readable only by chosen keys   | `CreateEphemeralPermissionCpi`, `is_private = true`, member flags         | `pnpm lab:per` (B)                   |
| Rewrite who can read, atomically       | `UpdateEphemeralPermissionCpi` (from a VRF callback)                      | `pnpm lab:pick` (C)                  |
| Member changes take effect immediately | Permission update, then a read with the TEE token                         | `pnpm lab:per` (B)                   |
| Scheduled ticks                        | Crank schedule, finite iterations (cancel unavailable on TEE)             | `pnpm lab:crank --validator tee` (D) |
| Commit state to base without leaving   | `commit` intent (at most 8 accounts per intent)                           | `pnpm spike`, `pnpm lab:slots`       |

Not yet verified. Checked in this order; item 1 decides the design:

1. **[verify] Order transactions stay dark.** A `send_order` transaction writes side and size into
   the private `Mempool`. Non-members must not be able to recover the instruction data through
   `getTransaction`, `getSignaturesForAddress`, websocket logs or simulation on the TEE RPC.
   The permission model has a `TX_MESSAGE` flag that gates "view transaction message data", which
   suggests this works. Test: send an order from key A, then try every read path from key B and
   anonymously. Also check that program logs never print order fields (`msg!` is banned in
   `send_order`).
   _Fallback (v0.2):_ if instruction data leaks, orders become public, and Leaks are cut from a
   VRF-written private price path instead (the v0.2 design). Accounts, UI and the Leak lifecycle
   stay the same; only the payload source changes. Decide by the end of day 1.
2. **[verify] Private permission with zero members.** _Fallback:_ the only member is a keyless PDA
   `["nobody"]`. There's no private key, so no one can complete the TEE login.
3. **[verify] A browser key with no SOL can sign rollup transactions.** ER transactions cost 0.
   _Fallback:_ `/api/faucet` sends dust once, or a relayer acts as fee payer.
4. **[verify] A crank-invoked instruction can CPI a VRF request.** _Fallback:_ the keeper calls the
   permissionless `request_drop` when it's due; early calls are rejected.
5. **[verify] Commit limits.** Without a delegated fee payer an account can commit 10 times.
   _Plan:_ commit the season every 5 rounds; register a delegated fee payer plus `magic_fee_vault`
   before the demo.

## 5. Onchain program (`programs/insider`)

### 5.1 Accounts

All accounts are created on the base layer, delegated once to the TEE validator, and reused every
round. Sizes are fixed, so there's no realloc inside the rollup.

| Account     | Seeds                    | Visibility                    | Fields (summary)                                                                                                        |
| ----------- | ------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Table`     | `["table", table_id]`    | public                        | authority, round_id, phase (`Seeding`/`Live`/`Closing`/`Xray`), tick, round_start_tick, params, vrf_pending, request_id |
| `Market`    | `["market", table]`      | public                        | vAMM reserves (`base`, `quote`), price (fixed-point 1e6), `history: [u32; 200]`, noise seed                             |
| `Mempool`   | `["mempool", table]`     | **private, no reader**        | `orders: [PendingOrder; 48]`, next_seq, whale schedule                                                                  |
| `Tape`      | `["tape", table]`        | public                        | `sends: [SendEvent; 64]` ring (seat, lane, sent_tick); `fills: [Fill; 64]` ring (seat, side, size, price, landed_tick)  |
| `Board`     | `["board", table]`       | public                        | `headers: [LeakHeader; 6]`, next_drop_tick, drop_counter                                                                |
| `LeakVault` | `["leak", table, slot]`  | **private, owner after open** | leak_id, kind, minted_tick, payload (up to 32 orders × 8 bytes)                                                         |
| `Seat`      | `["seat", table, index]` | public                        | owner (burner key), persona/name, is_bot, cash, position, entry, fees_paid, leak_spend, pending_count, last_seen_tick   |
| `Xray`      | `["xray", table]`        | public                        | the last round's full order log (sent/landed/side/size/seat), Leak payloads and holders, sandwich tags                  |
| `Season`    | `["season", table]`      | public (committed to base)    | `top: [(owner, score); 20]`, rounds_played                                                                              |

`PendingOrder` (8 bytes): `seat: u8`, `side_size: i16` (signed units), `lane: u8`,
`land_tick: u16`, `seq: u16`. Whale orders use `seat = 255`.

`LeakHeader` (public): `leak_id`, `kind`, `rarity`, `window_start`, `window_end`, `minted_tick`,
`state` (`Empty`/`Auction`/`Owned`/`Listed`/`Opened`/`Expired`), `auction_start_tick`,
`start_price`, `floor_price`, `owner_seat`, `ask`, `flips`, `opened_tick`.

Total: Table, Market, Mempool, Tape, Board, Xray, Season (7) + 6 vaults + 8 seats = **21
delegated accounts** (4 delegation transactions). Permissions: 7 (`Mempool` + 6 vaults).

### 5.2 Instructions

| Instruction           | Layer | Signer                      | Purpose                                                                                                                                                        |
| --------------------- | ----- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init_table`          | base  | authority                   | Create Table, Market, Mempool, Tape, Board, Xray, Season                                                                                                       |
| `init_slots`          | base  | authority                   | Create Seats (8) and LeakVaults (6), in batches                                                                                                                |
| `delegate_table`      | base  | authority                   | Delegate up to 6 accounts per tx to the TEE validator                                                                                                          |
| `init_permissions`    | ER    | authority                   | Private permissions for Mempool and each LeakVault (no reader / `nobody` PDA)                                                                                  |
| `schedule_ticks`      | ER    | authority                   | Crank `tick` every 500 ms for N iterations (finite; keeper re-arms)                                                                                            |
| `request_round_seed`  | ER    | anyone, when due            | VRF request for the next round                                                                                                                                 |
| `round_seed_callback` | ER    | VRF program only            | Schedule 3-5 whale orders into the Mempool (random side, 1,500-3,000 units, land ticks 30-170); set the noise seed; phase → `Live`                             |
| `send_order`          | ER    | seat owner                  | Push `PendingOrder{side_size, lane}` into the Mempool; land at +20 (standard) or +4 (priority, fee 10 chips); log a public `SendEvent` with seat and lane only |
| `tick`                | ER    | crank signer or keeper      | Execute all orders with `land_tick == tick` in `seq` order against the vAMM; apply noise; step auctions; expire Leaks; manage phases                           |
| `request_drop`        | ER    | anyone, at `next_drop_tick` | VRF request for the next Leak; allocates a free slot                                                                                                           |
| `drop_callback`       | ER    | VRF program only            | Roll kind and window; snapshot the Mempool into the vault payload; header → `Auction`                                                                          |
| `claim_seat` / `ping` | ER    | burner key                  | Take a free or idle-bot seat / heartbeat                                                                                                                       |
| `bid`                 | ER    | seat owner                  | Buy an `Auction` Leak at the current Dutch price                                                                                                               |
| `open_leak`           | ER    | seat owner                  | Permission update: members = [owner key]; header → `Opened` (can't be resold)                                                                                  |
| `list_leak`           | ER    | seat owner                  | Re-list an `Owned` (sealed) Leak at an ask                                                                                                                     |
| `buy_listed`          | ER    | seat owner                  | Pay the ask to the seller; ownership moves; still sealed                                                                                                       |
| `finish_round`        | ER    | anyone, in `Xray`           | Write the full order log and Leak payloads into `Xray`; tag sandwiches; clear vault members; score into Season; reset seats                                    |
| `commit_season`       | ER    | anyone, every 5 rounds      | Commit Season and Table to base (≤ 8 accounts per intent)                                                                                                      |
| `cancel_vrf`          | ER    | anyone, after timeout       | Clear a stalled VRF request (pattern from `lab_cancel_roll`)                                                                                                   |
| `teardown`            | ER    | authority                   | Make permissions public, close them, commit and undelegate in batches of ≤ 8                                                                                   |

There are no order cancels: a sent order is a commitment, which is what keeps Leaks honest. The
authority has no instruction that reads or writes Mempool contents, Leak payloads, prices or
scores.

### 5.3 State machine (per round, about 110 s)

```
Seeding --(round_seed_callback)--> Live --(tick 160)--> Closing --(tick 180)--> Xray --(+20 ticks)--> Seeding
```

- **Live:** ticks 0-159. Orders accepted. Drops at ticks 10, 30, ..., 150 (8 drops).
- **Closing:** ticks 160-179. No new orders; the Mempool drains (standard orders sent at tick 159
  land at 179). At tick 180 every position closes at the last price.
- **Xray:** 20 ticks. The UI animates the replay from `Xray`.

### 5.4 Market: vAMM plus noise

- Constant product with virtual reserves: `base = 50,000` units, `quote = 50,000` chips (price
  1.00). Reserves reset every round.
- An order of `s` units fills at the vAMM's average price for `s`, plus a 0.1% fee. A 2,000-unit
  buy moves the price about 8.5%, so size matters and front-running pays.
- Worked example: front-running a 2,000-unit buy with 2,000 units earns roughly 100-150 chips
  after both impacts and fees. That's why Leaks (60-200 chips) and the 10-chip priority fee are
  worth paying, but not always.
- **Noise:** each tick adds a small random walk (±0.05%) from the round's noise seed (a PRNG over
  the VRF output), so the chart moves even when nobody trades. Noise is public after the fact
  and never in Leaks.
- **Whales:** 3-5 VRF-scheduled orders per round live in the Mempool like any other order, so
  there's always flow to leak, even at a quiet table.
- Limits: at most 2,000 units per order, an absolute position of at most 5,000 units (5×
  leverage on the 1,000-chip bankroll), and at most 4 pending orders per seat. A seat whose
  equity hits 0 is liquidated at the next tick.
- Integer math only: prices in fixed-point 1e6, `u128` intermediates, checked operations.

### 5.5 Leaks

**Drop roll** (`drop_callback`):

| Rarity | Weight | Kinds            | Start price | Floor | Auction        |
| ------ | ------ | ---------------- | ----------- | ----- | -------------- |
| Common | 65%    | Flow             | 60          | 5     | 12 ticks (6 s) |
| Rare   | 30%    | Spotlight, Whale | 120         | 10    | 12 ticks       |
| Epic   | 5%     | Full Book        | 200         | 20    | 12 ticks       |

Price at tick `t` = `start − (start − floor) × (t − auction_start) / 12`. An unsold Leak at the
floor expires. The auction (12 ticks) is shorter than the standard delay (20 ticks), so a Leak
bought at any point still shows orders that haven't landed.

**Payloads:** a snapshot of the Mempool at `minted_tick`, filtered by kind.

| Kind        | Window                             | Payload                                                     |
| ----------- | ---------------------------------- | ----------------------------------------------------------- |
| `Flow`      | 10 ticks starting 2-12 ticks ahead | net signed units and order count landing in the window      |
| `Spotlight` | all pending                        | the largest non-whale order: seat, side, size, land_tick    |
| `Whale`     | next 60 ticks                      | the next whale order (side, size, land_tick), or "none"     |
| `Full Book` | all pending                        | every pending order (up to 32): seat, side, size, land_tick |

- **Accurate as of `minted_tick`.** Orders can't be cancelled, so everything in the payload will
  land as stated. Orders sent after minting (mostly priority ones) can still land in the window.
  That uncertainty is created by front-runners, and it's intended.
- `window_end` (or the last listed land tick) is the expiry. After that the Leak is worthless.

**Ownership:**

- `Auction` → `bid` → `Owned` (sealed; no reader).
- `Owned` → `list_leak` → `Listed` → `buy_listed` → `Owned` by the buyer (chips go to the seller;
  `flips++`).
- `Owned` → `open_leak` → `Opened`: members become exactly `[owner key]`. It can't be listed
  again.
- A Leak never opened has never had a reader. That's the "sealed" guarantee, visible in the
  permission history.
- At most 2 unopened Leaks per seat.

### 5.6 Seats and burner keys

- 8 seats, 5 of them bots by default. `claim_seat` takes a free seat or the bot seat idle
  longest; displaced bots spectate until a seat frees up.
- A seat is idle once `last_seen_tick` is more than 60 ticks old. Clients send heartbeats with
  `ping`.
- Names come from a fixed list, picked by hashing the key (no free text onchain).

### 5.7 Scoring, season and stakes

- Round score = equity − 1,000, which already includes fills, fees, Leak spend and flip income.
- `finish_round` folds scores into `Season.top`. `commit_season` commits every 5 rounds.
- **Stake mode (P2):** a devnet test mint through Ephemeral SPL eATAs. The top 3 by round score
  split the pot (50/30/20) with private visibility via the Private Payments API. If cut,
  chips-only is the shipped product and the README says so.

### 5.8 Sandwich tags (X-ray)

`finish_round` tags a **sandwich** when seat `F` has a priority order landing before a standard
order of seat `V` on the same side, then an opposite order from `F` landing within 6 ticks after
`V`'s, and `F` opened a Leak containing `V`'s order. Tags carry `(F, V, profit_estimate)` and the
UI draws them as arrows. Tagging is computed onchain, so the X-ray can't be edited.

## 6. Private state design (PER)

| Account         | Readers during play                   | How it changes                                                                       |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `Mempool`       | nobody (no member / `nobody` PDA)     | Written by `send_order`, `round_seed_callback` and `tick`; read by program code only |
| `LeakVault`     | nobody while sealed; owner after open | `open_leak` → `UpdateEphemeralPermissionCpi` members = [owner]                       |
| everything else | public                                | n/a                                                                                  |

- Program code reads and writes private accounts freely inside the TEE. Permissions gate **RPC
  reads** (verified in Phase 2: the VRF callback read and rewrote a private account).
- `send_order` transactions touch the private Mempool, so their messages and logs must be gated
  too (§4, item 1). `send_order` emits no logs. The public trace is the `SendEvent` written to
  `Tape` (seat, lane, tick).
- `finish_round` publishes the past round's orders and payloads into `Xray` and resets vault
  members. It never flips a permission from public back to private.
- Clients read an opened Leak through the TEE login challenge (`scripts/src/lib/tee.ts`): sign
  with the burner key, then `getAccountInfo(LeakVault)` with the token.
- **The two-browser test** (demo and integration test): A opens a Leak and reads it. B, and an
  anonymous call, get "account not returned" for the vault and the Mempool, and nothing useful
  from A's order transactions.

**Trust model, stated plainly:** privacy relies on MagicBlock's TEE (Intel TDX). Bot keys sit in
the bot service, which can only read Leaks its bots opened. The bot service never sees the
Mempool. Executed fills and positions are public by design.

## 7. VRF flows

1. **Round seed** (once per round): whale schedule and noise seed.
2. **Leak drop** (8 per round): rarity, kind, Flow window offset.
3. Both callbacks declare the scoped VRF identity with a compile-time constant (the Phase 2 fix
   for the 270k CU cost on SDK 0.18) and check `request_id`. A late callback after `cancel_vrf` is
   rejected.

## 8. Cranks and keeper

- `schedule_ticks` arms a finite crank (for example 7,200 iterations = 1 hour). Cancel doesn't
  work on the TEE (Phase 2 D); the keeper re-arms before it runs out.
- `tick` is idempotent per tick index, accepts the crank signer PDA or the keeper, and executes at
  most 12 orders per tick (overflow carries to the next tick in `seq` order).
- The keeper (bot service) calls `tick`, `request_drop`, `request_round_seed` and `finish_round`
  when they're due and the crank hasn't. All of these are permissionless and time-gated.

## 9. Off-chain components

### 9.1 App (`app/`)

| Route    | Screen                                                                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`      | Landing: hero, one-line pitch, **Play**, live table preview                                                                                                                  |
| `/table` | Trading floor: chart with landing markers, seat rail with lane tells, ghost-order lane (your pending orders), Leak board, order panel (side, size, lane), opened Leaks, feed |
| `/xray`  | The last round's replay with sandwich arrows (also inline during `Xray`)                                                                                                     |
| `/proof` | Live links: program, delegation, latest VRF and permission txs, the two-browser test                                                                                         |

Client modules in `app/src/lib/`: `connection.ts`, `program.ts` (typed client from
`idl/insider.json`), `burner.ts`, `tee-auth.ts`, `table.ts` (websocket subscriptions to public
accounts), `vamm.ts` (price-impact preview, the same math as the program).

UI requirements: 2 Hz updates without jitter; your own pending orders shown locally (from the
client's memory, never from chain); the crack-open animation; a 16:9 recording mode;
`prefers-reduced-motion` support.

### 9.2 Bots (`bots/`)

| Persona          | Strategy                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Front-runner** | Buys Spotlight and Full Book Leaks, opens them, priority-sends ahead of big pending orders, exits after they land           |
| **Baiter**       | Sends large standard orders, then a priority order the other way just before they land                                      |
| **Flipper**      | Buys sealed Leaks at the mid price, lists at +40%, opens only if unsold after 6 ticks                                       |
| **Copycat**      | Never buys Leaks. Mirrors the side of whoever just used the priority lane after opening a Leak (inferred from public fills) |
| **Flow**         | Steady medium-size standard orders from a momentum rule, so the mempool always has something to leak                        |

- Each bot has its own keypair and TEE token and reads only Leaks it opened.
- One decision every 2 ticks at most, with random delay and size jitter, so the bots are
  beatable.

## 10. Repository layout

```
insider/
  programs/insider/   Anchor program: table, mempool, vAMM, leaks, math, VRF, PER, cranks
  app/                Next.js app
  bots/               Bot strategies and keeper
  scripts/            setup-table, simulate-round, darkcheck, proof index, Phase 2 lab scripts
  tests/              Integration tests
  idl/                Generated IDL
  docs/               Phase 2 findings and devnet proofs
```

The Phase 2 `spike_*`, `lab_*` and `slot_*` instructions stay until the table instructions replace
them, then move behind a `lab` cargo feature so the proofs stay reproducible.

## 11. Testing plan

- **Unit (LiteSVM / `cargo test`):** vAMM fills and fees (no overflow; buy then sell returns less
  than the start); order maturity ordering (`land_tick`, then `seq`); lane delays and fees;
  position, order-size and pending limits; Leak payloads match the Mempool for each kind; Dutch
  curve; ownership transitions (can't list opened; can't bid on own; hoard limit); phase gating
  (no orders in `Closing`); sandwich tagging; `tick` idempotence; VRF callbacks only from the VRF
  program.
- **`pnpm darkcheck` (devnet TEE, day 1):** the §4 item 1 test. Key A sends orders; key B and an
  anonymous client try `getTransaction`, `getSignaturesForAddress`, logs subscriptions and
  account reads. Output goes into `docs/proofs`.
- **`pnpm simulate-round` (devnet):** setup → seed → orders → 8 drops → bids, flips, opens →
  front-run → Xray → commit, printing every explorer link.
- **Bot soak:** five bots, no humans, for 30 minutes: no stuck phase, crank re-armed, mempool
  never overflows.

## 12. Deployment

- Program on Solana devnet (ID above). The table is set up once by `scripts/setup-table.ts`.
- App on Vercel. The bots and keeper on an always-on host (Railway/Fly), so the table is live
  whenever a judge opens the link.
- A dedicated devnet RPC for base reads (the public RPC rate-limits, Phase 2 notes).
- Secrets only in `.env` and host env vars. `.env.example` is committed.

## 13. Security and fairness

- `#[vrf_callback]` plus a `request_id` match on both callbacks.
- No cancels and no authority write path to the Mempool, payloads, prices or scores.
- `send_order` prints no logs and the client never puts order details in memos.
- Every mutating instruction checks phase and tick.
- Seat actions need the seat owner's signature; crank-only paths check the crank signer PDA.
- Checked integer arithmetic only.
- Known limitations, documented: TEE trust; bot keys held by the service; devnet test token; a
  vAMM market by design.

## 14. Proof checklist for reviewers (to fill with links)

- [ ] Program ID on devnet
- [ ] Table delegation transactions to the TEE validator
- [ ] `darkcheck` output: an order tx is unreadable to a second key
- [ ] Round seed and Leak drop VRF requests and callbacks
- [ ] `open_leak` permission update, and a failed read from a second key
- [ ] Rollup orders and fills (sample)
- [ ] Season commit to base
- [ ] (P2) Private payout transaction
- [ ] Live app URL and a recorded round

## 15. Scope and cut order (deadline Nov 27, 9:00 AM EST = 14:00 UTC)

| Priority | Scope                                                                                                                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**   | `darkcheck`; Table/Market/Mempool/Tape/Seats; vAMM; `send_order` with two lanes; `tick` maturity; round seed VRF (whales); Leak drop VRF (Flow, Spotlight); bid; open (permission); Xray; burner seats; 3 bots (Front-runner, Flow, Baiter); trading-floor UI; deploy |
| **P1**   | Whale and Full Book Leaks; flip (list / buy_listed); Copycat and Flipper; sandwich tags and arrows; `/proof`; season commit                                                                                                                                           |
| **P2**   | Stake mode with Private Payments; SOAR; mobile layout                                                                                                                                                                                                                 |

Cut from the bottom up. Never cut `darkcheck`, the two-browser test, or the X-ray, because the
demo depends on them.

| Day    | Goal                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------- |
| Nov 22 | Docs; **`darkcheck` on the TEE (decides v0.3 or the v0.2 fallback)**; `math.rs` (vAMM) tests    |
| Nov 23 | Table accounts; `send_order`; `tick` maturity; seed VRF; Leak drop, bid, open; `simulate-round` |
| Nov 24 | App: trading floor, ghost orders, Leak cards, crack-open, X-ray; burner seats                   |
| Nov 25 | Bots and keeper deployed; app deployed; soak test; P1 items                                     |
| Nov 26 | Record rounds; video; README proofs                                                             |
| Nov 27 | Submit by 08:00 UTC (6 h buffer); post the X clip                                               |

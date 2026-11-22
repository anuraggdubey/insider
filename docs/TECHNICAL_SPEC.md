# INSIDER: Technical Specification

Version 2.0 (combined: Dark Mempool + Leak Exchange). This spec is the contract between the two
work streams in [STEPS.md](STEPS.md).

**How we handle risk.** There are no workaround code paths. Everything here is either (a) proven by
a Phase 2 lab experiment on devnet, or (b) behind a numbered **gate** (section 4) that runs in the
first work block. A gate that fails removes its feature from the scope and from every doc. The
design is built so that every removal leaves a complete product.

## 1. Principles

1. **Players make the hidden information.** Pending orders are the main secret. A VRF-written
   future is the second.
2. **The table never leaves the rollup.** All gameplay accounts are delegated once to the TEE
   validator. Cranks and seat-signed requests run the game, so no keeper is needed to play.
3. **Privacy only where it carries weight.** Private: pending orders, the future, sealed Leak
   contents, open Call contents. Public: executed fills, positions, prices, Leak ownership, and
   _who_ sent an order in _which lane_. Public behaviour is what makes the game social.
4. **Read access is the asset.** Owning, licensing or authoring information means being on a
   permission's member list. Every ownership change is a permission update.
5. **Nothing is mocked.** Every claim has code, a test and a devnet transaction.
6. **The operator has no power over play.** No instruction lets the authority read or write the
   mempool, the future, a Leak, a Call, a price or a score.
7. **Clock-derived, idempotent automation.** Cranks can fire late, twice or from a stale task; state
   is derived from time and tick, not from call counts.
8. **No cancels.** A sent order is a commitment. That keeps Flow Leaks honest.

## 2. Stack

| Layer          | Choice                                                                                                    | Notes                                           |
| -------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Program        | Rust, Anchor CLI 1.2.2, `anchor-lang` 1.2.2                                                               | Pinned                                          |
| MagicBlock SDK | `ephemeral-rollups-sdk` 0.18.0 (`anchor`, `vrf`, `access-control`, `crank`)                               | 0.20 is validator-2.0-only                      |
| Typed client   | `sdk/` (TypeScript)                                                                                       | Single source of truth for the app and the bots |
| Frontend       | Next.js (App Router), TypeScript, Tailwind, Framer Motion, `lightweight-charts`                           | Read `app/AGENTS.md`                            |
| Client libs    | `@solana/web3.js` 1.x, `@anchor-lang/core`, `@magicblock-labs/ephemeral-rollups-sdk` 0.18, wallet-adapter |                                                 |
| Bots / AI      | TypeScript service, Anthropic API                                                                         | One keypair per bot                             |
| Tests          | LiteSVM for program logic, devnet scripts for rollup behaviour, Vitest for the SDK                        |                                                 |

Phase 2 environment facts: public devnet ERs and the TEE run validator 1.x; growing the program
needs `solana program extend`; `anchor build` crashes on Windows (use `pnpm program:build`).

## 3. Architecture

```
 Browser (guest key or wallet + session key)        Bot service (Node)
 - trading floor, ghost orders, Desk, X-ray         - 5 strategy bots, 2 AI analysts
 - TEE auth token per key                           - commentary desk (LLM)
        |                                                   |
        |      rollup transactions via sdk/ (Magic Router + TEE RPC)
        v                                                   v
 +----------------------------------------------------------------------+
 |  MagicBlock TEE rollup (devnet-tee)                                   |
 |  public : Table, Market[2], Tape, Board, Seat[10], Xray, CallBook     |
 |  private: Mempool, Future, LeakVault[6], CallVault[10] (permissions)  |
 |  VRF    : one request per round (ephemeral oracle queue)              |
 |  Cranks : 500 ms tick (maturity, arbitrage, drops, auctions)          |
 |  Oracle : SOL/USD feed read inside the rollup (Desk)                  |
 +--------------------------+-------------------------------------------+
                            | epoch commit + Magic Action
                            v
 +----------------------------------------------------------------------+
 |  Solana devnet: program, delegation, Season, SOAR, Private Payments   |
 +----------------------------------------------------------------------+
```

Endpoints and programs (devnet): router `https://devnet-router.magicblock.app`; TEE
`devnet-tee.magicblock.app` (validator `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`); Permission
program `ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1`; Delegation program
`DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`; ephemeral VRF queue
`5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc`. The game gets a **new program ID**. The lab
program `5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ` stays deployed so the Phase 2 proofs remain
valid, and its source is tagged `phase-2-lab`.

## 4. Gates

Proven in Phase 2 (see `docs/proofs`): delegate and settle (6 delegates per transaction, at most 8
accounts per commit intent), VRF in the TEE, private permissions, atomic permission rewrite from a
VRF callback, finite cranks on the TEE, immediate revocation.

Everything else is a gate. Each is a script in `scripts/src/gates/`, a row in `docs/gates.md` with
transaction links, and a decision written into this spec. **G0 runs first** because it decides the
shape of the Floor.

| Gate                                 | Question                                                                                                                                                                                         | Pass means                                        | Fail means (scope rule)                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **G0 Darkcheck**                     | A `send_order` writes side and size into the private `Mempool`. Can a non-member recover them from `getTransaction`, `getSignaturesForAddress`, logs subscriptions, simulation or account reads? | Dark mempool, lanes and the Flow family are in    | **Remove the Flow family and the lanes.** Orders execute immediately and the Fundamentals market ships as the complete product |
| **G1 Clock**                         | How many slots or milliseconds does the TEE advance per 500 ms, and how precise is `Clock`?                                                                                                      | We derive `tick = f(clock)` with under 10% jitter | Not a cut: the measured value becomes `SLOTS_PER_TICK`                                                                         |
| **G2 Keyless reader**                | Is an account private with a keyless PDA (`["nobody"]`) as its only member unreadable by everyone?                                                                                               | Used for `Mempool`, `Future` and sealed vaults    | Not a cut: use an empty member list (same test)                                                                                |
| **G3 Zero-balance key**              | Can a key with 0 SOL sign on the TEE?                                                                                                                                                            | Guest onboarding needs no funding                 | Guests get one treasury transfer of 0.01 SOL at seat claim                                                                     |
| **G4 Oracle in the TEE**             | Can a program read a fresh SOL/USD feed inside the TEE?                                                                                                                                          | The Desk is in                                    | The Desk is cut                                                                                                                |
| **G5 Private Payments**              | Do deposit, private transfer and withdraw work on devnet-tee with a platform fee account?                                                                                                        | Alpha Cup is in                                   | Alpha Cup is cut (chips only)                                                                                                  |
| **G6 Magic Action + SOAR**           | Can a post-commit action update a SOAR leaderboard on the base layer?                                                                                                                            | Achievements are in                               | Achievements are cut                                                                                                           |
| **G7 Session keys**                  | Do session keys work with our program on the TEE?                                                                                                                                                | Wallet identity is in                             | Guest keys only                                                                                                                |
| **G8 Epoch cycle**                   | Can `Season` be committed and undelegated, then re-delegated, repeatedly?                                                                                                                        | The epoch design stands                           | Season commits become one-shot and cadence is reduced                                                                          |
| **G9 Duplicate cranks**              | If two crank tasks run the same tick, is state still correct?                                                                                                                                    | Idempotent ticking confirmed                      | Not a cut: make `tick` strictly time-gated                                                                                     |
| **G10 Crank-invoked VRF** (optional) | Can a crank-scheduled instruction request VRF?                                                                                                                                                   | Per-drop VRF becomes an enhancement               | Nothing changes: drops stay derived from the round seed                                                                        |

Also in the first block: the browser fee-payer question (G3) and a 10-account intent is never tried
again (Phase 2 showed it hangs).

### 4.1 Gate results (Block 0, devnet)

Run with `pnpm gates`; transactions and raw data are in [gates.md](gates.md) and
`docs/proofs/gates/`. 9 pass, 2 are informational, none is cut.

| Gate | Result   | What it means for the build                                                                                                                                                                                                                              |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | **pass** | The dark mempool, lanes and the Flow family stay. A non-member or anonymous caller gets a transaction back with its instructions and logs emptied, and no account, signature, block, simulation or subscription path returned the order.                 |
| G1   | **pass** | `SLOTS_PER_TICK = 50`: the TEE runs 100 slots per second, so a 500 ms tick is 50 slots with 1.5% jitter. `unix_timestamp` is whole seconds, so ticks are derived from the slot.                                                                          |
| G2   | **pass** | `["nobody"]` (a keyless PDA) as the only member makes an account unreadable to everyone, including the authority, while program code keeps writing. An empty member list does the same.                                                                  |
| G3   | **pass** | A brand-new key with 0 SOL signs and pays its own transactions on the TEE. Guests need no funding and no treasury transfer.                                                                                                                              |
| G4   | **pass** | The Desk is in. The SOL/USD feed (`ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu`, owner `PriCems...`) is on the TEE and fresh. Decode it by layout and take the exponent (-8) from the feed list, not the account.                                       |
| G5   | **pass** | Alpha Cup is in: deposit, private transfer and withdraw work on `devnet-private`, the platform fee account receives its fee, and another wallet's token cannot read a private balance. Run buy-ins and payouts as deposit, in-rollup transfer, withdraw. |
| G6   | **info** | Magic Action works (a post-commit action ran our base-layer instruction, paid from a funded escrow). The SOAR leaderboard call is untested: achievements stay undecided until task A-4.2.                                                                |
| G7   | **pass** | Session keys are in. A zero-SOL session key signs gameplay for a wallet, wrong signers and missing tokens are rejected, the wallet still works directly, and revocation takes effect within seconds.                                                     |
| G8   | **pass** | `Season` was committed, undelegated and re-delegated three times in a row with the right value on base each time. The epoch design stands.                                                                                                               |
| G9   | **pass** | Two crank tasks on the same cadence made 20 calls but only 10 effective ticks. A tick gated on elapsed slots is idempotent.                                                                                                                              |
| G10  | **info** | A crank-scheduled VRF request is rejected at schedule time ("Account is immutable"). Per-drop VRF is not available; drops stay derived from the one round seed that a signing seat requests.                                                             |

Findings that shape the code:

1. **Read access is evaluated when the read happens.** After a permission was closed, an old
   transaction became readable to everyone. So the `Mempool` and `Future` permissions are never
   closed or made public while their history matters; only `teardown` removes them.
2. **What stays public:** who signed, which accounts a transaction touched and its signature. That is
   the `SendEvent` we already treat as public; the order itself is the secret.
3. **A session key must not be writable in the instruction** (`Transaction loads a writable account
that cannot be written`): the session signer is a plain signer, and a funded key pays the fee.
4. **A Magic Action handler's account order is** `[...accounts, source_program, escrow_auth,
escrow]`, with `escrow` required to be a signer, and the escrow (a PDA of the delegation
   program) must be topped up on the base layer first.
5. **Zero-copy for big accounts.** A 1.8 KB account deserialised the normal way overflows the 4 KB
   SBF stack frame, so `CallBook` is zero-copy and `init` runs in one instruction per big account.

## 5. Accounts

All created on the base layer at setup, delegated once (6 per transaction, 1.4M compute limit), and
reused every round. Sizes are fixed, so there is no realloc inside the rollup. `Season` is
delegated separately (epoch cycle).

| Account     | Seats / count | Visibility              | Summary                                                                                                                                                |
| ----------- | ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Table`     | 1             | public                  | authority, epoch, round_id, phase (`Idle`/`Seeding`/`Live`/`Closing`/`Xray`), round_start, tick, armed_until, vrf_nonce, vrf_pending, params           |
| `Market`    | 2             | public                  | kind 0 = Floor (vAMM `base`, `quote`, price 1e6, `history: [u32; 192]`), kind 1 = Desk (oracle mark)                                                   |
| `Mempool`   | 1             | **private, keyless**    | `orders: [PendingOrder; 48]`, next_seq, whale schedule, drop schedule                                                                                  |
| `Future`    | 1             | **private, keyless**    | round_id, `path: [u32; 192]` (fundamental price per tick)                                                                                              |
| `Tape`      | 1             | public                  | `sends` ring (seat, lane, sent_tick), `fills` ring (seat, side, size, price, landed_tick)                                                              |
| `Board`     | 1             | public                  | `headers: [LeakHeader; 6]`, drop_index                                                                                                                 |
| `LeakVault` | 6             | **private**             | leak_id, kind, minted_tick, payload (up to 32 orders x 8 bytes, or a 16-byte Fundamentals payload)                                                     |
| `Seat`      | 10            | public                  | owner key, name_idx, seat_kind (Bot/Ai/Human), chips, position, entry, fees_paid, leak_spend, pending_count, desk_chips, desk_position, last_seen_tick |
| `Xray`      | 1             | public                  | last round's full order log (sent, landed, side, size, seat), Leak payloads and holders, sandwich tags                                                 |
| `CallBook`  | 1             | public                  | `headers: [CallHeader; 10]` (one Call per seat)                                                                                                        |
| `CallVault` | 10            | **private**             | direction, confidence                                                                                                                                  |
| `Season`    | 1             | public, epoch-committed | top-20 scores, per-seat analyst stats, rounds_played                                                                                                   |

`PendingOrder` (8 bytes): `seat: u8` (255 = whale), `side_size: i16` (signed units), `lane: u8`,
`land_tick: u16`, `seq: u16`.

`LeakHeader` (public): leak_id, kind, rarity, window_start, window_end, minted_tick, state
(`Empty`/`Auction`/`Owned`/`Listed`/`Opened`/`Expired`), auction_start, start_price, floor_price,
owner_seat, ask, license_ask, `readers: [Pubkey; 4]`, flips, opened_tick.

`CallHeader` (public): call_id, author_seat, minted_ts, minted_price, horizon_secs, expiry_ts,
stake, license_ask, `readers: [Pubkey; 4]`, state (`Empty`/`Open`/`Right`/`Wrong`), revealed_dir.

**Totals:** 35 delegated gameplay accounts (6 delegation transactions) plus `Season`; 18
permissions (`Mempool`, `Future`, 6 Leak vaults, 10 Call vaults); teardown uses 5 intents of at most
8 accounts.

## 6. Time, rounds and automation

- **Clock-derived ticks (G1).** `tick = (now - round_start) / TICK` from the rollup clock. The
  `tick` instruction processes every missed tick up to the derived one in order (at most 8 per
  call), so late or duplicate cranks are harmless.
- **Round loop (about 110 s):** `Idle -> Seeding -> Live (ticks 0-159) -> Closing (160-179) -> Xray
(20 ticks) -> Idle`. Live accepts orders. Closing drains the mempool and, at tick 180, every
  position closes at the last price.
- **Who starts a round.** `request_round_seed` is callable by any seat when the table is `Idle`.
  Bots sign it so the table never idles, and a human click does the same if the bot service is
  down. Only a signing seat ever requests VRF, so no crank signs a VRF request.
- **One VRF request per round.** Its 32-byte output seeds a PRNG that fills the future path, the
  3-5 whale orders (side, 1,500-3,000 units, land ticks 30-170) and the whole Leak drop schedule
  (kind, rarity, window per drop). Drops are computed at their tick from the live private state.
  (G10 may later add per-drop VRF as an enhancement.)
- **Cranks.** `schedule_ticks` arms a finite task (`armed_until`). `rearm_ticks` is permissionless
  once `tick > armed_until - 600`, so any seat keeps it alive (cancel is unavailable on the TEE,
  Phase 2 D). A second crank runs `settle_due` for Desk Calls every second.
- **Epoch.** An epoch is 10 rounds. At its end the operator calls `commit_epoch`
  (commit-and-undelegate `Season`, fire the Magic Action) and `open_epoch` (re-delegate). The table
  accounts stay delegated. This keeps every account below the 10-commit limit and produces real
  delegations, which MagicBlock counts.

## 7. The Floor

### 7.1 Market: anchored vAMM

- Constant product with virtual reserves `base = 50,000` units and `quote = 50,000` chips (price
  1.00), reset every round. An order of `s` units fills at the vAMM's average price for `s` plus a
  0.1% fee. A 2,000-unit buy moves the price about 8.5%.
- **Fundamental path.** `Future.path[t]` is the true value (fixed-point 1e6, `xorshift128+`,
  around 1.00): two volatility regimes, 2-4 shocks of 3-8% over 3-6 ticks after tick 20, clamped to
  [0.5, 2.0].
- **Arbitrage pull.** After executing orders each tick, the price moves `ARB_PCT` (start 4%) of the
  gap toward `path[tick]` by rebalancing the reserves at constant product (integer sqrt). Flow
  pushes the quote away from fundamentals and arbitrage pulls it back, so a push lasts about 17
  ticks. This is the source of alpha decay: it is emergent, with no hand-written decay rule.
- **Limits:** at most 2,000 units per order, absolute position of at most 5,000 units (5x leverage
  on the 1,000-chip bankroll), at most 4 pending orders per seat. A seat whose equity reaches 0 is
  liquidated at the next tick and sits out the round.
- Integer math only: prices in fixed point 1e6, `u128` intermediates, checked operations.

### 7.2 Orders and the dark mempool

- `send_order(side_size, lane)` pushes a `PendingOrder` into the private `Mempool`. **Standard**
  lands at `tick + 20`, **priority** at `tick + 4` for a fee of 10 chips. It writes a public
  `SendEvent` (seat, lane, tick) to `Tape` and **emits no logs**.
- `tick` executes every order with `land_tick == tick` in `seq` order against the vAMM (at most 12
  per tick, overflow carries to the next tick in `seq` order) and records a public `Fill`.
- Whale orders live in the mempool like any other order, so there is always flow to leak.

### 7.3 Leaks

Drops at ticks 10, 30, ..., 150 (eight per round; at most four live at once).

| Rarity | Weight | Family and kinds                                      | Start / floor | Auction  |
| ------ | ------ | ----------------------------------------------------- | ------------- | -------- |
| Common | 65%    | Flow: `Flow`. Fundamentals: `Pin`, `Drift`            | 60 / 5        | 12 ticks |
| Rare   | 30%    | Flow: `Spotlight`, `Whale`. Fundamentals: `Shockwave` | 120 / 10      | 12 ticks |
| Epic   | 5%     | Flow: `Full Book`. Fundamentals: `Summit`             | 200 / 20      | 12 ticks |

Price at tick `t` = `start - (start - floor) * (t - auction_start) / 12`. An unsold Leak at the
floor expires. The 12-tick auction is shorter than the 20-tick standard delay, so a Leak bought at
any point still shows orders that haven't landed. (Prices are starting values for gate E1.)

| Kind        | Payload (accurate as of `minted_tick`)                                                 |
| ----------- | -------------------------------------------------------------------------------------- |
| `Flow`      | Net signed units and order count landing in a 10-tick window starting 2-12 ticks ahead |
| `Spotlight` | The largest non-whale pending order: seat, side, size, land_tick                       |
| `Whale`     | The next whale order in the next 60 ticks: side, size, land_tick, or "none"            |
| `Full Book` | Every pending order (up to 32): seat, side, size, land_tick                            |
| `Pin`       | Fundamental price at a target tick 10-30 ticks ahead                                   |
| `Drift`     | Fundamental direction and size bucket (<1%, 1-3%, >3%) over 20-40 ticks                |
| `Shockwave` | Whether a fundamental shock hits in the next 40 ticks, its tick and sign               |
| `Summit`    | Fundamental high and low and their ticks over the next 60 ticks                        |

Payloads are computed by the program from `Mempool` or `Future`. A Leak can't be false. Orders sent
after minting (mostly priority orders) can still land in a Flow window. That uncertainty is created
by front-runners, and it is intended. `window_end` is the expiry.

### 7.4 Ownership, flipping and licensing (permission edits)

| Action                          | Who                                | Effect                                                                             |
| ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| `bid`                           | any seat                           | `Auction -> Owned`; pays the current Dutch price; members stay `[nobody]` (sealed) |
| `list_leak` / `buy_listed`      | owner / any seat                   | Sealed resale; ownership moves; flips +1; still unread                             |
| `open_leak`                     | owner                              | Members become `[owner]`; state `Opened`; can't be resold (it has been read)       |
| `offer_license` / `buy_license` | owner of an opened Leak / any seat | Buyer pays the owner; members gain the buyer (max 4 readers)                       |

A seat holds at most 2 unopened Leaks. A Leak never opened has never had a reader, which is
provable from `readers` and the permission history.

### 7.5 X-ray and sandwich tags

`finish_round` (anyone, during Xray) copies the order log and every Leak payload into `Xray`, tags
sandwiches, clears vault members, scores into `Season` and resets seats. A **sandwich** is tagged
when seat `F` has a priority order landing before a standard order of seat `V` on the same side,
then an opposite order from `F` within 6 ticks after `V`'s, and `F` opened a Leak containing `V`'s
order. Tags carry `(F, V, profit_estimate)`. They are computed on chain, so the X-ray can't be
edited. It never flips a permission from public back to private.

Round score = equity - 1,000 chips (fees, Leak spend, flip and license income included).

### 7.6 Seats

- 10 seats: 0-4 bots (a human may displace the bot idle longest), 5-6 AI analysts (protected),
  7-9 human-first. `claim_seat` takes a free seat or a displaceable bot seat. A seat is idle after
  60 ticks without `ping`, `send_order` or a trade.
- Names come from a fixed list picked by hashing the key (no free text on chain).

## 8. The Desk (oracle-settled Calls)

- **Mint.** `mint_call(direction, horizon, stake, license_price)` reads the SOL/USD feed (G4),
  stores `minted_price` publicly, keeps direction private. One open Call per seat. Horizons: 60,
  120 or 180 s.
- **License.** `buy_call_license` adds the buyer to the Call's readers (max 4) and pays the author.
- **Settle.** A crank runs `settle_due` every second: for each due Call it reads the oracle,
  decides Right or Wrong, reveals the direction by making the Call public, returns stake plus a
  bonus on Right or burns it on Wrong, and updates the author's stats in `Season`.
- **Desk market.** `desk_trade` trades the oracle price with the same fill engine (marked to the
  oracle, no arbitrage). Licensees act on a Call there.
- **Track record** (public, on chain): calls, hits, hit rate, streak, profit.

Desk chips are a separate balance credited each epoch. Nothing on the Desk depends on the Floor,
so each can be cut or demoed alone.

## 9. Money, identity and achievements

- **Guest identity.** A browser key claims a seat (G3 decides funding). Guests play chips only.
- **Wallet identity (G7).** A wallet creates a session key; the rollup accepts it for
  `send_order`, `bid`, `open_leak`, `list_leak`, `buy_*`, `offer_license`, `mint_call`, `ping`.
  Wallet seats appear on the leaderboard under their key and can enter the Alpha Cup.
- **Alpha Cup (G5).** Humans buy in with a devnet test token through the Private Payments API. At
  the end of each cup (5 rounds) the top 3 human seats are paid 50/30/20 with private transfers.
  Bots and AI can't win prizes. The app takes a platform fee into a fee-vault account listed in
  our submission. Payouts are signed by the operator wallet from the epoch Magic Action.
- **Magic Action + SOAR (G6).** `commit_epoch` attaches a post-commit action that updates the SOAR
  leaderboard and unlocks achievements: _Sealed Seer_ (flip a Leak that was never opened),
  _Sandwich_ (be the front-runner in a tagged sandwich), _Alpha Decay_ (license a Leak and still
  profit), _Clean Hands_ (win a round without opening anything), _Oracle_ (5 correct Calls in a row).

## 10. Economic model and gate E1

`programs/insider/tests/economics.rs` runs the engine against
scripted agents with a fixed seed set (thousands of rounds, deterministic):

| Agent          | Behaviour                                                          |
| -------------- | ------------------------------------------------------------------ |
| Blind          | Never buys a Leak, trades momentum                                 |
| Front-runner   | Buys Flow Leaks, opens, priority-sends ahead of big pending orders |
| Fundamentalist | Buys Fundamentals Leaks, opens, trades the content                 |
| Hoarder        | Buys every Leak at the floor and opens all                         |
| Flipper        | Buys sealed at mid price, lists at +40%                            |
| Crowd          | Three informed agents on the same Leak                             |

**E1 passes when:** (1) informed agents beat Blind by a clear margin but never by more than 3x
bankroll per round; (2) Hoarder earns less than the selective informed agents (no free-money
button); (3) edge per reader falls as readers grow (decay is real); (4) the Dutch auction clears
between 25% and 75% of the start price on average; (5) liquidations happen in under 5% of
seat-rounds; (6) the Flow family and the Fundamentals family each earn a profit for a selective
buyer, so neither is dominated. These are Rust tests, so parameter changes can't
regress them.

## 11. Instructions

| Group        | Instructions                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Setup (base) | `init_table`, `init_slots`, `delegate_batch`, `init_permissions` (rollup), `open_epoch`, `commit_epoch` |
| Automation   | `schedule_ticks`, `rearm_ticks`, `tick`, `schedule_settle`, `settle_due`                                |
| Round        | `request_round_seed`, `round_seed_callback`, `cancel_vrf`, `finish_round`                               |
| Seats        | `claim_seat`, `ping`, `send_order`                                                                      |
| Leaks        | `bid`, `open_leak`, `list_leak`, `buy_listed`, `offer_license`, `buy_license`                           |
| Desk         | `mint_call`, `buy_call_license`, `desk_trade`                                                           |
| Money (G5)   | `cup_join`, `cup_settle`                                                                                |
| Recovery     | `request_undelegation` (CPI to the Delegation program's rollback path), `teardown`                      |

Every mutating instruction checks phase and tick, requires the seat owner's signature or a valid
session key, and uses checked integer math. Crank-only instructions check the crank signer PDA
(`["crank-executor", authority]` under `Crank11111111111111111111111111111111111111`).

## 12. VRF

One `request_round_seed` per round; `round_seed_callback(randomness)` fills the future, whale and
drop schedules. The callback declares the scoped VRF identity as a compile-time constant (the Phase
2 fix for the 270k-CU `const fn` cost on SDK 0.18), carries a `request_id`, and has a `cancel_vrf`
path after 10 ticks of silence. Each request is a real, organic VRF request from our program, which
MagicBlock counts.

## 13. Private state (PER)

| Account             | Readers during play                                   | How it changes                                               |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `Mempool`, `Future` | nobody (`nobody` PDA)                                 | Written by program code only; read by program code only      |
| `LeakVault`         | nobody while sealed; owner (and licensees) after open | `open_leak`, `buy_license` -> `UpdateEphemeralPermissionCpi` |
| `CallVault`         | the author, then licensees                            | `mint_call`, `buy_call_license`; made public at settlement   |
| everything else     | public                                                | n/a                                                          |

- Program code reads and writes private accounts freely inside the TEE; permissions gate **RPC
  reads** (verified in Phase 2).
- `send_order` touches the private `Mempool`, so its message and logs must be gated too (G0).
  `send_order` emits no logs; the public trace is the `SendEvent`.
- Clients read an opened Leak with the TEE login challenge (`scripts/src/lib/tee.ts`).
- **The two-browser test:** A opens a Leak and reads it. B, and an anonymous call, get "account not
  returned" for the vault and the mempool, and nothing useful from A's order transactions.

**Trust model, stated plainly:** privacy relies on MagicBlock's TEE (Intel TDX). Bot keys sit in the
bot service, which only reads Leaks its bots opened and never the mempool. Fills and positions are
public by design.

## 14. AI Desk

- **Analysts.** Two AI seats own keys, mint Calls through the SDK like anyone else, and are judged
  by the oracle. Their prompts see public market data only.
- **Commentary.** A service turns public events (sends, fills, drops, opens, flips, licenses,
  X-ray sandwiches, settled Calls) into short live captions for the broadcast view and share
  cards. It reads no private account.
- If the API is unreachable the analysts simply don't mint and captions pause. Nothing on chain
  depends on them.

## 15. Bots (`bots/`)

| Persona          | Strategy                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Front-runner** | Buys Spotlight and Full Book Leaks, opens them, priority-sends ahead of big pending orders, exits after they land           |
| **Baiter**       | Sends large standard orders, then a priority order the other way just before they land                                      |
| **Flipper**      | Buys sealed Leaks at the mid price, lists at +40%, opens only if unsold after 6 ticks; also licenses opened Leaks           |
| **Copycat**      | Never buys Leaks. Mirrors the side of whoever just used the priority lane after opening a Leak (inferred from public fills) |
| **Flow**         | Steady medium-size standard orders from a momentum rule, so the mempool always has something to leak                        |

Each bot has its own keypair and TEE token and reads only Leaks it opened. One decision every 2
ticks at most, with random delay and size jitter so bots stay beatable. Bots also sign
`request_round_seed` and `rearm_ticks`.

## 16. App (`app/`)

| Route           | Screen                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | Landing: sealed-card hero, one-line pitch, **Play**, live table preview                                                                                                       |
| `/table`        | Floor: chart with landing markers, seat rail with lane tells, ghost-order lane (your pending orders), Leak board, order panel (side, size, lane), my Leaks and licenses, feed |
| `/desk`         | Call board, analyst leaderboard, license flow, oracle chart                                                                                                                   |
| `/xray/[round]` | X-ray replay with sandwich arrows, and the share card                                                                                                                         |
| `/watch`        | Broadcast view: auto-camera, live captions, no controls                                                                                                                       |
| `/proof`        | Live links: program, delegation, VRF, permission and payment transactions; the two-browser test                                                                               |
| `/cup`          | Alpha Cup entry and standings (if G5 passes)                                                                                                                                  |

`sdk/` provides `connection`, `program`, `tee-auth`, `session`, `accounts` (typed decode and
websocket subscriptions), `instructions` (builders), `vamm` (price-impact preview, the same math as
the program) and `table` (derived view-model). Your own pending orders are shown from the client's
memory, never from chain. UI requirements: 2 Hz updates without layout jitter, optimistic state,
the crack-open animation, a 16:9 recording mode, `prefers-reduced-motion`.

## 17. Testing

- **Unit (LiteSVM):** vAMM fills and fees; arbitrage pull; order maturity ordering (`land_tick`,
  then `seq`); lane delays and fees; position, size and pending limits; every Leak payload against
  its source; Dutch curve; ownership and license transitions; phase gating (no orders in
  `Closing`); sandwich tagging; `tick` idempotence and catch-up; callbacks only from the VRF
  program; crank-only instructions reject everyone else; E1 checks.
- **Devnet scripts:** `pnpm gates` (G0-G10), `pnpm simulate-round` (setup, seed, orders, eight
  drops, bids, flips, licenses, front-run, Xray, epoch), `pnpm lab:*` (kept from Phase 2).
- **Privacy tests:** the opener reads; a second key and an anonymous call can't read the vault, the
  mempool or A's order transactions; sealed vaults are unreadable to everyone including the
  authority; a revoked licensee loses access.
- **SDK tests (Vitest):** decode every account, build every instruction.
- **Soak:** five bots and two AI analysts, 60 minutes, no stuck phase, no failed VRF, crank
  re-armed, mempool never overflows.

## 18. Deployment

- New program ID on devnet; the table is created by `scripts/src/setup-table.ts`.
- App on Vercel. Bot service and operator on an always-on host (Railway or Fly) so the table is
  live whenever a judge opens the link. A dedicated devnet RPC for base reads.
- Secrets only in `.env` and host env vars. `.env.example` is committed.

## 19. Activity MagicBlock counts, produced organically

| Counted by the submission form | Produced by                                                       |
| ------------------------------ | ----------------------------------------------------------------- |
| Delegations                    | Setup (6 delegation transactions) and one re-delegation per epoch |
| VRF requests                   | One per round, continuously                                       |
| Private payments               | Alpha Cup buy-ins and payouts, with the platform fee account      |

All are real gameplay consequences, not scripted padding.

## 20. Security and fairness

- `#[vrf_callback]` plus a `request_id` match; the callback is cheap by construction.
- No authority write path to the mempool, future, payloads, prices, scores or Call outcomes.
- `send_order` and the tick path emit no logs that contain order fields.
- Checked arithmetic only; no floats; every PDA derived from stored seeds and bumps.
- Session keys are scoped to gameplay instructions and expire.
- Known limitations, stated in the README: TEE trust (Intel TDX), bot keys held by the service,
  devnet test funds, a synthetic asset on the Floor by design.

## 21. Scope and cut order

| Tier   | Scope                                                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | `Table`, `Market`, `Mempool`, `Future`, `Seat`, round seed VRF, `send_order`, `tick`, Leak drops (Flow and Fundamentals), Dutch `bid`, `open_leak`, X-ray with sandwiches, guest seats, 3 bots, trading-floor UI, deploy, E1 |
| **P1** | Flip, license and decay; Desk and Calls; Alpha Cup; AI analysts and commentary; 5 bots                                                                                                                                       |
| **P2** | Session keys, Magic Action and SOAR, share cards, broadcast view, proof page, mobile                                                                                                                                         |

Cut from the bottom up, and only when a gate fails or time forces it. Never cut G0, the
two-browser privacy test, the X-ray, E1, or the live table.

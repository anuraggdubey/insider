# INSIDER: Technical Specification

Version 0.2 (design, Leak market). Items marked **[verify]** depend on MagicBlock behaviour that
hasn't been confirmed with a prototype yet. Each one has a named fallback.

## 1. Goals and principles

1. **The table never leaves the rollup.** Table, market, seats and the Leak board are delegated
   once and play continuous rounds inside the TEE rollup. The base layer is used for setup,
   periodic season commits and stake-mode money only.
2. **Privacy only where it carries weight.** Two things are private: the future price path and
   sealed Leak contents. Everything else (prices, positions, ownership, who opened what) is public,
   because public behaviour is what makes the game social.
3. **Read access is the asset.** Owning a Leak means being on its permission's member list.
   Transfers and opens are permission updates, not off-chain bookkeeping.
4. **Everything claimed is real.** No mocked ER, VRF or PER paths. Every feature has code, a test
   and a devnet transaction.
5. **One-click play.** A browser key claims a pre-delegated seat inside the rollup. No wallet, no
   base-layer transaction, no deposit.
6. **Small surface.** One table, one asset, one program.

## 2. Technology stack

| Layer                    | Choice                                                  | Notes                                                 |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------------- |
| Program                  | Rust + Anchor                                           | Anchor CLI 1.2.2                                      |
| MagicBlock SDK (program) | `ephemeral-rollups-sdk` 0.18.0 (pinned)                 | Features `anchor`, `vrf`, `access-control`            |
| Frontend                 | Next.js (App Router), TypeScript                        | Read `app/AGENTS.md`; this Next version differs       |
| Styling and motion       | Tailwind CSS, Framer Motion                             | Leak cards, crack-open, X-ray replay                  |
| Charts                   | `lightweight-charts`                                    | Price line plus Leak horizon markers                  |
| Client SDK               | `@solana/kit`, `@magicblock-labs/ephemeral-rollups-kit` | Magic Router connection, TEE auth token               |
| Keys                     | In-browser burner keypair (localStorage)                | Optional Wallet Standard link for stake mode          |
| Bots                     | TypeScript service, one keypair per bot                 | Deterministic strategies, same instructions as humans |
| Tests                    | LiteSVM (Rust) for program logic; devnet scripts for ER | Existing `programs/insider/tests`                     |

Pinned versions and environment notes from Phase 2: public devnet ERs and the TEE run validator
1.x, so the SDK stays on 0.18.x. On 0.20 the `#[vrf]` macro doesn't compile.

## 3. Architecture

```
  Browser (burner key)                        Bot service (Node)
  - trading floor UI                          - 5 strategy bots, own keypairs
  - TEE auth token per key                    - keeper fallback for drops / ticks
        |                                              |
        |  rollup txs (Magic Router / TEE RPC)          |
        v                                              v
 +--------------------------------------------------------------+
 |  MagicBlock TEE rollup (devnet-tee)                           |
 |   public : Table, Market, Board, Seats[8], XrayLog            |
 |   private: Future (no reader), LeakVault[6] (owner only)      |
 |   VRF    : round seed, Leak drops (ephemeral oracle queue)    |
 |   Cranks : 500 ms tick                                        |
 +-------------------------------+------------------------------+
                                 | periodic commit (Season, Table)
                                 v
 +--------------------------------------------------------------+
 |  Solana devnet: program, delegation, Season leaderboard,      |
 |  stake-mode vault (P1, Ephemeral SPL / Private Payments)      |
 +--------------------------------------------------------------+
```

Endpoints and programs (devnet):

- Router: `https://devnet-router.magicblock.app`
- TEE validator: `devnet-tee.magicblock.app`, identity `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`
- Permission program: `ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1`
- Delegation program: `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`
- Ephemeral VRF queue (in rollup): `5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc`
- Program: `5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ`

## 4. MagicBlock integration, and what Phase 2 already proved

| Need in INSIDER                                  | Mechanism                                                                 | Proven by (devnet)                   |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------ |
| Delegate about 20 table accounts once            | `#[delegate]`, 6 delegates per tx, 1.4M CU limit                          | `pnpm lab:slots` (E)                 |
| VRF inside the TEE                               | `create_request_scoped_randomness_ix` + `#[vrf_callback]`, const identity | `pnpm lab:vrf --validator tee` (A)   |
| Account readable by nobody / only chosen wallets | `CreateEphemeralPermissionCpi`, `is_private = true`, member flags         | `pnpm lab:per` (B)                   |
| Callback rewrites who can read, atomically       | `UpdateEphemeralPermissionCpi` from the VRF callback                      | `pnpm lab:pick` (C)                  |
| Member add takes effect immediately              | Permission update, then a read with the TEE token                         | `pnpm lab:per` (B)                   |
| Scheduled ticks                                  | Crank schedule, finite iterations (cancel unavailable on TEE)             | `pnpm lab:crank --validator tee` (D) |
| Commit state to base without leaving the rollup  | `commit` intent (max 8 accounts per intent)                               | `pnpm spike`, `pnpm lab:slots`       |

New for the Leak market, not yet verified:

1. **[verify] Private permission with zero members.** _Fallback:_ the only member is a keyless
   PDA `["nobody"]`. No private key exists for it, so nobody can produce the TEE login signature.
2. **[verify] A browser key that holds no SOL can sign rollup transactions.** ER transactions cost 0. _Fallback:_ `/api/faucet` sends the burner devnet dust once, or a relayer acts as fee payer.
3. **[verify] A crank-invoked instruction can CPI a VRF request.** _Fallback:_ the bot service
   calls the permissionless `request_drop` when `Board.next_drop_tick` is reached. The program
   rejects early calls.
4. **[verify] Commit limits.** Without a delegated fee payer an account can commit 10 times.
   _Plan:_ commit the season every 5 rounds and register a delegated fee payer plus
   `magic_fee_vault` before the demo.

## 5. Onchain program (`programs/insider`)

### 5.1 Accounts

All accounts are created on the base layer at setup, delegated once to the TEE validator, and
reused every round. Sizes are fixed, so there's no realloc inside the rollup.

| Account     | Seeds                        | Visibility                    | Fields (summary)                                                                                                 |
| ----------- | ---------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Table`     | `["table", table_id]`        | public                        | authority, round_id, phase (`Seeding`/`Live`/`Xray`), round_start_tick, tick, params, vrf_pending                |
| `Market`    | `["market", table]`          | public                        | price (fixed-point 1e6), tick, `history: [u32; 180]` (past ticks only)                                           |
| `Future`    | `["future", table]`          | **private, no reader**        | round_id, seed, `path: [u32; 200]` (full round plus a horizon margin)                                            |
| `Board`     | `["board", table]`           | public                        | `headers: [LeakHeader; 6]`, next_drop_tick, drop_counter                                                         |
| `LeakVault` | `["leak", table, slot]`      | **private, owner after open** | leak_id, kind, payload (kind-specific, 16 bytes)                                                                 |
| `Seat`      | `["seat", table, index]`     | public                        | owner (burner pubkey), persona/name, is_bot, cash, position, entry, leak_spend, last_action_tick, last_seen_tick |
| `XrayLog`   | `["xray", table]`            | public                        | per-round ring of revealed Leaks: id, kind, payload, buyer seat, price, opened_tick, flips                       |
| `Season`    | `["season", table]`          | public (committed to base)    | `top: [(owner, score); 20]`, rounds_played                                                                       |
| `Stake`     | `["stake", table, round_id]` | base (P1)                     | buy-ins and payout status, used with Ephemeral SPL                                                               |

`LeakHeader` (public): `leak_id`, `kind`, `rarity`, `horizon_ticks`, `target_tick`, `expiry_tick`,
`state` (`Empty`/`Auction`/`Owned`/`Listed`/`Opened`/`Expired`), `auction_start_tick`,
`start_price`, `floor_price`, `owner_seat`, `ask`, `flips`, `opened_tick`.

Total: 1 + 1 + 1 + 1 + 6 + 8 + 1 + 1 = **20 delegated accounts** (4 delegation transactions).
Permissions: 7 (`Future` + 6 vaults).

### 5.2 Instructions

| Instruction                   | Layer     | Signer                      | Purpose                                                                                               |
| ----------------------------- | --------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `init_table`                  | base      | authority                   | Create Table, Market, Future, Board, XrayLog, Season                                                  |
| `init_slots`                  | base      | authority                   | Create Seats (8) and LeakVaults (6), in batches                                                       |
| `delegate_table`              | base      | authority                   | Delegate a batch of up to 6 accounts to the TEE validator                                             |
| `init_permissions`            | ER        | authority                   | Create private permissions for Future and each LeakVault (no reader / `nobody` PDA)                   |
| `schedule_ticks`              | ER        | authority                   | Crank `tick` every 500 ms for N iterations (finite; re-armed by the keeper)                           |
| `request_round_seed`          | ER        | anyone, when `Xray` is over | VRF request; sets `vrf_pending`                                                                       |
| `round_seed_callback`         | ER        | VRF program only            | Fill `Future.path` from the randomness; phase → `Live`                                                |
| `tick`                        | ER        | crank signer (or keeper)    | Advance price from `Future`; step auctions; expire Leaks; at round end force-close and phase → `Xray` |
| `request_drop`                | ER        | anyone, at `next_drop_tick` | VRF request for the next Leak; allocates a free slot                                                  |
| `drop_callback`               | ER        | VRF program only            | Roll kind, rarity and horizon; compute payload from `Future`; write the vault; header → `Auction`     |
| `claim_seat`                  | ER        | burner key                  | Take a free or idle-bot seat; reset chips if new                                                      |
| `trade`                       | ER        | seat owner                  | Set target position (long/short/flat, size ≤ 50% of bankroll); fills at price ± spread                |
| `bid`                         | ER        | seat owner                  | Buy an `Auction` Leak at the current Dutch price                                                      |
| `open_leak`                   | ER        | seat owner                  | Permission update: members = [owner key]; header → `Opened` (can't be resold)                         |
| `list_leak`                   | ER        | seat owner                  | Re-list an `Owned` (sealed) Leak at an ask price                                                      |
| `buy_listed`                  | ER        | seat owner                  | Pay the ask to the seller seat; ownership moves; still sealed                                         |
| `finish_round`                | ER        | anyone, in `Xray`           | Copy every Leak payload into `XrayLog`; clear vault members; score into `Season`; reset seats         |
| `commit_season`               | ER        | anyone, every 5 rounds      | Commit Season and Table to base (≤ 8 accounts per intent)                                             |
| `stake_join` / `stake_payout` | base + ER | player / anyone             | **P1.** Buy-in and top-3 payout via Ephemeral SPL tokens, private visibility                          |
| `teardown`                    | ER        | authority                   | Make permissions public, close them, commit and undelegate in batches of ≤ 8                          |

The authority has no instruction that writes `Future`, a Leak payload, prices or scores.

### 5.3 State machine (per round, about 100 s)

```
Seeding --(round_seed_callback)--> Live --(tick == 180)--> Xray --(finish_round + 20 ticks)--> Seeding
```

- **Live:** 180 ticks × 500 ms = 90 s. A drop every 20 ticks (ticks 10, 30, ..., 170: 9 drops).
- **Xray:** 20 ticks (10 s). No trades. The UI animates the replay from `XrayLog`.
- A stalled VRF callback goes back to the previous phase through `cancel_vrf` after 10 ticks
  (the pattern from `lab_cancel_roll`).

### 5.4 Price path generator

- Input: the 32-byte VRF output. A `xorshift128+` PRNG, integer only, fixed-point 1e6, `u32`
  prices around 100.000000.
- Random walk with two volatility regimes, switching at a random tick.
- **2-4 shocks per round** of ±3-8% over 3-6 ticks at random ticks after 20, so Shockwave and
  Summit Leaks always have something to find.
- Clamped to [50, 200]. 200 entries, so horizons near the round end never read past the path.
- Pure function in `math.rs`, unit-tested: deterministic per seed, bounded, shock count in range.

### 5.5 Leaks

**Drop roll** (`drop_callback`, from the randomness):

| Rarity | Weight | Kinds      | Start price | Floor | Auction length |
| ------ | ------ | ---------- | ----------- | ----- | -------------- |
| Common | 70%    | Pin, Drift | 150         | 10    | 16 ticks (8 s) |
| Rare   | 25%    | Shockwave  | 300         | 30    | 16 ticks       |
| Epic   | 5%     | Summit     | 500         | 60    | 16 ticks       |

Price at tick `t` = `start − (start − floor) × (t − auction_start) / 16`. An unsold Leak at the
floor expires.

**Payloads** (computed by the program from `Future.path` at drop time, so a Leak is always true):

| Kind        | Horizon window             | Payload                                          |
| ----------- | -------------------------- | ------------------------------------------------ |
| `Pin`       | target = now + 10-30 ticks | `price_at_target`                                |
| `Drift`     | now → now + 20-40 ticks    | `direction` (up/down), `bucket` (<1%, 1-3%, >3%) |
| `Shockwave` | now → now + 40 ticks       | `has_shock`, `shock_tick`, `sign`                |
| `Summit`    | now → now + 60 ticks       | `max_price`, `max_tick`, `min_price`, `min_tick` |

`expiry_tick` = the window end. After expiry the Leak is worthless and its slot frees at round end.

**Ownership rules**

- `Auction` → `bid` → `Owned` (sealed; still no reader).
- `Owned` → `list_leak` → `Listed` → `buy_listed` → `Owned` by the buyer. Chips go seller to buyer.
  The flip counter increments.
- `Owned` → `open_leak` → `Opened`: the permission's members become exactly `[owner key]`. Opened
  Leaks can't be listed, because the content has been seen.
- A Leak that was never opened has never had a reader. That's the "sealed" guarantee, enforced
  by the permission history and visible on the explorer.
- A seat may hold at most 2 unopened Leaks (prevents hoarding).

### 5.6 Trading

- 1,000 chips per seat per round. One asset. Position is a signed size in units, with notional
  capped at 50% of starting bankroll.
- `trade` sets a **target position**, so one instruction handles long, short, flip and flat.
- Fill price = current price ± 0.1% spread. No slippage term (keeps the math simple and
  readable).
- Equity = cash + position × price. Positions force-close at tick 180.
- Round score = equity − 1,000 (Leak spend is already out of cash; flip income is in cash).

### 5.7 Seats and burner keys

- 8 seats. 5 are held by bots by default. `claim_seat` lets a human take a free seat, or replace
  the bot seat idle longest. That bot moves to spectating until a seat frees up.
- A seat is idle when `last_seen_tick` is more than 60 ticks old. The client sends a heartbeat by
  trading or calling `ping` (no-op).
- Display names come from a fixed adjective + animal list, picked by hashing the key (no free
  text onchain).

### 5.8 Season and stakes

- `finish_round` folds round scores into `Season.top` (top 20 by cumulative score, keyed by
  owner key).
- `commit_season` commits `Season` and `Table` to base every 5 rounds (commit limit, section 4).
- **Stake mode (P1):** a devnet test mint. Players deposit into an Ephemeral SPL eATA. The round
  pot pays the top 3 (50/30/20) with **private** visibility through the Private Payments API. If
  it slips, chips-only mode is the shipped product and the README says so.

## 6. Private state design (PER)

| Account         | Readers during play                   | How it changes                                                           |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| `Future`        | nobody (no member / `nobody` PDA)     | Written only by `round_seed_callback`; read only by program instructions |
| `LeakVault`     | nobody while sealed; owner after open | `open_leak` → `UpdateEphemeralPermissionCpi` members = [owner]           |
| everything else | public                                | n/a                                                                      |

- The program reads private accounts freely during execution inside the TEE. Permissions gate
  **RPC reads**, not program access (verified in Phase 2: the VRF callback read and wrote a
  private account).
- `finish_round` copies payloads into the public `XrayLog` and resets each vault's members to
  none. It never flips a permission back from public to private, which avoids an unverified
  transition.
- Clients read an opened Leak with the TEE login challenge (`scripts/src/lib/tee.ts`): sign the
  challenge with the burner key, then call `getAccountInfo(LeakVault)` with the token.
- **The two-browser test** (demo and integration test): browser A opens a Leak and reads it;
  browser B (and an anonymous RPC call) gets "account not returned".

**Trust model, stated plainly:** privacy relies on MagicBlock's TEE (Intel TDX). Bot keys sit in
the bot service, which can only read Leaks its bots own. Seats, positions and trades are public by
design.

## 7. VRF flows

1. **Round seed.** `request_round_seed` → `round_seed_callback(randomness)` fills `Future.path`.
   One request per round.
2. **Leak drop.** `request_drop` → `drop_callback(randomness)` picks rarity, kind and horizon, then
   computes the payload. Nine requests per round.
3. Both callbacks declare the scoped VRF identity account with a compile-time constant (the
   Phase 2 fix for the 270k CU `const fn` cost on SDK 0.18).
4. Both have a `cancel_*` path after a timeout. A late callback for a cancelled request is
   rejected (`request_id` check).

## 8. Cranks and keepers

- `schedule_ticks` arms a finite crank (for example 7,200 iterations = 1 hour). Cancel doesn't
  work on the TEE (Phase 2 D), so the keeper re-arms before the task runs out.
- `tick` is idempotent per tick index and only accepts the crank signer PDA or the keeper key.
- The bot service runs a keeper that calls `tick`, `request_drop`, `request_round_seed` and
  `finish_round` when they're due and the crank hasn't done it. Every one of these is
  permissionless and time-gated, so the keeper has no special power.

## 9. Off-chain components

### 9.1 App (`app/`)

| Route         | Screen                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/`           | Landing: the sealed card hero, one-sentence pitch, **Play** button, live table preview                              |
| `/table`      | Trading floor: chart with Leak markers, seat rail, Leak board (auction cards), trade panel, activity feed, my Leaks |
| `/table/xray` | X-ray replay of the last round (also shown inline during `Xray`)                                                    |
| `/proof`      | Live links: program, delegation, the latest VRF and permission transactions, the two-browser test                   |

Client modules in `app/src/lib/`: `connection.ts` (Magic Router + TEE RPC), `program.ts` (typed
client from `idl/insider.json`), `burner.ts` (key create/store), `tee-auth.ts` (token cache per
key), `table.ts` (websocket subscriptions to Table, Market, Board, Seats).

UI requirements: price updates at 2 Hz without layout jitter; optimistic trade state; the
crack-open animation; a 16:9 recording mode; `prefers-reduced-motion` support.

API routes: `/api/faucet` (only if [verify] 2 needs it), `/api/health` (keeper and crank status).

### 9.2 Bots (`bots/`)

| Persona     | Strategy                                                                            |
| ----------- | ----------------------------------------------------------------------------------- |
| **Whale**   | Buys Rare and Epic early at high prices, opens them, trades max size on the content |
| **Sniper**  | Bids on Commons near the floor, opens them, takes small precise trades              |
| **Flipper** | Buys sealed at the mid price, lists at +40%, opens only if unsold after 6 ticks     |
| **Copycat** | Never buys. Mirrors whoever opened a Leak most recently, 1-2 ticks later            |
| **Degen**   | Random trades on momentum, occasionally buys a Leak and never opens it              |

- Each bot has its own keypair and TEE token, and reads only vaults it opened.
- The loop subscribes to public accounts, decides, and sends one transaction at most every 2
  ticks.
- A small per-decision random delay keeps bots from looking mechanical, and jitter in sizes
  makes them beatable.

## 10. Repository layout

```
insider/
  programs/insider/   Anchor program: table, market, leaks, math, VRF, PER, cranks
  app/                Next.js app
  bots/               Bot strategies and keeper
  scripts/            setup-table, simulate-round, proof index, Phase 2 lab scripts
  tests/              Integration tests
  idl/                Generated IDL
  docs/               Phase 2 findings and devnet proofs
```

The Phase 2 `spike_*`, `lab_*` and `slot_*` instructions stay until the table instructions replace
them, then move behind a `lab` cargo feature so the proofs stay reproducible.

## 11. Testing plan

- **Unit (LiteSVM / `cargo test`):** price generator (deterministic, bounded, shock count); Leak
  payload correctness against the path for every kind; Dutch price curve; trade fills and equity;
  phase gating; ownership transitions (can't list an opened Leak; can't bid on a Leak you own;
  hoard limit); round score sums; `tick` idempotence; only the VRF program can call the callbacks.
- **Devnet script `pnpm simulate-round`:** setup → seed → 9 drops → bids, flips, opens → trades →
  Xray → commit. Prints every explorer link and feeds `docs/proofs`.
- **Privacy test:** the opener reads the vault; a second key and an anonymous call can't; sealed
  vaults are unreadable to everyone, including the authority.
- **Bot soak:** five bots, no humans, for 30 minutes: no stuck phase, no failed VRF, crank re-armed.

## 12. Deployment

- Program on Solana devnet (ID above). The table is set up once by `scripts/setup-table.ts`.
- App on Vercel. The bot service and keeper on an always-on host (Railway/Fly), so the table is
  live whenever a judge opens the link.
- A dedicated devnet RPC for base reads (the public RPC rate-limits, Phase 2 notes).
- Secrets live only in `.env` and host env vars. `.env.example` is committed.

## 13. Security and fairness

- `#[vrf_callback]` plus a `request_id` match on both callbacks.
- No authority write path to `Future`, payloads, prices or scores.
- All mutating instructions check phase and tick, so late bids, trades after the round, and early
  drops are all rejected.
- Checked integer arithmetic only. No floats.
- Seat actions require the seat owner's signature. Crank-only instructions check the crank signer
  PDA.
- Known limitations, documented: TEE trust; bot keys held by the service; devnet test token;
  synthetic asset by design.

## 14. Proof checklist for reviewers (to fill with links)

- [ ] Program ID on devnet
- [ ] Table delegation transactions to the TEE validator
- [ ] Round seed VRF request and callback
- [ ] Leak drop VRF request and callback
- [ ] `open_leak` permission update, and a failed read from a second key
- [ ] Rollup trades and bids (sample)
- [ ] Season commit to base
- [ ] (P1) Private payout transaction
- [ ] Live app URL and a recorded round

## 15. Scope and cut order (deadline Nov 27, 9:00 AM EST = 14:00 UTC)

| Priority | Scope                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**   | Table/Market/Future/Seats; round seed VRF; tick; trade; Leak drop VRF; Dutch bid; open (permission); Xray; burner seats; 3 bots; trading-floor UI; deploy |
| **P1**   | Flip (list / buy_listed); 5 bots; `/proof` page; season commit; X-ray animation polish                                                                    |
| **P2**   | Stake mode with Private Payments; SOAR; LLM flavour text for bots; mobile layout                                                                          |

Cut from the bottom up. Never cut the two-browser privacy test or the X-ray, because the demo
depends on them.

| Day    | Goal                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| Nov 22 | Docs pivot; `math.rs` with unit tests; table accounts; seed VRF; tick; trade |
| Nov 23 | Leaks: drop VRF, payloads, auction, open, flip; `simulate-round` on devnet   |
| Nov 24 | App: trading floor, Leak cards, crack-open, X-ray; burner seats              |
| Nov 25 | Bots and keeper deployed; app deployed; soak test; fix                       |
| Nov 26 | Record rounds; video; README proofs                                          |
| Nov 27 | Submit by 08:00 UTC (6 h buffer); post the X clip                            |

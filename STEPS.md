# INSIDER: Build Steps

Working plan for the dark-mempool design (TECHNICAL_SPEC.md v0.3). Hard deadline: **Nov 27,
9:00 AM EST = 14:00 UTC = 19:30 IST**. Target submit time: 08:00 UTC.

State today (Nov 22): Phases 0-2 are done. The ER round trip, VRF in the TEE, private
permissions, VRF-picked reader, cranks and batching are all proven on devnet (docs/proofs). The
program contains only lab code. The app is the Next.js starter. The bots are empty.

Rule: one finished step = one commit. Run CI locally before every push.

---

## Phase 3: The darkcheck gate (first, half a day at most)

1. Add a lab `lab_send_secret(side_size: i16)` instruction that writes into a private lab account
   with no members and prints no logs.
2. `scripts/src/lab/darkcheck.ts`: key A sends it on the TEE. Key B and an anonymous client try
   `getTransaction`, `getSignaturesForAddress`, `logsSubscribe`, `simulateTransaction` and
   account reads. Record what each path returns.
3. Also check that a private permission with zero members works (or switch to the `nobody` PDA).
4. Write the result into `docs/proofs` and `docs/phase-2-findings.md`.

**Decision gate:** if B learns nothing, build v0.3 (dark mempool). If instruction data leaks,
build the v0.2 fallback (Leaks cut from a VRF-written private price path, see spec §4 item 1)
with the same accounts, UI and Leak lifecycle.

## Phase 4: Program core (P0)

1. `math.rs`: vAMM fill and price impact, fees, noise PRNG, Dutch price. Unit tests first.
2. State: `Table`, `Market`, `Mempool` (+ `PendingOrder`), `Tape`, `Board` (+ `LeakHeader`),
   `LeakVault`, `Seat`, `Xray`, `Season`. Fixed sizes.
3. `init_table`, `init_slots`, `delegate_table` (batches of 6, 1.4M CU), `init_permissions`.
4. `request_round_seed` / `round_seed_callback` (whales, noise; const VRF identity),
   `cancel_vrf`.
5. `send_order` (two lanes, limits, no logs), `tick` (maturity in `seq` order, at most 12 per
   tick, idempotent), `schedule_ticks`.
6. `claim_seat`, `ping`.

Done when: LiteSVM tests pass and a devnet script runs seed → orders → 180 ticks → close.

## Phase 5: Leaks (P0 then P1)

1. `request_drop` / `drop_callback`: Flow and Spotlight payloads from the Mempool (P1: Whale,
   Full Book).
2. `bid` (Dutch), `open_leak` (members = [owner]), expiry in `tick`.
3. `finish_round`: order log and payloads into `Xray`, clear members, scores into `Season`, reset.
4. P1: `list_leak`, `buy_listed`, hoard limit, sandwich tags, `commit_season`.
5. `scripts/src/simulate-round.ts`: a full round with 3 keys, all explorer links, written to
   `docs/proofs`.
6. Privacy test: the opener reads; a second key and an anonymous client get nothing from the
   vault or the Mempool.

## Phase 6: App (P0)

Read `app/node_modules/next/dist/docs/` first (see `app/AGENTS.md`).

1. `lib/`: `connection.ts`, `program.ts`, `burner.ts`, `tee-auth.ts`, `table.ts`, `vamm.ts`.
2. `/table`: chart with landing markers, seat rail with lane tells, ghost-order lane, Leak board,
   order panel (side, size, lane), opened Leaks, feed.
3. The crack-open animation and the X-ray with sandwich arrows (the money shots; polish these
   most).
4. The `/` landing page with Play. P1: `/proof`.
5. Verify early: a burner key signs rollup txs with no SOL (spec §4 item 3).

Done when: a cold browser plays a full round against bots with no console errors.

## Phase 7: Bots and keeper (P0: 3 bots, P1: 5)

1. `config.ts`, `keys.ts`, `chain.ts` (shared client), `keeper.ts`.
2. Strategies: Front-runner, Flow, Baiter (P0); Copycat, Flipper (P1).
3. Soak for 30 minutes with no humans.

## Phase 8: Deploy and harden

1. App to Vercel; bots and keeper to an always-on host; a dedicated RPC.
2. A delegated fee payer plus `magic_fee_vault` for long-running commits.
3. Edge cases: VRF timeout, crank expiry, idle seats, Mempool full, liquidation.

## Phase 9: Demo video (Nov 26)

Record real rounds (1920×1080), including the sandwich shot and the two-browser privacy shot.
Cut about 75 s plus a 20 s X clip, following PROJECT_INFO.md.

## Phase 10: Submission (Nov 27)

1. README statuses to `done` only where true; program ID, live URL, proof links, limitations.
2. Re-read it as a skeptical reviewer.
3. Submit at build.magicblock.app (`?stage=blitz#submit`). Categories: Games, Privacy, DeFi.
   Add the program address and keeper wallet (the form counts onchain activity).
4. Post the X clip and tag @magicblock.

## Cut order if behind

P2 (stake mode, SOAR, mobile), then P1 (Whale and Full Book, flip, extra bots, sandwich tags,
`/proof`, season commit). Never cut darkcheck, open-with-permission, the two-browser test, or
the X-ray.

## Definition of done

- [ ] Darkcheck recorded and the design decision written down
- [ ] Table runs continuously on devnet with bots
- [ ] VRF, permission and rollup txs linked in the README
- [ ] A second key can't read pending orders or a Leak it doesn't own (tested and filmed)
- [ ] A cold visitor plays with no wallet
- [ ] Video and X clip rendered
- [ ] README claims verified against code and txs
- [ ] Submitted

# INSIDER: Build Steps

Working plan for the Leak market (see TECHNICAL_SPEC.md). Hard deadline: **Nov 27, 9:00 AM EST
= 14:00 UTC = 19:30 IST**. Target submit time: 08:00 UTC.

State today (Nov 22): Phases 0-2 are done. The ER round trip, VRF in the TEE, private
permissions, VRF-picked reader, cranks and batching are all proven on devnet (docs/proofs). The
program contains only lab code. The app is the Next.js starter. The bots are empty.

Rule: one finished step = one commit. Run CI locally before every push.

---

## Phase 3: Program core (P0)

1. `math.rs`: price path generator (xorshift, regimes, 2-4 shocks, clamp) and Dutch price.
   Unit tests first.
2. State: `Table`, `Market`, `Future`, `Board` (+ `LeakHeader`), `LeakVault`, `Seat`, `XrayLog`,
   `Season`. Fixed sizes.
3. `init_table`, `init_slots`, `delegate_table` (batches of 6, 1.4M CU), `init_permissions`.
4. Verify early: a private permission with zero members, or fall back to the `nobody` PDA
   (spec section 4, item 1).
5. `request_round_seed` / `round_seed_callback` (const VRF identity), `cancel_vrf`.
6. `tick` (crank signer or keeper; idempotent), `schedule_ticks`.
7. `claim_seat`, `ping`, `trade` (target position).

Done when: LiteSVM tests pass and a devnet script runs seed → 180 ticks → force-close.

## Phase 4: Leaks (P0 then P1)

1. `request_drop` / `drop_callback`: rarity, kind, horizon, payload from `Future`.
2. `bid` (Dutch), `open_leak` (members = [owner]), expiry in `tick`.
3. `finish_round`: payloads into `XrayLog`, clear members, score into `Season`, reset.
4. P1: `list_leak`, `buy_listed`, hoard limit; `commit_season` every 5 rounds.
5. `scripts/src/simulate-round.ts`: a full round with 3 keys, all explorer links, writes into
   `docs/proofs`.
6. Privacy test: opener reads; a second key and anonymous get nothing; the authority can't read
   sealed vaults.

Done when: `pnpm simulate-round` passes on devnet and the proof index updates.

## Phase 5: App (P0)

Read `app/node_modules/next/dist/docs/` first (see `app/AGENTS.md`).

1. `lib/`: `connection.ts`, `program.ts`, `burner.ts`, `tee-auth.ts`, `table.ts`.
2. `/table`: chart with Leak horizon markers, seat rail, auction cards, trade panel, feed, my
   Leaks.
3. Crack-open animation and the X-ray replay (the money shots; polish these most).
4. `/` landing with the Play button. P1: `/proof` page.
5. Verify early: the burner key signs rollup transactions with no SOL (spec section 4, item 2).

Done when: a cold browser plays a full round against bots with no console errors.

## Phase 6: Bots and keeper (P0: 3 bots, P1: 5)

1. `config.ts`, `keys.ts`, `chain.ts` (shared client), `keeper.ts`.
2. Strategies: Whale, Sniper, Copycat (P0); Flipper, Degen (P1).
3. Soak for 30 minutes with no humans.

## Phase 7: Deploy and harden

1. App to Vercel; bots and keeper to an always-on host; a dedicated RPC.
2. Delegated fee payer plus `magic_fee_vault` for long-running commits.
3. Edge cases: VRF timeout, crank expiry, idle seats, two humans racing for one seat.

## Phase 8: Demo video (Nov 26)

Record real rounds (1920×1080), including the two-browser privacy shot. Cut about 75 s plus a
20 s X clip. Follow the PROJECT_INFO.md plan.

## Phase 9: Submission (Nov 27)

1. README statuses to `done` only where true; program ID, live URL, proof links, limitations.
2. Re-read it as a skeptical reviewer.
3. Submit at build.magicblock.app (`?stage=blitz#submit`). Categories: Games, Privacy,
   Consumer. Add the program address and keeper wallet (the form counts onchain activity).
4. Post the X clip and tag @magicblock.

## Cut order if behind

P2 (stake mode, SOAR, LLM flavour), then P1 (flip, extra bots, `/proof`, season commit). Never
cut: open-with-permission, the two-browser test, or the X-ray.

## Definition of done

- [ ] Table runs continuously on devnet with bots
- [ ] Seed and drop VRF, permission and rollup txs linked in the README
- [ ] A second key can't read a Leak it doesn't own (tested and filmed)
- [ ] A cold visitor plays with no wallet
- [ ] Video and X clip rendered
- [ ] README claims verified against code and txs
- [ ] Submitted

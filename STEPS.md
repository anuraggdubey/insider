# Insider: Build Steps

Private working plan (git-ignored). Hard deadline: **Nov 27, 9:00 AM EST = 19:30 IST**. Work is phase-driven (see Pacing at the bottom).
Rule: every finished step = one commit + push. No Co-Authored-By lines.

State today: repo, toolchain, dependencies, CI, docs are done. Program is an empty scaffold. App is the Next.js starter. Deployer wallet `23k9UnCKBkFyci6Sv1RhuFXUXFgTnjV6oeTZyMaxopWm` has 0 devnet SOL.

---

## Phase 0: Unblock (15 min)

1. Fund the deployer: faucet.solana.com (devnet) or `solana airdrop 2 -k .keys/deployer.json --url devnet`. Need about 5 SOL total for deploys (repeat over the day).
2. Back up `.keys/` (it holds the program keypair; losing it changes the program ID).
3. Copy `.env.example` to `.env`, set `INSIDER_PROGRAM_ID=5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ`.
4. Run `pnpm tsx scripts/check-setup.ts` (all ok).

Done when: deployer shows a balance and the check script is green.

---

## Phase 1: ER spike, the explorer proof

Goal: prove delegation to the TEE validator works end to end, before any game logic. This also gives the first explorer link for the README.

Program (`programs/insider/src`):
1. Add a tiny `Spike` account (`counter: u64`, `authority: Pubkey`), PDA seeds `["spike", authority]`.
2. Instructions: `spike_init` (base), `spike_delegate` (base, `#[delegate]` macro, validator = TEE `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`), `spike_increment` (ER), `spike_commit_undelegate` (ER, `MagicIntentBundleBuilder::commit_and_undelegate`).
3. Add `#[ephemeral]` above `#[program]` so the undelegate instruction exists.
4. Follow the MagicBlock Anchor quickstart exactly (docs.magicblock.gg, Ephemeral Rollups > Quickstart). Use the same macro imports shown there for `ephemeral-rollups-sdk` 0.20.

Build and deploy:
5. `pnpm program:build`, then `pnpm program:idl`.
6. `pnpm program:deploy` (uses `.keys/deployer.json`, program keypair, devnet).

Client script (`scripts/spike.ts`):
7. Create `Connection.create` from `@magicblock-labs/ephemeral-rollups-kit` with the router URLs from `.env`.
8. Run: init (base) -> delegate (base) -> increment x N (ER) -> commit_and_undelegate -> read the account back on base.
9. Print every signature with Solana Explorer links (devnet; for ER txs use the MagicBlock explorer link pattern from the docs).

Done when: you have a delegation tx and several ER increments with links, and the final value is visible on base layer. Save the links in a notes file.

Risk: toolchain or SDK API mismatch. Fix before moving on; everything else depends on it.

---

## Phase 2: Risk spikes

Answer the five open questions from TECHNICAL_SPEC.md section 17 with tiny experiments in the Spike program (delete later).

A. **VRF inside the ER.** Add `spike_request_random` + `#[vrf_callback]` consume instruction. Use `create_request_scoped_randomness_ix`, queue from `vrf::consts` (ER devnet queue when inside the ER). Confirm the callback fires and writes a value.
B. **PER permissions.** Delegate `Spike` to the TEE validator, then create an `EphemeralPermission` (`CreateEphemeralPermissionCpi`) with `is_private = true` and one member. From a second wallet, try to read the account through the TEE RPC (expect refusal); from the member wallet, read it (expect success). Learn the auth-token flow (`authorization` docs page).
C. **Permission update after VRF.** In the VRF callback, call `UpdateEphemeralPermissionCpi` to set the member to a wallet chosen by randomness. This is exactly the Insider-selection mechanic.
D. **Ticks.** Try a MagicBlock crank to call an instruction every N ms. If it fails, plan a keeper loop in the bots service.
E. **Compute and accounts.** Delegate 8 player accounts plus round/market/tape in one flow; check the limits.

Decision gate (end of Phase 2):
- A and B and C work -> build as specced.
- C fails -> two-step flow: VRF callback stores the Insider seat in a program-only private `Role`; a follow-up instruction sets the tape permission.
- B fails on the TEE -> fallback: the tape lives in a private-permission account only the Insider's session key can read, and say so honestly in the README.
- Cranks fail -> keeper loop.

Done when: each question has a written answer in `NOTES.md` (git-ignored) with a tx link.

---

## Phase 3: Real program

Replace the spike with the real program. Files under `programs/insider/src`: `constants.rs`, `error.rs`, `state/` (config, round, market, tape, player, role, vault), `instructions/` (one file each), `math.rs` (payout, price generator), `lib.rs`.

Order (build and unit-test each before the next):
1. `state` + `constants` + `error` (phases, params: bankroll 1000, max position 50 percent, tape length 240, tick 500 ms).
2. `math.rs`: price generator from a 32-byte seed (fixed-point 1e6, volatility regimes, 2 to 3 shocks) and payout calculation (caught / not caught). **Unit tests first** (`cargo test -p insider`): payouts sum to the pot; deterministic tape per seed; no overflow.
3. `initialize_config`, `create_round`, `join_round` (stake into vault via SPL token CPI).
4. `delegate_round` (round, market, tape, role, players -> TEE validator).
5. `init_permissions`, `request_roles` and `callback_roles` (Insider seat + tape + permission update; result of Phase 2).
6. `tick` and `trade` (phase checks, session key or wallet signer, position limits, spread).
7. `open_vote`, `cast_vote`, `reveal` (permissions to public).
8. `settle` (compute payouts, `commit_and_undelegate`) and `claim_payouts` (base layer, from vault).
9. `set_session_key` (expiry, scoped to trade and vote).
10. Cancel and refund path for rounds with fewer than 3 players.

Tests (`tests/`, vitest + `ephemeral-validator` locally or devnet): full round with 5 wallets, privacy check (non-Insider cannot read the tape), settlement check.

Done when: one scripted round runs on devnet from join to payout and prints all explorer links.

---

## Phase 4: Deploy and client plumbing

1. `pnpm program:build && pnpm program:idl && pnpm program:deploy` after each program milestone.
2. Copy `target/idl/insider.json` to `app/src/idl/` and generate types (script `scripts/sync-idl.ts`).
3. `app/src/lib/`:
   - `connection.ts`: Magic Router connection from env.
   - `program.ts`: typed Anchor client from the IDL (`@anchor-lang/core`).
   - `tee-auth.ts`: obtain and cache the TEE authorization token per wallet.
   - `session-key.ts`: generate, store (localStorage), register and expire the session keypair.
   - `rounds.ts`: fetch and subscribe (websocket) to Round, Market, Player accounts.
4. Zustand store for round state; TanStack Query for one-off reads.

Done when: a throwaway page can join a round and place a trade without a wallet popup after the first signature.

---

## Phase 5: Frontend

Read `app/node_modules/next/dist/docs/` first (Next 16 differences; see `app/AGENTS.md`).

1. Design tokens in Tailwind: dark background, two neon accents, mono numerals, spacing scale. Global layout with wallet button.
2. Screens, in this order (each one commit):
   - `/` landing: hero, "Play a round" button, short how-it-works.
   - `/lobby`: seats, stake, agent fill, countdown.
   - `/round/[id]`: price chart (lightweight-charts), action feed ("Echo traded at 0:42"), trade panel (buy / sell / flatten), phase timer, chat, Insider-only tape panel (shown only if the wallet can read it).
   - Vote modal and the **reveal animation** (tape replay against trades, payout count-up). This is the demo money shot, so polish it most.
   - `/replay/[id]`: shareable replay.
3. Wallet-free feel: show "session active" chip, optimistic UI on trades.
4. Make it screen-recording friendly: fixed 16:9 layout mode, large type, no layout jitter.

Done when: a human can play a full round against placeholder bots with no console errors.

---

## Phase 6: Backend

Next.js API routes (`app/src/app/api/`):
1. `/api/chat`: SSE stream plus POST (in-memory per round; optional transcript hash at settlement).
2. `/api/agents`: start or fill seats for a lobby (calls the bots service).
3. `/api/rounds`: list open and recent rounds from chain.
4. `/api/tee-auth`: helper if the token flow needs a server step.
Validate all inputs with zod. No secrets in the client bundle.

---

## Phase 7: AI agents

`bots/src`:
1. `config.ts` (env, zod), `keys.ts` (load or create agent keypairs in `.keys/agents`), `fund.ts` (devnet SOL and test token).
2. `chain.ts`: same program client as the app (shared code or copied lib).
3. `personas.ts`: Nova (paranoid), Rook (smug), Echo (quiet), plus 2 more. System prompt, trade policy, chat style.
4. `agent.ts` loop: read public state -> decide -> `trade` -> chat line -> vote. One LLM call per agent per about 15 s, short outputs, scripted fallback on error.
5. `insider-policy.ts`: if this agent is the Insider, read the tape through its own permission and trade with a cover pattern.
6. `index.ts`: watch for lobbies and fill seats; run an always-on loop.
Agents use the same instructions as humans (no privileged path).

Done when: `pnpm bots` fills a lobby and a 5-agent round finishes with no humans.

---

## Phase 8: Integration, hardening

1. `scripts/simulate-round.ts`: headless round, prints all explorer links (this is the proof checklist generator).
2. Edge cases: player disconnects, tie vote, cancelled round, session key expiry.
3. Performance: ER tx latency visible in UI; reduce re-renders on tick.
4. Deploy: app to Vercel, bots to Railway or Fly (always-on), env vars set, devnet program final deploy. Smoke test from a clean browser.
5. CI green.

---

## Phase 9: Demo video

Use the installed HyperFrames and Remotion skills and `DEMO_VIDEO_PLAYBOOK.md`.
1. Record real rounds from the deployed app (browser capture at 1920x1080): at least 3 takes with a good accusation moment and a clean reveal.
2. Build the film (about 90 s): cold open, title, real round with caption pills, reveal, "what's onchain" with explorer clicks, end card.
3. Cut a 20 s clip for X (hook plus reveal).
4. Render, check on phone size, add captions. Audio: local TTS or music (decide by quality).

---

## Phase 10: Submission and polish (the last 2 days)

1. README: update statuses to `done`, add program ID, live URL, explorer links, proof checklist, honest limitations.
2. Re-read the README as a skeptical reviewer: every claim maps to a file and a tx.
3. Submit at build.magicblock.app (`?stage=blitz#submit`): wallet, name, description, categories (Games, Privacy, AI/Agents), repo, video, explorer link, program address, X account.
4. Post the 20 s clip on X, tag @magicblock.
5. Submit at least 6 hours before the deadline; keep the buffer for surprises.

---

## Pacing (phase-driven, not date-driven)

We do not work to calendar dates. We finish a phase, then start the next one.
- **Build window (about 3 days):** Phases 0 to 8. The product must be complete and deployed.
- **Submission window (last 2 days):** Phases 9 and 10, plus repo cleanup. Video, README proofs, structure, submission. Protected time, never spent on features.
- If the build window runs long, cut from the cut-order list below instead of eating the submission window.

Cut order if behind: SOAR, replay page, cranks (use keeper), extra personas, chat hash.

## Definition of done
- [ ] Round runs end to end on devnet with humans and agents
- [ ] Delegation, VRF and permission txs visible on explorer
- [ ] Non-Insider cannot read the tape (tested)
- [ ] Live URL works for a cold visitor
- [ ] Demo video and 20 s X clip rendered
- [ ] README claims verified against code and txs
- [ ] Submitted

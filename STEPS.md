# INSIDER: Build Plan for Two

Plan for the combined design (spec: [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md), product:
[PROJECT_INFO.md](PROJECT_INFO.md)). Hard deadline: **Nov 27, 9:00 AM EST = 14:00 UTC =
19:30 IST**. Target submit time: 08:00 UTC.

The plan is **block-driven, not date-driven**: finish a block, hit its sync point, start the next.
About 3 days of building, then a protected 2-day submission window. If the build runs long we cut
scope (section 9). We never spend submission days on features.

| Person            | Stream                                  | Owns (directories)                                                                           |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Anurag Dubey**  | **A: Chain, SDK, bots, infrastructure** | `programs/`, `sdk/`, `bots/`, `scripts/`, `tests/`, `idl/`, deploys, the operator            |
| **Misbah Ansari** | **B: Product, app, AI Desk**            | `app/`, design system, AI analysts and commentary, share cards, broadcast view, video assets |

Both: gate reviews, playtests, the final video, README proofs and the submission.

---

## 0. Ground rules

1. **One owner per directory.** Don't edit the other person's directory. Ask in chat, or open a
   small PR for them.
2. **Contract first.** The streams share only `sdk/` (typed client) and `idl/insider.json`. Stream A
   publishes them and Stream B consumes them. Changing an instruction's shape means updating the
   spec and telling the other person before pushing.
3. **Small commits, rebase before push.** `git pull --rebase origin main`, then push. One finished
   feature per commit with a clear message. **No `Co-Authored-By` or "Generated with" trailers.**
   Before rewriting shared docs, say so in chat: we both edited the same files once already.
4. **Run CI locally first:** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && cargo test -p insider`.
5. **No fakes.** The UI reads the real devnet table through `sdk/`. Typed fixtures are for
   component development only and are removed from live pages at handoff H3.
6. **No workarounds.** If a gate fails, the feature is cut from code and docs (spec section 4).
7. **Secrets** only in `.env` and host env vars. `.keys/` is never committed.
8. **Both of us use AI heavily.** Review AI output against the spec and run the tests.

---

## 1. Where we are (reuse, don't redo)

Done and pushed (Phases 0-2):

- Repo, CI, docs, toolchain (Node 24, pnpm 10, Rust 1.89, Solana 4.0.2, Anchor 1.2.2) and all
  dependencies (Next.js 16, wallet adapter, SDK 0.18, lightweight-charts, zod, ...).
- Lab program at `5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ` (`spike_*`, `lab_*`, `slot_*`), 7
  LiteSVM tests, and 13 devnet proof files in `docs/proofs/`.
- Proven on devnet: ER round trip, VRF in the public ER and the TEE, private permissions, VRF
  picking the sole reader and rewriting the permission atomically, finite cranks on the TEE, 6
  delegations per transaction, settle intents of at most 9 accounts (we use 8).
- Reusable code: `scripts/src/lib/{config,client,lab,rpc,tee,explorer}.ts` and
  `scripts/src/lab/*.ts`. They become the base of `sdk/` and `scripts/src/gates/`.

Still to do: everything in the spec. The program has only lab code, the app is the Next.js starter,
`bots/` is empty and `sdk/` doesn't exist.

**Fresh deploys are fine.** The game gets a new program ID. Anurag funds a new deployer (about 6
SOL) and an operator wallet (2 SOL). The lab program stays deployed so the old proofs remain valid,
and the lab source is tagged `phase-2-lab` before it is removed.

---

## 2. Gates (Block 0, owner: Anurag, review: both)

**G0 runs first and decides the shape of the Floor.** Each gate is a script in
`scripts/src/gates/gN-*.ts` and a row in `docs/gates.md` with transaction links, plus a pass or cut
decision written into the spec. Nothing that depends on a gate is built before its result.

| Gate                             | Script             | Needed by                   | Result written to                 |
| -------------------------------- | ------------------ | --------------------------- | --------------------------------- |
| **G0 Darkcheck**                 | `g0-darkcheck.ts`  | mempool, lanes, Flow Leaks  | spec sections 7.2-7.3, scope      |
| G1 Clock and tick rate           | `g1-clock.ts`      | all of A; B's timers        | spec section 6 (`SLOTS_PER_TICK`) |
| G2 Keyless reader                | `g2-keyless.ts`    | `Mempool`, `Future`, vaults | spec section 13                   |
| G3 Zero-balance key              | `g3-zero-sol.ts`   | guest onboarding (B)        | spec section 9                    |
| G4 Oracle in the TEE             | `g4-oracle.ts`     | The Desk                    | scope (in or cut)                 |
| G5 Private Payments              | `g5-payments.ts`   | Alpha Cup                   | scope (in or cut)                 |
| G6 Magic Action + SOAR           | `g6-actions.ts`    | achievements                | scope (in or cut)                 |
| G7 Session keys                  | `g7-session.ts`    | wallet identity (B)         | scope (in or cut)                 |
| G8 Epoch cycle                   | `g8-epoch.ts`      | Season and epoch design     | spec section 6                    |
| G9 Duplicate cranks              | `g9-cranks.ts`     | `tick` idempotency          | spec section 6                    |
| G10 Crank-invoked VRF (optional) | `g10-crank-vrf.ts` | per-drop VRF enhancement    | spec section 12                   |

**G0 procedure.** A lab `lab_send_secret(side_size)` instruction writes into a private lab account
with no members and prints no logs. Key A sends it on the TEE. Key B and an anonymous client try
`getTransaction`, `getSignaturesForAddress`, `logsSubscribe`, `simulateTransaction` and account
reads. Record what each path returns. If B learns nothing, the dark mempool stays. If anything
leaks, the Flow family and the lanes are removed and the Fundamentals market ships (spec section 4).

G1, G2, G3 and G9 are quick (the lab program is enough). G4-G8 and G10 need a small stub
instruction each in a throwaway `gates` module that is deleted once the gate passes.

---

## 3. Stream A: Anurag (chain, SDK, bots, infrastructure)

### A0. Reset and gates (Block 0)

- [ ] **A0.1** Tag the repo `phase-2-lab`. Create a new program keypair and ID
      (`.keys/insider-v1-program-keypair.json`), update `Anchor.toml`, `declare_id!`, `.env.example`.
      Remove `spike_*`, `lab_*` and `slot_*` from the program (the source stays in the tag).
- [ ] **A0.2** Create `sdk/` (workspace package `@insider/sdk`): move `config`, `client`, `rpc`,
      `tee`, `explorer`. Export typed `connection`, `program`, `teeAuth`. Add it to
      `pnpm-workspace.yaml`.
- [ ] **A0.3** Gates G0-G10 as above, with `docs/gates.md`. Update the spec with each result.
- [ ] **A0.4** `pnpm gates` runner that prints a pass/cut table.

**Done when:** `docs/gates.md` has every result and the spec scope is final. **Handoff H0.**

### A1. The Floor core (Block 1, P0)

- [ ] **A1.1** `math.rs`: `xorshift128+`, fundamental path (two regimes, 2-4 shocks, clamp), vAMM
      fills and fee, arbitrage pull (integer sqrt), Dutch price, Leak payload functions for all eight
      kinds. **Unit tests first.**
- [ ] **A1.2** State: `Table`, `Market[2]`, `Mempool` + `PendingOrder`, `Future`, `Tape`, `Board` +
      `LeakHeader`, `LeakVault`, `Seat`, `Xray`, `CallBook` + `CallHeader`, `CallVault`, `Season`.
      Fixed sizes, `InitSpace`.
- [ ] **A1.3** Setup: `init_table`, `init_slots`, `delegate_batch` (6 per transaction, 1.4M CU),
      `init_permissions` (`Mempool`, `Future` and vaults get the keyless reader).
- [ ] **A1.4** `request_round_seed` / `round_seed_callback` (const VRF identity, `request_id`;
      fills the future, whales and drop schedule), `cancel_vrf`.
- [ ] **A1.5** `send_order` (two lanes, limits, no logs, public `SendEvent`), `tick` (clock-derived,
      catch-up, maturity in `seq` order at most 12 per tick, arbitrage pull, liquidation, phase
      management), `schedule_ticks`, `rearm_ticks`.
- [ ] **A1.6** `claim_seat`, `ping`, seat classes (bot, AI, human-first).
- [ ] **A1.7** Economics simulator v1 (`scripts/src/sim/economics.ts` + `economics.rs`) with the
      six agents and the E1 checks.
- [ ] **A1.8** **Publish SDK v1** (instruction builders, account decoders, websocket
      subscriptions, `vamm`, `table` view-model) and the IDL. **Handoff H1.**

**Done when:** LiteSVM tests pass and `pnpm simulate-round --floor-only` runs seed, orders,
180 ticks and close on devnet.

### A2. Leaks and the live table (Block 2, P0)

- [ ] **A2.1** Drop schedule from the seed; Leak drops at their ticks (Flow and Fundamentals
      payloads from `Mempool` or `Future`); `bid` (Dutch); `open_leak` (members become `[owner]`);
      expiry in `tick`.
- [ ] **A2.2** `finish_round`: order log and payloads into `Xray`, **sandwich tags**, clear
      members, score into `Season`, reset seats.
- [ ] **A2.3** `pnpm simulate-round` full round with three keys; writes `docs/proofs`.
- [ ] **A2.4** **Privacy tests**: the opener reads; a second key and anonymous get nothing from the
      vault, the mempool or A's order transactions; the authority can't read sealed vaults.
- [ ] **A2.5** **Deploy the live devnet table** (setup script, delegate, permissions, crank armed).
      **Handoff H3.**
- [ ] **A2.6** `bots/` v1: Front-runner, Flow, Baiter with own keypairs and TEE tokens, one
      decision every 2 ticks, `request_round_seed` and `rearm_ticks` duty.

**Done when:** a human and three bots complete a round on the live table with no manual steps.

### A3. Exchange depth (Block 3, P1)

- [ ] **A3.1** Flip (`list_leak`, `buy_listed`), licensing (`offer_license`, `buy_license`), the
      hoard limit. **Tune and pass gate E1** (alpha decay visible, no free-money strategy, both Leak
      families profitable for a selective buyer).
- [ ] **A3.2** The Desk (if G4 passes): `mint_call`, `buy_call_license`, `schedule_settle` /
      `settle_due`, `desk_trade`, analyst stats in `Season`.
- [ ] **A3.3** Epoch: `commit_epoch`, `open_epoch`, operator service (`bots/src/operator.ts`) that
      runs both at the epoch boundary. Verify with a 10-round run.
- [ ] **A3.4** Alpha Cup (if G5 passes): `cup_join`, `cup_settle`, Private Payments integration with
      the platform fee account.
- [ ] **A3.5** Bots v2: Copycat, Flipper (also licenses), and bots that buy licenses. Two AI analyst
      seats registered (the strategy code is Misbah's, **handoff H6**).
- [ ] **A3.6** Recovery: `request_undelegation` wrapper and a runbook in `docs/`.

**Done when:** a full 10-round epoch runs with flips, licenses, Calls settled by the oracle, an
epoch commit and (if enabled) a private cup payout, all linked in `docs/proofs`.

### A4. Reach and infrastructure (Block 4, P2)

- [ ] **A4.1** Session keys (if G7 passes) in the program and `sdk/session`.
- [ ] **A4.2** Magic Action + SOAR leaderboard and achievements (if G6 passes).
- [ ] **A4.3** Production deploy: bot service and operator on an always-on host, dedicated devnet
      RPC, env management, health endpoint, auto-restart.
- [ ] **A4.4** 60-minute soak: five bots and two AI analysts. Fix everything it finds.
- [ ] **A4.5** `pnpm proofs` index covers every experiment and the live table; a feed for the app's
      `/proof` page.

### A5. Freeze and ship (Block 5)

- [ ] Code freeze at sync point S5. Only bug fixes after that.
- [ ] README statuses updated to `done` only for what is verifiable; proof checklist filled in.
- [ ] Final tag `v1.0-blitz`.

---

## 4. Stream B: Misbah (product, app, AI Desk)

You can start B0 immediately: it needs no chain work. From H1 on, use `@insider/sdk` types. Read
`app/AGENTS.md` first: this Next.js version differs from older docs (see
`node_modules/next/dist/docs/`).

### B0. Foundation (Block 0)

- [ ] **B0.1** Design system: tokens (dark terminal, cold blue for sealed, hot amber for opened,
      grey/cyan/magenta rarities, mono numerals), type scale, spacing, motion rules,
      `prefers-reduced-motion`.
- [ ] **B0.2** Components with typed fixtures (test data in `app/src/fixtures`, never on live
      pages): `GhostOrder`, `SealedCard`, `LeakCard` (all six states, both families), `PriceChart` (with
      landing markers and sandwich arrows), `SeatRail` (with lane tells), `OrderPanel`, `AuctionTimer`,
      `ActivityFeed`, `PhaseBar`.
- [ ] **B0.3** Landing page: the sealed-card hero, one-sentence pitch, **Play** button.
- [ ] **B0.4** Providers: wallet adapter, query client, SDK context.

### B1. The trading floor (Block 1)

- [ ] **B1.1** After **H1**: `/table` reads live accounts through `sdk/` (Table, Market, Tape,
      Seats) with websocket updates at 2 Hz and no layout jitter.
- [ ] **B1.2** Onboarding: guest key creation (stored in `localStorage`, exportable), seat claim,
      TEE login, chip balance, "you are seat 4". Follow gate G3 for funding.
- [ ] **B1.3** Order panel: side, size, lane (standard or priority with the fee), a price-impact
      preview from `sdk/vamm`, and your **ghost orders** drifting toward the chart until they land
      (shown from client memory, never from chain).
- [ ] **B1.4** Phase bar and timers driven by `Table.tick`, not by wall clocks.

### B2. Leaks on screen (Block 2)

- [ ] **B2.1** Leak board: auction cards with the falling price, rarity styling, sealed state,
      family badge (Flow or Fundamentals).
- [ ] **B2.2** **Crack-open animation** (the hero moment): the purchase, the TEE login, the payload
      revealed on the chart (pending orders as ghosts, or the fundamental path).
- [ ] **B2.3** **X-ray replay**: every order (sent to landed), every Leak and who held it, sandwich
      arrows, scrubbable, ending in the round score. The same component powers `/xray/[round]` and the
      inline end-of-round view.
- [ ] **B2.4** Activity feed: who sent an order in which lane, who opened what, copy and fade
      shortcuts.
- [ ] **B2.5** The **two-browser test** page (or a documented procedure) for the demo.

### B3. Exchange depth screens (Block 3)

- [ ] **B3.1** Flip and license flows: sell sealed, offer a license, buy one, readers list, and a
      live "edge left" indicator derived from readers and impact.
- [ ] **B3.2** `/desk`: Call board, mint-a-Call form, oracle chart, analyst leaderboard with hit
      rate and streaks, license flow, settled-Call history.
- [ ] **B3.3** **AI Desk** (handoff **H6**): two analyst agents (own keys, Anthropic API, public
      data only) that mint Calls through `@insider/sdk`, and a commentary service that turns public
      events into short captions. Prompt files live in `bots/src/ai/`; coordinate with Anurag, who owns
      `bots/`, before merging.
- [ ] **B3.4** `/cup`: Alpha Cup entry, standings, private payout confirmation (if G5 passes).
- [ ] **B3.5** Share card generator (Next.js OG image route): "I read a Full Book Leak for 120 and
      front-ran a whale for +412", used by X-ray and the Desk.

### B4. Reach and polish (Block 4)

- [ ] **B4.1** `/watch` broadcast view: auto-camera on the biggest event, live captions, no
      controls, 16:9 recording mode.
- [ ] **B4.2** `/proof` page: live links to the program, delegation, VRF, permission and payment
      transactions, fed by `docs/proofs` and the SDK.
- [ ] **B4.3** Wallet identity and session-key UI (if G7 passes): connect, create session, revoke,
      leaderboard under your key.
- [ ] **B4.4** SOAR achievements display (if G6 passes).
- [ ] **B4.5** Motion and sound polish, mobile layout, empty, loading and error states,
      accessibility pass.

### B5. Video and launch assets (Block 5 and the submission window)

- [ ] Storyboard (section 7), capture sessions from the live app, motion graphics with the
      HyperFrames or Remotion skills, an 80 s film plus a 20 s X clip.
- [ ] Landing copy, screenshots and the X thread.

---

## 5. Handoffs (the only places the streams depend on each other)

| ID     | From to | What                                                                                                | When                  |
| ------ | ------- | --------------------------------------------------------------------------------------------------- | --------------------- |
| **H0** | A to B  | Gate results, especially G0 (mempool or not), G3 (funding) and G7 (session keys)                    | End of Block 0        |
| **H1** | A to B  | `@insider/sdk` v1 and `idl/insider.json`: typed accounts, builders, subscriptions, TEE auth, `vamm` | First half of Block 1 |
| **H2** | A to B  | Constants exported by the SDK: `SLOTS_PER_TICK`, lane delays and fees, auction lengths              | With H1               |
| **H3** | A to B  | **Live devnet table** running with bots: URL and setup transcript                                   | End of Block 2        |
| **H4** | B to A  | UI findings from the first live round: missing fields, slow reads, awkward flows                    | Sync point S2         |
| **H5** | A to B  | Desk, license and cup instructions in the SDK                                                       | Mid Block 3           |
| **H6** | B to A  | AI analyst and commentary code merged into `bots/src/ai/`                                           | Late Block 3          |
| **H7** | A to B  | Production URLs, proof feed, session key support                                                    | Block 4               |

If a handoff slips, the receiver works on the next item that doesn't need it. Every block has
independent work.

---

## 6. Sync points (join, run it live, decide)

| Sync   | When               | What we do together                              | Pass condition                                 |
| ------ | ------------------ | ------------------------------------------------ | ---------------------------------------------- |
| **S1** | End of Block 0     | Review gates, freeze scope, agree the SDK shape  | Every gate row decided; G0 result known        |
| **S2** | End of Block 2     | Play a full round, two browsers, bots running    | Two-browser privacy test works; no stuck phase |
| **S3** | End of Block 3     | Economics, Desk and cup playtest, 10-round epoch | E1 passes; epoch commit lands                  |
| **S4** | End of Block 4     | Soak report, mobile and polish review            | 60-minute soak clean                           |
| **S5** | **Feature freeze** | Decide what is cut, tag the release candidate    | No red items                                   |
| **S6** | Submission window  | Video review, README and form dry run            | Section 8 ready                                |

---

## 7. Demo and video plan (owners: both; Misbah leads design, Anurag leads proofs)

About 80 s, recorded from the real app:

1. **0:00** A pending order card, glowing. "This order executes in 10 seconds. Someone just paid
   to see it."
2. **0:08** Title: INSIDER. "Own the secret."
3. **0:14** A Leak drops, the price falls, one click buys it. The same second, a second browser
   shows "nothing" for that account (the two-browser test).
4. **0:26** Crack it open: an 800-unit buy landing in 7 s. Priority-send ahead, the price moves,
   sell into it.
5. **0:40** A flip, a license, a bot copying the trade, the edge shrinking.
6. **0:52** X-ray with sandwich arrows.
7. **1:02** The Desk: an AI analyst's Call resolves against the live oracle.
8. **1:10** The proof page: VRF request, permission rewrite, delegation, private payout.
9. **1:18** End card: Own the secret. Link, repo.

Plus a 20 s X clip (steps 3-4 and 6) and share cards.

---

## 8. Submission checklist (window: last 2 days)

- [ ] Live URL works for a cold visitor and the table is running.
- [ ] README: statuses honest, program ID, live URL, transaction links, proof checklist filled.
- [ ] Both teammates logged in to build.magicblock.app, profiles saved, **team member added** in
      the form, one wallet entered for prizes (agree the split now).
- [ ] Form: name, description, categories (Games, Privacy, AI / Agents), GitHub repo, video,
      explorer link, **on-chain addresses** (program, operator wallet, platform fee account), X account.
- [ ] Post the clip on X, tag @magicblock.
- [ ] Submit at least 6 hours before the deadline.

---

## 9. Cut order and freeze

If time runs short, cut from the bottom and never from the top:

1. Mobile polish and sound 2. Share cards 3. SOAR / Magic Action 4. Session keys
2. Alpha Cup 6. AI commentary (keep the analysts) 7. The Desk 8. Broadcast view

**Never cut:** G0, the Floor, Leaks, the two-browser privacy test, the X-ray, E1 and the live
table.

---

## 10. Definition of done

- [ ] G0 recorded and the design decision written down
- [ ] Table runs continuously on devnet with bots, with no keeper in the game loop
- [ ] VRF, permission and rollup transactions linked in the README
- [ ] A second key can't read pending orders or a Leak it doesn't own (tested and filmed)
- [ ] A cold visitor plays with no wallet
- [ ] Video and X clip rendered
- [ ] README claims verified against code and transactions
- [ ] Submitted

---

## 11. Commands

```bash
pnpm install
pnpm dev                         # app
pnpm program:build && pnpm program:idl && pnpm program:deploy
pnpm gates                       # gate runner (A0.4)
pnpm simulate-round              # full devnet round (A2.3)
pnpm sim:economics               # economics simulator (A1.7)
pnpm bots                        # bot service
pnpm proofs                      # rebuild docs/proofs/README.md
```

Funding needs: Anurag's deployer (about 6 SOL), operator wallet (2 SOL), each bot and AI key
(0.05 SOL), a devnet test mint for the cup. Misbah needs a devnet wallet for session-key work.

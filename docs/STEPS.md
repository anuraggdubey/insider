# INSIDER: Build Plan for Two

Plan for the combined design (spec: [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md), product:
[PROJECT_INFO.md](PROJECT_INFO.md)). Hard deadline: **Nov 27, 9:00 AM EST = 14:00 UTC =
19:30 IST**. Target submit time: 08:00 UTC.

**Pace.** Block-driven, not date-driven: finish a block, hit its sync point, start the next. About 3
days of building, then a protected 2-day submission window. If the build runs long we cut scope
(section 12). We never spend the submission window on features.

**The video is not in this plan.** Anurag will record it and both of us will edit it. It gets added
here when we start it.

---

## 1. The split at a glance (equal on purpose)

Each person owns about **105-108 hours** of work, an almost equal share of Rust, and an almost
equal share of TypeScript and UI. The split follows these rules: the **SDK** goes to Misbah (it's the
biggest TypeScript piece and doesn't need heavy builds), and Anurag's PC takes the **lighter
compute** work (scripts, gates, bots, hosting, devnet ops, smaller UI screens) plus a Rust share
that is mostly instruction wiring rather than big builds.

|                                 | **Anurag Dubey**                                                                                                                            | **Misbah Ansari**                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Theme                           | **Lifecycle, gates, Desk, bots, infra**                                                                                                     | **Market engine, Leaks, SDK, trading UI**                                                                                                                                                        |
| Rust (about 40 h vs 39 h)       | Table setup and delegation, seats, VRF round seed, `tick` loop and cranks, epoch, recovery; **Desk, Alpha Cup, Magic Action, session keys** | **Math and engine** (price path, vAMM, arbitrage, Dutch, payloads), **orders and mempool**, **Leaks** (drops, bid, open, flip, license), **X-ray and sandwiches**, **economics gate E1**         |
| TypeScript (about 50 h vs 28 h) | Gates G0-G10, setup and simulate-round scripts, **5 bots + operator**, **AI analysts and commentary**, hosting, soak, proofs                | **SDK** (`@insider/sdk`)                                                                                                                                                                         |
| UI (about 18 h vs 38 h)         | `/desk`, `/cup`, `/proof`                                                                                                                   | Design system, landing, **floor**, order panel and ghost orders, **Leak board and crack-open**, **X-ray**, flip and license UI, onboarding, wallet and session UI, `/watch`, share cards, polish |
| Total hours                     | **108**                                                                                                                                     | **105**                                                                                                                                                                                          |

If one of us falls behind, the other takes tasks from the **overflow list** (section 11), not from
the other person's list.

---

## 1.1 Repository layout (clean and minimal)

```
README.md  LICENSE  package.json  pnpm-workspace.yaml  pnpm-lock.yaml  .env.example  .gitignore
.github/    CI workflow
app/        Next.js app (Misbah)
bots/       bot service, AI analysts, operator (Anurag)
scripts/    gates, setup, simulate-round, proof index; scripts/test (Anurag)
programs/   Rust workspace: Cargo.toml, Anchor.toml, rust-toolchain.toml, insider/ (the program), idl/
docs/       PROJECT_INFO, TECHNICAL_SPEC, STEPS, Phase 2 findings, proofs
sdk/        typed client (added by Misbah, task B-SDK-1)
```

Everything tool-specific lives inside a folder: the Rust files are in `programs/` (run Rust commands
through the `pnpm program:*` scripts, which `cd programs` for you), the Prettier config is inside
`package.json`, and the plan and specs are in `docs/`.

---

## 2. Ground rules

1. **One owner per file area** (section 5). Don't edit the other person's area. Ask in chat, or open
   a small PR for them.
2. **Contracts first.** The streams share three things: the **engine API** (Rust function
   signatures, handoff H-API), the **IDL** (`programs/idl/insider.json`) and the **SDK** (`sdk/`). Changing
   any of them means telling the other person before pushing.
3. **Small commits, rebase before push.** `git pull --rebase origin main`, then push. One finished
   feature per commit with a clear message. **No `Co-Authored-By` or "Generated with" trailers.**
4. **Say it before you rewrite a shared doc.** We both rewrote the same four docs once already.
5. **Run CI locally first:** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm program:test`.
6. **No fakes.** The UI reads the real devnet table through `sdk/`. Typed fixtures are for
   component development only and are removed from live pages at handoff H3.
7. **No workarounds.** If a gate fails, the feature is cut from code and docs (spec section 4).
8. **Secrets** only in `.env` and host env vars. `.keys/` is never committed.
9. **Both of us use AI heavily.** Review AI output against the spec and run the tests.

---

## 3. What we delete from the old (Phase 0-2) work

Nothing is lost: before deleting, Anurag tags the repo **`phase-2-lab`**. The lab program, lab
scripts and proofs are reproducible from that tag, and `docs/proofs/` and
`docs/phase-2-findings.md` **stay** in the repo as the evidence of what we proved.

### 3.1 Delete from the program (`programs/insider/`)

Delete after porting the patterns listed in 3.3:

| Delete             | Files                                                                                                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spike instructions | `src/instructions/spike_init.rs`, `spike_increment.rs`, `spike_delegate.rs`, `spike_commit.rs`, `spike_undelegate.rs`                                                                                                                                                         |
| Lab instructions   | `src/instructions/lab_init.rs`, `lab_delegate.rs`, `lab_request_roll.rs`, `lab_roll_callback.rs`, `lab_cancel_roll.rs`, `lab_permission.rs`, `lab_request_pick.rs`, `lab_pick_callback.rs`, `lab_tick.rs`, `lab_schedule_tick.rs`, `lab_commit.rs`, `lab_undelegate.rs`       |
| Slot instructions  | `src/instructions/slot_batch.rs`                                                                                                                                                                                                                                              |
| Old state          | `src/state/spike.rs`, `src/state/lab.rs`, `src/state/slot.rs`                                                                                                                                                                                                                 |
| Old tests          | `programs/insider/tests/spike.rs`, `lab.rs`                                                                                                                                                                                                                                   |
| Registry lines     | the `spike_*`, `lab_*`, `slot_*` entries in `src/lib.rs`, `src/instructions.rs`, `src/state.rs`; the constants `SPIKE_SEED`, `LAB_SEED`, `LAB_MAX_CANDIDATES`, `LAB_MAX_PERMISSION_MEMBERS`, `SLOT_SEED`; the error variants `RollPending`, `NoRollPending`, `TooManyMembers` |
| Generated          | the contents of `programs/idl/insider.json` (regenerated for the new program)                                                                                                                                                                                                 |
| Identity           | the old program ID `5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ` in `Anchor.toml`, `declare_id!`, `.env.example` (the old keypair file stays in `.keys/`; the old program stays deployed on devnet)                                                                          |

**Keep** `src/constants.rs` entries `CRANK_PROGRAM_ID` and `TASK_CONTEXT_ID`, and `rust-toolchain.toml`,
`Cargo.toml`, `Anchor.toml` structure.

### 3.2 Delete from scripts, tests and root

| Delete                         | Files                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Experiments                    | `scripts/src/spike.ts`, `scripts/src/lab/crank.ts`, `per.ts`, `pick.ts`, `slots.ts`, `vrf.ts`                                               |
| Lab helper                     | `scripts/src/lib/lab.ts`                                                                                                                    |
| Root scripts in `package.json` | `spike`, `lab:vrf`, `lab:per`, `lab:pick`, `lab:crank`, `lab:slots`, `validator:local`                                                      |
| Starter content                | the default Next.js page body in `app/src/app/page.tsx` and the starter styles in `app/src/app/globals.css` (replaced by the design system) |
| Placeholder                    | `bots/src/index.ts` (replaced by the real service)                                                                                          |

**Move, don't delete:** `scripts/src/lib/{config,rpc,tee,explorer}.ts` move into `sdk/` (task B-SDK-1).
`client.ts` was removed with the lab scripts; restore it from the tag when building the SDK. **Keep:**
`scripts/src/build-proof-index.ts`, `scripts/check-setup.ts`, `scripts/test/setup.test.ts` (updated),
`docs/proofs/*`, `docs/phase-2-findings.md`.

### 3.3 Port before deleting (knowledge we keep)

| Pattern                                                                                | From                                           | Used by                                                     |
| -------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| VRF callback with the compile-time scoped identity (fixes the 270k-CU `const fn` cost) | `lab_roll_callback.rs`, `lab_pick_callback.rs` | `round_seed_callback` (Anurag)                              |
| Permission create, update, close CPIs; the keyless reader                              | `lab_permission.rs`                            | `init_permissions`, `open_leak`, `buy_license`, `mint_call` |
| Atomic permission rewrite from a callback                                              | `lab_pick_callback.rs`                         | `settle_due`, `open_leak`                                   |
| Crank schedule, the crank signer check, `remaining_accounts` lifetimes                 | `lab_tick.rs`, `lab_schedule_tick.rs`          | `schedule_ticks`, `rearm_ticks`, `tick`                     |
| Batched delegation (6 per transaction, 1.4M CU) and batched settle (at most 8)         | `slot_batch.rs`, `scripts/src/lab/slots.ts`    | `delegate_batch`, `teardown`, `commit_epoch`                |
| TEE login, send helper, delegation wait and retry                                      | `scripts/src/lib/{tee,client,lab}.ts`          | `sdk/`                                                      |

### 3.4 Remove these installed packages (unused)

Run from the repo root. Nothing in the source imports them.

```bash
pnpm --filter app remove @solana/kit @magicblock-labs/ephemeral-rollups-kit @solana-program/token
pnpm --filter bots remove @solana/kit
pnpm --filter tests remove @solana/kit
pnpm --filter scripts remove @solana/kit
pnpm remove -w @magicblock-labs/ephemeral-validator
```

Why: the game uses the web3.js 1.x path with SDK 0.18, so the kit packages (and their peer-dependency
warning) aren't needed; the local rollup validator is a large download we don't use (we test on
devnet). Owner: Anurag (task A-0.2), who pushes it so Misbah installs a lighter tree.

---

## 4. Dependencies and machine setup

### 4.1 New packages to add, by gate

Nothing is added speculatively. Each package is installed **only when its gate passes** (the person
who owns the gate installs it and pushes the lockfile).

| Package                                       | Where                                          | Needed for                          | Added when                                                               | Command                                                            |
| --------------------------------------------- | ---------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **`sdk/` workspace package** (`@insider/sdk`) | new `sdk/` dir, added to `pnpm-workspace.yaml` | typed client for app, bots, scripts | Block 0 (Misbah B-SDK-1)                                                 | see 4.4                                                            |
| `@magicblock-labs/gum-sdk` 3.0.x              | `sdk`                                          | session keys                        | G7 passes                                                                | `pnpm --filter @insider/sdk add @magicblock-labs/gum-sdk`          |
| `@magicblock-labs/gum-react-sdk` 3.0.x        | `app`                                          | session-key React hooks             | G7 passes                                                                | `pnpm --filter app add @magicblock-labs/gum-react-sdk`             |
| Rust crate `session-keys` 3.1.x               | `programs/insider`                             | session keys on chain               | G7 passes                                                                | `cargo add session-keys@3.1 -p insider`                            |
| Rust crate `pyth-solana-receiver-sdk` 2.x     | `programs/insider`                             | reading the oracle price account    | G4, **only if** manual byte decoding of the feed account turns out worse | `cargo add pyth-solana-receiver-sdk@2 -p insider`                  |
| `@pythnetwork/pyth-solana-receiver`           | `app` or `sdk`                                 | client-side feed account decoding   | G4, **only if** needed                                                   | `pnpm --filter @insider/sdk add @pythnetwork/pyth-solana-receiver` |
| `@magicblock-labs/soar-sdk` 0.1.x             | `app`, `sdk`                                   | SOAR achievements                   | **already installed** in `app`; add to `sdk` when G6 passes              | `pnpm --filter @insider/sdk add @magicblock-labs/soar-sdk`         |
| Private Payments                              | none                                           | Alpha Cup                           | G5: it is an HTTP API, so plain `fetch`                                  | no package                                                         |

Already installed and **kept**: `next`, `react`, `tailwindcss`, `framer-motion`,
`lightweight-charts`, `lucide-react`, `clsx`, `tailwind-merge`, `zustand`, `@tanstack/react-query`,
`zod`, `@solana/wallet-adapter-*`, `@wallet-standard/core`, `@solana/web3.js` (1.x),
`@solana/spl-token`, `@anchor-lang/core`, `@magicblock-labs/ephemeral-rollups-sdk` (**0.18.0, never
0.20**), `bs58`, `tweetnacl`, `dotenv`, `pino`, `ws`, `@anthropic-ai/sdk`, `prettier`, `vitest`,
`tsx`, `typescript`. Rust crates in use: `anchor-lang` 1.2.2, `ephemeral-rollups-sdk` 0.18.0
(features `anchor`, `vrf`, `access-control`, `crank`), dev: `litesvm`.

### 4.2 Machine setup checklist

**Misbah: do all of this.** Anurag: verify with `pnpm tsx scripts/check-setup.ts` (everything must
print `ok`). Commands below are for Windows (PowerShell); macOS and Linux notes in parentheses.

| #   | Tool                                             | Version                    | How                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Git                                              | any recent                 | https://git-scm.com. Then `git config user.name "..."` and `git config user.email "..."`                                                                                                                                                          |
| 2   | GitHub access                                    |                            | Accept the repo invite for `anuraggdubey/insider`. `git clone https://github.com/anuraggdubey/insider.git`                                                                                                                                        |
| 3   | C++ build tools (Windows)                        | VS Build Tools 2022        | Install "Desktop development with C++". Needed by Rust. (macOS: `xcode-select --install`. Linux: `build-essential`)                                                                                                                               |
| 4   | Node.js                                          | **24.x** (24.15 works)     | nvm-windows: `nvm install 24.15.0; nvm use 24.15.0` (macOS/Linux: nvm)                                                                                                                                                                            |
| 5   | pnpm                                             | **10.34.9**                | `npm i -g pnpm@10.34.9` or `corepack enable; corepack prepare pnpm@10.34.9 --activate`                                                                                                                                                            |
| 6   | Rust                                             | **1.89.0**                 | https://rustup.rs, then `rustup toolchain install 1.89.0; rustup component add rustfmt clippy --toolchain 1.89.0`. The repo's `rust-toolchain.toml` selects it                                                                                    |
| 7   | Solana CLI (Agave)                               | **4.0.x**                  | https://docs.anza.xyz/cli/install. Check `solana --version` and `cargo build-sbf --version`                                                                                                                                                       |
| 8   | Anchor CLI                                       | **1.2.2**                  | https://www.anchor-lang.com/docs/installation (avm). **Windows:** `avm install 1.2.2` works but the symlink step fails; copy the binary: `copy %USERPROFILE%\.avm\bin\anchor-1.2.2 %USERPROFILE%\.cargo\bin\anchor.exe`. Check `anchor --version` |
| 9   | Disk and RAM                                     | about 15 GB free, 8 GB RAM | Rust and SBF tool caches are large. Close the browser while building                                                                                                                                                                              |
| 10  | VS Code (or similar) + rust-analyzer             |                            | optional but recommended                                                                                                                                                                                                                          |
| 11  | Claude Code (or your AI tool)                    |                            | and the MagicBlock dev skill: `npx skills add https://github.com/magicblock-labs/magicblock-dev-skill` (it installs into your local, git-ignored `.agents/`)                                                                                      |
| 12  | Phantom (or any Solana wallet) set to **devnet** |                            | for session-key and wallet work                                                                                                                                                                                                                   |
| 13  | Accounts                                         |                            | Telegram (needed by build.magicblock.app), https://build.magicblock.app login, builder profile saved                                                                                                                                              |

First-time project setup (everyone):

```bash
git clone https://github.com/anuraggdubey/insider.git
cd insider
pnpm install                      # installs every workspace package
cp .env.example .env              # then fill values (4.3)
pnpm tsx scripts/check-setup.ts   # all lines must be "ok"
pnpm program:check                # first run downloads and compiles for a few minutes
pnpm dev                          # app on http://localhost:3000
```

A repo-level note for Misbah: `app/AGENTS.md` says this Next.js version differs from older ones.
Read the relevant guide in `node_modules/next/dist/docs/` before writing app code.

### 4.3 Environment variables (`.env`, never committed)

| Variable                                               | Who         | Value                                                                                                                               |
| ------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SOLANA_RPC_URL`                                       | both        | dedicated devnet RPC once Anurag sets it up (A-5.3); until then `https://api.devnet.solana.com`                                     |
| `MAGIC_ROUTER_URL`, `MAGIC_ROUTER_WS_URL`              | both        | `https://devnet-router.magicblock.app`, `wss://devnet-router.magicblock.app`                                                        |
| `TEE_RPC_URL`, `TEE_VALIDATOR`                         | both        | `https://devnet-tee.magicblock.app`, `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`                                                  |
| `INSIDER_PROGRAM_ID`, `NEXT_PUBLIC_INSIDER_PROGRAM_ID` | both        | the **new** program ID, announced by Anurag after A-0.1                                                                             |
| `ANCHOR_WALLET`                                        | each dev    | path to your own devnet keypair, e.g. `./.keys/deployer.json`. Misbah generates his own: `solana-keygen new -o .keys/deployer.json` |
| `ANTHROPIC_API_KEY`                                    | Anurag only | for AI analysts and commentary                                                                                                      |
| `AGENT_KEYPAIR_DIR`                                    | Anurag only | `./.keys/agents`                                                                                                                    |
| `OPERATOR_KEYPAIR`                                     | Anurag only | `./.keys/operator.json`                                                                                                             |

Devnet SOL: Anurag funds a fresh deployer (about 6 SOL) and an operator (2 SOL). Misbah needs about
2 SOL on his own devnet wallet (faucet.solana.com) for testing. Each bot and AI key needs 0.05 SOL
(Anurag's script funds them).

### 4.4 The new `sdk/` package skeleton (Misbah, task B-SDK-1)

```bash
mkdir sdk && cd sdk
pnpm init                         # then set name "@insider/sdk", "type": "module", "main": "src/index.ts", "private": true
```

Add `sdk` to `pnpm-workspace.yaml`, then:

```bash
pnpm --filter @insider/sdk add @solana/web3.js@1 @anchor-lang/core @magicblock-labs/ephemeral-rollups-sdk@0.18.0 tweetnacl bs58 zod
pnpm --filter app add @insider/sdk@workspace:*
pnpm --filter bots add @insider/sdk@workspace:*
pnpm --filter scripts add @insider/sdk@workspace:*
```

The SDK ships TypeScript source (no build step). In `app/next.config.ts` add
`transpilePackages: ["@insider/sdk"]`. Bots and scripts run it through `tsx`.

---

## 5. File ownership (who edits what)

### 5.1 Program (`programs/insider/src/`)

Shared registry files (`lib.rs`, `constants.rs`, `error.rs`, `instructions.rs`, `state.rs`) are
**add-only**: add your own lines, in alphabetical order, never reformat the other person's lines, and
rebase before every push.

| Area            | Anurag                                                                                                                        | Misbah                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `math/`         |                                                                                                                               | `prng.rs`, `path.rs`, `vamm.rs`, `arb.rs`, `dutch.rs`, `payloads.rs`, `seed.rs`                          |
| `engine/`       | calls `engine::step` from `tick`                                                                                              | `engine/step.rs` (the pure per-tick function: maturity, arbitrage, drops, auctions, liquidation, phases) |
| `state/`        | `table.rs`, `seat.rs`, `tape.rs`, `calls.rs`, `season.rs`                                                                     | `market.rs`, `mempool.rs`, `future.rs`, `board.rs`, `leak_vault.rs`, `xray.rs`                           |
| `instructions/` | `setup.rs`, `round_seed.rs`, `tick.rs`, `cranks.rs`, `seats.rs`, `epoch.rs`, `recovery.rs`, `desk.rs`, `cup.rs`, `session.rs` | `orders.rs`, `leaks.rs`, `licenses.rs`, `finish_round.rs`                                                |
| `tests/`        | `insider/tests/lifecycle.rs`, `insider/tests/desk.rs`                                                                         | `tests/engine.rs`, `tests/leaks.rs`, `tests/economics.rs`                                                |

### 5.2 TypeScript and app

| Area                  | Anurag                                                                   | Misbah                                                                             |
| --------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `sdk/`                | consumes it                                                              | **owns it**                                                                        |
| `app/src/app/` routes | `desk/`, `cup/`, `proof/`                                                | `page.tsx` (landing), `table/`, `xray/[round]/`, `watch/`, `api/og/` (share cards) |
| `app/src/components/` | `desk/*`, `cup/*`, `proof/*`                                             | `ui/*` (design system), `floor/*`, `leaks/*`, `xray/*`, `onboarding/*`, `watch/*`  |
| `app/src/lib/`        |                                                                          | everything (thin wrappers over the SDK)                                            |
| `bots/`               | **owns it** (`strategies/`, `ai/`, `operator.ts`, `loop.ts`)             | none                                                                               |
| `scripts/`            | **owns it** (`gates/`, `setup-table.ts`, `simulate-round.ts`, `fund.ts`) | none                                                                               |
| `docs/`, `README.md`  | `docs/gates.md`, `docs/proofs/`                                          | `docs/engine.md` (math notes, E1 results)                                          |

The design system (`app/src/components/ui`, Misbah) must exist before Anurag builds the Desk, Cup,
Proof and Watch screens. Anurag's UI work is scheduled after that (Blocks 3-4).

---

## 6. Blocks, sync points and handoffs

| Block                          | Goal                                                            | Sync at the end         |
| ------------------------------ | --------------------------------------------------------------- | ----------------------- |
| **0 Reset and gates**          | Repo reset, gates decided, SDK skeleton, design system          | **S1**                  |
| **1 Floor core**               | Market engine, orders, lifecycle, vertical slice on devnet      | **S2**                  |
| **2 Leaks and the live table** | Leaks, X-ray, bots, live table, trading UI                      | **S3**                  |
| **3 Exchange depth**           | Flip, license, Desk, cup, AI analysts, epoch                    | **S4**                  |
| **4 Reach and polish**         | Session keys, Actions and SOAR, proof, watch, share cards, soak | **S5 (feature freeze)** |
| **5 Ship**                     | QA, README proofs, submission (video added when we start it)    | **S6**                  |

### Handoffs (the only places we wait on each other)

| ID        | From to | What                                                                                                                                 | When                     |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| **H0**    | A to B  | Gate results (G0 mempool yes or no, G3 funding, G7 sessions) and the new program ID                                                  | End of Block 0           |
| **H-API** | B to A  | **Engine API**: `math/` and `engine/step.rs` function signatures and the `state/` structs B owns (stubs with `todo!()` are fine)     | First 4 hours of Block 1 |
| **H1**    | B to A  | **SDK v0**: connection, TEE auth, send helper, account decode from the IDL, instruction builders (A needs this for bots and scripts) | Mid Block 1              |
| **H2**    | both    | Fresh `programs/idl/insider.json` after each program milestone                                                                       | Each milestone           |
| **H3**    | A to B  | **Live devnet table** with bots: URL and setup transcript                                                                            | End of Block 2           |
| **H4**    | B to A  | UI findings from the first live round                                                                                                | S3                       |
| **H5**    | A to B  | Desk, license and cup instructions in the IDL                                                                                        | Mid Block 3              |
| **H6**    | A to B  | Production URLs, proof feed, session-key support                                                                                     | Block 4                  |

If a handoff slips, the receiver works on the next task that doesn't need it. Every block has
independent work.

---

## 7. Gates (Block 0, owner Anurag, reviewed by both)

**G0 runs first and decides the shape of the Floor.** Each gate is a script in
`scripts/src/gates/gN-*.ts` and a row in `docs/gates.md` with transaction links, plus a pass or cut
decision written into the spec. Nothing that depends on a gate is built before its result.

| Gate                             | Script             | Needed by                   | Result written to         |
| -------------------------------- | ------------------ | --------------------------- | ------------------------- |
| **G0 Darkcheck**                 | `g0-darkcheck.ts`  | mempool, lanes, Flow Leaks  | spec 7.2-7.3, scope       |
| G1 Clock and tick rate           | `g1-clock.ts`      | `tick`; UI timers           | spec 6 (`SLOTS_PER_TICK`) |
| G2 Keyless reader                | `g2-keyless.ts`    | `Mempool`, `Future`, vaults | spec 13                   |
| G3 Zero-balance key              | `g3-zero-sol.ts`   | guest onboarding            | spec 9                    |
| G4 Oracle in the TEE             | `g4-oracle.ts`     | The Desk                    | scope                     |
| G5 Private Payments              | `g5-payments.ts`   | Alpha Cup                   | scope                     |
| G6 Magic Action + SOAR           | `g6-actions.ts`    | achievements                | scope                     |
| G7 Session keys                  | `g7-session.ts`    | wallet identity             | scope                     |
| G8 Epoch cycle                   | `g8-epoch.ts`      | Season and epoch            | spec 6                    |
| G9 Duplicate cranks              | `g9-cranks.ts`     | `tick` idempotency          | spec 6                    |
| G10 Crank-invoked VRF (optional) | `g10-crank-vrf.ts` | per-drop VRF enhancement    | spec 12                   |

**G0 procedure.** A lab `lab_send_secret(side_size)` instruction (written in the `phase-2-lab`
state, before deletion) writes into a private lab account with no members and prints no logs. Key A
sends it on the TEE. Key B and an anonymous client try `getTransaction`, `getSignaturesForAddress`,
`logsSubscribe`, `simulateTransaction` and account reads. Record what each path returns. If B learns
nothing, the dark mempool stays. If anything leaks, the Flow family and the lanes are removed and
the Fundamentals market ships (spec section 4).

G1, G2, G3 and G9 are quick (the lab program is enough). G4-G8 and G10 need a small stub
instruction each in a throwaway `gates` module, deleted once the gate passes.

---

## 8. Anurag's work (108 h)

Light on PC load: scripts, gates, bots, hosting and screens. His Rust is mostly instruction wiring.
While editing Rust, use `pnpm program:check` and `pnpm program:test`; only run
`pnpm program:build` (release) before a deploy.

### Block 0: Reset and gates (13 h)

- [x] **A-0.1 Tag and reset (2 h).** _Done:_ tag `phase-2-lab` pushed, all lab, spike and slot code
      deleted (sections 3.1-3.2), the program is an empty placeholder that passes `pnpm program:check`,
      the repo root was cleaned up (section 1.1), and the stale `leak-exchange-v1` branch was deleted.
      New program ID `7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW` (keypair
      `.keys/insider-v1-program-keypair.json`) is set in `programs/Anchor.toml`, `declare_id!`,
      `.env.example` and `scripts/src/lib/config.ts`. Announce it to Misbah with the H0 handoff.
- [x] **A-0.2 Remove unused packages (0.5 h).** _Done:_ the packages in 3.4 are removed and the lockfile is
      committed. Misbah: run `pnpm install`.
- [x] **A-0.3 Update scripts (0.5 h).** _Done:_ old root scripts removed, `program:*` scripts now run from
      `programs/`. Still to add as the work arrives: `gates`, `fund`, `setup-table`, `simulate-round`.
- [x] **A-0.4 Gates G0-G10 (8 h).** _Done:_ one script per gate in `scripts/src/gates/`, run on
      devnet against a throwaway probe program (`programs/gates`, ID in `.env.example`). **9 pass
      (G0-G5, G7-G9), none cut, 2 informational:** G6 (Magic Action works, SOAR untested, decided
      at A-4.2) and G10 (a crank cannot request VRF, nothing changes). Results are in
      [gates.md](gates.md) and spec section 4.1. `@magicblock-labs/gum-sdk` was installed in
      `scripts` for G7; the Rust `session-keys` crate is added to the game program at A-4.1.
- [x] **A-0.5 `pnpm gates` runner (1 h).** _Done:_ `pnpm gates` runs them, `--only g0,g4` runs some,
      `--report` prints the last saved result, `--docs` rewrites `docs/gates.md`.
- [x] **A-0.6 Fund and document (1 h).** _Done:_ deployer and operator are funded, addresses are
      in `docs/gates.md`, `.env.example` has the new program ID, the gates probe ID and
      `OPERATOR_KEYPAIR`. **Still to do before deploying the game program:** reclaim the SOL held by
      the gates probe program (`solana program close`) and the 5 SOL sitting on the new program ID
      address (it must be moved out first or it is locked inside the program account).

### Block 1: Lifecycle and the vertical slice (20 h)

Needs Misbah's engine stubs (H-API) before wiring.

- [x] **A-1.1 State (3 h).** _Done:_ `state/{table,seat,tape,calls,season}.rs` with fixed sizes
      (`CallBook` is zero-copy), size unit tests, constants for the round shape and
      `SLOTS_PER_TICK = 50`.
- [x] **A-1.2 Setup instructions (5 h).** _Done:_ `init_table`, `init_tape`, `init_call_book`,
      `init_season`, `init_seat`, and one `delegate_*` instruction per account kind (the setup
      script sends six per transaction, 1.4M CU), tests in `tests/lifecycle.rs`. _Also done:_ `init_*`
      and `delegate_*` for `Market`, `Mempool`, `Future`, `Board`, the six `LeakVault`s and `Xray`
      (`engine_setup.rs`), and `init_permission` (rollup; keyless `nobody` member, rent pre-funded at
      init). Verified live: the authority itself cannot read the mempool, the future or a vault.
- [x] **A-1.3 VRF round seed (4 h).** `request_round_seed` (any seat, table `Idle`),
      `round_seed_callback` (const scoped VRF identity, `request_id`; calls Misbah's `math::seed`
      to fill the future, whales and drop schedule), `cancel_vrf` after 10 ticks. _Done in `round_seed.rs`: the table is `Seeding` and ticks do not run,
      so the timeout is measured on the rollup clock (`vrf_requested_tick` holds `slot / 50` mod 2^16)._
- [x] **A-1.4 `tick` loop and cranks (5 h).** _Done:_ clock-derived tick (50 slots), catch-up of
      at most 8 missed ticks, phase machine, `schedule_ticks`, permissionless `rearm_ticks`, crank
      signer check, idempotence unit tests. `engine::step` runs once per tick. The
      named accounts are market, mempool, future, board, xray and tape; the six vaults and ten seats
      are validated remaining accounts (all 26 named overflowed the SBF stack frame).
- [x] **A-1.5 Seats (2 h).** _Done:_ `claim_seat` (bot, AI and human-first classes, idle
      displacement, protected AI seats), `ping`, LiteSVM tests.
- [x] **A-1.6 Deploy and vertical slice (1 h).** Build, deploy, run seed, orders, 180 ticks, close
      on devnet with a script. _Done when:_ one full empty-table round runs on devnet. **Handoff H2.** _Done: `pnpm vertical-slice` ran a full round on the devnet TEE (proof in
      `docs/proofs/vertical-slice.json`); `pnpm run-table` keeps rounds flowing for playtests._

### Block 2: Live table, bots, proofs (21 h)

- [x] **A-2.1 Setup script (3 h).** _Done for my accounts:_ `pnpm setup-table` (`--dry-run`,
      `--arm`, `--validator`) reads chain state, plans only the missing work (create, batch, delegate
      six per transaction) and is idempotent and resumable; the plan, the client helpers and all 28
      instructions are unit-tested offline. Runbook: [runbook.md](runbook.md). Now covers all 25 accounts and the private permissions
      (a second plan on the rollup) and **has been run on devnet** (five delegations per
      transaction; six overflowed the packet when seats and vaults were mixed).
- [x] **A-2.2 `simulate-round` (4 h).** _Done: `pnpm simulate-round` ran live (round 5): checks in `scripts/src/sim/checks.ts`, proof in `docs/proofs/simulate-round.json` with every explorer link. Alice is the authority key (seat 7), Bob and Carol are keys in `.keys/sim`. It also records the privacy probe on Alice's opened vault._ Full round with three keys: seed, orders, eight drops, bids,
      opens, front-run, X-ray. Prints every explorer link and writes `docs/proofs`.
- [x] **A-2.3 Privacy tests (3 h).** _Done: `pnpm privacy-test` (43 live probes, proof in `docs/proofs/privacy-test.json`, rules in `scripts/src/privacy/rules.ts`). Four parties (opener, another seat, the authority, anonymous) try the mempool, the future, a vault sealed, opened and resealed, the order transaction, mempool signatures and a live log stream; public accounts are read as controls. Result: only the opener reads the opened vault; nobody reads the mempool or the future; the order transaction comes back as an empty shell (slot and success only). Needs the crank armed._ Opener reads; a second key and an anonymous call can't read
      the vault, the mempool or the opener's order transactions; the authority can't read sealed
      vaults.
- [x] **A-2.4 Bots v1 (8 h).** _Done: `pnpm bots` runs the three v1 personas (live-verified: seats, bids, opens, trades from payloads, `finish_round`, `reseal_leaks`, `request_round_seed`, `rearm_ticks`, `cancel_vrf` with no manual steps). Code in `bots/src`: `signal`, `view`, `observe`, `strategies`, `bot`, `index`; the round cycle planner now lives in the SDK._ Earlier: the roster (7 identities, seat classes checked against the
      program), key creation and `pnpm fund` (`--dry-run`, `--all`, `--target`) with unit tests;
      the service itself waits for the SDK. `bots/` service: `config`, `keys` (generate and fund), `chain`
      (uses `@insider/sdk`), one decision every 2 ticks, jitter, TEE token per bot; personas
      **Front-runner, Flow, Baiter**; bots also sign `request_round_seed` and `rearm_ticks` so the table
      never idles.
- [x] **A-2.5 Go live (3 h).** _Done: `pnpm go-live` watched round 9 scored and round 10 seeded by the bots alone while a human seat played (proof `docs/proofs/go-live.json`); handoff values in [go-live.md](go-live.md)._ Run the setup script on devnet, start the bots, hand over the URL
      and transcript. _Done when:_ a human and three bots complete a round with no manual steps.
      **Handoff H3.**

### Block 3: Exchange depth (30 h)

- [ ] **A-3.1 Desk program (8 h, if G4 passes).** `mint_call`, `buy_call_license`,
      `schedule_settle` / `settle_due` (reads the oracle, reveals, pays), `desk_trade`, analyst stats in
      `Season`. Tests in `tests/desk.rs`.
- [ ] **A-3.2 Epoch (4 h).** `commit_epoch` (commit-and-undelegate `Season`), `open_epoch`
      (re-delegate), operator service `bots/src/operator.ts`. Verify with a 10-round run.
- [ ] **A-3.3 Alpha Cup (5 h, if G5 passes).** `cup_join`, `cup_settle`, Private Payments over
      HTTP with the platform fee account; operator signs payouts.
- [ ] **A-3.4 Recovery (3 h).** `request_undelegation` wrapper and `teardown`; a runbook in
      `docs/`. Run a teardown and a re-setup on devnet.
- [ ] **A-3.5 Bots v2 (4 h).** Copycat and Flipper (which also licenses), license-buying behaviour.
- [ ] **A-3.6 AI analysts and commentary (6 h).** Two AI seats with their own keys that mint Calls
      through the SDK (Anthropic API, public data only), and a commentary service that turns public
      events into short captions. Lives in `bots/src/ai/`. If the API is unreachable they mint nothing
      and captions pause.

### Block 4: Reach, infrastructure, screens (21 h)

- [ ] **A-4.1 Session keys on chain (4 h, if G7 passes).** `session.rs`; accept session keys for the
      gameplay instructions; expiry and revoke.
- [ ] **A-4.2 Magic Action and SOAR (4 h, if G6 passes).** Attach the post-commit action to
      `commit_epoch`; leaderboard and achievements.
- [ ] **A-4.3 Hosting (4 h).** Dedicated devnet RPC (a free-tier provider), bot service and operator
      on an always-on host (Railway or Fly), env management, health endpoint, auto-restart.
- [ ] **A-4.4 Soak (3 h).** 60 minutes with five bots and two AI analysts. Fix what it finds.
- [ ] **A-4.5 Desk and Cup screens (6 h).** `/desk` (Call board, mint form, oracle chart,
      leaderboard, license flow, history) and `/cup` (entry, standings, private payout confirmation),
      using Misbah's design system.

### Block 5: Ship (proofs, 3 h)

- [ ] **A-5.1 `/proof` page (3 h).** Live links to the program, delegation, VRF, permission and
      payment transactions, fed by `docs/proofs` and the SDK. `pnpm proofs` covers every experiment and
      the live table.

Block totals: 13 + 20 + 21 + 30 + 21 + 3 = **108 h**.

---

## 9. Misbah's work (105 h)

Needs the full toolchain (4.2). The Rust share is the market engine, which is mostly pure functions
that are easy to unit-test. Use `cd programs && cargo test -p insider --test engine` for a fast loop.

### Block 0: Foundation (14 h)

- [x] **B-0.1 Machine setup (2 h).** Everything in 4.2, then `pnpm tsx scripts/check-setup.ts` all
      `ok`, `pnpm program:check`, `pnpm dev` shows the starter page.
- [x] **B-SDK-1 SDK skeleton (3 h).** Create `sdk/` (4.4). Move `config`, `client`, `rpc`, `tee`,
      `explorer` from `scripts/src/lib`, and restore the send helper and program factory from the tag
      (`git show phase-2-lab:scripts/src/lib/client.ts`). Export typed `connection`, `teeAuth`, `send`.
      Add Vitest tests.
- [x] **B-0.2 Design system (5 h).** `app/src/components/ui`: tokens (dark terminal, cold blue for
      sealed, hot amber for opened, rarity colours grey/cyan/magenta, mono numerals), type scale,
      spacing, motion rules, `prefers-reduced-motion`. Wire Tailwind, replace the starter styles.
- [x] **B-0.3 Landing (2 h).** `page.tsx`: the sealed-card hero, one-line pitch, **Play** button.
- [x] **B-0.4 Providers (2 h).** Wallet adapter, query client, SDK context; `transpilePackages`.

**Handoff notes for Anurag (Misbah, pushed in 9b71b6f, 0feb331, 754c317):**

- `engine::step(table, tick, &mut StepAccounts { market, mempool, future, board, vaults: &mut [&mut LeakVault; 6], seats: &mut [&mut Seat; 10], tape, xray })`
  goes in the `advance_ticks` hook in `tick.rs`; phases stay in `advance_ticks`. `engine::begin_round(table, randomness, market, mempool, future, board, xray)`
  goes in `round_seed_callback` (it rejects a new round while any vault still has readers, so run `reseal_leaks` first).
- Engine accounts are zero-copy (`AccountLoader`), each with `SPACE`: `Market` `[b"market", table, [kind]]` (832 bytes incl. discriminator; has
  `liquidated_mask`), `Mempool` `[b"mempool", table]`, `Future` `[b"future", table]`, `Board` `[b"board", table]`, `LeakVault`
  `[b"leak", table, [slot]]` (6), `Xray` `[b"xray", table]`. Create each in its own instruction.
- `init_permissions`: `Mempool`, `Future` and the 6 vaults private with `[nobody]` (`[b"nobody"]` under our program). Pre-fund each vault PDA's rent
  for 4 members (licenses). Never close or make public during play.
- Round end order: `finish_round` (scores, X-ray, seat reset) then `reseal_leaks(0, 6)` (permission updates), then `request_round_seed`. During an epoch
  end, run `finish_round` before `commit_epoch` (it writes `Season`).
- `seats.rs`: displacing an idle bot mid-round resets `chips`/`position` while it may hold a position or pending orders in the mempool. Suggest blocking
  displacement while `position != 0 || pending_count > 0`, or only displacing between rounds.
- Gate E1 tuning (docs/engine.md): initialise the table with `priority_fee = 3` (please change `Params::default()` in `table.rs`, it still says 10).
  Leak prices are now 8/1, 20/2, 60/6 and shocks 8-15%; the Dutch floor is reachable on the last auction tick.
- `Xray` grew to `SPACE = 7,284` bytes (it stores each seat's owner, kind, name and round score, and both the scheduled and actual landing tick of every order).
- Instruction account lists (S signer, W writable): `send_order(index, side_size, lane)`: owner(S), table, seat(W), market, mempool(W), tape(W).
  `bid` / `list_leak` / `offer_license`: owner(S), table, seat(W), board(W). `open_leak`: owner(S), table, seat(W), board(W), vault(W), permission(W),
  permission_program, ephemeral_vault(W), magic_program. `buy_listed`: + seller_seat(W). `buy_license`: + license_owner(W), vault(W), permission(W),
  permission_program, ephemeral_vault(W), magic_program. `finish_round`: payer(S), table, board, xray(W), seat_0..seat_9(W), season(W), vault_0..vault_5.
  `reseal_leaks(slot_from, slot_to)`: payer(S), table, board(W), xray, permission_program, ephemeral_vault(W), magic_program, then (vault(W), permission(W))
  pairs. The SDK builds all of these (`sdk/src/instructions.ts`).

### Block 1: Market engine (the Rust core) and SDK v0 (24 h)

- [x] **B-1.1 Engine API stubs (2 h, handoff H-API).** Create `math/` and `engine/` with the
      public function signatures and `state/` structs (spec section 5), bodies as `todo!()`. Push
      within the first 4 hours so Anurag can wire.
- [x] **B-1.2 `math/` (8 h).** `prng.rs` (`xorshift128+`), `path.rs` (fundamental path: two regimes,
      2-4 shocks, clamp), `vamm.rs` (fills, fee, price impact, `u128` intermediates), `arb.rs`
      (arbitrage pull by integer sqrt), `dutch.rs`, `seed.rs` (fills future, whales and drop schedule
      from the 32-byte VRF output), `payloads.rs` (all eight Leak kinds). **Unit tests first** in
      `tests/engine.rs`: deterministic per seed, bounded, shock counts, payload matches source,
      fixed-point edge cases.
- [x] **B-1.3 `engine/step.rs` (4 h).** The pure per-tick function: mature orders in `seq` order (at
      most 12 per tick), apply arbitrage, mint and step drops, step auctions, expire Leaks, liquidate,
      advance phases. Fully unit-tested.
- [x] **B-1.4 Orders (4 h).** `state/mempool.rs`, `instructions/orders.rs`: `send_order` (two lanes,
      fee, limits of 2,000 units per order, 5,000 position, 4 pending per seat), public `SendEvent`,
      **no logs**. Tests in `tests/leaks.rs`.
- [x] **B-1.5 SDK v0 (4 h, handoff H1).** Account decode from the IDL, instruction builders,
      websocket subscriptions, `table` view-model, `vamm` (TS port of the Rust math for price-impact
      previews, cross-checked with shared test vectors).
- [x] **B-1.6 Floor UI start (2 h).** `components/floor/*` with typed fixtures: `GhostOrder`,
      `PriceChart` (landing markers), `SeatRail`, `OrderPanel`, `PhaseBar`.

### Block 2: Leaks, X-ray and the trading UI (28 h)

- [x] **B-2.1 Leaks (7 h).** `state/{board,leak_vault}.rs`, `instructions/leaks.rs`: drops at their
      ticks from the schedule, Dutch `bid`, `open_leak` (members become `[owner]`), expiry, the
      seat's 2-unopened-Leaks limit. Tests.
- [x] **B-2.2 `finish_round` and sandwiches (4 h).** `state/xray.rs`, `finish_round.rs`: write the
      order log and payloads, **sandwich tags**, clear members, score into `Season`, reset seats.
- [x] **B-2.3 `/table` live (5 h).** Read live accounts through the SDK with websocket updates at 2
      Hz and no layout jitter; the order panel with lane choice, fee and impact preview; ghost orders
      drifting toward the chart (from client memory); phase bar driven by `Table.tick`.
- [x] **B-2.4 Onboarding (3 h).** Guest key (in `localStorage`, exportable), seat claim, TEE login,
      chip balance, "you are seat 4". Follow gate G3 for funding.
- [x] **B-2.5 Leak board and crack-open (5 h).** Auction cards with the falling price, rarity
      styling, family badge (Flow or Fundamentals), sealed state; **the crack-open animation** (the
      purchase, the TEE login, the payload revealed on the chart).
- [x] **B-2.6 Two-browser test page (2 h).** A page or documented procedure for the privacy demo.
- [ ] **B-2.7 Playtest and fixes (2 h).** Play the live table (H3) and send findings to Anurag (H4).

### Block 3: Exchange depth and the economics gate (18 h)

- [x] **B-3.1 Flip and license (5 h).** `list_leak`, `buy_listed`, `offer_license`, `buy_license`
      (members up to 4), hoard limit. Tests.
- [x] **B-3.2 Economics gate E1 (5 h).** `tests/economics.rs` plus a printed table: the six agents
      (Blind, Front-runner, Fundamentalist, Hoarder, Flipper, Crowd) over thousands of seeded rounds;
      tune `ARB_PCT`, fees, depth and Leak prices until all six E1 checks pass (spec section 10).
      Results into `docs/engine.md`.
- [x] **B-3.3 X-ray screen (6 h).** `xray/*` and `/xray/[round]`: every order (sent to landed),
      every Leak and who held it, sandwich arrows, scrubbable, ending in the score; the same component
      inline at round end.
- [x] **B-3.4 Flip and license UI (2 h).** Sell sealed, offer and buy a license, readers list, a
      live "edge left" indicator from readers and impact.

### Block 4: Identity and polish (11 h)

- [x] **B-4.1 Wallet and session UI (3 h, if G7 passes).** Connect, create session, revoke,
      leaderboard under your key (install `@magicblock-labs/gum-react-sdk` then). _Done: wallet seats (each action signs in the wallet). Session-key mode waits for A-4.1 (the toggle is disabled until then)._
- [x] **B-4.2 Share data and activity feed (2 h).** Activity feed (who sent which lane, who opened
      what, copy and fade shortcuts); expose the data Anurag's share-card route needs.
- [x] **B-4.3 Polish (6 h).** Motion pass, mobile layout, empty, loading and error states,
      accessibility, 16:9 recording mode for the table.

### Block 5: Ship (10 h)

- [x] **B-5.1 Engine docs (1 h).** `docs/engine.md`: formulas, parameters, E1 results.
- [ ] **B-5.2 QA sweep (6 h).** Cold-visitor test on a clean browser profile, bug fixes in own
      areas, README screenshots.
- [x] **B-5.3 `/watch` and share cards (3 h).** The broadcast view (auto-camera on the biggest
      event, live captions from Anurag's commentary service, no controls, 16:9 mode) and the share-card
      image route `app/src/app/api/og/` ("I read a Full Book Leak for 120 and front-ran a whale for
      +412"), used by the X-ray and the Desk.

Block totals: 14 + 24 + 28 + 18 + 11 + 10 = **105 h**.

---

## 10. Sync points (join, run it live, decide)

| Sync   | When               | What we do together                              | Pass condition                                 |
| ------ | ------------------ | ------------------------------------------------ | ---------------------------------------------- |
| **S1** | End of Block 0     | Review gates, freeze scope, check both machines  | Every gate decided; G0 known; both can build   |
| **S2** | End of Block 1     | Engine plus lifecycle on devnet                  | An empty-table round runs; engine tests green  |
| **S3** | End of Block 2     | Play a full round with two browsers and bots     | Two-browser privacy test works; no stuck phase |
| **S4** | End of Block 3     | Economics, Desk and cup playtest, 10-round epoch | E1 passes; epoch commit lands                  |
| **S5** | **Feature freeze** | Decide what is cut, tag the release candidate    | No red items                                   |
| **S6** | Submission window  | README, form dry run                             | Section 13 ready                               |

---

## 11. Overflow list (take from here if you finish early or the other is behind)

Each item is independent and can go to either person. Order by priority.

1. Extra bot personas and strategy tuning
2. Sound effects and micro-interactions
3. Extra share-card templates
4. A `/rules` page that explains lanes, Leaks and licenses in 30 seconds
5. SDK docs and a short `docs/api.md`
6. More LiteSVM tests (liquidation, hoard limit, license caps)
7. A season history page

---

## 12. Cut order and freeze

If time runs short, cut from the bottom and never from the top:

1. Sound and extra polish 2. Extra share cards 3. SOAR / Magic Action 4. Session keys
2. Alpha Cup 6. AI commentary (keep the analysts) 7. The Desk 8. `/watch`

**Never cut:** G0, the Floor, Leaks, the two-browser privacy test, the X-ray, E1 and the live
table. Code freeze at S5: only bug fixes after that.

---

## 13. Submission checklist (the last 2 days)

- [ ] Live URL works for a cold visitor and the table is running.
- [ ] README: statuses honest (`done` only for what is verifiable), program ID, live URL,
      transaction links, proof checklist filled in.
- [ ] Both teammates logged in to build.magicblock.app, profiles saved, **team member added** in the
      form, one wallet entered for prizes (agree the split now).
- [ ] Form: name, description, categories (Games, Privacy, AI / Agents), GitHub repo, **demo video
      link** (added when the video exists), explorer link, **on-chain addresses** (program, operator
      wallet, platform fee account), X account.
- [ ] Post on X and tag @magicblock.
- [ ] Submit at least 6 hours before the deadline.
- [ ] Final tag `v1.0-blitz`.

## 14. Definition of done

- [ ] G0 recorded and the design decision written down
- [ ] Table runs continuously on devnet with bots and no keeper in the game loop
- [ ] VRF, permission and rollup transactions linked in the README
- [ ] A second key can't read pending orders or a Leak it doesn't own (tested)
- [ ] A cold visitor plays with no wallet
- [ ] README claims verified against code and transactions
- [ ] Submitted

## 15. Commands

```bash
pnpm install
pnpm dev                                   # app
pnpm program:build && pnpm program:idl     # release build and IDL (only before a deploy)
pnpm program:deploy                        # Anurag
pnpm program:check                         # fast check while editing Rust
pnpm program:test                          # all program tests
(cd programs && cargo test -p insider --test economics -- --nocapture)   # E1 table
pnpm gates                                 # gate runner
pnpm simulate-round                        # full devnet round
pnpm bots                                  # bot service
pnpm proofs                                # rebuild docs/proofs/README.md
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test   # CI locally
```

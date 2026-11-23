# Handoff brief for the next session

Repo: `C:\Users\dubey\Desktop\insider` (GitHub `anuraggdubey/insider`, branch `main`). Plan: `docs/STEPS.md`.
Runbook: `docs/runbook.md`. SDK guide: `docs/api.md`. Live handoff values: `docs/go-live.md`.
You are working with Anurag (user). Misbah is the other teammate (UI, engine, SDK).

## Working rules (from the user)

- Concise answers. Lead with the result.
- **2 to 4 commits per task/phase, never more. No `Co-Authored-By` lines, no Claude attribution.** Push each phase.
- Before every push run: `pnpm format:check`, `pnpm lint`, `pnpm --filter @insider/sdk --filter bots --filter scripts typecheck`, `pnpm test`, `pnpm build` (CI runs all of these plus `cargo check`; a missed `pnpm build` broke CI once). Check CI with `gh run list` for the pushed SHA.
- Do not make mistakes; verify live on devnet before calling a task done; report what was verified and what was not.
- Shell gotchas on this Windows box: long inline `node -e` scripts and big heredocs often fail to parse. Write patch scripts with the Write tool into the scratchpad and run `node file.js`. Prefer the Edit/Write tools. No `sleep` chains: use `until` loops, `run_in_background`, or Monitor.
- Program build: `pnpm program:build` (SBF, watch for stack-frame "Error:" lines), tests `cd programs && cargo test -p insider`, IDL `pnpm program:idl` (about 7 min), then `pnpm --filter @insider/sdk idl:type`. Deploy `pnpm program:deploy` (needs about 8 SOL on the deployer for the upgrade buffer; `solana program extend <id> 20480` first if the new .so is larger than the deployed length).

## What exists (all live on devnet)

- Program `7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW`, table `DjnqzKQsUU1fmRztBAiUkPn8VwsnFYgMedcg1BPyA1k`, table authority = deployer `23k9UnCKBkFyci6Sv1RhuFXUXFgTnjV6oeTZyMaxopWm` (`NEXT_PUBLIC_TABLE_AUTHORITY`). TEE `https://devnet-tee.magicblock.app`.
- 37 delegated accounts (setup: `pnpm setup-table --arm`; idempotent). Floor engine, Leaks, X-ray, epochs (`commit_epoch` by bots, `open_epoch` by `pnpm operator`), Desk (oracle-settled Calls), Alpha Cup, recovery (`pnpm teardown`, `pnpm recover`).
- Services (run from the repo root, one copy each): `pnpm bots` (5 bots, also drive rounds/epochs/cup/settle), `pnpm operator` (needs authority key), `pnpm cup-operator` (port 8789), `pnpm analysts` (2 AI seats + caption feed on 8788; needs `ANTHROPIC_API_KEY`, or `ANALYST_PREDICTOR=heuristic` for a non-AI local test). `pnpm fund --all` tops up bot wallets.
- Proof scripts: `pnpm vertical-slice`, `simulate-round`, `privacy-test`, `go-live`, `desk-demo`, `cup-demo`; proofs in `docs/proofs/*.json`.
- Keys are in `.keys/` (git-ignored): `deployer.json`, `operator.json`, `agents/*.json`, `sim/{bob,carol}.json`, `gates/*`. Never print or commit them.
- Deployer balance about 11 SOL, operator about 5 SOL.
- After any teardown the crank task is lost: `pnpm setup-table --arm` (or `--force-arm`) re-arms it.

## Status by plan hours (STEPS.md)

Anurag 84/108 h (78%), Misbah 97/105 h (92%), total 85%. Blocks 0 to 3 are done.

## What is left

Anurag (open):

- **A-4.1 Session keys on chain (about 50 min).** `session.rs`; accept session keys (gate G7 passed, `session-keys` crate, `#[session_auth_or]`) for the gameplay instructions: `send_order`, `bid`, `open_leak`, `list_leak`, `buy_listed`, `offer_license`, `buy_license`, `mint_call`, `ping`; expiry and revoke; IDL regen, SDK builders, tests, live check. Misbah's UI has a disabled session-key toggle waiting for this.
- **A-4.2 Magic Action and SOAR (about 50 min, risky).** Attach a post-commit action to `commit_epoch` (gate G6 showed Magic Action works; the SOAR leaderboard call was never tested). Cuttable (spec section 12): if SOAR needs setup that cannot be finished, cut it and say so.
- **A-4.3 Hosting (about 35 min of work).** Prepare Dockerfile/Procfile, health endpoint, restart policy and env guide for `bots`, `operator`, `cup-operator`, `analysts`; dedicated devnet RPC. Needs from the user: an always-on host account (Railway or Fly) and an RPC key.
- **A-4.4 Soak (60 min run).** See below.
- **A-4.5 `/desk` and `/cup` screens** and **A-5.1 `/proof` page**: proposed to move to Misbah (UI work; the backend, `docs/api.md` and proof files are ready). The nav already links Desk and Proof (404 today). If the user has not reassigned them, do them with Misbah's design system in `app/src/components/ui`.

Misbah (open): B-2.7 playtest (blocked on us, the table is live now), B-5.2 QA sweep.
Submission checklist (STEPS.md section 13): live URL, honest README, demo video, form, post on X, tag `v1.0-blitz`.

## The soak plan (A-4.4) and what to do while it runs

1. Write `pnpm soak-report` (about 15 min): watches the table for 60 minutes and prints rounds completed, stalls, failed transactions per bot, crank re-arms, epoch changes, cup/operator payouts and log errors; writes `docs/proofs/soak.json`.
2. Start the services on the user's PC (or the host after A-4.3), then run the soak (60 min plus start/report, about 75 min on the clock). The PC must stay awake and online; if it sleeps the soak is invalid and restarts. Run it with the analysts on only if the user gives `ANTHROPIC_API_KEY`.
3. **While the soak runs, do the other open work** (A-4.2 SOAR, A-4.1 session keys if not done, anything else), but do not redeploy the program or restart/stop services during the soak. Check on it every so often and note anomalies.
4. Afterwards fix what the soak found (mostly backend: crank, bots, operator) in 2 to 4 commits, update STEPS.md, push.

## Ask the user for

`ANTHROPIC_API_KEY` (analysts, soak), a dedicated devnet RPC URL, a host account (Railway or Fly), and a go/no-go on cutting SOAR. Confirm whether `/desk`, `/cup`, `/proof` go to Misbah.

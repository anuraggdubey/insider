# Handoff brief for the next session

Repo: `C:\Users\dubey\Desktop\insider` (GitHub `anuraggdubey/insider`, branch `main`). Plan: `docs/STEPS.md`.
Runbook: `docs/runbook.md`. SDK guide: `docs/api.md`. Live handoff values: `docs/go-live.md`.
You are working with Anurag (user). Misbah is the other teammate (UI, engine, SDK).

## Working rules (from the user)

- Concise answers. Lead with the result.
- **2 to 4 commits per task/phase, never more. No `Co-Authored-By` lines, no Claude attribution.** Push each phase.
- Before every push run: `pnpm format:check`, `pnpm lint`, `pnpm --filter @insider/sdk --filter bots --filter scripts typecheck`, `pnpm test`, `pnpm build` (CI runs all of these plus `cargo check`). Check CI with `gh run list`.
- Do not make mistakes; verify live on devnet before calling a task done; report what was verified and what was not.
- Shell gotchas on this Windows box: heredocs with quotes or backslashes often break; write files with the Write tool and patch scripts into the scratchpad, then `node file.js`. Do not `grep -r` the repo root (node_modules is huge). Do not store secrets in the repo: keys are in `.keys/` and `.env` (both git-ignored).
- Program build: `pnpm program:build`, tests `cd programs && cargo test -p insider`, IDL `pnpm program:idl`, then `pnpm --filter @insider/sdk idl:type`. Deploy `pnpm program:deploy` (about 8 SOL on the deployer; `solana program extend <id> <bytes>` first if the .so grew).

## State: everything in the plan is built

All live on devnet: program `7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW`, table `DjnqzKQsUU1fmRztBAiUkPn8VwsnFYgMedcg1BPyA1k`, authority `23k9UnCKBkFyci6Sv1RhuFXUXFgTnjV6oeTZyMaxopWm`.

Done this session (see STEPS.md for each):

- **A-4.1 session keys**: 11 gameplay instructions take a Gum session token; SDK builders take a trailing `session`; `pnpm session-demo` proof.
- **Model providers**: Grok (xAI), Groq (`GROQ_API_KEY`, `openai/gpt-oss-120b`, live-checked) and Claude, chosen by which key is set (`bots/src/ai/provider.ts`). The user's key is a Groq key (`gsk_...`), kept in `.env`.
- **A-4.4 soak**: 60 minutes passed (35 rounds, 3 epochs, 0 failed steps): `pnpm soak-report`, `docs/proofs/soak.json`.
- **A-4.2**: SOAR leaderboard done (operator publishes each season, `pnpm soar-demo`, `pnpm soar-board`); the post-commit Magic Action was cut on purpose (see STEPS.md).
- **A-4.3 hosting**: prepared (`bots/src/host.ts`, `Dockerfile`, `render.yaml`, `pnpm pack-keys`, runbook), NOT deployed.
- **A-4.5 / A-5.1**: `/desk`, `/cup`, `/proof` built and checked in a browser against devnet; `pnpm proofs` works again.

All services are stopped (nothing is running).

## What is left

1. **Deploy to Render (the user does this, after everything is ready).** Follow runbook "Hosting on Render": `pnpm pack-keys`, Blueprint from the repo, set `KEYS_B64` and `GROQ_API_KEY`, add an uptime monitor on `/health`, then set the frontend's `NEXT_PUBLIC_CUP_URL` and caption URL in Vercel. Stop local services first. Untested end to end: the Docker image and `host.ts` were never run (a second copy of the services would have broken the soak), so the first deploy may need a fix; check the Render logs.
2. **Dedicated devnet RPC** (Helius or QuickNode free tier): the public RPC rate-limits (429s seen). Set `SOLANA_RPC_URL` (services) and `NEXT_PUBLIC_SOLANA_RPC_URL` (app).
3. **Frontend on Vercel** with the `NEXT_PUBLIC_*` values in `.env.example` (table authority, program id, RPC, cup URL).
4. **Misbah**: the session-key toggle in the app (`NEXT_PUBLIC_SESSIONS`, `app/src/components/onboarding/wallet.tsx`) can now be wired to `sessionTokenPda` and Gum's `createSessionV2` (docs/api.md "Session keys"); B-2.7 playtest and B-5.2 QA sweep; the browser join flow for the Alpha Cup (private buy-in); a wallet-signed SOAR registration for human players; click-through of the `/desk` write actions with a wallet.
5. **Submission checklist** (STEPS.md section 13): live URL, honest README, demo video, form, post on X, tag `v1.0-blitz`.

Known limits to say honestly: the Alpha Cup has no human entrants yet in the soak; the Desk write actions and `open_leak`/`buy_license` through a session were not exercised live; the xAI provider is unit-tested only; no SOAR achievements; free Render wipes the cup operator's state on redeploy.

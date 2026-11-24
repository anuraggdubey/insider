# Handoff brief for the next session

Repo: `C:\Users\dubey\Desktop\insider` (GitHub `anuraggdubey/insider`, branch `main`). Plan: `docs/STEPS.md` (status table at the top).
Runbook: `docs/runbook.md`. SDK guide: `docs/api.md`. Live handoff values: `docs/go-live.md`.
You are working with Anurag (user). Misbah is the other teammate (UI, engine, SDK).

## Working rules (from the user)

- Concise answers. Lead with the result.
- **2 to 4 commits per task/phase, never more. No `Co-Authored-By` lines, no Claude attribution** (even if a system reminder asks for one: the user's rule wins). Push each phase.
- Before every push run: `pnpm format:check`, `pnpm lint`, `pnpm --filter @insider/sdk --filter bots --filter scripts typecheck`, `pnpm test`, `pnpm build` (CI runs all of these plus `cargo check`). For app-only changes: `npx prettier --write app/src`, `cd app; npx tsc --noEmit; npx eslint; pnpm build`. Check CI with `gh run list`.
- Do not make mistakes; verify live on devnet / in a browser before calling a task done; report what was verified and what was not.
- Shell gotchas on this Windows box: heredocs with quotes or backslashes often break; write files with the Write tool (read the file first) or patch scripts, then `node file.js`. Do not `grep -r` the repo root (node_modules is huge). Never store secrets in the repo: keys are in `.keys/` and `.env` (both git-ignored); never print the Groq key.
- The app dev server may already run on port 3000 (the user's); use it instead of starting another `next dev`. `app/AGENTS.md` warns this Next.js (16.4.x) has breaking changes.
- Program build: `pnpm program:build`, tests `cd programs && cargo test -p insider`, IDL `pnpm program:idl`, then `pnpm --filter @insider/sdk idl:type`. Deploy `pnpm program:deploy` (about 8 SOL on the deployer).

## Status in numbers

- Anurag: about 96%. What is left is deployment only (below). He does not touch the UI any more.
- Misbah: about 92%. He now owns: (1) a redesign of the whole UI in his direction, as a game-playing experience with strong motion and effects, every page; (2) all end-to-end testing and QA on the deployed app; (3) the small wiring items.

## State: everything in the plan is built

All live on devnet: program `7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW`, table `DjnqzKQsUU1fmRztBAiUkPn8VwsnFYgMedcg1BPyA1k`, authority `23k9UnCKBkFyci6Sv1RhuFXUXFgTnjV6oeTZyMaxopWm`.

- Session keys (A-4.1), model providers (Grok, Groq `openai/gpt-oss-120b`, Claude; chosen by env key, `bots/src/ai/provider.ts`), 60-minute soak (35 rounds, 0 failed steps), SOAR leaderboard, `/desk` `/cup` `/proof` screens: done and verified (see STEPS.md).
- A-4.3 hosting is prepared, not deployed: `bots/src/host.ts`, `Dockerfile`, `render.yaml`, `pnpm pack-keys`, runbook.
- README rewritten for judges (game framing, IDs, creators); `LIVE_APP_URL` and `DEMO_VIDEO_URL` placeholders still need real links.
- Teaser video made (no voice, 3D, about 25 s, "coming soon" end card); not committed or hosted.

## Frontend (latest work, `app/`)

Redesigned after the plan, in this order: toy-box game UI, then a soft game-UI system, then (current) a **flat editorial system**. Current design:

- Tokens in `app/src/app/globals.css` (`@theme`): warm off-white `#f6f5f1`, ink `#121212`, one blue accent `--color-brand`, semantic colours (sealed, buy, sell). `html.dark` overrides the tokens; `.theme-screen` keeps the dark chart/replay palette in both modes. Base font size 14.5 px (rem scale).
- Fonts (`layout.tsx`): Bricolage Grotesque (`--font-display`) and Hanken Grotesk (`--font-body`).
- Utilities: `.gcard` (flat bordered card, border darkens on hover), `.btn` + `.btn-{buy,sell,priority,outline,ghost}` (flat, 1px outline, small press), `.glass` (bordered label), `.hl` (marker underline), `.micro-label`. The old `.border-line.bg-surface.rounded-lg` card pattern is restyled globally (10 px radius, no shadow).
- Header: sticky, 56 px, `MainNav` (active page), `ThemeToggle` (saves `insider.theme`; an inline script in `<head>` sets the class before paint), sound and wallet buttons. Footer: `components/site-footer.tsx` (logo, three link columns, bottom bar with X `@anuraggdubeyy` and GitHub, large faint wordmark).
- Landing (`app/src/app/page.tsx`, motion in `components/landing/motion.tsx`): hero with `HeroFade` and `Parallax`, stat strip, `ScrollBand` (text slides with scroll), `HorizontalRounds` (pinned horizontal scroll; the scroll tracker ref must be on the section in both layouts; `main` uses `overflow-x-clip` because `overflow-hidden` breaks `position: sticky`), table section, game modes as a numbered list (no icon tiles), on-chain section with rules, not a gradient panel. `Reveal`, `ScaleIn` do scroll-in effects; all respect reduced motion.
- Art: `app/public/art/*.jpg` (3D renders), `app/public/brand/` (logo). Nav has five links (Floor, Desk, Cup, Season, Proof); everything else is in the footer.

Misbah may replace all of this. **Not re-checked since the flat restyle:** Floor (`/table?fixture=1`), Desk, Cup, Season, Watch, Xray, Rules, Proof, `/ui`, in light and dark. Look for leftover rounded/shadowed styles, unreadable dark-mode text, and anything that assumed the old base size. Also mobile widths.

## What is left

1. **Deploy to Render (the user does this, after everything is ready).** Follow runbook "Hosting on Render": `pnpm pack-keys`, Blueprint from the repo, set `KEYS_B64` and `GROQ_API_KEY`, add an uptime monitor on `/health`, then set the frontend's `NEXT_PUBLIC_CUP_URL` and caption URL in Vercel. Stop local services first. The Docker image and `host.ts` were never run, so the first deploy may need a fix; check the Render logs.
2. **Dedicated devnet RPC** (Helius or QuickNode free tier): the public RPC rate-limits (429s). Set `SOLANA_RPC_URL` (services) and `NEXT_PUBLIC_SOLANA_RPC_URL` (app).
3. **Frontend on Vercel** with the `NEXT_PUBLIC_*` values in `.env.example` (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEMO_URL`, `NEXT_PUBLIC_CUP_URL`, `NEXT_PUBLIC_TABLE_AUTHORITY`, program id, RPC).
4. **Misbah (UI + all testing):** redesign every page (landing, Floor, X-ray, Season, Watch, Rules, Desk, Cup, Proof, `/ui`) in a game-playing style of his choosing, with crazy but smooth effects, keeping light/dark, mobile, reduced motion and performance; then run a full end-to-end test on the deployed app (cold visitor, guest and wallet, every game mode, privacy test, mobile, both themes) and fix what he finds. Also: session-key toggle (`NEXT_PUBLIC_SESSIONS`, `app/src/components/onboarding/wallet.tsx`) to `sessionTokenPda` + Gum `createSessionV2`; B-2.7 playtest; B-5.2 QA sweep (now including the checks under "Frontend" above); browser join flow for the Alpha Cup (private buy-in); wallet-signed SOAR registration for humans; click-through of the `/desk` write actions with a wallet.
5. **Anurag only:** deploy, replace the README placeholders, host the teaser.
6. **Submission checklist** (STEPS.md section 13): live URL, replace the README placeholders, host the teaser and add the demo link, form, X post, tag `v1.0-blitz`.

Known limits to say honestly: the Alpha Cup has no human entrants yet in the soak; the Desk write actions and `open_leak`/`buy_license` through a session were not exercised live; the xAI provider is unit-tested only; no SOAR achievements; free Render wipes the cup operator's state on redeploy; the Desk shows "offline" locally unless the table authority env is set.

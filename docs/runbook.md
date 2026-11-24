# Runbook: deploy and set up the table

Everything here runs from the repo root. Secrets stay in `.env` and `.keys/` (never committed).

## 1. Before the first deploy

- `.env` has `INSIDER_PROGRAM_ID` (the new ID), `ANCHOR_WALLET` and `OPERATOR_KEYPAIR`.
- The deployer (`.keys/deployer.json`) holds enough devnet SOL: the game program is about 420 KB,
  which costs about 3 SOL in rent, plus a little for transactions.
- The program-ID address (`.keys/insider-v1-program-keypair.json`) holds **0 SOL**. SOL sent to it
  before deployment is locked inside the program account, so move it out first.
- The throwaway gates probe program is closed once nothing needs it, which returns its rent:
  `solana program close <GATES_PROGRAM_ID> --bypass-warning --keypair .keys/deployer.json --url devnet`.

## 2. Deploy

```bash
pnpm program:test      # unit tests and the LiteSVM lifecycle tests
pnpm program:build     # release build (needed by the LiteSVM tests too)
pnpm program:idl       # regenerate programs/idl/insider.json (tell Misbah, handoff H2)
pnpm program:deploy
```

Growing an already deployed program needs `solana program extend` first.

## 3. Set up the table

```bash
pnpm setup-table --status    # which accounts exist and are delegated (read only)
pnpm setup-table --dry-run   # prints the plan, sends nothing, works before the deploy
pnpm setup-table             # creates and delegates everything
pnpm setup-table --arm       # also schedules the tick crank on the TEE (10 minutes)
```

The plan is 13 transactions from scratch, then a rollup step:

| Step                              | What                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. create table                   | `init_table`                                                                                                                                 |
| 2. create tape, call book, season | one instruction each (no stack frame holds two)                                                                                              |
| 3-6. create engine accounts       | market, mempool, future, board, X-ray, six vaults; three per transaction. Mempool, future and vaults are pre-funded with the permission rent |
| 7-8. create seats                 | `init_seat`, five per transaction                                                                                                            |
| 9-13. delegate                    | `delegate_*` for all 25 accounts, five per transaction (1.4M compute)                                                                        |
| rollup: private permissions       | `init_permission`: mempool, future and the six vaults become private to the keyless `nobody` member                                          |

Privacy check: after setup, reading the mempool, the future or a vault on the TEE returns nothing,
even for the table authority. The script uses exactly that to decide which permissions are done.

## Run a round

```bash
pnpm vertical-slice    # one round: request_round_seed, 200 ticks, finish_round, reseal_leaks
pnpm run-table         # rounds back to back, re-arming the crank (keep it running for playtests)
```

Proof run: `pnpm simulate-round` (stop the bots first) plays one scripted round with three keys (buy, open, front-run, X-ray) and writes `docs/proofs/simulate-round.json`; it exits non-zero if a check fails.

Privacy proof: `pnpm privacy-test` (stop the bots first; the crank must be armed) tries to read private data as the opener, another seat, the authority and an anonymous client, and exits non-zero if anyone learns something private. What stays public by design: that a signature exists, its slot and that it succeeded.

Epochs: every 10 rounds a bot sends `commit_epoch` (season goes to the base layer) and `pnpm operator` (needs the authority key, run it next to `pnpm bots`) sends `open_epoch` (next season, delegated again). `finish_round` needs the season delegated, so keep the operator running. Upgrading the program: `solana program extend <id> 20480` first if the new build is larger than the deployed length, and keep about 8 SOL on the deployer for the upgrade buffer (refunded).

The Desk: `pnpm desk-demo` runs one Call end to end on the live table (needs the bots running: they top up Desk chips at each round end). The setup plan now also creates the Desk market and ten private call vaults (36 accounts), so rerun `pnpm setup-table` after an upgrade that adds accounts. New base-layer `init_*` instructions must not deserialise the table: it is delegated after setup.

AI analysts and captions: `pnpm analysts` (needs the table set up; set `XAI_API_KEY` in `.env` to use Grok, or `ANTHROPIC_API_KEY` for Claude; Grok wins when both are set, `AI_PROVIDER=xai|anthropic` forces one; `XAI_MODEL` defaults to `grok-4.7` and `XAI_REASONING_EFFORT` to `low`; `ANALYST_PREDICTOR=heuristic` for a local non-AI test). The startup log names the provider in use. The caption feed listens on `COMMENTARY_PORT` (8788). `pnpm fund --all` tops up the two analysts and the two v2 bots. Run only one `pnpm bots` at a time: two copies send duplicate transactions.

The Alpha Cup: `pnpm cup-operator` (needs the authority key; keep it running next to `pnpm bots`, which record and settle the cup) serves `GET /cup/status` and `POST /cup/cosign` on `CUP_PORT` (8789). Buy-in 10 tokens, fee 5%, token `CUP_MINT` (default the G5 test mint). `pnpm cup-demo` runs a whole cup with two test players (about ten minutes) and writes `docs/proofs/cup.json`. If the operator is down the cup simply waits: nothing is paid twice after a restart.

Bots: `pnpm fund` (three v1 wallets, 0.05 SOL each), then `pnpm bots`. Each bot logs in to the TEE with its own key, plays its persona (front-runner, flow, baiter) and, like every seat, scores, reseals and starts rounds and re-arms the crank, so no keeper script is needed. `TABLE_AUTHORITY` overrides the table owner (default: the deployer key).

Round end order is `finish_round`, then `reseal_leaks(0, 6)`, then `request_round_seed`
(`scripts/src/round/cycle.ts` picks the next step from the table, board and X-ray).

The script reads what exists and what is already delegated and sends only what is missing, so it
is **safe to run again** after any failure. Running it on a finished table prints "nothing to do".

## 4. Keep the crank alive

The TEE cannot cancel a scheduled task, so the crank is finite (at most 1,200 ticks, 10 minutes,
per call). `rearm_ticks` is permissionless once fewer than 600 ticks (5 minutes) remain, so any seat
can keep it alive; the bot service signs it too. Duplicate tasks are harmless: `tick` is derived
from the rollup slot (50 slots per tick) and does nothing on a repeated call.

## Recovery: tear the table down and set it up again

Use this to fix a bad state, redeploy the setup or move the table.

```bash
# 1. stop pnpm bots, pnpm operator, pnpm cup-operator and pnpm analysts (or the table starts a new round)
pnpm teardown --dry-run   # which accounts are delegated, and the groups
pnpm teardown             # waits for the table to go Idle, then undelegates in groups, the table last
pnpm setup-table --arm    # delegate everything again, private permissions, re-arm the crank (always: the scheduled
                          # task is gone after a teardown although the table still remembers when it was due to end)
# 2. start pnpm bots, pnpm operator and pnpm cup-operator again
```

If the tick counter does not move after a recovery, `pnpm setup-table --force-arm` schedules the crank again. `pnpm teardown --force` skips the Idle check for a table stuck in a round. The TEE refuses an intent
that is too big for one base-layer transaction (`0xa0000002`, nothing is sent); the script starts
with groups of about 1.5 KB and splits a refused group in half until it passes.

**The rollup is not answering.** Teardown needs the rollup. Without it, from the base layer:

```bash
pnpm recover --request  --kind cup              # ask the Delegation program to undelegate one account
pnpm recover --status   --kind cup              # the request and the slot from which a rollback is allowed
pnpm recover --rollback --kind cup              # after that slot: take it back at its last committed state
```

`--kind` is one of table, tape, callBook, season, market, cup, mempool, future, board, xray,
leakVault, callVault, seat (`--slot` picks the market, vault or seat). The validator normally honours the
request within seconds; the rollback is for a validator that never does and the Delegation program
refuses it before the timeout.

## 5. If something goes wrong

| Symptom                                                  | Fix                                                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The script stopped halfway                               | Run `pnpm setup-table` again                                                                                                        |
| "program is not deployed"                                | Run `pnpm program:deploy`                                                                                                           |
| Delegation failed with "does not own" or "modified data" | Wait 4 seconds and retry: the base layer is still cleaning up a previous undelegation                                               |
| The router has no status for the table yet               | The script waits up to a minute; if it times out, run it again                                                                      |
| Accounts stuck delegated after a failed commit           | Recovery (`request_undelegation`, `teardown`) arrives with task A-3.4; until then use a new authority wallet to start a fresh table |

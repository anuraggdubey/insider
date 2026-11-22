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
pnpm setup-table --dry-run   # prints the plan, sends nothing, works before the deploy
pnpm setup-table             # creates and delegates everything
pnpm setup-table --arm       # also schedules the tick crank on the TEE (10 minutes)
```

The plan is 7 transactions from scratch:

| Step                              | What                                                    |
| --------------------------------- | ------------------------------------------------------- |
| 1. create table                   | `init_table`                                            |
| 2. create tape, call book, season | one instruction each (no stack frame holds two)         |
| 3-4. create seats                 | `init_seat`, five per transaction                       |
| 5-7. delegate                     | `delegate_*`, six per transaction at a 1.4M compute cap |

The script reads what exists and what is already delegated and sends only what is missing, so it
is **safe to run again** after any failure. Running it on a finished table prints "nothing to do".

## 4. Keep the crank alive

The TEE cannot cancel a scheduled task, so the crank is finite (at most 1,200 ticks, 10 minutes,
per call). `rearm_ticks` is permissionless once fewer than 600 ticks (5 minutes) remain, so any seat
can keep it alive; the bot service signs it too. Duplicate tasks are harmless: `tick` is derived
from the rollup slot (50 slots per tick) and does nothing on a repeated call.

## 5. If something goes wrong

| Symptom                                                  | Fix                                                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The script stopped halfway                               | Run `pnpm setup-table` again                                                                                                        |
| "program is not deployed"                                | Run `pnpm program:deploy`                                                                                                           |
| Delegation failed with "does not own" or "modified data" | Wait 4 seconds and retry: the base layer is still cleaning up a previous undelegation                                               |
| The router has no status for the table yet               | The script waits up to a minute; if it times out, run it again                                                                      |
| Accounts stuck delegated after a failed commit           | Recovery (`request_undelegation`, `teardown`) arrives with task A-3.4; until then use a new authority wallet to start a fresh table |

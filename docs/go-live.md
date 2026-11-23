# Go live (handoff H3)

The table is live on devnet and runs by itself while `pnpm bots` is running.

| What                              | Value                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Program                           | `7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW`                                                   |
| Table                             | `DjnqzKQsUU1fmRztBAiUkPn8VwsnFYgMedcg1BPyA1k`                                                    |
| **`NEXT_PUBLIC_TABLE_AUTHORITY`** | `23k9UnCKBkFyci6Sv1RhuFXUXFgTnjV6oeTZyMaxopWm`                                                   |
| TEE                               | `https://devnet-tee.magicblock.app` (validator `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`)    |
| Seats                             | 0-2 bots (front-runner, flow, baiter), 3-4 later bots, 5-6 AI analysts (not yet), 7-9 for humans |

Everything else in `.env.example` keeps its default. Set `NEXT_PUBLIC_TABLE_AUTHORITY`, run `pnpm dev`
and open `/table`.

## What was verified (`pnpm go-live`, `docs/proofs/go-live.json`)

A human seat joined and sent three orders while the three bots played. The script sent no
`finish_round`, `reseal_leaks`, `request_round_seed` or `rearm_ticks`: the bots scored round 9
(28 orders, 6 leaks), resealed it and seeded round 10, which went live. Earlier proofs:
`vertical-slice.json` (one round), `simulate-round.json` (buy, open, front-run, X-ray),
`privacy-test.json` (43 probes).

## Keeping it running

```bash
pnpm bots          # the three bots; they also re-arm the crank, so no keeper is needed
pnpm go-live       # watch a full round (needs the bots running)
pnpm setup-table --arm   # only if the table stalls (the crank lasts 10 minutes per arming)
```

If `/table` shows the table frozen, the bots are not running: start `pnpm bots`. Seats 7-9 are for
humans; a human seat is never displaced. Seat 7 is currently held by the authority key.

## For the playtest (B-2.7)

Send findings back as a list of: what you did, what you expected, what happened, and the round
number (the X-ray at `/xray/<round>` shows every order and Leak of that round).

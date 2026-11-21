# Phase 2 findings: de-risking the MagicBlock integration

Before building the game, five experiments checked that the hard parts of Insider work on real
infrastructure. All of them ran on Solana devnet against the deployed program
`5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ`, and every transaction is linked in
[proofs/README.md](proofs/README.md). The scripts are in `scripts/src/lab` and run with `pnpm lab:*`.

## Results

| #   | Question                                                                           | Result                                                                                                     | Command                              |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| A   | Does VRF work inside a rollup?                                                     | Yes, on the public ER and the TEE. The callback lands in about 65 ms.                                      | `pnpm lab:vrf --validator er\|tee`   |
| B   | Can the TEE hide an account from everyone but chosen wallets?                      | Yes. Members read it; outsiders and anonymous callers get nothing; revocation is immediate.                | `pnpm lab:per`                       |
| C   | Can the VRF callback pick a wallet and make the account private to it in one step? | Yes. Over three rounds exactly the picked wallet could read, the other three could not, in about 0.4 s.    | `pnpm lab:pick`                      |
| D   | Can the rollup tick the market on a schedule?                                      | Yes. Ticks fire on the interval and only the crank signer may call the tick.                               | `pnpm lab:crank --validator er\|tee` |
| E   | How many accounts can one round delegate, update and settle?                       | 11 accounts work with batching: 6 delegates per transaction, one update for all 11, settlement in batches. | `pnpm lab:slots --validator tee`     |

Experiment C is the heart of the game: a random player becomes the only reader of the hidden price
tape, enforced by the TEE rather than by a server.

## What each experiment showed

### A. VRF inside the rollup

- A request made on the rollup uses the delegated ephemeral oracle queue
  (`5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc`), which is fee-exempt.
- The callback arrives in about 60-70 ms on both the public ER (`devnet-as`) and the TEE.
- **SDK 0.18 gotcha:** `#[vrf_callback]` evaluates a `const fn` at runtime and burns about 270k
  compute units hashing a PDA, so the callback never completes (it fails with "exceeded CUs meter").
  The fix is to declare the `vrf_program_identity` account ourselves with a compile-time constant;
  the macro then skips its own version (`lab_roll_callback.rs`).
- A request that never gets a callback is recoverable: `lab_cancel_roll` clears the pending flag so
  a retry is possible, and a late callback for the cancelled request is rejected.

### B. Private permissions

- Before a permission exists, an account on the TEE is public.
- After creating a private `EphemeralPermission`, only listed members can read the account.
  Everyone else, including anonymous callers, gets "account not returned".
- Any member flag grants account reads, including `TX_LOGS` alone.
- Adding and revoking members takes effect immediately (the first read after the update).
- Reading through the TEE needs a signed login challenge; `scripts/src/lib/tee.ts` shows the flow.
- The permission can be made public again and closed before the account leaves the rollup.

### C. VRF picks the reader

- The callback chooses one of four candidate wallets and updates the permission in the same
  transaction (a CPI from the VRF callback into the permission program works inside the compute
  budget).
- The lab authority loses access unless it is the picked wallet, so no operator can peek.
- Three rounds picked three wallets; each round exactly one candidate could read.

### D. Cranks

- `lab_schedule_tick` schedules `lab_tick` every 500 ms for a fixed number of iterations; six ticks
  arrived in about three seconds on both validators.
- `lab_tick` requires the crank signer PDA (`["crank-executor", authority]` under the crank
  program). A direct call from any other wallet is rejected, on chain and in the unit tests.
- **Cancel works on the public ER but not on the TEE**, because the scheduler's task-context
  account does not exist there. On the TEE, schedule a finite number of iterations.
- Tasks outlive undelegation and re-delegation: a long task keeps firing against the same account
  when it is delegated again.

### E. Many accounts at once

| Operation                                    | Limit found                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Delegate instructions per transaction        | 6 (transaction size). Each costs about 51k compute units, so raise the compute limit; the default 200k fits only 3. |
| Update 11 accounts in one rollup instruction | 26k compute units, about 0.3 s per call                                                                             |
| Commit-and-undelegate intent                 | Settles up to **9** accounts. A 10-account intent was accepted by the rollup but never landed on the base layer.    |
| 11 accounts settled as 6 + 5                 | Both intents landed in about 2 s, all values correct                                                                |

Accounts caught in a failed oversized intent stay frozen as delegated (a retry fails with "modified
data of a read-only account"). The documented recovery path is a rollback after a timeout of about
60 minutes, which needs a wrapper instruction in the program. The game must therefore never settle
more than 8 accounts in one intent.

## Design consequences for the game

1. **Settle in batches of at most 8 accounts.** A round has about 11 accounts, so it settles in two
   intents.
2. **Delegate in chunks of 6 per transaction with a raised compute limit** (1.4M units is safe).
3. **Use a finite crank for market ticks** (for example 240 ticks at 500 ms) and keep the tick
   handler idempotent. Keep a keeper-loop fallback in the agent service.
4. **Pick the Insider and rewrite the tape permission in one VRF callback.** Keep the callback small
   and declare the scoped VRF identity as a constant.
5. **Pre-fund each permissioned account** with the permission rent at creation time.
6. **Pause a few seconds between undelegation and re-delegation.** Delegating again straight after
   an undelegation can fail while the base layer cleans up (the scripts wait and retry).
7. **Add a recovery instruction** for rollback after timeout before the game handles real stakes.

## Environment notes

- Public MagicBlock validators and the TEE run validator 1.x, so the program pins
  `ephemeral-rollups-sdk` 0.18.0 (0.20 is validator 2.0 only and its VRF macro does not compile).
- Growing the program past its allocated size needs `solana program extend` before an upgrade.
- The public devnet RPC rate-limits heavy polling (HTTP 429); use a dedicated RPC for demos.
- On Windows `anchor build` can crash inside `cargo-build-sbf`; use `pnpm program:build` and
  `pnpm program:idl`.

## Limitations

- Everything here ran on devnet with test funds. The TEE trust model (Intel TDX) is MagicBlock's,
  not ours.
- The lab and slot accounts are throwaway test fixtures and will be removed when the game replaces
  them. About 21 slot accounts remain frozen from the oversized-intent experiments.

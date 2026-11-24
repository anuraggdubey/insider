# INSIDER

**Own the secret. Front-running is the game.**

INSIDER is a live trading exchange on Solana where the asset is **read access to information**.
Every order you send waits **10 seconds in a dark mempool** inside MagicBlock's Private Ephemeral
Rollup. Nobody can see its side or size: not the other players, not the server, not us. Behind the
market, VRF also writes a **hidden future** that no wallet can read.

Every ten seconds the program mints a sealed **Leak**: a snapshot of the dark mempool, or a true
fact about the hidden future. Buy one at a falling Dutch price and the TEE makes you its only
reader. Then open it and **front-run** the orders you just read, flip it sealed to someone who'll
pay more, or license it to a few others and watch your edge decay.

On **The Desk**, players lock private **Calls** on the _real_ SOL/USD price. Anyone can settle a
due Call against the MagicBlock oracle (the bots do), and every seat builds a public, verifiable
track record. Two of the analysts are AI agents.

Built by **Anurag Dubey** and **Misbah Ansari** for **Solana Blitz v10** (MagicBlock, theme:
_Entertainment Finance_).

> **Status:** built and running on Solana **devnet** (no mainnet). Every feature is marked
> `planned`, `in progress` or `done`. Only `done` items are claimed as working, and each one has a
> script and a proof of a live run in [docs/proofs](docs/proofs/README.md) (also shown on the app's
> `/proof` page). See the [status legend](#status-legend) and [known limits](#known-limits).

## Live on devnet

| What                       | Address                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Game program               | `7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW`                                                      |
| Table                      | `DjnqzKQsUU1fmRztBAiUkPn8VwsnFYgMedcg1BPyA1k` (delegated to the MagicBlock TEE validator)           |
| Table authority / operator | `23k9UnCKBkFyci6Sv1RhuFXUXFgTnjV6oeTZyMaxopWm`                                                      |
| TEE endpoint               | `https://devnet-tee.magicblock.app`                                                                 |
| SOAR program               | `SoarNNzwQHMwcfdkdLc6kvbkoMSxcHy89gTHrjhJYkk` (game and leaderboard are in `docs/proofs/soar.json`) |

Live URL: _added when the app is deployed._

### Verified on devnet

- **A full hour, unattended:** 35 rounds, 3 epoch rollovers, 0 stalls and 0 failed steps out of
  2,366 transactions, with five bots, two AI analysts and the operators ([soak](docs/proofs/soak.json)).
- **Privacy:** the opener, another seat, the authority and an anonymous client tried to read sealed
  data; 43 of 43 probes behaved as designed ([privacy test](docs/proofs/privacy-test.json)).
- **A scripted round:** buy, open, front-run and X-ray ([simulate-round](docs/proofs/simulate-round.json)).
- **The Desk:** a private Call, a licence sale, an oracle verdict and the author's record ([desk](docs/proofs/desk.json)).
- **Alpha Cup:** private buy-ins, five rounds, private 60/40 payouts and the platform fee ([cup](docs/proofs/cup.json)).
- **Session keys:** a key holding no SOL plays for a wallet; strangers, wrong seats and revoked keys
  are refused ([session](docs/proofs/session.json)).
- **SOAR:** season scores of the bots and analysts published to a leaderboard ([soar](docs/proofs/soar.json)).
- **Recovery:** the whole table torn down and set up again ([teardown](docs/proofs/teardown.json)).

---

## A round in 110 seconds

1. **Sit down.** One click gets you a seat. Guests get a browser key and chips; wallet users sign
   each action (popup-free session keys work on chain and in the SDK; the app toggle is not wired
   yet). Bots fill the other seats.
2. **The future is written.** A VRF request seeds the round inside the TEE: a hidden price path,
   hidden whale orders and the Leak schedule.
3. **Send orders into the dark.** The standard lane lands in 10 s. The priority lane lands in 2 s
   for a fee, and using it is a tell. Everyone sees _who_ sent an order, never what it was.
4. **Leaks drop** every 10 s: sealed, with a public label and rarity.
5. **Dutch auction.** The price falls every 500 ms until someone takes it.
6. **Open, flip or license.** Each is an access-control edit enforced by the TEE.
7. **Front-run, bait, fade.** Read a big pending buy, jump ahead in the priority lane, sell into
   it. Or send a decoy and fade the bots that bite.
8. **X-ray.** Every order, Leak and sandwich is replayed on the chart.

## What makes it different

- **The secret is made by the players.** Pending orders are the hidden information, so every action
  you take creates something someone else can buy.
- **It plays out a concept every Solana user knows.** Mempools, priority fees, front-running and
  sandwiches are the game mechanics.
- **Read access is the asset.** Buying, flipping and licensing a Leak rewrites who the TEE lets
  read an account. A Leak that was never opened has provably never been read.
- **Two kinds of secret that interact.** Flow (other players' orders) and Fundamentals (the VRF
  future the market is pulled toward). Flow pushes the price, fundamentals pull it back.
- **A real information economy.** Every reader's trades move the price, so shared information
  decays. Sellers choose between exclusivity and revenue.
- **Real markets, private signals.** Calls on live SOL/USD are settled by a crank against the
  MagicBlock oracle, so analyst track records are verifiable on chain.
- **Always live, plays alone.** Cranks run the table. Bots front-run, bait, flip, license and copy
  under the same rules as humans.

## MagicBlock features used

| Feature                              | What it does in INSIDER                                                                                                         | Code                       | Status                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| **Ephemeral Rollup (ER)** (required) | The whole table runs delegated: 500 ms ticks, order maturity, auctions and zero-fee trades                                      | `programs/insider`         | done (live table; 35 rounds in the soak)                                              |
| **Private ER (PER, TEE)**            | Hides the pending-order mempool, the future, and every sealed Leak and Call; ownership, flips and licenses are permission edits | `programs/insider`         | done (43 of 43 privacy probes)                                                        |
| **VRF**                              | Seeds each round's hidden future, whale orders and drop schedule in the TEE                                                     | `programs/insider`         | done (every round is seeded this way)                                                 |
| **Cranks**                           | 500 ms ticks, order maturity, auction steps and expiries                                                                        | `programs/insider`         | done (finite crank, re-armed by the bots; never ran out in the soak)                  |
| **Pricing Oracle**                   | Real SOL/USD for The Desk: Call snapshots, settlement, marks                                                                    | `programs/insider`         | done (Calls minted and judged on devnet)                                              |
| **Private Payments / Ephemeral SPL** | Alpha Cup buy-ins and private prize payouts, through an operator service                                                        | `programs/insider`, `bots` | done (test token, scripted entry; no browser join flow yet)                           |
| **Magic Actions + SOAR**             | Season scores published to a SOAR leaderboard on the base layer by the operator                                                 | `bots` (operator)          | SOAR done (`pnpm soar-demo`, `pnpm soar-board`); the post-commit Magic Action was cut |
| **Session keys**                     | Popup-free play for wallet users                                                                                                | `programs/insider`, `sdk`  | program and SDK done (`pnpm session-demo`); the app toggle is in progress             |
| **Magic Router**                     | Client routing across base and rollup transactions                                                                              | `sdk`                      | only the delegation-status lookup (`getDelegationStatus`)                             |

The hard part was proven before any game code was written: a VRF callback inside the TEE picks a
wallet and makes it the **only** reader of a private account in one transaction, in about 0.4 s. The
transaction index is in [docs/proofs](docs/proofs/README.md).

## Why it has to be onchain

- **Nobody can peek.** Pending orders, the future and sealed Leaks are readable by no wallet,
  including ours.
- **Nobody can rig it.** VRF writes the future and the authority has no instruction that edits it.
- **Truth is guaranteed.** The program computes every Leak from the hidden state.
- **Real time at zero fees.** A falling price every 500 ms and orders that mature on a tick aren't
  practical on the base layer.
- **Track records can't be faked.** Calls are judged against the oracle price by the program, not by us.

## Tech stack

- **Onchain:** Rust, Anchor, `ephemeral-rollups-sdk` 0.18 (`anchor`, `vrf`, `access-control`, `crank`)
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, `lightweight-charts`
- **SDK:** `sdk/`, a typed client shared by the app and the bots
- **Bots:** TypeScript service, one real keypair per bot, deterministic strategies
- **AI Desk:** Grok (xAI), Groq-hosted models or Claude (Anthropic) for analyst Calls and live commentary

Design: [docs/TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md). Product:
[docs/PROJECT_INFO.md](docs/PROJECT_INFO.md). Who builds what: [docs/STEPS.md](docs/STEPS.md).

## Repository layout

```
programs/   Rust workspace: the Anchor program (insider/), Anchor.toml, generated IDL
sdk/        Typed TypeScript client (accounts, instructions, TEE auth)
app/        Next.js app (trading floor, ghost orders, Leak cards, Desk, X-ray)
bots/       Bot players, AI analysts, commentary and the operator
scripts/    Gates, table setup, simulate-round, proof index
docs/       Product, technical spec, build plan, Phase 2 findings and devnet proofs
```

## Quick start

Prerequisites: Node 24, pnpm 10, Rust 1.89, Solana CLI 4.x, Anchor CLI 1.2.2.

```bash
pnpm install
cp .env.example .env            # fill in values
pnpm tsx scripts/check-setup.ts # verify toolchain and keypairs
pnpm dev                        # run the Next.js app
pnpm program:build              # build the program to SBF
pnpm program:idl                # generate the IDL
pnpm program:test               # program unit tests (LiteSVM)
pnpm test                       # TypeScript tests
```

Run the table (needs the deployer key in `.keys/`; see [docs/runbook.md](docs/runbook.md)):

```bash
pnpm setup-table --arm   # create and delegate the table accounts, arm the crank (safe to repeat)
pnpm fund --all          # top up the bot wallets
pnpm bots                # five bots; they also score rounds, reseal Leaks and re-arm the crank
pnpm operator            # opens each new season (and publishes it to SOAR); needed at every epoch end
pnpm cup-operator        # Alpha Cup buy-ins, co-signing and payouts
pnpm analysts            # the two AI analysts and the caption feed (needs a model API key)
```

Proof scripts: `pnpm session-demo`, `desk-demo`, `cup-demo`, `simulate-round`, `privacy-test`,
`soar-demo`, `soak-report`; `pnpm proofs` rebuilds the proof index. Hosting the services is in the
runbook ("Hosting on Render").

On Windows, `anchor build` can crash inside `cargo-build-sbf`; use `pnpm program:build` and
`pnpm program:idl` instead.

## Status legend

- `planned`: designed, not started
- `in progress`: partially built, or the underlying primitive is verified on devnet
- `done`: built, tested and verifiable in this repo

## Known limits

- Devnet only; the Alpha Cup uses a test token and has no browser entry flow yet (entry is scripted).
- The soak had no human players, so a cup with real entrants has only been run by the demo script.
- Session keys are verified on chain and in the SDK but not yet switched on in the app.
- The post-commit Magic Action was cut; SOAR scores are published by the operator, and a human
  appears on the SOAR board only after registering once (not in the app yet). No achievements.
- Models: the analysts use whichever of Grok, Groq or Claude has a key set; the Groq path is the
  one run live. The xAI path is unit-tested only.

## Hackathon

Solana Blitz v10, Nov 20-27 2026 (online), by MagicBlock. Submission deadline: Nov 27, 9:00 AM EST
(14:00 UTC).

## License

MIT. See [LICENSE](LICENSE).

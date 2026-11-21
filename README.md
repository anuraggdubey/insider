# INSIDER

**Front-running is the game.**

INSIDER is a real-time trading game on Solana built around MEV. Every order you send waits **10
seconds in a dark mempool** before it executes. For those 10 seconds the future exists, sealed
inside MagicBlock's Private Ephemeral Rollup. Nobody can see it: not the other players, not the
server, not us.

Unless they buy a **Leak**: a sealed, provably untouched snapshot of a piece of that mempool. Read
it, then pay the priority fee to jump ahead of the orders you just saw. Or flip it unopened to
someone who'll pay more. Or place a fat fake order to bait the front-runners, and fade them when
they bite.

The future here isn't a random number. **The other players make it**, and you can buy a look at
it.

Built solo for **Solana Blitz v10** (MagicBlock, theme: _Entertainment Finance_).

> **Status:** in development. Every feature below is marked `planned`, `in progress` or `done`, and
> only `done` items are claimed as working. See [Status legend](#status-legend).

---

## A round in 90 seconds

1. **Sit down.** Click _Play_. A browser key takes a seat at a live table. There's no wallet popup
   and no deposit. Bots with real strategies fill the other seats.
2. **Send orders into the dark.** Buy or sell. Your order enters the private mempool and
   executes against the market **20 ticks (10 s)** later. Everyone sees that _you_ sent something,
   and which lane you used. Nobody sees the side or size.
3. **Leaks drop.** Every 10 s the program snapshots part of the mempool into a sealed Leak, such
   as _"Net flow landing in 4-9 s"_, _"Largest pending order"_ or _"Whale incoming"_. The label
   is public. The contents are sealed.
4. **Dutch auction.** The Leak's price falls every 500 ms until someone takes it.
5. **Open, flip or ignore.** _Open_ makes you its only reader (the TEE adds your key to its
   permission). _Flip_ resells it sealed, and a sealed Leak has provably never been read.
6. **Front-run.** Saw an 800-unit buy landing in 7 s? Send your buy in the **priority lane** (2 s
   delay, costs a fee), let their order push the price, and sell into it.
7. **X-ray.** At round end, every order, every Leak and every front-run is replayed on the chart,
   with arrows showing who got sandwiched by whom.

## Why this is different

- **The hidden information is made by the players.** In most hidden-info games the secret is a
  card or a random number. In INSIDER the secret is other people's pending orders, so every
  action you take creates information someone else can buy.
- **It plays out a real crypto concept.** Mempools, priority fees, front-running and sandwiches
  are everyday Solana knowledge, and here they're the game mechanics.
- **Privacy you can sell.** A Leak is read access to sealed data, and ownership is enforced by
  the TEE's permission list. Most privacy projects hide data. Here, read access is something you
  trade.
- **Bluffing is built in.** Leaks are true snapshots, so the only way to deceive is to place real
  orders you're willing to have filled. Bluffing costs you, which keeps it meaningful.
- **It plays with one person.** Bots front-run, bait, flip and copy-trade under the same rules,
  so a judge can play a full round alone in under a minute.

## MagicBlock features used

| Feature                                   | What it does in INSIDER                                                                                 | Code                      | Status                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------- |
| **Ephemeral Rollup (ER)** (required)      | The table, market and seats stay delegated; orders, bids and ticks run at zero fees, 2 ticks per second | `programs/insider`        | in progress (delegate, commit, undelegate verified)       |
| **Private ER (PER, TEE)**                 | The dark mempool and every sealed Leak are unreadable; opening a Leak adds exactly one reader           | `programs/insider`        | in progress (private read and member rewrite verified)    |
| **VRF**                                   | Rolls each Leak drop (type, window), schedules hidden whale flow, and adds market noise                 | `programs/insider`        | in progress (VRF in TEE + permission rewrite verified)    |
| **Cranks**                                | 500 ms ticks: mature orders, step auctions, expire Leaks, change phases                                 | `programs/insider`        | in progress (finite scheduled ticks on the TEE, verified) |
| **Magic Router**                          | Client routes base and rollup transactions automatically                                                | `app/src/lib`             | planned                                                   |
| **Ephemeral SPL / Private Payments** (P2) | Stake mode: buy-in and private prize payouts in a devnet test token                                     | `programs/insider`, `app` | planned                                                   |

The primitive the game depends on was proven before any game code was written: a VRF callback
inside the TEE picks a wallet and makes it the only reader of a private account in one
transaction, in about 0.4 s. See [docs/phase-2-findings.md](docs/phase-2-findings.md) and the devnet
index in [docs/proofs](docs/proofs/README.md). The new risk for the dark mempool is whether
order transactions themselves stay hidden. That's
[TECHNICAL_SPEC.md §4](TECHNICAL_SPEC.md#4-magicblock-integration-what-is-proven-what-is-not), and
it's checked first, with a fallback.

## Why it has to be onchain

- **A dark mempool you can trust.** On a normal server, the operator is the biggest
  front-runner. Here pending orders sit in TEE-private state that no key can read, including ours.
- **Leaks can't lie.** The program builds each Leak from the real mempool, so the contents are
  guaranteed accurate as of the tick it was minted.
- **Ownership is enforced, not promised.** Who can read a Leak is a permission record, visible on
  the explorer.
- **Real-time at zero fees.** Execution at 2 ticks per second and auctions that drop every 500 ms
  aren't practical on the base layer.

## Tech stack

- **Onchain:** Rust, Anchor, `ephemeral-rollups-sdk` 0.18 (features: `anchor`, `vrf`,
  `access-control`)
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion,
  `lightweight-charts`
- **Client SDKs:** `@solana/kit`, `@magicblock-labs/ephemeral-rollups-kit`, Wallet Standard
- **Bots:** TypeScript service, one real keypair per bot, deterministic strategies, no privileged
  path

Full design in [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md). Product and pitch in
[PROJECT_INFO.md](PROJECT_INFO.md).

## Repository layout

```
programs/insider/   Anchor program (table, dark mempool, vAMM, leaks, VRF, PER, cranks)
app/                Next.js app (trading floor, Leak cards, X-ray replay)
bots/               Bot players (Front-runner, Baiter, Flipper, Copycat, Flow) and keeper
tests/              Integration tests
scripts/            Deploy, table setup, simulate-round, Phase 2 lab experiments
docs/               Phase 2 findings and devnet proofs
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
pnpm test                       # integration tests
```

Note: on Windows, `anchor build` can crash inside `cargo-build-sbf`; use `pnpm program:build` and
`pnpm program:idl` instead.

## Status legend

- `planned`: designed, not started
- `in progress`: partially built, or the underlying primitive is verified on devnet
- `done`: built, tested and verifiable in this repo

## Hackathon

Solana Blitz v10, Nov 20-27 2026 (online), by MagicBlock. Submission deadline: Nov 27 9:00 AM EST.

## License

MIT. See [LICENSE](LICENSE).

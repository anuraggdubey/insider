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

On **The Desk**, players lock private **Calls** on the _real_ SOL/USD price. A crank settles them
against the MagicBlock oracle, and every seat builds a public, verifiable track record. Two of the
analysts are AI agents.

Built by **Anurag Dubey** and **Misbah Ansari** for **Solana Blitz v10** (MagicBlock, theme:
_Entertainment Finance_).

> **Status:** in development. Every feature is marked `planned`, `in progress` or `done`. Only
> `done` items are claimed as working. "Verified" means the underlying primitive ran on devnet in
> our lab experiments (see [docs/phase-2-findings.md](docs/phase-2-findings.md)). See the
> [status legend](#status-legend).

---

## A round in 110 seconds

1. **Sit down.** One click gets you a seat. Guests get a browser key and chips; wallet users get a
   session key with no popups. Bots fill the other seats.
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

| Feature                              | What it does in INSIDER                                                                                                         | Code                      | Status                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| **Ephemeral Rollup (ER)** (required) | The whole table runs delegated: 500 ms ticks, order maturity, auctions and zero-fee trades                                      | `programs/insider`        | in progress (delegate, commit, undelegate verified)                                           |
| **Private ER (PER, TEE)**            | Hides the pending-order mempool, the future, and every sealed Leak and Call; ownership, flips and licenses are permission edits | `programs/insider`        | in progress (private read, revocation and atomic rewrite verified; order privacy gated by G0) |
| **VRF**                              | Seeds each round's hidden future, whale orders and drop schedule in the TEE                                                     | `programs/insider`        | in progress (VRF in the TEE and permission rewrite verified)                                  |
| **Cranks**                           | 500 ms ticks, order maturity, auction steps, expiries, Call settlement                                                          | `programs/insider`        | in progress (finite scheduled ticks on the TEE verified)                                      |
| **Pricing Oracle**                   | Real SOL/USD for The Desk: Call snapshots, settlement, marks                                                                    | `programs/insider`        | planned (gate G4)                                                                             |
| **Private Payments / Ephemeral SPL** | Alpha Cup buy-ins and private prize payouts                                                                                     | `programs/insider`, `app` | planned (gate G5)                                                                             |
| **Magic Actions + SOAR**             | Post-commit leaderboard and achievements on the base layer                                                                      | `programs/insider`        | planned (gate G6)                                                                             |
| **Session keys**                     | Popup-free play for wallet users                                                                                                | `programs/insider`, `app` | program and SDK live on devnet (`pnpm session-demo`); the app toggle is next                  |
| **Magic Router**                     | Client routing across base and rollup transactions                                                                              | `sdk`                     | planned                                                                                       |

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
- **Track records can't be faked.** The crank settles Calls against the oracle, not against us.

## Tech stack

- **Onchain:** Rust, Anchor, `ephemeral-rollups-sdk` 0.18 (`anchor`, `vrf`, `access-control`, `crank`)
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, `lightweight-charts`
- **SDK:** `sdk/`, a typed client shared by the app and the bots
- **Bots:** TypeScript service, one real keypair per bot, deterministic strategies
- **AI Desk:** Grok (xAI) or Claude (Anthropic) API for analyst Calls and live commentary

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
pnpm test                       # integration tests
```

On Windows, `anchor build` can crash inside `cargo-build-sbf`; use `pnpm program:build` and
`pnpm program:idl` instead.

## Status legend

- `planned`: designed, not started
- `in progress`: partially built, or the underlying primitive is verified on devnet
- `done`: built, tested and verifiable in this repo

## Hackathon

Solana Blitz v10, Nov 20-27 2026 (online), by MagicBlock. Submission deadline: Nov 27, 9:00 AM EST
(14:00 UTC).

## License

MIT. See [LICENSE](LICENSE).

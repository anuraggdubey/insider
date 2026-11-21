# INSIDER

**Buy the future. Sealed.**

INSIDER is a real-time market on Solana where the thing you trade is the future itself. Every
ten seconds a sealed **Leak** drops: a true fact about where the price is going, that nobody has
read. Not the other players, not the server, not us. Bid for it, crack it open and trade on it, or
flip it unopened to someone who will pay more. Leaks expire, so what's worth something now is
worthless fifteen seconds later.

On Solana you can own a token. In INSIDER you can own a **secret**, and the TEE enforces that only
you can read it.

Built solo for **Solana Blitz v10** (MagicBlock, theme: _Entertainment Finance_).

> **Status:** in development. Every feature below is marked `planned`, `in progress` or `done`, and
> only `done` items are claimed as working. See [Status legend](#status-legend).

---

## A round in 90 seconds

1. **Sit down.** Click _Play_. You get a seat at a live table with a browser key, so there's no
   wallet popup and no deposit. Bots with their own strategies fill the other seats.
2. **The future is written.** MagicBlock VRF seeds the round's price path inside a Private
   Ephemeral Rollup. The whole path exists before the first tick, and no wallet can read it.
3. **Leaks drop.** Every 10 s the program mints a sealed Leak from the hidden path, for example
   _"Price in 12 s"_, _"Direction over the next 20 s"_ or _"Crash warning"_. Everyone sees the label
   and rarity. Nobody sees the contents.
4. **Dutch auction.** The Leak's price falls every 500 ms until someone takes it. Buy early and you
   pay more but get more time to use it. Wait and a bot snipes it.
5. **Open or flip.** _Open_ makes you the only reader (the TEE adds your wallet to the
   permission). _Flip_ re-lists it sealed. A sealed Leak has provably never been read, so a
   buyer is paying for untouched information.
6. **Trade it.** Go long or short on the asset with zero fees, settled in milliseconds. Everyone
   can see who opened what and when they traded. Copy them, fade them, or bluff.
7. **X-ray.** When the round ends, every Leak is revealed on the chart next to the trades it
   triggered. Score is final equity minus what you spent on Leaks.

## Why this is different

Most MagicBlock entries use privacy to **hide game state** (fog of war, hidden hands, private order
books). INSIDER uses privacy for **ownership of knowledge**:

- **Read access is the asset.** Buying a Leak doesn't move a token. It rewrites who the TEE lets
  read an account. Ownership, transfer and "opened or not" are all enforced by the protocol.
- **Information you can verify without seeing it.** The program computes each Leak from the hidden
  path, so it's guaranteed true. The buyer only has to decide what it's worth.
- **Perishable assets.** Every Leak has an expiry tick, which turns pack-opening and
  collecting into a live trading decision.
- **It plays with one person.** Bots buy, flip, snipe and copy-trade under the same rules as
  humans, so a judge can play a full round alone in under a minute.

## MagicBlock features used

| Feature                                   | What it does in INSIDER                                                                         | Code                      | Status                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------- |
| **Ephemeral Rollup (ER)** (required)      | The table, market, seats and Leak board stay delegated; trades, bids and ticks run at zero fees | `programs/insider`        | in progress (delegate, commit, undelegate verified)       |
| **Private ER (PER, TEE)**                 | Hides the future price path and every sealed Leak; opening a Leak adds exactly one reader       | `programs/insider`        | in progress (private read and member rewrite verified)    |
| **VRF**                                   | Seeds each round's price path and rolls every Leak drop (type, rarity, horizon)                 | `programs/insider`        | in progress (VRF in TEE + permission rewrite verified)    |
| **Cranks**                                | 500 ms market ticks, auction steps, Leak expiry, round transitions                              | `programs/insider`        | in progress (finite scheduled ticks on the TEE, verified) |
| **Magic Router**                          | Client routes base and rollup transactions automatically                                        | `app/src/lib`             | planned                                                   |
| **Ephemeral SPL / Private Payments** (P1) | Stake mode: buy-in and private prize payouts in a devnet test token                             | `programs/insider`, `app` | planned                                                   |
| **SOAR** (stretch)                        | Season leaderboard for best "alpha hunters"                                                     | `app`                     | planned                                                   |

The hard part was proven before any game code was written: a VRF callback inside the TEE
picks a wallet and makes it the **only** reader of a private account in one transaction, in about
0.4 s. INSIDER's whole mechanic sits on that. See [docs/phase-2-findings.md](docs/phase-2-findings.md)
and the devnet transaction index in [docs/proofs](docs/proofs/README.md).

## Why it has to be onchain

- **Nobody can peek.** The future path and sealed Leaks are readable by no wallet, including the
  operator's. A normal server can't credibly promise that.
- **Nobody can rig it.** VRF writes the path and the drops. The authority has no instruction that
  edits either.
- **Truth is guaranteed.** Leak contents are computed by the program from the path, so a Leak can't
  lie.
- **Real-time at zero fees.** A falling price every 500 ms and trades in milliseconds aren't
  practical on the base layer.

## Tech stack

- **Onchain:** Rust, Anchor, `ephemeral-rollups-sdk` 0.18 (features: `anchor`, `vrf`,
  `access-control`)
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, `lightweight-charts`
- **Client SDKs:** `@solana/kit`, `@magicblock-labs/ephemeral-rollups-kit`, Wallet Standard
- **Bots:** TypeScript service, one real keypair per bot, deterministic strategies, no
  privileged path

Full design in [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md). Product and pitch in
[PROJECT_INFO.md](PROJECT_INFO.md).

## Repository layout

```
programs/insider/   Anchor program (table, market, leaks, VRF, PER, cranks)
app/                Next.js app (trading floor, Leak cards, X-ray replay)
bots/               Bot players (whale, sniper, flipper, copycat, degen)
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

# INSIDER

**Among Us for the market. Fully onchain.**

Insider is a real-time social-deduction trading game on Solana. In every round one player is secretly "the Insider" and can see the future price. Everyone else trades blind, watches for suspicious moves, then votes on who they think the Insider is. Catch them and their profit is split among the detectives. Slip past and they keep it all.

Built solo for **Solana Blitz v10** (MagicBlock, theme: _Entertainment Finance_).

> **Status:** in development. This README marks every feature as `planned`, `in progress` or `done`, and only `done` items are claimed as working. See [Status legend](#status-legend).

---

## How a round works

1. **Lobby.** 5 to 8 seats fill with humans and AI agent players. Everyone stakes the same amount.
2. **Roles.** MagicBlock VRF secretly picks one Insider. Only the Insider's wallet can read the hidden _price tape_ (the price path 10-15 seconds ahead).
3. **Trading (about 2 min).** Everyone trades a single synthetic asset in real time on an Ephemeral Rollup. Sides, sizes and balances are hidden; the public only sees _who_ acted and _when_.
4. **Accusations.** Humans and AI agents argue in chat ("why did you sell at 1:42?").
5. **Vote.** Each player votes for who they think the Insider is.
6. **Reveal and settle.** The private tape and every position are revealed, the vote is tallied, and the pot is paid out onchain.

## MagicBlock features used

| Feature                              | What it does in Insider                                                              | Code                          | Status  |
| ------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------- | ------- |
| **Ephemeral Rollup (ER)** (required) | Delegates round, market and player accounts; 10 ms, zero-fee trades and ticks        | `programs/insider`            | planned |
| **VRF**                              | Picks the Insider, seeds the hidden price path                                       | `programs/insider`            | planned |
| **Private ER (PER, TEE)**            | Hides the price tape, positions and balances from everyone but the permitted wallets | `programs/insider`            | planned |
| **Magic Router**                     | Routes transactions to base layer or ER automatically on the client                  | `app/lib`                     | planned |
| **Session keys**                     | Wallet-free play: no popup per trade                                                 | `programs/insider`, `app/lib` | planned |
| **Cranks**                           | Scheduled price ticks inside the rollup                                              | `programs/insider`            | planned |
| **SOAR** (stretch)                   | Onchain "best detective" leaderboard                                                 | `app`                         | planned |

Explorer proofs (delegation, VRF request, private-state transactions) will be linked here once deployed.

## Why onchain

- **Provable fairness.** The Insider pick and the price path come from verifiable randomness; nobody (including the host) can rig a round.
- **Real hidden information.** Private rollup state means the Insider's edge is enforced by hardware-backed access control, not by a server promising not to leak.
- **Real stakes.** Stakes and payouts are escrowed and settled by the program.
- **Real-time.** 10 ms zero-fee execution is what makes a live trading game playable.

## Tech stack

- **Onchain:** Rust, Anchor, `ephemeral-rollups-sdk` (features: `anchor`, `vrf`, `access-control`)
- **Frontend and backend:** Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Client SDKs:** `@solana/kit`, `@magicblock-labs/ephemeral-rollups-kit`, Wallet Standard
- **AI players:** TypeScript agent service with persona-driven LLM calls and real keypairs
- **Video:** HyperFrames / Remotion for the demo film

Full details in [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md).

## Repository layout (target)

```
programs/insider/   Anchor program (ER, VRF, PER)
app/                Next.js app (UI, API routes, realtime)
bots/               AI agent players
tests/              Program and integration tests
scripts/            Deploy, delegate, simulate-round scripts
video/              Demo film project
```

## Documentation

- [PROJECT_INFO.md](PROJECT_INFO.md): what Insider is, the game design and the strategy
- [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md): architecture, accounts, instructions, MagicBlock integration

## Quick start

Prerequisites: Node 24, pnpm 10, Rust 1.89, Solana CLI 4.x, Anchor CLI 1.2.2.

```bash
pnpm install
cp .env.example .env            # fill in values
pnpm tsx scripts/check-setup.ts # verify toolchain and keypairs
pnpm dev                        # run the Next.js app
pnpm program:build              # build the program to SBF
pnpm program:idl                # generate the IDL
pnpm test                       # run tests
```

Note: on Windows, `anchor build` can crash inside `cargo-build-sbf`; use `pnpm program:build` and `pnpm program:idl` instead.

## Status legend

- `planned`: designed, not started
- `in progress`: partially built
- `done`: built, tested and verifiable in this repo

## Hackathon

Solana Blitz v10, Nov 20-27 2026 (online), by MagicBlock. Submission deadline: Nov 27 9:00 AM EST.

## License

MIT. See [LICENSE](LICENSE).

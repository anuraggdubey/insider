# Insider: Technical Specification

Version 0.1 (design). Items marked **[verify]** depend on MagicBlock behaviour that must be confirmed with a small prototype before relying on it.

## 1. Goals and principles
1. **ER is the core.** All live game state (round, market, players, trades) runs inside an Ephemeral Rollup. Base layer is used only for delegation, escrow and final settlement.
2. **Everything claimed is real.** No mocked ER, VRF or PER paths. Every feature has code, a test and an explorer transaction.
3. **Hidden state is enforced by the protocol.** The Insider's information advantage comes from Private ER access control, not from server-side secrecy.
4. **Demo-able at any time.** A full round must run from one command or one click, with AI agents filling seats.
5. **Small surface.** One asset, one mode, one program.

## 2. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Program | Rust + Anchor | Anchor 1.0.x as pinned by MagicBlock docs [verify exact version at setup] |
| MagicBlock SDK (program) | `ephemeral-rollups-sdk` >= 0.14.2 | Features: `anchor`, `vrf`, `access-control` |
| Frontend / full stack | Next.js (App Router), TypeScript | API routes for chat, bot control, round indexing |
| Styling and motion | Tailwind CSS, Framer Motion | Neon trading-floor UI, reveal animation |
| Charts | Lightweight canvas or `lightweight-charts` | Live candles and price line |
| Client SDK | `@solana/kit`, `@magicblock-labs/ephemeral-rollups-kit` | `Connection.create` against the Magic Router |
| Wallets | Wallet Standard (Phantom, Backpack, Solflare) | Plus in-browser session key |
| Agents | TypeScript service, LLM API | One keypair per agent, persona prompts |
| Realtime | ER websocket subscriptions + SSE for chat | No separate DB required for MVP |
| Tests | Anchor tests (TypeScript), local ER stack / Surfpool | MagicBlock "Run Ephemeral Rollups Locally" |
| Video | HyperFrames / Remotion + ffmpeg | See PROJECT_INFO.md |

Toolchain versions from MagicBlock docs (reference): Solana 3.1.9, Rust 1.89.0, Anchor 1.0.2, Node 24.x. Already present on the dev machine: Solana CLI, Rust, Node, ffmpeg. Anchor to be confirmed at setup.

## 3. Architecture

```
                 +---------------------------+
   Browser  ---> | Next.js app (UI + API)    |
 (wallet +       |  - lobby, game, reveal    |
  session key)   |  - chat (SSE)             |
      |          +------------+--------------+
      |                       |
      | tx (via Magic Router) | agent control / round index
      v                       v
+------------------+   +----------------------+
| Magic Router     |   | Agent service (Node) |
| devnet-router    |   |  personas + LLM      |
+--------+---------+   |  agent keypairs      |
         |             +----------+-----------+
   base layer / ER                |
         |                        |
+--------v------------------------v-----------+
|  Solana devnet (base)   |  MagicBlock ER    |
|  - escrow vault         |  + TEE (PER)      |
|  - delegation program   |  - Round, Market  |
|  - settlement           |  - PriceTape (priv)|
|                         |  - Players, Votes |
+-------------------------+-------------------+
```

Flow: accounts are created and funded on the base layer, delegated to a **TEE validator**, played inside the ER, then committed and undelegated for settlement.

## 4. MagicBlock integration

| Feature | Used for | Mechanism |
|---|---|---|
| Delegation / ER | Live round state | `#[ephemeral]`, `#[delegate]` macros, `delegate_*` CPI, `commit_and_undelegate` via `MagicIntentBundleBuilder` |
| Private ER | Price tape, positions, balances | Delegate to the TEE validator; `EphemeralPermission` accounts created on the ER via `CreateEphemeralPermissionCpi` / updated via `UpdateEphemeralPermissionCpi` with `Member` flags (`TX_LOGS_FLAG`, `TX_MESSAGE_FLAG`, `TX_BALANCES_FLAG`) |
| VRF | Insider selection, tape seed | `create_request_scoped_randomness_ix` with `#[vrf]` context and a `#[vrf_callback]` consume instruction; oracle queue from `vrf::consts` (ER devnet queue when requested inside the ER) [verify in-ER request] |
| Magic Router | Client routing | `Connection.create("https://devnet-router.magicblock.app", "wss://devnet-router.magicblock.app")` |
| Session keys | Wallet-free trading | Program-level session authority (section 8) |
| Cranks | Scheduled price ticks | MagicBlock cranks; fallback is a keeper loop in the agent service [verify] |
| SOAR (stretch) | Detective leaderboard | SOAR leaderboard + achievements |

Known endpoints and programs (devnet, from MagicBlock docs):
- Router: `https://devnet-router.magicblock.app`
- TEE validator: `devnet-tee.magicblock.app`, identity `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`
- Permission Program: `ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1`
- Delegation Program: `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`

## 5. Onchain program (`programs/insider`)

### 5.1 Accounts

| Account | Seeds | Layer during play | Visibility | Fields (summary) |
|---|---|---|---|---|
| `Config` | `["config"]` | base | public | admin, stake mint, params (durations, bankroll, max position %) |
| `Round` | `["round", round_id]` | ER (TEE) | public | id, phase, start_ts, trade_end_ts, vote_end_ts, player_count, stake, pot, insider_revealed (Option), tally |
| `Market` | `["market", round_id]` | ER (TEE) | public | tick index, current_price, last_update_ts, spread params |
| `PriceTape` | `["tape", round_id]` | ER (TEE) | **private: Insider only** | seed, precomputed price array (fixed length), lookahead window |
| `Player` | `["player", round_id, wallet]` | ER (TEE) | action times public, balances private | wallet, session_authority, seat, cash, position, equity, last_action_ts, voted_for |
| `Role` | `["role", round_id]` | ER (TEE) | **private** until reveal | insider_seat / wallet |
| `Vault` | `["vault", round_id]` | base | public | escrowed stake tokens |
| `EphemeralPermission` | managed by Permission Program | ER | n/a | members + flags per private account |

Only a minimal public surface is exposed: who acted and when, the current price, phase and timers.

### 5.2 Instructions

| Instruction | Layer | Purpose |
|---|---|---|
| `initialize_config` | base | One-time config |
| `create_round` | base | Create `Round`, `Market`, `PriceTape`, `Vault`; set params |
| `join_round` | base | Player stakes into vault, creates `Player`; AI agents use the same path |
| `delegate_round` | base | Delegate Round, Market, PriceTape, Players, Role to the TEE validator when lobby is full or timer ends |
| `init_permissions` | ER | Create `EphemeralPermission` for private accounts (PDA signs via seeds) |
| `request_roles` | ER | Request VRF randomness (caller seed = round id) |
| `callback_roles` | ER | VRF callback: pick Insider seat, generate `PriceTape` from randomness, then set permission so only the Insider's wallet can read the tape |
| `tick` | ER | Advance market using the tape: `Market.current_price = tape[tick]`; called by crank or keeper |
| `trade` | ER | Buy / sell / flatten; executes at current price with spread; enforces max position and phase; signed by wallet or session key |
| `open_vote` | ER | Move to vote phase after trading ends |
| `cast_vote` | ER | One vote per player; cannot vote for self |
| `reveal` | ER | Make tape, role and positions public (update permissions to public) |
| `settle` | ER then base | Compute payouts; `commit_and_undelegate`; base-layer `claim_payouts` pays from vault |
| `claim_payouts` | base | Transfer payout to each player from the vault |
| `set_session_key` | base or ER | Authorize a browser session key for a player (section 8) |

### 5.3 Round state machine

```
Lobby -> RoleDraw -> Trading -> Voting -> Reveal -> Settled
```
Transitions are time-based (`Clock`) and enforced by each instruction's phase check. Any player or keeper can call the next-phase instruction once its timer has expired.

### 5.4 Market and price tape
- At role callback, the VRF output seeds a deterministic generator that fills `PriceTape` with N ticks (for example 1 tick per 500 ms for 120 s = 240 ticks).
- Generator: random walk with volatility regimes plus 2 to 3 scripted "event shocks" (+/- 3 to 8 percent over a few ticks) at random times, so there is always at least one movable event for the Insider.
- `Market.current_price` is public and follows the tape tick by tick. The Insider can read `PriceTape` (private) and therefore sees the next 10 to 15 seconds.
- Trades execute at `current_price` with a small spread and a size-based slippage term, so trading is not free and size is a visible risk.
- Price scale is integer fixed-point (for example 1e6) to avoid floats.

### 5.5 Trading rules
- Starting virtual bankroll: 1,000 chips per player (same for all).
- One asset, long or short, position limited to a fraction of bankroll (default 50 percent) to keep the Insider from being trivially all-in.
- Equity = cash + position marked to market.
- At trading end, positions are force-closed at the last price.

### 5.6 Voting and settlement math
Let `E_i` be final equity of player `i`, `B` the starting bankroll, `S` the stake, `N` players, pot `P = N * S`.

1. If the Insider is **not caught** (plurality of votes does not name the Insider, ties count as not caught): payout share is proportional to equity, `payout_i = P * E_i / sum(E)`.
2. If the Insider **is caught**: Insider equity is capped to `B` (profit forfeited). Forfeited profit `F = max(0, E_insider - B)` is added to a bonus pool split equally among players who voted for the Insider. All others are paid `P * E_i / sum(E')` where `E'` is equity after capping, then bonus pool is added to correct voters.
3. Dust is rounded to the last player; total payouts always equal the pot (asserted in tests).

Edge cases: a player who never votes counts as a wrong vote; disconnected players keep their last position and are force-closed at the end; a round with fewer than 3 active players is cancelled and refunds are claimable.

## 6. Private state design (PER)

Goal: only the Insider can read the future tape; positions and balances stay private until reveal; public sees who acted and when.

- All private accounts are delegated to the TEE validator. Accounts without a permission are public, so permissions are created immediately after delegation (`init_permissions`).
- `PriceTape`: permission `is_private = true`, members = empty at creation, then **updated in `callback_roles` to the Insider's wallet** with log/message/balance flags.
- `Role`: private, members = empty (program-only) until `reveal`.
- `Player` (positions, cash): private with the owner as the only member; a public subset of "who acted and when" is exposed through `Round`/`Market` event fields (for example a ring buffer of `(seat, ts)` pairs), not through the private account.
- `reveal`: updates permissions to `is_private = false` so the explorer and the UI can show the full replay.
- RPC reads of private accounts require an authorization token from the TEE RPC; the frontend obtains it per wallet. [verify exact token flow in the PER authorization docs]

**Honest trust model:** privacy relies on the TEE (Intel TDX). Agent keypairs are held by the agent service, so an agent playing the Insider role is trusted not to leak to other agents; this is stated in the README.

## 7. VRF flow
1. `request_roles` calls `create_request_scoped_randomness_ix` with `caller_seed = round_id`, callback discriminator `callback_roles`, and the accounts the callback needs (Round, PriceTape, Role, permission accounts).
2. Oracle returns randomness and the VRF program calls `callback_roles` (guarded by `#[vrf_callback]` so only the VRF program can invoke it).
3. `callback_roles` derives: Insider seat = `random_u8_with_range` over player count; tape seed = the 32-byte randomness.
4. The request and callback transactions are the explorer proof for "VRF used".

## 8. Session keys
- A player signs once on the base layer to register a browser-generated ephemeral keypair as `Player.session_authority` with an expiry slot.
- `trade` and `cast_vote` accept either the wallet or a valid, unexpired session authority.
- Result: no wallet popup per trade. Agents use their own keypairs directly.

## 9. Token and stakes
- MVP: stake is a devnet SPL test token minted by the project (shown as "USDC (devnet test)"). Real USDC is out of scope.
- Escrow in the `Vault` PDA on the base layer; payouts via `claim_payouts` after settlement.
- Fee: none for MVP.

## 10. Off-chain components

### 10.1 Next.js app (`app/`)
Routes and screens:
- `/` Landing and "Play a round" button
- `/lobby` Seats, stake, agent fill, countdown
- `/round/[id]` Live game: chart, action feed, chat, trade panel, vote modal, reveal
- `/replay/[id]` Shareable replay of a finished round
- API routes: `/api/chat` (SSE), `/api/agents` (control), `/api/rounds` (index from chain), `/api/tee-auth` (TEE token helper)

UI requirements: neon trading floor, big mono numerals, price chart with smooth tick animation, phase timer, caption-friendly layout (good for screen recording), reduced-motion support.

### 10.2 Agent service (`bots/`)
- N agent keypairs funded with devnet SOL and test tokens.
- Loop per agent: read public state, decide action, submit `trade`, post chat lines, cast vote.
- Personas: Nova (paranoid, accuses early), Rook (smug, trades big), Echo (quiet, low volume), plus more later. Each has a system prompt, a trade policy and a chat style.
- Insider agent policy: read the private tape through its own permission and trade with a randomised "cover" pattern so it is catchable but not trivial.
- Cost and latency controls: at most one LLM call per agent per 15 seconds, short outputs, scripted fallback lines if the API fails.
- Agents use exactly the same instructions as humans (no privileged path), which keeps the "real, not simulated" claim true.

### 10.3 Chat
Chat is off-chain (SSE). Stretch: commit a hash of the final transcript onchain at settlement.

## 11. Repository layout

```
insider/
  programs/insider/        Anchor program
  app/                     Next.js app
  bots/                    Agent service
  tests/                   Anchor + integration tests
  scripts/                 deploy, delegate, simulate-round
  video/                   Demo film (HyperFrames/Remotion)
  README.md
  PROJECT_INFO.md
  TECHNICAL_SPEC.md
```

## 12. Testing plan
- **Program unit tests:** payout math (property test: payouts sum to pot), phase gating, vote rules, position limits.
- **Integration (local ER stack or Surfpool):** full round with 5 players, delegate, VRF, trade, vote, settle.
- **Devnet smoke test:** scripted round that prints explorer links for each MagicBlock feature.
- **Privacy test:** a non-Insider wallet attempts to read `PriceTape` and is refused; Insider succeeds [verify].
- **Agent dry run:** headless round with 5 agents, no humans, for demo recording.

## 13. Deployment
- Program on Solana devnet (program ID recorded in README).
- App on Vercel (or similar); agent service on a small always-on host (Railway / Fly / Render) so a judge can always find a lobby filled.
- Env vars in `.env` (never committed); `.env.example` committed.

## 14. Security and fairness notes
- `#[vrf_callback]` on the callback, otherwise anyone could spoof randomness.
- All phase and authority checks use `Clock` and PDA seeds; no admin override of outcomes.
- Session keys are scoped to `trade` and `cast_vote` and expire.
- Integer math only; checked arithmetic everywhere.
- Known limitations (documented, not hidden): TEE trust, agent-held keys, devnet test token, off-chain chat.

## 15. Proof checklist for reviewers (to fill with links)
- [ ] Program ID on devnet
- [ ] Delegation transaction to the TEE validator
- [ ] VRF request and callback transactions
- [ ] Permission create / update transactions
- [ ] Settlement and payout transactions
- [ ] Live app URL and a recorded round

## 16. Milestones (deadline Nov 27, 9:00 AM EST = 14:00 UTC = 19:30 IST)

| Day | Goal |
|---|---|
| Nov 21 | Docs, repo, scaffold, toolchain; **minimal ER delegation on devnet (explorer proof)** |
| Nov 22 | Program: config, round, join, delegate, VRF role draw |
| Nov 23 | Program: tape, market tick, trade, private permissions; privacy test |
| Nov 24 | Program: vote, reveal, settle, payouts; Next.js lobby and game UI |
| Nov 25 | Agents, chat, reveal animation, UI polish |
| Nov 26 | Record real rounds; build and render the video; deploy |
| Nov 27 | README proofs, submission form, buffer (submit well before 19:30 IST) |

Cut order if time runs short: SOAR, cranks (use keeper), replay page, agent personas beyond three.

## 17. Open questions to verify early
1. Can `request_roles` run inside the TEE ER with the ER-devnet oracle queue, and can the callback then update the tape permission to the Insider's wallet in the same flow?
2. Exact TEE authorization flow for reading a private account from the browser and from an agent.
3. Cranks availability on the TEE validator for periodic `tick`.
4. Maximum number of delegated accounts per round and compute limits for settlement.
5. Anchor version compatibility with `ephemeral-rollups-sdk` >= 0.14.2.

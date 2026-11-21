# INSIDER: Project Information

## One-line pitch

A real-time market where you trade the future: sealed, perishable Leaks about the price, which
only their owner can read. The TEE enforces that.

## Taglines

- "Buy the future. Sealed."
- "On Solana you can own a token. Here you can own a secret."
- "Alpha expires."

## The idea in plain words

Finance runs on information asymmetry. Somebody knows something first, and everyone else pays
for it. INSIDER turns that into a game you can play in 90 seconds.

- A table trades one synthetic asset. Its price path for the round is **already written** by
  verifiable randomness and sealed inside a Private Ephemeral Rollup. No one can read it.
- Every ten seconds the program cuts a **Leak** from that hidden future: one true fact, such as
  the exact price twelve seconds from now, or whether a crash starts within twenty seconds.
- The Leak is sold **sealed** in a falling-price auction. The label and rarity are public. The
  contents aren't.
- The owner can **open** it (they become its only reader) or **flip** it sealed to another
  player. Because it's sealed, the buyer knows nobody has read it.
- Leaks **expire**. A Leak about second 40 is worth nothing at second 41.
- At the end of the round, the **X-ray** replays every Leak on the chart next to the trades it
  caused.

## Why this is Entertainment Finance

MagicBlock describes Entertainment Finance as apps where you trade, collect, compete and win
assets you actually own, with game mechanics on top. Their examples are trading games
(BananaZone), skill games with prizes (Slimecoin) and packs you open (Jungle Fun). INSIDER combines
all three in one loop:

| Entertainment Finance element | INSIDER                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| Packs you open and collect    | Sealed Leaks with rarities, opened with a reveal animation           |
| Trading game                  | A live long/short market at 500 ms ticks with zero fees              |
| Skill with real stakes        | Auction timing, reading other players, a PnL leaderboard, stake mode |
| Assets you own                | The Leak itself: ownership is the TEE's permission list              |

## Why it stands out

Three of the last four Blitz winners in v9 used privacy, and all of them used it to **hide
state**: fog-of-war battle royales and a private order book. Hidden-information card games,
prediction markets and social deduction are also common entries. INSIDER is none of these:

1. **Privacy as property, not fog.** The asset is read access. Buying, flipping and opening are
   permission updates enforced by Intel TDX hardware, not database rows.
2. **A new asset type: verifiable, sealed, perishable information.** The program generates the
   Leak from the hidden future, so it's guaranteed true. It hasn't been read, and it rots on a
   timer. We haven't seen this primitive in an onchain game before.
3. **Emergent social play without assigned roles.** Ownership is public. When a bot opens an
   Epic Leak and goes short two seconds later, the whole table sees it. Players copy-trade, fade,
   and bluff, and you can buy a Leak just to make others think you know something.
4. **Solo-playable by design.** Five bot strategies (Whale, Sniper, Flipper, Copycat, Degen) trade
   under the same rules and read only Leaks they own. A judge can play a full round in under a
   minute without finding other humans.
5. **Built to be watched.** Leak drops on the chart, an auction counting down, a crack-open
   animation, and the X-ray replay at the end.

## Players and roles

There are no assigned roles. Everyone has the same rules and different information.

- **Player (human).** Browser key, 1,000 chips per round, one seat.
- **Bot.** Same instructions, its own keypair, a fixed strategy and a persona name.
- **Spectator.** Watches the table live without a seat.

## Leak types

| Leak          | Rarity | What the owner learns                                         | Horizon |
| ------------- | ------ | ------------------------------------------------------------- | ------- |
| **Pin**       | Common | The exact price at a future tick                              | 5-15 s  |
| **Drift**     | Common | Up or down over the next window, plus a magnitude bucket      | 10-20 s |
| **Shockwave** | Rare   | Whether a shock of at least 3% starts in the window, and when | 20 s    |
| **Summit**    | Epic   | The highest and lowest price in the window, and their ticks   | 30 s    |

VRF picks each drop's type, rarity and horizon. The label (type, rarity, horizon, expiry tick)
is public. The contents are sealed.

## Round flow

| Phase | Duration | What happens                                                              |
| ----- | -------- | ------------------------------------------------------------------------- |
| Seed  | ~1 s     | VRF writes the hidden price path for the round                            |
| Live  | 90 s     | 500 ms ticks; a Leak drops every 10 s (9 per round); trading and auctions |
| X-ray | 10 s     | Positions force-closed, every Leak revealed on the chart, scores posted   |
| Next  | instant  | The table rolls straight into the next round (always live)                |

## Scoring

- Everyone starts a round with 1,000 chips.
- Leak purchases cost chips. Flip sales earn chips from the buyer.
- At round end, positions close at the last price.
- **Round score = final equity − 1,000.** The season leaderboard sums round scores.
- **Stake mode (P1):** a fixed buy-in in a devnet test token; the top 3 by round score split the
  pot, and payouts are sent with MagicBlock Private Payments.

## Example round (for the demo)

1. 0:00. Price 100.00, flat. You sit with Whale, Sniper, Flipper and Copycat.
2. 0:10. A **Rare Shockwave** drops at 300 chips and falls 15 chips per tick. Sniper takes it at 180.
3. 0:14. Sniper flips it, still sealed, for 260. Whale buys. The feed shows: _"Whale bought a
   sealed Shockwave from Sniper."_
4. 0:15. Whale opens it. A second later Whale shorts the maximum size. Copycat follows.
5. 0:21. You fade them and go long. 0:24: the shock is real, the price drops 6%, and you're
   down.
6. 0:30. A **Common Pin** drops. You buy it cheap and open it: _"Price at 0:42 = 97.80"_. You go
   long and close at 0:42.
7. X-ray. The chart replays all nine Leaks, who held them, when each was opened, and the trade
   that followed. Whale tops the round, you finish second, and Sniper profited without opening
   anything.

## Strategy for winning the hackathon

- **Playable, not promised.** A cold visitor clicks _Play_ and is trading within 5 seconds. This
  beats any amount of README.
- **One crisp idea.** "You can own a secret" works in a single sentence and a single shot (a
  sealed card cracking open).
- **Privacy is load-bearing.** If the TEE leaked, the game would be broken. Judges reward
  privacy that matters (v8's Herd won for exactly this).
- **Visible onchain activity.** The submission form counts delegations, VRF requests and
  private payments at the program address. Every round makes about 10 VRF requests, dozens
  of permission updates and hundreds of rollup transactions, all of which are real gameplay.
- **Honest README for automated screening.** Every claim maps to a file and a devnet transaction.
- **Scope discipline.** The P0 loop ships first. Stake mode, SOAR and extras are cut before the
  core loop is at risk.

## Demo video plan (about 75 s, plus a 20 s cut for X)

1. Cold open: a black screen with a sealed card. _"This card knows the price 12 seconds from
   now. Nobody has read it."_
2. Title: INSIDER. "Buy the future. Sealed."
3. A real round: a drop, the falling auction, a sniper takes it, a flip, someone opens it, and
   a short follows.
4. The crack-open shot: the TEE adds one reader, and the contents appear only on the owner's
   screen. Split screen with a second browser that sees nothing.
5. X-ray replay.
6. "What's onchain": VRF seed, permission rewrite and rollup trades, each with an explorer link.
7. End card: play link, repo.

## Non-goals (for this hackathon)

- Mainnet, real money or a token launch
- Real-world price feeds. The future has to exist in advance, so the asset is synthetic by
  design.
- More than one table or asset
- LLM chat agents (bots are deterministic; LLM flavour text is a stretch)
- Native mobile apps

## Success criteria

- A table runs continuously on devnet with bots: seed, ticks, drops, auctions, opens, flips,
  trades and X-ray.
- A second wallet provably cannot read a Leak it doesn't own (recorded in the demo and the
  tests).
- A cold visitor plays a round with no wallet and no setup.
- The VRF, permission and rollup transactions are linked from the README.
- The video, README and code tell the same story.

## Risks and how we handle them

| Risk                                              | Mitigation                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A private permission with zero members misbehaves | Use a keyless program PDA as the only member; nobody holds its key                                               |
| Browser keys can't pay rollup fees                | ER transactions are free; if a fee payer must exist on the base layer, a faucet route funds the burner with dust |
| Cranks can't issue VRF requests                   | The bot service calls `request_drop` on schedule (keeper fallback)                                               |
| 10-commit limit without a delegated fee payer     | Commit the season every few rounds and add a delegated fee payer plus `magic_fee_vault`                          |
| An empty or dull table for judges                 | Five bot strategies always seated; humans displace bots                                                          |
| Solo scope with about 4.5 days left               | Strict P0/P1/P2 cut order (see TECHNICAL_SPEC.md section 15)                                                     |
| Judges can't verify claims                        | Explorer links and file paths for every feature                                                                  |

## Branding notes

- Look: a dark trading terminal, a sealed-envelope / wax-seal motif for Leaks, rarity colours
  (grey, cyan, magenta), big mono numerals.
- Motion: Leaks slide onto the chart at their horizon, auction price ticks down, cards crack
  open.
- Tone: tense, sly, dry. Name in caps: INSIDER.

# INSIDER: Project Information

## One-line pitch

A real-time trading game where every order waits 10 seconds in a TEE-sealed dark mempool, and
players buy, flip and act on sealed snapshots of it. Front-running is the game.

## Taglines

- "Front-running is the game."
- "Every order waits 10 seconds in the dark. Buy a look."
- "The future is other people's orders."

## The idea in plain words

On real chains, whoever sees the mempool first wins. Bots read pending transactions, pay a
priority fee to jump ahead, and profit from everyone else's trades. INSIDER turns that into a
90-second game that's fair to play.

- A table trades one asset against a simple onchain market maker (a virtual AMM: big orders move
  the price). Everyone has 1,000 chips and up to 5× leverage.
- **Every order is delayed.** Standard orders execute 20 ticks (10 s) after you send them.
  Priority orders execute after 4 ticks (2 s) but cost a fee.
- **Pending orders are private.** They sit in a dark mempool inside MagicBlock's Private
  Ephemeral Rollup. The public only sees _"Seat 3 sent an order (priority lane)"_.
- **Leaks** are sealed snapshots of part of that mempool, auctioned every 10 s. Open one to read
  it, flip it unopened, or let it expire.
- At round end the **X-ray** replays everything and draws every sandwich on the chart.

## Why this is 10x the earlier versions

| Version                           | The hidden thing                       | Weakness                                                                     |
| --------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| v0.1 Among Us for the market      | One player's role                      | Social deduction is common, needs many humans, and the tell is trivial       |
| v0.2 Sealed Leaks of a VRF future | A random price path                    | The secret is a random number; once you hold a Leak, play is mechanical      |
| **v0.3 Dark mempool (this)**      | **Other players' real pending orders** | Players create the information, so strategy, bluffing and reflexivity follow |

The key change is that the information is **made by the players**. Every order you send is
something someone else can buy a look at, and every Leak you buy can push you into a trade that
someone else is waiting for.

## Why this is Entertainment Finance

MagicBlock describes Entertainment Finance as apps where you trade, collect, compete and win
assets you actually own, with game mechanics on top. Their examples are trading games
(BananaZone), skill games with real prizes (Slimecoin) and packs you open (Jungle Fun).

| Entertainment Finance element | INSIDER                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Trading game                  | Live long/short against a vAMM at 2 ticks per second, zero fees                |
| Packs you open                | Sealed Leaks with rarities, auctioned, cracked open with a reveal              |
| Skill with real stakes        | Reading flow, timing the priority lane, bluffing; PnL leaderboard; stake mode  |
| Assets you own                | The Leak itself: ownership is the TEE's permission list, transferable sealed   |
| Finance mechanics             | Mempool, priority fees, front-running, sandwiches, the core of onchain markets |

## Why it stands out

Recent Blitz winners used privacy to **hide state**: fog-of-war battle royales (Blackout,
Nightfall), a private order book (NoirWire), private RFQ (Tenor) and hidden answers (Herd).
Hidden-information card games, prediction markets and social deduction are common entries.
INSIDER is different in four ways:

1. **It plays out MEV.** Every Solana user knows front-running and sandwiches, but nobody has made
   a fair game out of them. Private pending orders are also exactly what MagicBlock's TEE is good
   at.
2. **Privacy is something you trade.** Pending orders are private, and read access to a snapshot
   of them is an asset you can buy, resell sealed, or use.
3. **Information created by players.** The secret is your opponents' intent, so the game has real
   depth: bait orders, decoy priority sends, copy-trading the priority lane.
4. **Bluffing has a real cost.** Leaks can't be faked, so deception means placing real orders
   that really get filled.

## Players

There are no roles. Everyone follows the same rules and holds different information.

- **Player (human).** Browser key, 1,000 chips per round, one seat.
- **Bot.** Same instructions, its own keypair, a fixed strategy and a persona.
- **Spectator.** Watches the table live, with all public data.

## The two lanes

| Lane     | Delay           | Cost               | What everyone sees                 |
| -------- | --------------- | ------------------ | ---------------------------------- |
| Standard | 20 ticks (10 s) | free               | "Seat 3 sent an order"             |
| Priority | 4 ticks (2 s)   | 10 chips per order | "Seat 3 sent a **priority** order" |

Using the priority lane is itself a tell. It usually means someone knows something.

## Leak types

| Leak          | Rarity | What the owner learns (accurate at mint tick)                           |
| ------------- | ------ | ----------------------------------------------------------------------- |
| **Flow**      | Common | Net units and order count landing in a 10-tick window, 2-12 ticks ahead |
| **Spotlight** | Rare   | The largest pending order: seat, side, size, landing tick               |
| **Whale**     | Rare   | The next hidden whale order (VRF-scheduled): side, size, landing tick   |
| **Full Book** | Epic   | Every pending order in the mempool: seat, side, size, landing tick      |

A Leak is a true snapshot at the tick it was minted. Orders sent afterwards, mostly priority
ones, can still land inside its window. Front-runners create that uncertainty, and that's
intended.

## Round flow

| Phase | Duration | What happens                                                                                    |
| ----- | -------- | ----------------------------------------------------------------------------------------------- |
| Seed  | ~1 s     | VRF schedules 3-5 hidden whale orders and the round's noise seed                                |
| Live  | 90 s     | 500 ms ticks; orders mature; a Leak drops every 10 s (8 per round); auctions; trades            |
| Close | 10 s     | No new orders after tick 160; the mempool drains; positions close at the last price at tick 180 |
| X-ray | 10 s     | Every order, Leak and sandwich revealed on the chart; scores posted                             |
| Next  | instant  | The table rolls straight into the next round                                                    |

## Scoring

- 1,000 chips per round. Leak bids and priority fees cost chips; flip sales earn them.
- **Round score = final equity − 1,000.** The season leaderboard sums round scores.
- **Stake mode (P2):** a devnet test-token buy-in; the top 3 split the pot through MagicBlock
  Private Payments.

## Example round (for the demo)

1. 0:12. You go long 2,000 units in the standard lane. The feed shows: _"You sent an order."_
2. 0:14. A **Rare Spotlight** drops. Front-runner takes it at 90 and opens it. It shows your 2,000-unit buy, landing at 0:22.
3. 0:15. _"Front-runner sent a **priority** order."_ It lands at 0:17, buying ahead of you.
4. 0:22. Your buy lands and pushes the price up about 8%. Front-runner sells into it at 0:23. You've
   just been sandwiched by a player who **bought the right to see your order**.
5. 0:40. Payback. You buy a **Common Flow** Leak: _"+2,600 net buy landing 0:46-0:51"_. You
   send a priority buy, it lands at 0:44, and you sell at 0:52.
6. 0:55. Baiter sends a huge standard sell. Copycat sees the Spotlight's owner go priority-short
   and follows. Baiter's priority buy lands first, and the trap closes on both of them.
7. X-ray: the chart replays every order with arrows (sent → landed), every Leak and who held it,
   and labels each sandwich.

## Strategy for winning the hackathon

- **A hook people get immediately.** "Front-running is the game" needs no explanation on
  Solana, and "you got front-run by someone who bought your order" works in one shot.
- **Privacy that carries the game.** If the TEE leaked, the dark mempool would be pointless.
  Judges reward privacy that matters (v8's Herd won for that reason).
- **Playable, not promised.** A cold visitor clicks _Play_ and is trading in 5 seconds, against
  bots that play the meta.
- **Visible onchain activity.** The submission form counts delegations, VRF requests and private
  payments at the program address. Each round makes around 9 VRF requests, dozens of permission
  updates and hundreds of rollup transactions, all from real gameplay.
- **Honest README.** Every claim maps to a file and a devnet transaction.
- **A fallback that still ships.** If order transactions can't be hidden (spec §4, item 1), the
  v0.2 design (Leaks cut from a VRF-written price path) uses the same accounts and UI, so the
  project still ships.

## Demo video plan (about 75 s, plus a 20 s cut for X)

1. Cold open: a pending order card, glowing. _"This order executes in 10 seconds. Someone just
   paid to see it."_
2. Title: INSIDER. "Front-running is the game."
3. A real round: send an order; a Spotlight drops and is bought and opened; a priority send;
   the sandwich lands on the chart.
4. Split screen: the Leak owner's screen shows the order, a second browser shows nothing
   (TEE-gated).
5. Revenge: a Flow Leak, a priority buy, profit.
6. X-ray with sandwich arrows.
7. "What's onchain": VRF, permission rewrite, rollup orders, each with an explorer link. End
   card.

## Non-goals (for this hackathon)

- Mainnet, real money or a token launch
- Real-world price feeds (the market is a vAMM by design, because players are the price)
- Multiple tables or assets; native mobile apps
- LLM chat agents (bots are deterministic)

## Success criteria

- A table runs continuously on devnet with bots: orders, maturity, Leak drops, auctions, opens,
  flips, front-runs, X-ray.
- A second key provably can't read pending orders or a Leak it doesn't own, including through
  transaction lookups.
- A cold visitor plays a round with no wallet and no setup.
- VRF, permission and rollup transactions are linked from the README.

## Risks and how we handle them

| Risk                                                                     | Mitigation                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Order instruction data is visible through transaction lookups on the TEE | Checked first (spec §4, item 1). If it leaks: fall back to v0.2, where Leaks come from a VRF path |
| A private permission with zero members misbehaves                        | The only member is a keyless `nobody` PDA                                                         |
| Browser keys can't pay rollup fees                                       | ER transactions are free; otherwise a faucet route sends dust                                     |
| Cranks can't make VRF requests                                           | The keeper calls the permissionless, time-gated `request_drop`                                    |
| Too few humans, so the mempool is thin                                   | Five bots plus VRF whale flow keep the mempool full every round                                   |
| Solo scope with about 4.5 days left                                      | P0/P1/P2 cut order (spec §15); the core is just orders, delay, Leak and open                      |

## Branding notes

- Look: a dark terminal; the pending-order "ghost" cards are translucent and float toward the
  chart until they land. Leaks use a wax-seal motif. Rarity colours are grey, cyan and magenta.
- Motion: ghost orders drift in, cards crack open, sandwich arrows in the X-ray.
- Tone: sly, tense, dry. Name in caps: INSIDER.

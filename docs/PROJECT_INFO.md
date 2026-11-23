# INSIDER: Project Information

**Own the secret. Front-running is the game.**

Team: **Anurag Dubey** (chain, SDK, bots, infrastructure) and **Misbah Ansari** (app, design, AI
Desk, share cards). Built for **Solana Blitz v10** (MagicBlock, theme: _Entertainment Finance_).

This document merges two designs we each wrote independently: the **Leak Exchange** (a market in
read access to a hidden future, with licensing, oracle-settled Calls and AI analysts) and the
**Dark Mempool** (every order waits in the dark and you buy a look at other players' pending
orders). Each fixed the other's weak points, and the combination is the product.

---

## 1. The idea in one minute

On a real chain, whoever sees the mempool first wins. In INSIDER, that is the game.

- Every order you send waits **10 seconds in a dark mempool** inside MagicBlock's Private
  Ephemeral Rollup (or 2 seconds, for a fee). Nobody can see its side or size: not the other
  players, not the server, not us.
- Behind the market there is also a **hidden future**: VRF writes a fundamental price path that no
  wallet can read, and the market is steadily pulled toward it.
- Every ten seconds the program mints a sealed **Leak**: either a snapshot of the dark mempool
  (**Flow**) or a provably true fact about the hidden future (**Fundamentals**). A Leak is sold by
  Dutch auction, and buying it makes you its only reader: the TEE adds your key to its permission
  list.
- Then it becomes a market in information. **Open** it and trade on it. **Flip** it sealed to
  someone who'll pay more. **License** read access to up to three others, knowing every extra
  reader erodes your edge. **Front-run** the orders you just read.
- On **The Desk**, players lock private **Calls** on the _real_ SOL/USD price. Anyone can license
  a Call, a crank settles it against the MagicBlock oracle, and every seat builds a public,
  verifiable track record. Two of the analysts are AI agents.
- At round end the **X-ray** replays everything: every order, every Leak and who held it, and
  every sandwich drawn as an arrow on the chart.

On Solana you can own a token. In INSIDER you can own a **secret**, and the TEE enforces that only
you can read it.

## 2. Why the merge is stronger than either design

| Question                                        | Leak Exchange alone                           | Dark Mempool alone                                                           | **Combined**                                                                            |
| ----------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Where does the secret come from?                | A random number (mechanical once you hold it) | Other players' orders (but thin when few play, and unproven to stay private) | **Both: flow made by players, fundamentals made by VRF**                                |
| Is there a hook people get at once?             | "Own the secret"                              | "Front-running is the game"                                                  | **Both, on one screen**                                                                 |
| Does it need many humans?                       | No                                            | Yes, to keep the mempool full                                                | **No: bots, whales and the hidden future always give you something to buy**             |
| What if the dark mempool can't be kept private? | n/a                                           | The game collapses to a weaker v0.2                                          | **The Fundamentals market is already a complete product; only the Flow family is cut**  |
| Balance                                         | Needed a simulation gate                      | No gate                                                                      | **A deterministic economics gate (E1) covers the combined engine**                      |
| Automation                                      | No keeper needed                              | Keeper fallback for drops and phases                                         | **Cranks and seat-signed requests only; no keeper in the game loop**                    |
| Bluffing and reflexivity                        | None                                          | Strong                                                                       | **Kept: bait orders, priority tells, copy-trading**                                     |
| Real markets and track records                  | The Desk                                      | None                                                                         | **The Desk, with AI analysts**                                                          |
| Money and activity MagicBlock counts            | Private payouts                               | Optional stake mode                                                          | **Alpha Cup with Private Payments; a VRF request every round; delegations every epoch** |
| Depth of MagicBlock use                         | 9 features                                    | 4 features                                                                   | **9 features, each load-bearing**                                                       |

## 3. How a round feels

1. **Sit down.** One click gets you a seat. Guests get a browser key and chips; wallet users get a
   session key with no popups.
2. **The future is written.** A VRF request seeds the round inside the TEE: the hidden
   fundamental path, 3-5 hidden whale orders, and the whole Leak drop schedule.
3. **Send orders into the dark.** Buy or sell. Everyone sees that _Seat 3 sent an order_ and which
   lane it used, never the side or size. The standard lane lands 20 ticks (10 s) later; the
   priority lane lands in 4 ticks (2 s) and costs 3 chips. Using priority is a tell.
4. **Leaks drop** every 10 s with a public label and rarity and sealed contents.
5. **Dutch auction.** The price falls every 500 ms until someone takes it.
6. **Open, flip or license.** Each is an access-control edit enforced by the TEE.
7. **Front-run, bait, fade.** Saw a big buy landing in 7 s? Send a priority buy, let theirs push
   the price, and sell into it. Or send a fat decoy and fade the bots that bite.
8. **X-ray.** Every order, Leak and sandwich is replayed on the chart. Your score is final equity
   minus 1,000 chips, after fees, Leak spend and information income.

## 4. The two kinds of secret

| Family                           | Source                                           | Leaks                                 | What it tells you                              |
| -------------------------------- | ------------------------------------------------ | ------------------------------------- | ---------------------------------------------- |
| **Flow** (Dark Mempool)          | Players' and whales' real pending orders         | **Flow, Spotlight, Whale, Full Book** | What other people are about to do to the price |
| **Fundamentals** (Hidden Future) | The VRF-written path the market is pulled toward | **Pin, Drift, Shockwave, Summit**     | Where the price is _really_ heading            |

They interact, which is what makes it a market and not a hint shop. Flow pushes the quote away
from fundamentals, and arbitrage pulls it back at a known rate. Knowing flow lets you front-run the
push; knowing fundamentals tells you how long a push will last.

| Rarity | Weight | Kinds                       | Start / floor price |
| ------ | ------ | --------------------------- | ------------------- |
| Common | 65%    | Flow, Pin, Drift            | 8 / 1 chips         |
| Rare   | 30%    | Spotlight, Whale, Shockwave | 20 / 2              |
| Epic   | 5%     | Full Book, Summit           | 60 / 6              |

(Starting values; the economics gate tunes them.)

## 5. The information economy

- **Information is non-rival, so it decays.** Each reader's trades push the quote, so the more
  readers, the smaller the edge left. Sellers choose between keeping a Leak exclusive and licensing
  it to up to three others.
- **Sealed is a promise.** A Leak that was never opened has never had a reader, which is provable
  from the permission history.
- **Perishable.** Every Leak expires. Holding costs you its value.
- **Truth by construction.** The program computes each Leak from the hidden state, so a Leak can't
  lie. Orders can't be cancelled, so a Flow Leak stays true. Deception means placing real orders
  that really fill.
- **The house can't cheat.** No instruction lets the authority read or write the mempool, the
  future, a Leak, a Call or a score.
- **Balanced on purpose.** Leverage, depth, fees, arbitrage speed and Leak prices are set by a
  simulation gate before any UI polish. If buying every Leak is a free-money button, we don't ship.

## 6. Modes and tiers

| Tier                    | What                                                                                                                                                         | Why it exists                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **P0 The Floor**        | Dark mempool, two lanes, vAMM, hidden future, Leak drops (Flow and Fundamentals), Dutch auction, open, X-ray with sandwiches, bots, trading-floor UI, deploy | The core product and the demo             |
| **P1 Exchange depth**   | Flip, licensing and decay; The Desk (oracle-settled Calls and track records); Alpha Cup (Private Payments); AI analysts and commentary; all five bots        | What makes it far deeper than a hint shop |
| **P2 Reach and polish** | Session keys and wallet identity, Magic Actions plus SOAR achievements, share cards, broadcast view, proof page, mobile                                      | Virality, retention, verifiability        |

Everything is in scope and has an owner. Tiers set build order and what is cut last.

## 7. Why it can't exist without MagicBlock

| If we remove...              | What breaks                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Private Ephemeral Rollup** | Pending orders can't be hidden, and nothing can make an account readable by exactly one wallet        |
| **Ephemeral Rollup**         | Half-second ticks, a falling Dutch price and zero-fee orders aren't practical on the base layer       |
| **VRF**                      | The hidden future, whale orders and drop schedule would be rigged or guessable                        |
| **Cranks**                   | No ticks, order maturity, expiries or Call settlement without a server we'd have to be trusted to run |
| **Pricing Oracle**           | The Desk has nothing real to settle against                                                           |
| **Private Payments**         | The Alpha Cup would have public balances and no private prizes                                        |
| **Magic Actions / SOAR**     | No automatic post-commit leaderboard and achievements                                                 |
| **Session keys**             | Wallet users would sign every action                                                                  |

## 8. How we score with the judges

- **Creativity:** MEV turned into a fair game; privacy used as _ownership of knowledge_ instead of
  hidden state; an information exchange with licensing, decay and AI analysts.
- **Technical depth:** nine MagicBlock features used for real, a VRF callback that rewrites a
  permission atomically, order data that stays private, oracle-settled private Calls, and an
  economics gate. Every claim has a devnet transaction.
- **How compellingly it shows what's possible:** the two-browser moment (one opens a Leak and
  sees the order, the other sees nothing), the sandwich X-ray, and a table that is always live.
- **Built for AI-assisted screening:** the README maps every feature to code and explorer links;
  nothing is mocked. MagicBlock counts delegations, VRF requests and private payments from our
  program, and the table produces real ones continuously: a VRF request every round, epoch
  re-delegations, and private cup payouts.

Recent Blitz winners used privacy to hide state (fog-of-war games, a private order book, hidden
answers). INSIDER uses it for _ownership_ and for a concept every Solana user already knows.

## 9. Demo and video

About 80 s, recorded from the real app, plus a 20 s X clip.

1. A pending order card, glowing: "This order executes in 10 seconds. Someone just paid to see it."
2. Title: INSIDER. "Own the secret."
3. A Leak drops, the price falls, one click buys it. The same second, a second browser shows
   _nothing_ for that account (the two-browser test).
4. Crack it open: an 800-unit buy landing in 7 s. Priority-send ahead, the price moves, sell into
   it. Sandwich arrow on the chart.
5. The edge shrinks: a flip, a license, a bot copying the trade.
6. X-ray: every order, Leak and sandwich revealed.
7. The Desk: an AI analyst's Call resolves against the live oracle.
8. The proof page: VRF request, permission rewrite, delegation, private payout. End card with the
   link.

## 10. Non-goals

- Mainnet launch, real money or a token launch (devnet test funds only)
- A second game genre, multiple assets on the Floor, or native mobile apps
- A chat-based social deduction layer (we dropped it)

## 11. Risks, gates and what the plan does about them

| Risk                                                                    | Handling                                                                                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pending orders might be readable through transaction lookups on the TEE | **Gate G0 (darkcheck), first thing.** If it fails, the Flow family and lanes are removed and the Fundamentals market ships as the full product. This is a scope rule, not a workaround |
| Unverified MagicBlock features                                          | Numbered gates G0-G10, each with a pass condition. A feature that fails is cut from code and docs                                                                                      |
| Game balance                                                            | A deterministic economics simulator and acceptance gate (E1) before UI polish                                                                                                          |
| Thin mempool with few humans                                            | Five bots, hidden whale orders and the Fundamentals family keep every round worth playing                                                                                              |
| Two people, large scope                                                 | Hard split by directory and a typed SDK contract; feature freeze before the submission window                                                                                          |
| "Is it fun?"                                                            | 110 s rounds, bots that play the meta, playtests at each sync point                                                                                                                    |
| Public RPC limits                                                       | A dedicated devnet RPC for demos                                                                                                                                                       |
| TEE trust                                                               | Stated plainly in the README (Intel TDX, MagicBlock's trust, not ours)                                                                                                                 |

## 12. Branding

- Look: a dark terminal. Pending-order "ghost" cards float toward the chart until they land. Cold
  blue for sealed things, hot amber for opened things, a wax-seal motif for Leaks, rarity colours
  grey, cyan and magenta. Big mono numerals.
- Motion: ghosts drift in, Leaks crack open, sandwich arrows in the X-ray.
- Tone: sly, tense, dry. Name in caps: INSIDER.
- Taglines: **Own the secret.** / **Front-running is the game.** / _Every order waits 10 seconds in
  the dark. Buy a look._

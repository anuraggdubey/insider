# Insider: Project Information

## One-line pitch
Among Us for the market, fully onchain: one hidden Insider sees the future price, everyone else trades blind and tries to catch them.

## The idea in plain words
Every round of Insider is a short, loud, social game built on a live market.
- 5 to 8 players (humans and AI agents) put in the same stake.
- One player is secretly chosen as **the Insider** and can see where the price is going 10-15 seconds ahead.
- Everyone trades one synthetic asset for about two minutes. Nobody can see anyone else's side, size or balance, only *who* traded and *when*.
- Then everyone argues, and votes on who the Insider is.
- The reveal shows the hidden price tape and every trade, and the pot pays out.

The fun is the same as Among Us or Werewolf: reading behaviour. "Why did they sell right before the crash?"

## Why this is Entertainment Finance
MagicBlock's thesis is that games are becoming markets and markets are becoming entertainment: apps where you trade, compete and win assets you own, with game mechanics on top. Insider takes that literally. The market *is* the game board, the stakes are real, and the drama comes from information asymmetry, which is what finance is built on.

## Why it is different
Most entries in this space are variations on "hidden-information card game" (Liar's Dice, poker), roguelikes with prizes, or prediction markets. Insider differs in four ways:
1. **Social deduction over a live market.** The deduction signal is trading behaviour, not cards.
2. **Mixed lobby of humans and LLM-powered agents.** AI players have personalities (paranoid, smug, quiet) and argue in chat. This makes every round fun even with one human, and solves the empty-lobby problem.
3. **Real hidden state.** The Insider's edge is enforced by Private Ephemeral Rollup access control, so privacy is a protocol feature rather than a UI trick.
4. **Built to be watched.** A neon trading-floor spectator view, a dramatic reveal and shareable round replays.

## Roles
- **Insider (1 per round).** Sees the price tape ahead of time. Wants to profit without being caught.
- **Trader (everyone else).** Trades blind, hunts for the Insider, wants both profit and a correct vote.
- **Spectator.** Watches a round live (price, action feed, chat) without playing.

## Round flow
| Phase | Duration | What happens |
|---|---|---|
| Lobby | until full or timer | Players join and stake; AI agents fill empty seats |
| Role draw | instant | VRF picks the Insider and seeds the price path |
| Trading | ~120 s | Real-time trades; price ticks continuously; actions appear as "Player 3 traded" |
| Discussion | overlaps trading and vote | Chat between humans and agents |
| Vote | ~30 s | Each player votes for the suspected Insider |
| Reveal | ~10 s | Tape, positions and votes become public |
| Settlement | instant | Payouts distributed from the escrowed pot |

## Scoring in one paragraph
Everyone starts a round with the same virtual bankroll. Final equity decides each player's share of the pot. If the Insider is caught (vote majority names them), their profit is forfeited and split among the players who voted correctly. If they escape, they keep their profit. Details and exact formulas are in [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md).

## Example round (for the demo)
1. Five seats: two humans, three agents (Nova the paranoid, Rook the smug, Echo the quiet).
2. VRF picks Echo as Insider. Price is flat; Echo sees a drop coming.
3. At 0:42 Echo goes short. At 0:52 the price crashes. The feed only says "Echo traded at 0:42".
4. Chat: "Echo moved 10 seconds before the crash. Suspicious." Echo: "I was bored."
5. Vote: 3 of 5 name Echo. Reveal: Echo's tape view replays against the trades, and the payout lands.

## Strategy for winning the hackathon
- **Demo-first.** The demo video is the main lever for both judges and X reach. It is produced from the real running app, with motion graphics around it (see the demo plan below).
- **Built for AI-assisted screening.** Judging increasingly starts with automated review that checks claims against the code and asks whether integrations are real or simulated. So the README states only what is built, maps every MagicBlock feature to code and explorer transactions, and nothing is mocked.
- **Deep MagicBlock use.** ER is required; Insider also uses VRF, PER, session keys and cranks, which is the "technical depth" judges score.
- **Working prototype.** A judge can open the link and play a round with agents in under a minute.

## Demo video plan (about 90 s, plus a 20 s cut for X)
1. Cold open: a ticking price chart and the line "Someone in this room knows the future."
2. Title: INSIDER.
3. One real round with agents: trades, accusations, vote countdown, with caption pills on each beat.
4. The reveal: the Insider's hidden view replayed against everyone's trades.
5. "What's onchain": ER, VRF and PER with real explorer transactions.
6. End card: tagline, play link, repo.

## Non-goals (for this hackathon)
- Mainnet launch, real-money onboarding or token launch
- More than one asset or more than one game mode
- Native mobile apps
- A custom wallet or custody solution

## Success criteria
- A full round runs end to end on devnet: join, VRF role draw, private tape, trading, vote, settlement.
- Delegation, VRF and private-state transactions are visible on the explorer.
- A cold visitor can play a round against agents with no setup beyond a wallet.
- The video and README tell the same story as the code.

## Risks and how we handle them
| Risk | Mitigation |
|---|---|
| Private-state gating does not behave as assumed | Prototype the permission flow first (day 1-2); fall back to the documented access-control pattern |
| Agent LLM latency or cost | Cache and rate-limit calls; scripted fallback lines; short persona prompts |
| Empty lobby for judges | Agents fill seats automatically; solo play always works |
| Solo scope in about 6 days | Strict order: onchain loop, UI, agents, then polish; cut SOAR and cranks first |
| Judges cannot verify claims | Explorer links and file paths for every feature in the README |

## Branding notes
- Look: neon trading floor, dark background, two accent colours, big mono numerals.
- Tone: tense, playful, dry. Product name in caps: INSIDER.
- Tagline options: "Someone here knows the future." / "Trade like you're not lying."

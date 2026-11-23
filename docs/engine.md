# Market engine and E1

For client configuration, instructions and account decoding, see the [SDK guide](api.md).

## Parameters and math

Prices use `PRICE_ONE = 1_000_000`; one tick is 0.5 seconds. The floor starts
with 50,000 base and 50,000 quote units. E1 uses 400 bps arbitrage pull,
10 bps trading fees, and a 3-chip priority fee. Standard and priority orders
land after 20 and 4 ticks respectively. The table must be initialized with
`priority_fee = 3`: `Params::default()` still returns 10 until Anurag changes it.

- **vAMM:** `k = base * quote`, `price = floor(quote * PRICE_ONE / base)`.
  A signed order changes base by `-size`, sets `quote' = ceil(k / base')`,
  and pays `ceil(abs(quote' - quote) * fee_bps / 10_000)`.
- **Arbitrage:** each tick pulls the spot toward the fundamental by
  `p' = p + (fundamental - p) * min(arb_bps, 10_000) / 10_000`, with integer
  truncation. It proposes `base' = isqrt(k * PRICE_ONE / p')` and
  `quote' = floor(k / base')`; the change is applied only if the resulting
  price stays between the old spot and the fundamental.
- **Dutch auction:** for `e = clamp(t - auction_start, 0, DUTCH_TICKS - 1)`,
  `price = start - floor((start - floor) * e / (DUTCH_TICKS - 1))`.
  `DUTCH_TICKS = 12`: the floor is reachable at start + 11 and the auction is
  over at start + 12. Common starts/floors at 8/1 chips, Rare 20/2, Epic 60/6.
- **Fundamental path:** starts at `PRICE_ONE`, uses two randomly ordered
  volatility regimes of ±10 and ±35 bps per tick with a switch at tick
  40–140, and adds 2–4 non-overlapping signed shocks of 800–1,500 bps
  (8–15%) over 3–6 ticks, beginning at ticks 21–165. Each step applies
  `p[t] = clamp(p[t-1] + p[t-1] * bps / 10_000, 0.5, 2.0)` at the price
  scale, with integer truncation.

## Leaks

Eight drops are scheduled every 20 ticks starting at tick 10. Rarity weights
are 65/30/5; Flow and Fundamentals families are equally likely. Windows are
clamped to tick 179.

- **Flow:** net signed size and count of pending orders landing in a ten-tick
  window starting 2–12 ticks ahead.
- **Spotlight:** largest pending non-whale order by absolute size.
- **Whale:** earliest pending whale order landing within the next 60 ticks.
- **FullBook:** up to 32 pending orders, ordered by landing tick and sequence.
- **Pin:** fundamental price at a target 10–30 ticks ahead.
- **Drift:** direction, basis-point change and magnitude bucket for a target
  20–40 ticks ahead; buckets are `<1%`, `1–3%`, and `>3%`.
- **Shockwave:** whether a shock exists in the next 40 ticks, and its tick and
  direction if present.
- **Summit:** high and low fundamental prices and their ticks in the next
  60 ticks.

At most four Leaks are live in six slots. A slot is reusable if empty, or if
expired, unread and `tick > window_end`. Before reusing an expired slot, the
engine archives its header and vault payload into Xray, deduplicated by leak
ID. Finalization adds the remaining leaks without duplicating archived ones;
future-window information is not published on slot reuse.

## E1 policies

E1 drives the in-memory engine with deterministic seeds and rotates the order
in which seats act. Agents act at tick `t`, then the engine steps tick `t + 1`.
Errors are skipped. Trades use at most one active Leak-driven position; all
agents skip an entry if its planned exit must be sent at tick 160 or later.

- **Blind:** every six Live ticks, follow the sign of the six-tick spot
  momentum with 300 standard units. At `|position| >= 1,500`, instead send
  750 units against the position.
- **Front-runner:** buys Flow-family auctions at at most 60% of start, or
  listings at at most 80%, then opens. For Spotlight, Whale and FullBook,
  choose the largest non-own pending order of at least 1,000 units landing
  at least six ticks ahead. Flow requires `|net| >= 1,500` and window start
  at least six ticks ahead. Enter in the indicated direction with priority
  size `min(2,000, floor_to_50(0.8 * |size|))`; send the priority exit at
  target minus three, landing one tick after the target.
- **Fundamentalist:** buys Fundamentals-family Leaks using the same auction
  and listing thresholds. Priority entries are 800 units. Pin requires at
  least a 2% target-to-spot move and exits at the target. Drift requires
  bucket 2 and exits at its `to` tick. Shockwave enters in the shock
  direction when a shock is present and exits at `shock_tick + 30`. Summit
  chooses the high or low farthest from spot, breaking equal distances by
  earlier tick; it requires at least 3% distance and exits at the extreme's
  tick + 15. Summit is skipped if that landing would be outside Live.
  Priority exits are sent four ticks before the intended landing. For Pin,
  Drift and Summit, entries are skipped if the exit send tick is at most
  four ticks after entry; Shockwave is skipped if its send tick is already
  past.
- **Hoarder:** bids any auction at its last accepted tick, opens it, and uses
  the legacy payload rules below.
- **Flipper:** buys any auction at at most 50% of start and lists at 1.4
  times paid, rounded to the nearest chip. After six ticks without a sale it
  delists, opens and uses the legacy payload rules.
- **Legacy Hoarder/Flipper rules:** Flow requires `|net| >= 400` and a window
  start more than four ticks ahead; order payloads require a non-own order of
  at least 400 units landing six ticks ahead. Enter in its direction at half
  size, capped at 1,000; send the exit three ticks before the target. Pin
  requires a move greater than 1% and exits at target minus three; Drift
  requires bucket at least 1 and exits at `to - 4`; Shockwave exits at
  `shock_tick + 3`; Summit chooses the first extreme and exits at its tick
  minus three. Fundamentals entries are 800 units and use the same
  four-tick exit-send deadline.
- **Crowd:** C1 uses the Front-runner rule and offers licenses at half its
  purchase price. C2 and C3 buy those licenses and use the same trade rule.
- **Flow bot:** seat 8 sends a standard order every three Live ticks. It follows
  six-tick spot momentum with 60% probability and otherwise opposes it, using
  a seeded direction at zero momentum; size is uniform from 400 to 1,200 in
  steps of 50. At `|position| >= 3,000` it instead sends 1,000 against the
  position. It is reported but excluded from the score-cap and liquidation
  assertions.

## E1 results

Scores are chips minus the 1,000-chip bankroll after tick-180 close-out.
Each seed is run with crowd sizes 1, 2 and 3; the score table uses the
three-reader run. Standard errors are across seeds.

### 1,000 seeds

| Agent          |     Mean | Standard error |   Max |
| -------------- | -------: | -------------: | ----: |
| Blind          | -201.343 |          8.501 |   789 |
| Front-runner   |   15.261 |          4.248 | 1,654 |
| Fundamentalist |    3.501 |          3.195 |   434 |
| Hoarder        |    0.000 |          0.000 |     0 |
| Flipper        |    1.555 |          0.214 |   193 |
| Crowd C1       |   21.664 |          3.455 |   735 |
| Crowd C2       |  -17.733 |          3.052 |   423 |
| Crowd C3       |  -50.287 |          4.722 |   204 |
| Flow bot       | -487.776 |         13.556 |   984 |

Clearing ratio 0.5361; liquidation rate 0.2000%; crowd per-reader edges
11.5879, -0.5601 and -12.6007. All six assertions pass.

### 5,000 seeds

| Agent          |     Mean | Standard error |   Max |
| -------------- | -------: | -------------: | ----: |
| Blind          | -197.136 |          3.737 | 1,119 |
| Front-runner   |   10.166 |          1.798 | 1,654 |
| Fundamentalist |    5.333 |          1.412 |   543 |
| Hoarder        |    0.000 |          0.000 |     0 |
| Flipper        |    1.517 |          0.084 |   229 |
| Crowd C1       |   21.645 |          1.541 | 1,024 |
| Crowd C2       |  -16.168 |          1.395 |   544 |
| Crowd C3       |  -50.835 |          2.167 |   672 |
| Flow bot       | -456.613 |          6.081 | 1,615 |

Clearing ratio 0.5355; liquidation rate 0.2250%; crowd per-reader edges
11.4577, -0.4802 and -12.2946. All six assertions pass.

From `programs`, run `cargo test -p insider --test economics -- --nocapture`
for the cached 1,000-seed gate, and
`cargo test -p insider --test economics -- --ignored e1_tuning_5000_rounds --nocapture`
for the 5,000-seed confirmation. The latter asserts all six gates.

## Tuning history

Earlier runs failed because Leak spend and priority fees dwarfed trading
edges; without background flow, many Flow-family payloads contained no
tradeable orders. Fundamentalist performance required exits timed to
informative ticks and, for shocks, time for arbitrage convergence. In these
runs the Hoarder never reaches the floor: other buyers clear auctions first,
so it makes no bids. Assertion 2 holds because assertion 6 gives both
selective buyers positive mean scores while Hoarder's mean is zero.

# SDK guide

The workspace package is private and exports TypeScript source, not a published npm package.
From this repo run `pnpm install`; add `"@insider/sdk": "workspace:*"` to a workspace
package's dependencies. Use `@insider/sdk` in browser or Node code and
`@insider/sdk/node` for Node-only filesystem, `.env` and keypair helpers. Do not bundle
the Node entry in a browser. Sources: [`sdk/package.json`](../sdk/package.json),
[`sdk/src/index.ts`](../sdk/src/index.ts), [`sdk/src/node.ts`](../sdk/src/node.ts).

## Configure and connect

`createConfig(partial?)` takes `baseRpcUrl`, `routerUrl`, `routerWsUrl`, `teeRpcUrl`,
`programId`, `teeValidator`, and `tableAuthority` (the latter three are `PublicKey`s).
It supplies devnet defaults except for `tableAuthority`, which must be set before
PDA-based builders or table fetches. `createConfig` does **not** read environment
variables. Node's `config` export loads the repository `.env` and reads
`SOLANA_RPC_URL`, `MAGIC_ROUTER_URL`, `MAGIC_ROUTER_WS_URL`, `TEE_RPC_URL`,
`INSIDER_PROGRAM_ID`, `TEE_VALIDATOR`, `ER_VALIDATOR`, and `ANCHOR_WALLET`;
set `tableAuthority` separately (the example below reads `TABLE_AUTHORITY`).
The web app explicitly maps
`NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_MAGIC_ROUTER_URL`,
`NEXT_PUBLIC_MAGIC_ROUTER_WS_URL`, `NEXT_PUBLIC_TEE_RPC_URL`,
`NEXT_PUBLIC_INSIDER_PROGRAM_ID`, and `NEXT_PUBLIC_TABLE_AUTHORITY` in
[`providers.tsx`](../app/src/app/providers.tsx).

`baseConnection(config)` is a confirmed base-layer connection for setup and committed
accounts. `await teeConnection(config)` connects anonymously to the TEE. Pass a
`Keypair` or `{ publicKey, signMessage }` to `teeConnection(config, signer)` for a
signed auth token: [`teeAuthUrl`](../sdk/src/tee.ts) caches it until expiry and adds
it to HTTP and WebSocket URLs. Recreate the connection after expiry; don't log tokens.
An authorized connection is required for private vault reads. G3 demonstrated a
zero-SOL guest as its own fee payer **on the TEE**, not on base Solana
([gate evidence](gates.md#g3-zero-balance-key-pass)). The gameplay integration is
not yet deployed; this is not a guarantee that arbitrary base-layer transactions
are free. See [`connection.ts`](../sdk/src/connection.ts).
Account initialization and the tick-to-engine integration are still open;
see the current status in [`STEPS.md`](STEPS.md).

## Addresses and data

`tableAccounts(authority, programId?)` returns `table`, `tape`, `callBook`, `season`,
`seats[0..9]`, `floor`, `desk`, `mempool`, `future`, `board`, `leakVaults[0..5]`,
`xray`, and `nobody`. Individual `tablePda`, `seatPda`, `marketPda`,
`leakVaultPda`, etc. are also exported; indices are bytes, and builders additionally
check seat/slot ranges. Specify the configured `programId` when not using the
default. See [`pdas.ts`](../sdk/src/pdas.ts).

`decodeAccount("table" | "seat" | "tape" | "market" | "mempool" | "board" |
"leakVault" | "xray" | "season" | "callBook", buffer)` and corresponding
`decodeTable`, `decodeSeat`, etc. use the generated IDL; `decodeFuture` handles
the private Future layout separately. Anchor 64-bit values are `BN`s; convert
deliberately rather than assuming JavaScript numbers are safe. `fetchTable(connection,
config)` returns a `TableSnapshot` or `null` if a required account is missing.
It fetches public table, floor, board, tape and ten seats; desk, X-ray, season
and call book may be `null`. It does not fetch private accounts.
`subscribeTable(connection, config, onChange, onError?)`
registers account-change listeners and coalesces refreshes to at most one per
500 ms; fetch the initial snapshot separately and call the returned unsubscribe
function. Its optional fourth argument receives refresh errors.
See [`accounts.ts`](../sdk/src/accounts.ts).

`deriveTable(snapshot, { me?, pending?, nowSlot? })` returns:

- `phase`, `tick`, `ticksLeftInPhase`, `secondsLeft`, `round`, `price`, and
  `priceSeries` (`{ tick, value }[]`).
- `seats`: index, display `name`, `kind`, `owner`, `isFree`, `isMe`, position,
  chips, equity, pnl, liquidation state, last seen tick and last public send;
  `mine` is the matching seat or `undefined`.
- `leaks`: headers plus slot, kind/rarity/state names, family, current price,
  ticks remaining, ownership/reader flags and `canBid`, `canOpen`, `canList`,
  `canBuy`, `canLicense` hints. Recheck state when submitting: another actor
  may act first.
- `feed` (newest public sends/fills), `myPending` from the caller's local
  `pending` list, and `whaleSeat`, `noSeat`, `priorityLane` constants.

`nowSlot` refines the phase countdown; `pending` is not recovered from the private
mempool. Price values are scaled by `PRICE_ONE = 1_000_000`. Equity and P&L in
this UI view are JavaScript numbers. See [`table.ts`](../sdk/src/table.ts).
X-ray orders distinguish `scheduledTick` from actual `landTick`: congestion can
carry a fill beyond its original scheduled tick.

## Instructions

All builders below return a `TransactionInstruction`; they do not send or sign.
`tx(...instructions)` wraps them. `sendTx(connection, tx, [keypair], { feePayer? })`
signs and confirms; `sendWithWallet` accepts a wallet transaction signer.
Seat actions require the acting owner's signature; `claimSeat` is signed by the
claimant, who need not own the seat yet. Seat indices are 0–9 and slots 0–5.
Leak actions require Live or Closing and matching board round. On-chain checks
remain authoritative. Sources: [`instructions.ts`](../sdk/src/instructions.ts),
[`send.ts`](../sdk/src/send.ts), [`orders.rs`](../programs/insider/src/instructions/orders.rs),
[`leaks.rs`](../programs/insider/src/engine/leaks.rs).

At 0.5 seconds per tick, Live is ticks 0–159, Closing 160–179 and X-ray 180–199;
the table then returns to Idle.

### Session keys (popup-free play)

`ping`, `sendOrder`, `bid`, `openLeak`, `listLeak`, `buyListed`, `offerLicense`, `buyLicense`,
`mintCall`, `buyCallLicense` and `deskTrade` accept a Gum session key in place of the wallet. Each
builder takes an optional last argument `session` (the session token address). Pass the session key's
public key as `owner`, sign with the session key, and the program acts for the wallet that owns the
seat: orders, chips, Leak ownership and the private reader permissions all stay with the wallet.

1. Make a throwaway keypair. It never needs SOL: on the TEE it pays its own (zero) fees, verified live.
2. On the **base layer**, the wallet and the session key both sign Gum's `createSessionV2`
   (`@magicblock-labs/gum-sdk`, `SessionTokenManager`; `targetProgram` is the game program, `authority`
   the wallet, `validUntil` at most a week ahead). Any account can pay the small rent as `feePayer`.
3. The token address is `sessionTokenPda(wallet, sessionKey)`. Pass it as `session` to the builders.
4. `revokeSessionV2` on the base layer (wallet signs while the session is live) ends it; after expiry
   or revoke the program refuses the key (`InvalidToken`, or `AccountNotInitialized` once closed).

Without `session` the builders pass the program id for the optional account, so the wallet signs
directly exactly as before. A session key cannot `claimSeat` or join the Alpha Cup (those need the
wallet). Errors: `NotSeatOwner` (no token and the signer is not the owner), `InvalidToken` (wrong
key, wrong wallet, expired). Live proof: `pnpm session-demo`, `docs/proofs/session.json`.

- `claimSeat(config, owner, index)`: no phase restriction; free seat, same owner, or idle bot seat;
  an occupied bot is idle after 60 ticks; occupied AI/human seats are protected.
  New owners receive a fresh bankroll.
- `ping(config, owner, index)`: no phase restriction; update the owned seat's last-seen tick.
- `sendOrder(config, owner, index, sideSize, lane)`: Live only; signed nonzero
  `i16` size (positive buy, negative sell), `LANE_STANDARD = 0` or
  `LANE_PRIORITY = 1`. Enforces configured max order, position including pending
  orders, pending count and mempool capacity; a liquidated seat cannot send.
  Default limits are 2,000 per order, 5,000 position, 4 pending; the mempool
  holds 48 orders and processes up to 12 fills per tick. Congestion can delay a
  fill beyond its target. Priority fee and delay come from `table.params`. E1
  uses 3 chips but `Params::default()` currently uses 10, so initialize
  explicitly and read the live table.
- `bid(config, owner, index, slot)`: buy an active auction at its current Dutch
  price. The last accepted tick is `auctionStart + 11`, then it is over.
  A seat can hold at most two unopened Leaks and needs enough chips.
- `openLeak(config, owner, index, slot)`: open your **Owned** (not Listed)
  Leak through its window end; adds your key to the private reader permission.
- `listLeak(config, owner, index, slot, ask)`: list an Owned sealed Leak at a
  positive `u32` ask, or delist a Listed Leak with `ask = 0`.
- `buyListed(config, owner, index, slot, sellerIndex)`: buy a different seat's
  Listed, unexpired Leak for its ask; `sellerIndex` must match its owner and the
  unopened limit and chip balance apply.
- `offerLicense(config, owner, index, slot, ask)`: owner sets a `u32` license
  ask on an Opened Leak; zero disables buying.
- `buyLicense(config, owner, index, slot, ownerIndex)`: buy an unexpired,
  positive-price license from the matching owner; buyer must not already be a
  reader and there can be at most four readers including the owner. Updates TEE
  permission.
- `finishRound(config, payer)`: permissionless signer; X-ray or Idle, matching
  round, idempotent after finalization. Snapshots scores before resetting seats.
- `resealLeaks(config, payer, slotFrom, slotTo)`: after finalization, X-ray or
  Idle; reseals the half-open range `[slotFrom, slotTo)` with writable
  vault/permission pairs. All readers must be resealed before the next round.

Typical errors include `WrongPhase`, `NotSeatOwner`, `SeatTaken`, `InvalidSeat`,
`InvalidLeakSlot`, `InvalidLane`, `ZeroOrder`, `OrderTooLarge`, `PositionLimit`,
`TooManyPending`, `MempoolFull`, `Liquidated`, `AuctionOver`, `HoardLimit`,
`InsufficientChips`, `NotForSale`, `AlreadyOpened`, `NotLeakOwner`, `ReaderLimit`
and `Overflow`. Permission CPI and transaction errors can also occur. See
[`error.rs`](../programs/insider/src/error.rs) for the full list.

## Read an opened Leak

After confirmed `openLeak` or `buyLicense`, fetch `leakVaultPda(table, slot,
config.programId)` through `await teeConnection(config, reader)` and decode
with `decodeLeakVault(info.data)`. Check `roundId` and `leakId` against the
current header before using `kind`, `fields`, and the first `orderCount` entries
of `orders`: slots can be reused. Anonymous and non-reader access is intended
to be denied by TEE permission. X-ray publishes payloads after their information
window; treat payloads as private before then. See
[payload definitions and archival](engine.md#leaks).

For a local fill estimate use
`previewOrder({ base: BigInt(market.base.toString()), quote: BigInt(market.quote.toString()) }, sideSize, { feeBps: table.params.feeBps })`.
It returns `avgPrice`, `fee` (bigint), `priceAfter`, and signed `impactBps`;
reserves may move before the order lands. See [`vamm.ts`](../sdk/src/vamm.ts).

## Minimal bot loop

This intentionally simple example sends one standard order per round and buys at
most one available Leak per iteration. It needs a configured, initialized table;
real bots should add retries, strategy, logging and a shutdown handler.

<!-- prettier-ignore -->
```ts
import { PublicKey, Keypair } from "@solana/web3.js";
import { config as nodeConfig } from "@insider/sdk/node";
import { createConfig, teeConnection, tx, sendTx, claimSeat, fetchTable, deriveTable,
  sendOrder, bid, openLeak, tableAccounts, decodeLeakVault, sleep, LANE_STANDARD } from "@insider/sdk";
const config = createConfig({ ...nodeConfig, tableAuthority: new PublicKey(process.env.TABLE_AUTHORITY!) });
const bot = Keypair.generate(); // retain this key if you need to recover the seat
const connection = await teeConnection(config, bot);
const index = 7; let sentRound = -1; // choose a free or displaceable seat
await sendTx(connection, tx(claimSeat(config, bot.publicKey, index)), [bot]);
for (;;) {
  try {
    const snapshot = await fetchTable(connection, config);
    if (!snapshot) { await sleep(500); continue; }
    const view = deriveTable(snapshot, { me: bot.publicKey });
    if (view.phase === "live" && sentRound !== view.round) { await sendTx(connection, tx(sendOrder(config, bot.publicKey, index, 100, LANE_STANDARD)), [bot]); sentRound = view.round; }
    const leak = view.leaks.find((item) => item.canBid);
    if (leak) {
      await sendTx(connection, tx(bid(config, bot.publicKey, index, leak.slot)), [bot]);
      await sendTx(connection, tx(openLeak(config, bot.publicKey, index, leak.slot)), [bot]);
      const info = await connection.getAccountInfo(tableAccounts(config.tableAuthority!, config.programId).leakVaults[leak.slot]!);
      if (info) { const payload = decodeLeakVault(info.data); if (payload.roundId === view.round && payload.leakId === leak.leakId) { /* use payload.fields privately */ } }
    }
  } catch { console.error("Action failed; refresh state."); } // avoid logging token-bearing RPC errors
  await sleep(500);
}
```

The example's token-bearing connection must be recreated when its token expires.
Do not hard-code or commit secret keys.

## Captions feed (commentary)

`pnpm analysts` also serves short live captions built from public events only (drops, sales,
flips, opens, licences, Desk Calls, big fills, sandwiches, round start and end).

```
GET http://localhost:8788/captions?since=<id>
{ "paused": false, "captions": [ { "id": 14, "at": 1795472854118, "kind": "leak-opened", "text": "Clever Badger cracked open the common Flow Leak. Only they can read it." } ] }
```

Poll with the largest `id` you have seen. `paused` is true while the optional model rewrite
(`COMMENTARY_LLM=1`) is unreachable; nothing is published until it recovers. Kinds: `round-start`,
`round-end`, `sandwich`, `leak-drop`, `leak-bought`, `leak-listed`, `leak-flipped`,
`leak-opened`, `license-sold`, `call-minted`, `call-judged`, `big-fill`. A minted Call never
names its direction; the judged caption does.

## Alpha Cup

Five rounds, human seats (7 to 9) only, the top three are paid 50/30/20 (60/40 for two, all for
one) after a 5% platform fee. Players pay the buy-in with a private transfer to the operator
(Private Payments API, `docs/proofs/gates/g5.json`), then join:

```ts
import { cupJoin } from "@insider/sdk";
const tx = new Transaction().add(cupJoin(config, owner, seatIndex)); // owner signs first
// POST the partially signed transaction; the operator checks it, co-signs and submits it
await fetch(`${operator}/cup/cosign`, {
  method: "POST",
  body: JSON.stringify({ transactionBase64 }),
});
```

`GET /cup/status` returns `{ cupId, open, roundsRecorded, settled, entrants, credits, buyIn, feeBps,
mint, operator, history }`. The `Cup` account (`decodeCup`) is public: entries, scores, and after
settlement the winners with their shares in basis points.

`POST /cup/faucet` with `{ "owner": "<wallet public key>" }` creates the wallet's associated token
account if needed and mints twice the buy-in in devnet test tokens. It is limited to one request per
wallet per hour, persisted in the operator state; a failed mint still consumes the reservation.
The host proxies `/cup/*` to the operator. The faucet does not provide SOL for transaction fees.

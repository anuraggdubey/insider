import { PRICE_ONE } from "./constants";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const BPS = BigInt(10_000);
const U64_MAX = (ONE << BigInt(64)) - ONE;
const U128_MAX = (ONE << BigInt(128)) - ONE;
const U32_MAX = (ONE << BigInt(32)) - ONE;
const SCALE = BigInt(PRICE_ONE);
const ceilDiv = (n: bigint, d: bigint) => (n + d - ONE) / d;
const u64 = (n: bigint) => {
  if (n < ZERO || n > U64_MAX) throw new RangeError("Arithmetic overflow");
  return n;
};

export type Reserves = { base: bigint; quote: bigint };
export type FillQuote = {
  units: number;
  quote: bigint;
  fee: bigint;
  avgPrice: number;
  base: bigint;
  newQuote: bigint;
};

export function vammPrice({ base, quote }: Reserves): number {
  if (base === ZERO) return Number(U32_MAX);
  return Number((quote * SCALE) / base > U32_MAX ? U32_MAX : (quote * SCALE) / base);
}

export function applyFill(reserves: Reserves, sideSize: number, feeBps: number): FillQuote {
  if (!Number.isInteger(sideSize) || sideSize === 0 || sideSize < -32768 || sideSize > 32767)
    throw new RangeError("Invalid order size");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 65535)
    throw new RangeError("Invalid fee");
  const oldBase = u64(reserves.base);
  const oldQuote = u64(reserves.quote);
  const units = BigInt(Math.abs(sideSize));
  const base = u64(sideSize > 0 ? oldBase - units : oldBase + units);
  if (base === ZERO) throw new RangeError("Arithmetic overflow");
  const newQuote = u64(ceilDiv(oldBase * oldQuote, base));
  const amount = u64(sideSize > 0 ? newQuote - oldQuote : oldQuote - newQuote);
  const fee = u64(ceilDiv(amount * BigInt(feeBps), BPS));
  const rawPrice = (amount * SCALE) / units;
  return {
    units: Number(units),
    quote: amount,
    fee,
    avgPrice: Number(rawPrice > U32_MAX ? U32_MAX : rawPrice),
    base,
    newQuote,
  };
}

export function isqrt(n: bigint): bigint {
  if (n < ZERO || n > U128_MAX) throw new RangeError("Arithmetic overflow");
  if (n < TWO) return n;
  let x = ONE << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const next = (x + n / x) / TWO;
    if (next >= x) return x;
    x = next;
  }
}

export function arbPull(reserves: Reserves, targetPrice: number, arbBps: number): Reserves {
  const base = u64(reserves.base);
  const quote = u64(reserves.quote);
  if (
    !Number.isInteger(targetPrice) ||
    targetPrice < 0 ||
    BigInt(targetPrice) > U32_MAX ||
    !Number.isInteger(arbBps) ||
    arbBps < 0 ||
    arbBps > 65535
  )
    throw new RangeError("Arithmetic overflow");
  const price = vammPrice(reserves);
  if (price === targetPrice || arbBps === 0) return { base, quote };
  const p =
    BigInt(price) +
    ((BigInt(targetPrice) - BigInt(price)) * BigInt(Math.min(arbBps, 10_000))) / BPS;
  if (p <= ZERO || base === ZERO || quote === ZERO) throw new RangeError("Arithmetic overflow");
  const k = base * quote;
  if (k * SCALE > U128_MAX) throw new RangeError("Arithmetic overflow");
  const nextBase = isqrt((k * SCALE) / p);
  if (nextBase === ZERO) return { base, quote };
  const next = { base: u64(nextBase), quote: u64(k / nextBase) };
  const nextPrice = vammPrice(next);
  return (price < targetPrice && nextPrice >= price && nextPrice <= targetPrice) ||
    (price > targetPrice && nextPrice <= price && nextPrice >= targetPrice)
    ? next
    : { base, quote };
}

const DUTCH_TICKS = 12;

export function dutchPrice(
  start: number,
  floor: number,
  auctionStart: number,
  tick: number,
): number {
  const elapsed = Math.min(DUTCH_TICKS - 1, Math.max(0, tick - auctionStart));
  return start - Math.floor((Math.max(0, start - floor) * elapsed) / (DUTCH_TICKS - 1));
}

export function auctionOver(auctionStart: number, tick: number): boolean {
  return Math.max(0, tick - auctionStart) >= DUTCH_TICKS;
}

export function previewOrder(
  market: Reserves,
  sideSize: number,
  params: { feeBps: number },
): { avgPrice: number; fee: bigint; priceAfter: number; impactBps: number } {
  const before = vammPrice(market);
  const fill = applyFill(market, sideSize, params.feeBps);
  const priceAfter = vammPrice({ base: fill.base, quote: fill.newQuote });
  return {
    avgPrice: fill.avgPrice,
    fee: fill.fee,
    priceAfter,
    impactBps: before === 0 ? 0 : ((priceAfter - before) * 10_000) / before,
  };
}

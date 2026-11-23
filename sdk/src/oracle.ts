/**
 * Decoder for the pricing-oracle feed the Desk settles against (SOL/USD). Mirrors
 * `programs/insider/src/math/desk.rs::decode_oracle` and gate G4: a `PriceUpdateV3` account with a
 * discriminator (8), write authority (32), verification level (1 byte when `Full`, else 2), feed id
 * (32), then price (i64), confidence (u64), exponent (i32) and publish time (i64). The feed list
 * gives exponent -8 for SOL/USD, so the price in USD is `raw / 1e8`.
 */
export type OraclePrice = {
  /** USD per SOL. */
  usd: number;
  /** The same price in the program's 1e6 fixed point. */
  price: number;
  /** Unix seconds. */
  publishTime: number;
};

/** A little-endian i64 as a Number: exact below 2^53, far above any price or timestamp here. */
const readI64 = (view: DataView, offset: number) =>
  view.getInt32(offset + 4, true) * 2 ** 32 + view.getUint32(offset, true);

export function decodeOraclePrice(data: Uint8Array): OraclePrice | undefined {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8 + 32;
  if (data.length <= offset) return undefined;
  offset += data[offset] === 0 ? 2 : 1;
  offset += 32;
  if (data.length < offset + 8 + 8 + 4 + 8) return undefined;
  const raw = readI64(view, offset);
  offset += 8 + 8 + 4;
  const publishTime = readI64(view, offset);
  const fixed = Math.floor(raw / 100);
  if (fixed <= 0) return undefined;
  return { usd: fixed / 1e6, price: fixed, publishTime };
}

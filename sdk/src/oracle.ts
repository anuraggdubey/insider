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

export function decodeOraclePrice(data: Uint8Array): OraclePrice | undefined {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8 + 32;
  if (data.length <= offset) return undefined;
  offset += data[offset] === 0 ? 2 : 1;
  offset += 32;
  if (data.length < offset + 8 + 8 + 4 + 8) return undefined;
  const raw = view.getBigInt64(offset, true);
  offset += 8 + 8 + 4;
  const publishTime = Number(view.getBigInt64(offset, true));
  const fixed = raw / 100n;
  if (fixed <= 0n) return undefined;
  return { usd: Number(fixed) / 1e6, price: Number(fixed), publishTime };
}

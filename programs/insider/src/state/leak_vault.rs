use anchor_lang::prelude::*;

use crate::{state::PendingOrder, LEAK_PAYLOAD_FIELDS, LEAK_PAYLOAD_ORDERS};

/// Private payload, sealed until opened.
///
/// `fields` by kind:
/// - Flow: net units, order count, window start, window end, 0, 0.
/// - Spotlight: unused; `orders[0]` is the order if `order_count` is nonzero.
/// - Whale: unused; `orders[0]` is the next whale within 60 ticks, if any.
/// - FullBook: unused; `orders[..order_count]` contains the pending orders.
/// - Pin: target tick, fundamental price (1e6), 0, 0, 0, 0.
/// - Drift: from tick, to tick, direction (+1/-1/0), bucket (0:<1%, 1:1-3%, 2:>3%), move bps, 0.
/// - Shockwave: has shock (0/1), shock tick, sign (+1/-1), window end, 0, 0.
/// - Summit: high (1e6), high tick, low (1e6), low tick, window start, window end.
#[account(zero_copy)]
#[repr(C)]
pub struct LeakVault {
    pub leak_id: u32,
    pub round_id: u32,
    pub minted_tick: u16,
    pub kind: u8,
    pub order_count: u8,
    pub slot: u8,
    pub bump: u8,
    pub _pad: [u8; 2],
    pub fields: [i32; LEAK_PAYLOAD_FIELDS],
    pub orders: [PendingOrder; LEAK_PAYLOAD_ORDERS],
}

impl LeakVault {
    pub const SPACE: usize = 8 + core::mem::size_of::<Self>();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_is_fixed() {
        assert_eq!(core::mem::size_of::<LeakVault>(), 296);
        assert_eq!(LeakVault::SPACE, 304);
    }
}

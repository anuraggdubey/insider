use anchor_lang::prelude::*;

use crate::PATH_LEN;

/// Public Floor or Desk market.
#[account(zero_copy)]
#[repr(C)]
pub struct Market {
    pub round_id: u32,
    pub kind: u8,
    pub bump: u8,
    pub last_tick: u16,
    pub base: u64,
    pub quote: u64,
    pub price: u32,
    pub mark_price: u32,
    pub oracle_ts: i64,
    pub volume: u64,
    pub history: [u32; PATH_LEN],
}

impl Market {
    pub const SPACE: usize = 8 + core::mem::size_of::<Self>();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_is_fixed() {
        assert_eq!(core::mem::size_of::<Market>(), 816);
        assert_eq!(Market::SPACE, 824);
    }
}

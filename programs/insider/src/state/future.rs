use anchor_lang::prelude::*;

use crate::{MAX_SHOCKS, PATH_LEN};

#[zero_copy]
#[repr(C)]
#[derive(Default, Debug)]
pub struct Shock {
    pub tick: u16,
    pub bps: i16,
    pub len: u8,
    pub _pad: [u8; 3],
}

/// Private fundamental path.
#[account(zero_copy)]
#[repr(C)]
pub struct Future {
    pub round_id: u32,
    pub shock_count: u8,
    pub bump: u8,
    pub _pad: [u8; 2],
    pub shocks: [Shock; MAX_SHOCKS],
    pub path: [u32; PATH_LEN],
}

impl Future {
    pub const SPACE: usize = 8 + core::mem::size_of::<Self>();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_is_fixed() {
        assert_eq!(core::mem::size_of::<Shock>(), 8);
        assert_eq!(core::mem::size_of::<Future>(), 808);
        assert_eq!(Future::SPACE, 816);
    }
}

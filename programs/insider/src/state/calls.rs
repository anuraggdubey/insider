use anchor_lang::prelude::*;

use crate::{CALL_READERS, CALL_SLOTS};

/// State of a Desk Call. Stored as a `u8` in the zero-copy header.
#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace,
)]
pub enum CallState {
    #[default]
    Empty,
    Open,
    Right,
    Wrong,
}

impl CallState {
    pub fn from_u8(value: u8) -> CallState {
        match value {
            1 => CallState::Open,
            2 => CallState::Right,
            3 => CallState::Wrong,
            _ => CallState::Empty,
        }
    }
}

/// Public header of a Desk Call; the direction and confidence stay in the private `CallVault`
/// until settlement reveals the direction. Zero-copy: the call book is 1.8 KB, too big for the
/// 4 KB SBF stack frame when deserialised the normal way.
#[zero_copy]
#[repr(C)]
#[derive(Default)]
pub struct CallHeader {
    pub call_id: u32,
    pub author_seat: u8,
    /// `CallState` as a byte.
    pub state: u8,
    /// Revealed direction after settlement: +1 up, -1 down, 0 not revealed.
    pub revealed_dir: i8,
    pub _pad0: u8,
    pub minted_ts: i64,
    /// Oracle price at mint, fixed point 1e6 (decoded with the feed-list exponent).
    pub minted_price: u64,
    pub horizon_secs: u16,
    pub _pad1: [u8; 6],
    pub expiry_ts: i64,
    pub stake: u64,
    pub license_ask: u64,
    pub readers: [Pubkey; CALL_READERS],
}

impl CallHeader {
    pub fn call_state(&self) -> CallState {
        CallState::from_u8(self.state)
    }
}

/// One Call per seat.
#[account(zero_copy)]
#[repr(C)]
pub struct CallBook {
    pub headers: [CallHeader; CALL_SLOTS],
    pub next_call_id: u32,
    pub bump: u8,
    pub _pad: [u8; 3],
}

impl CallBook {
    /// Account space including the 8-byte discriminator.
    pub const SPACE: usize = 8 + core::mem::size_of::<CallBook>();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_is_fixed() {
        assert_eq!(core::mem::size_of::<CallHeader>(), 184);
        assert_eq!(core::mem::size_of::<CallBook>(), 10 * 184 + 8);
        assert_eq!(CallBook::SPACE, 8 + 10 * 184 + 8);
    }

    #[test]
    fn states_round_trip_through_the_byte() {
        for state in [
            CallState::Empty,
            CallState::Open,
            CallState::Right,
            CallState::Wrong,
        ] {
            assert_eq!(CallState::from_u8(state as u8), state);
        }
        assert_eq!(CallState::from_u8(99), CallState::Empty);
    }
}

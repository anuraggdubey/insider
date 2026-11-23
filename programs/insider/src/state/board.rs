use anchor_lang::prelude::*;

use crate::{LEAK_READERS, LEAK_SLOTS};

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace,
)]
pub enum LeakKind {
    #[default]
    Flow,
    Spotlight,
    Whale,
    FullBook,
    Pin,
    Drift,
    Shockwave,
    Summit,
}

impl LeakKind {
    pub fn from_u8(value: u8) -> Self {
        match value {
            1 => Self::Spotlight,
            2 => Self::Whale,
            3 => Self::FullBook,
            4 => Self::Pin,
            5 => Self::Drift,
            6 => Self::Shockwave,
            7 => Self::Summit,
            _ => Self::Flow,
        }
    }

    pub fn family(self) -> LeakFamily {
        match self {
            Self::Flow | Self::Spotlight | Self::Whale | Self::FullBook => LeakFamily::Flow,
            Self::Pin | Self::Drift | Self::Shockwave | Self::Summit => LeakFamily::Fundamentals,
        }
    }
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace,
)]
pub enum LeakFamily {
    #[default]
    Flow,
    Fundamentals,
}

impl LeakFamily {
    pub fn from_u8(value: u8) -> Self {
        match value {
            1 => Self::Fundamentals,
            _ => Self::Flow,
        }
    }
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace,
)]
pub enum Rarity {
    #[default]
    Common,
    Rare,
    Epic,
}

impl Rarity {
    pub fn from_u8(value: u8) -> Self {
        match value {
            1 => Self::Rare,
            2 => Self::Epic,
            _ => Self::Common,
        }
    }

    pub fn start_price(self) -> u32 {
        match self {
            Self::Common => 60,
            Self::Rare => 120,
            Self::Epic => 200,
        }
    }

    pub fn floor_price(self) -> u32 {
        match self {
            Self::Common => 5,
            Self::Rare => 10,
            Self::Epic => 20,
        }
    }
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace,
)]
pub enum LeakState {
    #[default]
    Empty,
    Auction,
    Owned,
    Listed,
    Opened,
    Expired,
}

impl LeakState {
    pub fn from_u8(value: u8) -> Self {
        match value {
            1 => Self::Auction,
            2 => Self::Owned,
            3 => Self::Listed,
            4 => Self::Opened,
            5 => Self::Expired,
            _ => Self::Empty,
        }
    }
}

#[zero_copy]
#[repr(C)]
#[derive(Default)]
pub struct LeakHeader {
    pub leak_id: u32,
    pub kind: u8,
    pub rarity: u8,
    pub state: u8,
    pub owner_seat: u8,
    pub window_start: u16,
    pub window_end: u16,
    pub minted_tick: u16,
    pub auction_start: u16,
    pub start_price: u32,
    pub floor_price: u32,
    pub paid: u32,
    pub ask: u32,
    pub license_ask: u32,
    pub opened_tick: u16,
    pub flips: u8,
    pub reader_count: u8,
    pub readers: [Pubkey; LEAK_READERS],
}

/// Public leak headers, indexed by vault slot.
#[account(zero_copy)]
#[repr(C)]
pub struct Board {
    pub round_id: u32,
    pub next_leak_id: u32,
    pub drop_index: u8,
    pub bump: u8,
    pub _pad: [u8; 6],
    pub headers: [LeakHeader; LEAK_SLOTS],
}

impl Board {
    pub const SPACE: usize = 8 + core::mem::size_of::<Self>();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_is_fixed() {
        assert_eq!(core::mem::size_of::<LeakHeader>(), 168);
        assert_eq!(core::mem::size_of::<Board>(), 1024);
        assert_eq!(Board::SPACE, 1032);
    }

    #[test]
    fn enums_round_trip_and_default_on_unknown() {
        let kinds = [
            LeakKind::Flow,
            LeakKind::Spotlight,
            LeakKind::Whale,
            LeakKind::FullBook,
            LeakKind::Pin,
            LeakKind::Drift,
            LeakKind::Shockwave,
            LeakKind::Summit,
        ];
        for kind in kinds {
            assert_eq!(LeakKind::from_u8(kind as u8), kind);
            assert_eq!(
                kind.family(),
                if (kind as u8) < 4 {
                    LeakFamily::Flow
                } else {
                    LeakFamily::Fundamentals
                }
            );
        }
        for family in [LeakFamily::Flow, LeakFamily::Fundamentals] {
            assert_eq!(LeakFamily::from_u8(family as u8), family);
        }
        for state in [
            LeakState::Empty,
            LeakState::Auction,
            LeakState::Owned,
            LeakState::Listed,
            LeakState::Opened,
            LeakState::Expired,
        ] {
            assert_eq!(LeakState::from_u8(state as u8), state);
        }
        assert_eq!(LeakKind::from_u8(99), LeakKind::Flow);
        assert_eq!(LeakFamily::from_u8(99), LeakFamily::Flow);
        assert_eq!(LeakState::from_u8(99), LeakState::Empty);
    }

    #[test]
    fn rarity_prices_and_bytes() {
        for (rarity, start, floor) in [
            (Rarity::Common, 60, 5),
            (Rarity::Rare, 120, 10),
            (Rarity::Epic, 200, 20),
        ] {
            assert_eq!(Rarity::from_u8(rarity as u8), rarity);
            assert_eq!(rarity.start_price(), start);
            assert_eq!(rarity.floor_price(), floor);
        }
        assert_eq!(Rarity::from_u8(99), Rarity::Common);
    }
}

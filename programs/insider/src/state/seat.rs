use anchor_lang::prelude::*;

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace,
)]
pub enum SeatKind {
    #[default]
    Bot,
    Ai,
    Human,
}

/// One of the ten seats. Public: owner, chips, position and activity are visible to everyone.
#[account]
#[derive(InitSpace)]
pub struct Seat {
    /// Seat number 0-9 (also in the PDA seeds).
    pub index: u8,
    /// Wallet or guest key that holds the seat; the default key means the seat is free.
    pub owner: Pubkey,
    /// Index into the fixed name list (no free text on chain).
    pub name_idx: u8,
    pub kind: SeatKind,
    pub chips: i64,
    /// Signed position in units.
    pub position: i32,
    /// Average entry price, fixed point 1e6.
    pub entry: u64,
    pub fees_paid: u64,
    pub leak_spend: u64,
    pub pending_count: u8,
    pub desk_chips: i64,
    pub desk_position: i32,
    pub last_seen_tick: u16,
    /// How many times the seat has been claimed.
    pub claims: u32,
    pub bump: u8,
}

impl Seat {
    pub fn is_free(&self) -> bool {
        self.owner == Pubkey::default()
    }

    /// Seat classes (spec 7.6): 0-4 bots, 5-6 AI analysts, 7-9 human-first.
    pub fn kind_for_index(index: u8) -> SeatKind {
        if index < crate::FIRST_AI_SEAT {
            SeatKind::Bot
        } else if index < crate::FIRST_HUMAN_SEAT {
            SeatKind::Ai
        } else {
            SeatKind::Human
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_is_fixed() {
        // index 1, owner 32, name_idx 1, kind 1, chips 8, position 4, entry 8, fees_paid 8,
        // leak_spend 8, pending_count 1, desk_chips 8, desk_position 4, last_seen_tick 2,
        // claims 4, bump 1
        assert_eq!(
            Seat::INIT_SPACE,
            1 + 32 + 1 + 1 + 8 + 4 + 8 + 8 + 8 + 1 + 8 + 4 + 2 + 4 + 1
        );
    }

    #[test]
    fn seat_classes() {
        assert_eq!(Seat::kind_for_index(0), SeatKind::Bot);
        assert_eq!(Seat::kind_for_index(4), SeatKind::Bot);
        assert_eq!(Seat::kind_for_index(5), SeatKind::Ai);
        assert_eq!(Seat::kind_for_index(6), SeatKind::Ai);
        assert_eq!(Seat::kind_for_index(7), SeatKind::Human);
        assert_eq!(Seat::kind_for_index(9), SeatKind::Human);
    }
}

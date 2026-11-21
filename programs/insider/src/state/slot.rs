use anchor_lang::prelude::*;

/// Phase 2 slot: one of many small accounts used to measure how many delegated accounts a single
/// transaction can delegate, update and settle. Removed once the game accounts exist.
#[account]
#[derive(InitSpace)]
pub struct Slot {
    pub authority: Pubkey,
    pub index: u8,
    pub count: u64,
    pub bump: u8,
}

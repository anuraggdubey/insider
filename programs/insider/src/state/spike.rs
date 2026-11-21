use anchor_lang::prelude::*;

/// Phase 1 spike: a counter used to prove the base layer to Ephemeral Rollup round trip.
/// Removed once the real game accounts exist.
#[account]
#[derive(InitSpace)]
pub struct Spike {
    pub authority: Pubkey,
    pub count: u64,
    pub bump: u8,
}

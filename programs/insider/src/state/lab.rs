use anchor_lang::prelude::*;

use crate::constants::LAB_MAX_CANDIDATES;

/// Phase 2 lab: one account used to de-risk VRF, private permissions, cranks and multi-account
/// settlement before the real game accounts exist. Removed once the game replaces it.
#[account]
#[derive(InitSpace)]
pub struct Lab {
    pub authority: Pubkey,
    /// Value used to prove who can read a private account.
    pub secret: u64,
    /// Wallets the VRF callback may pick as the reader.
    pub candidates: [Pubkey; LAB_MAX_CANDIDATES],
    /// Wallet picked by the last VRF callback.
    pub reader: Pubkey,
    pub randomness: [u8; 32],
    pub pending: bool,
    pub rolls: u64,
    /// Incremented by the crank target.
    pub ticks: u64,
    pub bump: u8,
}

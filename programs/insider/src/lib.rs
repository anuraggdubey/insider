pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ");

#[ephemeral]
#[program]
pub mod insider {
    use super::*;

    // Phase 1 spike: base layer <-> ER round trip.
    pub fn spike_init(ctx: Context<SpikeInit>) -> Result<()> {
        spike_init::handler(ctx)
    }

    pub fn spike_increment(ctx: Context<SpikeIncrement>) -> Result<()> {
        spike_increment::handler(ctx)
    }

    pub fn spike_delegate(ctx: Context<SpikeDelegate>) -> Result<()> {
        spike_delegate::handler(ctx)
    }

    pub fn spike_commit(ctx: Context<SpikeCommit>) -> Result<()> {
        spike_commit::handler(ctx)
    }

    pub fn spike_undelegate(ctx: Context<SpikeUndelegate>) -> Result<()> {
        spike_undelegate::handler(ctx)
    }

    // Phase 2 lab: VRF, private permissions, cranks, multi-account settlement.
    pub fn lab_init(
        ctx: Context<LabInit>,
        secret: u64,
        candidates: [Pubkey; LAB_MAX_CANDIDATES],
    ) -> Result<()> {
        lab_init::handler(ctx, secret, candidates)
    }

    pub fn lab_delegate(ctx: Context<LabDelegate>) -> Result<()> {
        lab_delegate::handler(ctx)
    }

    pub fn lab_request_roll(ctx: Context<LabRequestRoll>, client_seed: u8) -> Result<()> {
        lab_request_roll::handler(ctx, client_seed)
    }

    pub fn lab_roll_callback(ctx: Context<LabRollCallback>, randomness: [u8; 32]) -> Result<()> {
        lab_roll_callback::handler(ctx, randomness)
    }

    pub fn lab_cancel_roll(ctx: Context<LabCancelRoll>) -> Result<()> {
        lab_cancel_roll::handler(ctx)
    }

    pub fn lab_commit(ctx: Context<LabCommit>) -> Result<()> {
        lab_commit::handler(ctx)
    }

    pub fn lab_undelegate(ctx: Context<LabUndelegate>) -> Result<()> {
        lab_undelegate::handler(ctx)
    }
}

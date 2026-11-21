use anchor_lang::prelude::*;

use crate::{constants::SPIKE_SEED, error::InsiderError, state::Spike};

/// Runs unchanged on the base layer and inside the Ephemeral Rollup.
#[derive(Accounts)]
pub struct SpikeIncrement<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SPIKE_SEED, authority.key().as_ref()],
        bump = spike.bump,
        has_one = authority,
    )]
    pub spike: Account<'info, Spike>,
}

pub fn handler(ctx: Context<SpikeIncrement>) -> Result<()> {
    let spike = &mut ctx.accounts.spike;
    spike.count = spike.count.checked_add(1).ok_or(InsiderError::Overflow)?;
    Ok(())
}

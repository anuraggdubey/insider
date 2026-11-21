use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

use crate::{constants::SPIKE_SEED, state::Spike};

/// Ephemeral Rollup: schedule a commit of the Spike state to the base layer, keeping it delegated.
#[commit]
#[derive(Accounts)]
pub struct SpikeCommit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [SPIKE_SEED, payer.key().as_ref()],
        bump = spike.bump,
    )]
    pub spike: Account<'info, Spike>,
}

pub fn handler(ctx: Context<SpikeCommit>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit(&[ctx.accounts.spike.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}

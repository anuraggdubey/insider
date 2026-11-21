use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

use crate::{constants::SPIKE_SEED, state::Spike};

/// Ephemeral Rollup: commit the final Spike state and return the account to the base layer.
#[commit]
#[derive(Accounts)]
pub struct SpikeUndelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [SPIKE_SEED, payer.key().as_ref()],
        bump = spike.bump,
    )]
    pub spike: Account<'info, Spike>,
}

pub fn handler(ctx: Context<SpikeUndelegate>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.spike.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}

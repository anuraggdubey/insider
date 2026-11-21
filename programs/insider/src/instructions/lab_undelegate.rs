use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

use crate::{constants::LAB_SEED, state::Lab};

/// Ephemeral Rollup: commit the final lab state and return the account to the base layer.
#[commit]
#[derive(Accounts)]
pub struct LabUndelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [LAB_SEED, payer.key().as_ref()], bump = lab.bump)]
    pub lab: Account<'info, Lab>,
}

pub fn handler(ctx: Context<LabUndelegate>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.lab.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}

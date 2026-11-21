use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

use crate::{constants::LAB_SEED, state::Lab};

/// Ephemeral Rollup: schedule a commit of the lab to the base layer, keeping it delegated.
#[commit]
#[derive(Accounts)]
pub struct LabCommit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [LAB_SEED, payer.key().as_ref()], bump = lab.bump)]
    pub lab: Account<'info, Lab>,
}

pub fn handler(ctx: Context<LabCommit>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit(&[ctx.accounts.lab.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}

use anchor_lang::prelude::*;

use crate::{constants::LAB_SEED, state::Lab};

/// Explicit cancel path for a randomness request that was never fulfilled, so a retry is possible.
/// A late callback for the cancelled request is rejected because `pending` is false.
#[derive(Accounts)]
pub struct LabCancelRoll<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [LAB_SEED, authority.key().as_ref()], bump = lab.bump)]
    pub lab: Account<'info, Lab>,
}

pub fn handler(ctx: Context<LabCancelRoll>) -> Result<()> {
    ctx.accounts.lab.pending = false;
    Ok(())
}

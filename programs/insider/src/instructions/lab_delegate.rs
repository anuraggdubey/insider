use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::LAB_SEED;

/// Base layer: delegate the lab to an ER or TEE validator, passed as the first remaining account.
#[delegate]
#[derive(Accounts)]
pub struct LabDelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the lab PDA being delegated; the Delegation Program validates the seeds.
    #[account(mut, del, seeds = [LAB_SEED, payer.key().as_ref()], bump)]
    pub lab: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<LabDelegate>) -> Result<()> {
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    ctx.accounts.delegate_lab(
        &ctx.accounts.payer,
        &[LAB_SEED, ctx.accounts.payer.key().as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

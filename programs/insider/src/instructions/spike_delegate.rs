use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::SPIKE_SEED;

/// Base layer: hand the Spike account to the Delegation Program so an Ephemeral Rollup
/// validator can execute against it. Pass the target ER validator as the first remaining account.
#[delegate]
#[derive(Accounts)]
pub struct SpikeDelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the Spike PDA being delegated; the Delegation Program validates the seeds.
    #[account(mut, del, seeds = [SPIKE_SEED, payer.key().as_ref()], bump)]
    pub spike: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<SpikeDelegate>) -> Result<()> {
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    ctx.accounts.delegate_spike(
        &ctx.accounts.payer,
        &[SPIKE_SEED, ctx.accounts.payer.key().as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

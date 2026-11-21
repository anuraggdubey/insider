use anchor_lang::prelude::*;

use crate::{constants::SPIKE_SEED, state::Spike};

#[derive(Accounts)]
pub struct SpikeInit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Spike::INIT_SPACE,
        seeds = [SPIKE_SEED, authority.key().as_ref()],
        bump,
    )]
    pub spike: Account<'info, Spike>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SpikeInit>) -> Result<()> {
    let spike = &mut ctx.accounts.spike;
    spike.authority = ctx.accounts.authority.key();
    spike.count = 0;
    spike.bump = ctx.bumps.spike;
    Ok(())
}

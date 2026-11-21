use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use ephemeral_rollups_sdk::{access_control::structs::EphemeralPermission, ephemeral_accounts};

use crate::{
    constants::{LAB_MAX_CANDIDATES, LAB_MAX_PERMISSION_MEMBERS, LAB_SEED},
    state::Lab,
};

#[derive(Accounts)]
pub struct LabInit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Lab::INIT_SPACE,
        seeds = [LAB_SEED, authority.key().as_ref()],
        bump,
    )]
    pub lab: Account<'info, Lab>,
    pub system_program: Program<'info, System>,
}

/// Base layer: create the lab and pre-fund it so it can pay for its own ephemeral permission
/// rent once it is delegated.
pub fn handler(
    ctx: Context<LabInit>,
    secret: u64,
    candidates: [Pubkey; LAB_MAX_CANDIDATES],
) -> Result<()> {
    let permission_rent =
        ephemeral_accounts::rent(EphemeralPermission::size_of(LAB_MAX_PERMISSION_MEMBERS) as u32);
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.lab.to_account_info(),
            },
        ),
        permission_rent,
    )?;

    let lab = &mut ctx.accounts.lab;
    lab.authority = ctx.accounts.authority.key();
    lab.secret = secret;
    lab.candidates = candidates;
    lab.reader = ctx.accounts.authority.key();
    lab.bump = ctx.bumps.lab;
    Ok(())
}

use anchor_lang::prelude::*;

use crate::{constants::CRANK_PROGRAM_ID, error::InsiderError, state::Lab};

/// The only signer the crank scheduler adds to a scheduled instruction: a PDA of the crank
/// program derived from the task authority.
pub fn crank_signer_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"crank-executor", authority.as_ref()], &CRANK_PROGRAM_ID).0
}

/// Scheduled by `lab_schedule_tick` and executed by the rollup's crank scheduler. The crank
/// signer check makes it callable only by the scheduler, not by arbitrary wallets.
#[derive(Accounts)]
pub struct LabTick<'info> {
    #[account(mut)]
    pub lab: Account<'info, Lab>,
    #[account(address = crank_signer_pda(&lab.authority))]
    pub crank_signer: Signer<'info>,
}

pub fn handler(ctx: Context<LabTick>) -> Result<()> {
    let lab = &mut ctx.accounts.lab;
    lab.ticks = lab.ticks.checked_add(1).ok_or(InsiderError::Overflow)?;
    Ok(())
}

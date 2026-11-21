use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::{commit, delegate},
    cpi::DelegateConfig,
    ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder},
};

use crate::{constants::SLOT_SEED, error::InsiderError, state::Slot};

/// Base layer: create one slot for the signer at the given index.
#[derive(Accounts)]
#[instruction(index: u8)]
pub struct SlotInit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Slot::INIT_SPACE,
        seeds = [SLOT_SEED, authority.key().as_ref(), &[index]],
        bump,
    )]
    pub slot: Account<'info, Slot>,
    pub system_program: Program<'info, System>,
}

pub fn init_handler(ctx: Context<SlotInit>, index: u8) -> Result<()> {
    let slot = &mut ctx.accounts.slot;
    slot.authority = ctx.accounts.authority.key();
    slot.index = index;
    slot.count = 0;
    slot.bump = ctx.bumps.slot;
    Ok(())
}

/// Base layer: delegate one slot. Several of these instructions can share one transaction.
#[delegate]
#[derive(Accounts)]
#[instruction(index: u8)]
pub struct SlotDelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the slot PDA being delegated; the Delegation Program validates the seeds.
    #[account(mut, del, seeds = [SLOT_SEED, payer.key().as_ref(), &[index]], bump)]
    pub slot: UncheckedAccount<'info>,
}

pub fn delegate_handler(ctx: Context<SlotDelegate>, index: u8) -> Result<()> {
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    ctx.accounts.delegate_slot(
        &ctx.accounts.payer,
        &[SLOT_SEED, ctx.accounts.payer.key().as_ref(), &[index]],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

/// Rollup: add one to every slot passed as a remaining account, in a single instruction.
#[derive(Accounts)]
pub struct SlotBumpAll<'info> {
    pub authority: Signer<'info>,
}

pub fn bump_all_handler<'info>(ctx: Context<'info, SlotBumpAll<'info>>) -> Result<()> {
    for info in ctx.remaining_accounts.iter() {
        let mut slot: Account<Slot> = Account::try_from(info)?;
        require_keys_eq!(slot.authority, ctx.accounts.authority.key());
        let expected = Pubkey::create_program_address(
            &[
                SLOT_SEED,
                slot.authority.as_ref(),
                &[slot.index],
                &[slot.bump],
            ],
            &crate::ID,
        )
        .map_err(|_| InsiderError::Overflow)?;
        require_keys_eq!(expected, slot.key());
        slot.count = slot.count.checked_add(1).ok_or(InsiderError::Overflow)?;
        slot.exit(&crate::ID)?;
    }
    Ok(())
}

/// Rollup: commit and undelegate every slot passed as a remaining account in one intent.
#[commit]
#[derive(Accounts)]
pub struct SlotSettleAll<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}

pub fn settle_all_handler<'info>(ctx: Context<'info, SlotSettleAll<'info>>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(ctx.remaining_accounts)
    .build_and_invoke()?;
    Ok(())
}

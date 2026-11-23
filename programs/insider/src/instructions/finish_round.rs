use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    access_control::structs::PERMISSION_SEED,
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
};

use crate::{
    engine::finish::finalize_round,
    error::InsiderError,
    instructions::leaks::{update_permission, PermissionAccounts},
    state::{Board, LeakVault, Phase, Season, Seat, Table, Xray},
    BOARD_SEED, LEAK_SEED, LEAK_SLOTS, NOBODY_SEED, SEASON_SEED, SEAT_COUNT, SEAT_SEED, XRAY_SEED,
};

#[derive(Accounts)]
pub struct FinishRound<'info> {
    pub payer: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(seeds = [BOARD_SEED, table.key().as_ref()], bump = board.load()?.bump)]
    pub board: AccountLoader<'info, Board>,
    #[account(mut, seeds = [XRAY_SEED, table.key().as_ref()], bump = xray.load()?.bump)]
    pub xray: AccountLoader<'info, Xray>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[0]], bump = seat_0.bump)]
    pub seat_0: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[1]], bump = seat_1.bump)]
    pub seat_1: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[2]], bump = seat_2.bump)]
    pub seat_2: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[3]], bump = seat_3.bump)]
    pub seat_3: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[4]], bump = seat_4.bump)]
    pub seat_4: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[5]], bump = seat_5.bump)]
    pub seat_5: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[6]], bump = seat_6.bump)]
    pub seat_6: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[7]], bump = seat_7.bump)]
    pub seat_7: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[8]], bump = seat_8.bump)]
    pub seat_8: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[9]], bump = seat_9.bump)]
    pub seat_9: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEASON_SEED, table.key().as_ref()], bump = season.bump)]
    pub season: Box<Account<'info, Season>>,
    #[account(seeds = [LEAK_SEED, table.key().as_ref(), &[0]], bump = vault_0.load()?.bump)]
    pub vault_0: AccountLoader<'info, LeakVault>,
    #[account(seeds = [LEAK_SEED, table.key().as_ref(), &[1]], bump = vault_1.load()?.bump)]
    pub vault_1: AccountLoader<'info, LeakVault>,
    #[account(seeds = [LEAK_SEED, table.key().as_ref(), &[2]], bump = vault_2.load()?.bump)]
    pub vault_2: AccountLoader<'info, LeakVault>,
    #[account(seeds = [LEAK_SEED, table.key().as_ref(), &[3]], bump = vault_3.load()?.bump)]
    pub vault_3: AccountLoader<'info, LeakVault>,
    #[account(seeds = [LEAK_SEED, table.key().as_ref(), &[4]], bump = vault_4.load()?.bump)]
    pub vault_4: AccountLoader<'info, LeakVault>,
    #[account(seeds = [LEAK_SEED, table.key().as_ref(), &[5]], bump = vault_5.load()?.bump)]
    pub vault_5: AccountLoader<'info, LeakVault>,
}

#[derive(Accounts)]
pub struct ResealLeaks<'info> {
    pub payer: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [BOARD_SEED, table.key().as_ref()], bump = board.load()?.bump)]
    pub board: AccountLoader<'info, Board>,
    #[account(seeds = [XRAY_SEED, table.key().as_ref()], bump = xray.load()?.bump)]
    pub xray: AccountLoader<'info, Xray>,
    /// CHECK: fixed permission program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed ephemeral vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed Magic program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

pub fn finish_round(ctx: Context<FinishRound>) -> Result<()> {
    let table = &ctx.accounts.table;
    {
        let xray = ctx.accounts.xray.load()?;
        require!(
            matches!(table.phase, Phase::Xray | Phase::Idle) && xray.round_id == table.round_id,
            InsiderError::WrongPhase
        );
        if xray.finalized != 0 {
            return Ok(());
        }
    }
    {
        let board = ctx.accounts.board.load()?;
        let vault_0 = ctx.accounts.vault_0.load()?;
        let vault_1 = ctx.accounts.vault_1.load()?;
        let vault_2 = ctx.accounts.vault_2.load()?;
        let vault_3 = ctx.accounts.vault_3.load()?;
        let vault_4 = ctx.accounts.vault_4.load()?;
        let vault_5 = ctx.accounts.vault_5.load()?;
        let vaults: [&LeakVault; LEAK_SLOTS] =
            [&vault_0, &vault_1, &vault_2, &vault_3, &vault_4, &vault_5];
        let mut seats: [&mut Seat; SEAT_COUNT] = [
            &mut ctx.accounts.seat_0,
            &mut ctx.accounts.seat_1,
            &mut ctx.accounts.seat_2,
            &mut ctx.accounts.seat_3,
            &mut ctx.accounts.seat_4,
            &mut ctx.accounts.seat_5,
            &mut ctx.accounts.seat_6,
            &mut ctx.accounts.seat_7,
            &mut ctx.accounts.seat_8,
            &mut ctx.accounts.seat_9,
        ];
        finalize_round(
            table,
            &board,
            &vaults,
            &mut *ctx.accounts.xray.load_mut()?,
            &mut seats,
            &mut ctx.accounts.season,
        )?;
    }
    Ok(())
}

pub fn reseal_leaks<'info>(
    ctx: Context<'info, ResealLeaks<'info>>,
    slot_from: u8,
    slot_to: u8,
) -> Result<()> {
    let table = &ctx.accounts.table;
    {
        let xray = ctx.accounts.xray.load()?;
        let board = ctx.accounts.board.load()?;
        require!(
            matches!(table.phase, Phase::Xray | Phase::Idle)
                && xray.round_id == table.round_id
                && board.round_id == table.round_id
                && xray.finalized != 0,
            InsiderError::WrongPhase
        );
    }
    require!(
        slot_from <= slot_to && usize::from(slot_to) <= LEAK_SLOTS,
        InsiderError::InvalidLeakSlot
    );
    require!(
        ctx.remaining_accounts.len() == usize::from(slot_to - slot_from) * 2,
        InsiderError::InvalidLeakSlot
    );
    let table_key = table.key();
    let nobody = Pubkey::find_program_address(&[NOBODY_SEED], ctx.program_id).0;
    for (offset, slot) in (slot_from..slot_to).enumerate() {
        let vault_info = &ctx.remaining_accounts[offset * 2];
        let permission = &ctx.remaining_accounts[offset * 2 + 1];
        require!(
            vault_info.is_writable && permission.is_writable,
            InsiderError::InvalidLeakSlot
        );
        let vault = AccountLoader::<LeakVault>::try_from(vault_info)?;
        let bump = vault.load()?.bump;
        let expected_vault = Pubkey::create_program_address(
            &[LEAK_SEED, table_key.as_ref(), &[slot], &[bump]],
            ctx.program_id,
        )
        .map_err(|_| error!(InsiderError::InvalidLeakSlot))?;
        let expected_permission = Pubkey::find_program_address(
            &[PERMISSION_SEED, expected_vault.as_ref()],
            &PERMISSION_PROGRAM_ID,
        )
        .0;
        require_keys_eq!(vault.key(), expected_vault, InsiderError::InvalidLeakSlot);
        require_keys_eq!(
            permission.key(),
            expected_permission,
            InsiderError::InvalidLeakSlot
        );
        if ctx.accounts.board.load()?.headers[usize::from(slot)].reader_count == 0 {
            continue;
        }
        update_permission(
            &table_key,
            slot,
            bump,
            &[nobody],
            PermissionAccounts {
                vault: vault_info.clone(),
                permission: permission.clone(),
                permission_program: ctx.accounts.permission_program.to_account_info(),
                ephemeral_vault: ctx.accounts.ephemeral_vault.to_account_info(),
                magic_program: ctx.accounts.magic_program.to_account_info(),
            },
        )?;
        let mut board = ctx.accounts.board.load_mut()?;
        board.headers[usize::from(slot)]
            .readers
            .fill(Pubkey::default());
        board.headers[usize::from(slot)].reader_count = 0;
    }
    Ok(())
}

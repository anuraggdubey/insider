use anchor_lang::prelude::*;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};
use ephemeral_rollups_sdk::{
    access_control::structs::PERMISSION_SEED,
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
};

use crate::{
    engine::leaks,
    error::InsiderError,
    instructions::leaks::{
        check_live, check_vault, update_permission, LeakAction, PermissionAccounts,
    },
    state::{Board, LeakVault, Seat, Table},
    BOARD_SEED, LEAK_SEED, LEAK_SLOTS, SEAT_COUNT, SEAT_SEED,
};

#[derive(Accounts, Session)]
#[instruction(index: u8, slot: u8, owner_index: u8)]
pub struct BuyLicense<'info> {
    pub owner: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[index]], bump = seat.bump)]
    pub seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [BOARD_SEED, table.key().as_ref()], bump = board.load()?.bump)]
    pub board: AccountLoader<'info, Board>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[owner_index]], bump = license_owner.bump)]
    pub license_owner: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [LEAK_SEED, table.key().as_ref(), &[slot]], bump = vault.load()?.bump)]
    pub vault: AccountLoader<'info, LeakVault>,
    /// CHECK: PDA under the permission program.
    #[account(mut, seeds = [PERMISSION_SEED, vault.key().as_ref()], bump, seeds::program = permission_program.key())]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed permission program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed ephemeral vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed Magic program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    #[session(signer = owner, authority = seat.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[session_auth_or(
    ctx.accounts.seat.owner == ctx.accounts.owner.key(),
    InsiderError::NotSeatOwner
)]
pub fn offer_license(ctx: Context<LeakAction>, index: u8, slot: u8, ask: u32) -> Result<()> {
    let mut board = ctx.accounts.board.load_mut()?;
    check_live(&ctx.accounts.table, &board, index)?;
    leaks::offer_license(&mut board, slot, index, ask)
}

#[session_auth_or(
    ctx.accounts.seat.owner == ctx.accounts.owner.key(),
    InsiderError::NotSeatOwner
)]
pub fn buy_license(ctx: Context<BuyLicense>, index: u8, slot: u8, owner_index: u8) -> Result<()> {
    require!(
        usize::from(owner_index) < SEAT_COUNT,
        InsiderError::InvalidSeat
    );
    require!(
        usize::from(slot) < LEAK_SLOTS,
        InsiderError::InvalidLeakSlot
    );
    let table = &ctx.accounts.table;
    let bump = {
        let vault = ctx.accounts.vault.load()?;
        let board = ctx.accounts.board.load()?;
        check_live(table, &board, index)?;
        check_vault(table, &board, slot, &vault)?;
        require!(
            board.headers[usize::from(slot)].owner_seat == owner_index,
            InsiderError::NotLeakOwner
        );
        vault.bump
    };
    let (readers, count) = leaks::buy_license(
        &mut *ctx.accounts.board.load_mut()?,
        slot,
        index,
        ctx.accounts.seat.owner,
        &mut ctx.accounts.seat,
        &mut ctx.accounts.license_owner,
        table.tick,
    )?;
    update_permission(
        &table.key(),
        slot,
        bump,
        &readers[..usize::from(count)],
        PermissionAccounts {
            vault: ctx.accounts.vault.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            ephemeral_vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
        },
    )
}

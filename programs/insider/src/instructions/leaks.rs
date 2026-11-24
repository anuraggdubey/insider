use anchor_lang::prelude::*;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::UpdateEphemeralPermissionCpi,
        structs::{EphemeralMembersArgs, Member, PERMISSION_SEED, TX_LOGS_FLAG},
    },
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
};

use crate::{
    engine::leaks,
    error::InsiderError,
    state::{Board, LeakVault, Phase, Seat, Table},
    BOARD_SEED, LEAK_SEED, LEAK_SLOTS, SEAT_COUNT, SEAT_SEED,
};

#[derive(Accounts, Session)]
#[instruction(index: u8)]
pub struct LeakAction<'info> {
    pub owner: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[index]], bump = seat.bump)]
    pub seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [BOARD_SEED, table.key().as_ref()], bump = board.load()?.bump)]
    pub board: AccountLoader<'info, Board>,
    #[session(signer = owner, authority = seat.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
#[instruction(index: u8, slot: u8)]
pub struct OpenLeak<'info> {
    pub owner: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[index]], bump = seat.bump)]
    pub seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [BOARD_SEED, table.key().as_ref()], bump = board.load()?.bump)]
    pub board: AccountLoader<'info, Board>,
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

#[derive(Accounts, Session)]
#[instruction(index: u8, slot: u8, seller_index: u8)]
pub struct BuyListed<'info> {
    pub owner: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[index]], bump = seat.bump)]
    pub seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [BOARD_SEED, table.key().as_ref()], bump = board.load()?.bump)]
    pub board: AccountLoader<'info, Board>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[seller_index]], bump = seller_seat.bump)]
    pub seller_seat: Box<Account<'info, Seat>>,
    #[session(signer = owner, authority = seat.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

pub(crate) fn check_live(table: &Table, board: &Board, index: u8) -> Result<()> {
    require!(usize::from(index) < SEAT_COUNT, InsiderError::InvalidSeat);
    require!(
        matches!(table.phase, Phase::Live | Phase::Closing) && board.round_id == table.round_id,
        InsiderError::WrongPhase
    );
    Ok(())
}

pub(crate) fn check_vault(table: &Table, board: &Board, slot: u8, vault: &LeakVault) -> Result<()> {
    require!(
        usize::from(slot) < LEAK_SLOTS,
        InsiderError::InvalidLeakSlot
    );
    require!(
        vault.round_id == table.round_id
            && vault.leak_id == board.headers[usize::from(slot)].leak_id,
        InsiderError::InvalidLeakSlot
    );
    Ok(())
}

#[session_auth_or(
    ctx.accounts.seat.owner == ctx.accounts.owner.key(),
    InsiderError::NotSeatOwner
)]
pub fn bid(ctx: Context<LeakAction>, index: u8, slot: u8) -> Result<()> {
    let table = &ctx.accounts.table;
    let mut board = ctx.accounts.board.load_mut()?;
    check_live(table, &board, index)?;
    leaks::bid(&mut board, slot, index, &mut ctx.accounts.seat, table.tick)?;
    Ok(())
}

#[session_auth_or(
    ctx.accounts.seat.owner == ctx.accounts.owner.key(),
    InsiderError::NotSeatOwner
)]
pub fn open_leak(ctx: Context<OpenLeak>, index: u8, slot: u8) -> Result<()> {
    let table = &ctx.accounts.table;
    let bump = {
        let vault = ctx.accounts.vault.load()?;
        let board = ctx.accounts.board.load()?;
        check_live(table, &board, index)?;
        check_vault(table, &board, slot, &vault)?;
        vault.bump
    };
    let (readers, count) = leaks::open(
        &mut *ctx.accounts.board.load_mut()?,
        slot,
        index,
        ctx.accounts.seat.owner,
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

#[session_auth_or(
    ctx.accounts.seat.owner == ctx.accounts.owner.key(),
    InsiderError::NotSeatOwner
)]
pub fn list_leak(ctx: Context<LeakAction>, index: u8, slot: u8, ask: u32) -> Result<()> {
    let mut board = ctx.accounts.board.load_mut()?;
    check_live(&ctx.accounts.table, &board, index)?;
    leaks::list(&mut board, slot, index, ask)
}

#[session_auth_or(
    ctx.accounts.seat.owner == ctx.accounts.owner.key(),
    InsiderError::NotSeatOwner
)]
pub fn buy_listed(ctx: Context<BuyListed>, index: u8, slot: u8, seller_index: u8) -> Result<()> {
    require!(
        usize::from(seller_index) < SEAT_COUNT,
        InsiderError::InvalidSeat
    );
    require!(
        usize::from(slot) < LEAK_SLOTS,
        InsiderError::InvalidLeakSlot
    );
    let table = &ctx.accounts.table;
    let mut board = ctx.accounts.board.load_mut()?;
    check_live(table, &board, index)?;
    require!(
        board.headers[usize::from(slot)].owner_seat == seller_index,
        InsiderError::NotLeakOwner
    );
    leaks::buy_listed(
        &mut board,
        slot,
        index,
        &mut ctx.accounts.seat,
        &mut ctx.accounts.seller_seat,
        table.tick,
    )?;
    Ok(())
}

pub(crate) struct PermissionAccounts<'info> {
    pub vault: AccountInfo<'info>,
    pub permission: AccountInfo<'info>,
    pub permission_program: AccountInfo<'info>,
    pub ephemeral_vault: AccountInfo<'info>,
    pub magic_program: AccountInfo<'info>,
}

pub(crate) fn update_permission<'info>(
    table: &Pubkey,
    slot: u8,
    bump: u8,
    readers: &[Pubkey],
    accounts: PermissionAccounts<'info>,
) -> Result<()> {
    let slot_seed = [slot];
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[LEAK_SEED, table.as_ref(), &slot_seed, &bump_seed];
    let members = readers
        .iter()
        .map(|pubkey| Member {
            flags: TX_LOGS_FLAG,
            pubkey: *pubkey,
        })
        .collect();
    UpdateEphemeralPermissionCpi {
        payer: accounts.vault.clone(),
        permissioned_account: accounts.vault.clone(),
        permission: accounts.permission,
        vault: accounts.ephemeral_vault,
        magic_program: accounts.magic_program,
        permission_program: accounts.permission_program,
        authority: accounts.vault,
        authority_is_signer: false,
        args: EphemeralMembersArgs {
            is_private: true,
            members,
        },
    }
    .invoke_signed(&[seeds])?;
    Ok(())
}

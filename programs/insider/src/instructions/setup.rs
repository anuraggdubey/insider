//! Base-layer setup: create the public accounts and delegate them to the TEE.
//!
//! The setup script batches these: `init_table` once, `init_seat` per seat, then six delegate
//! instructions per transaction under a 1.4M compute limit (Phase 2, experiment E).

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};

use crate::{
    state::{CallBook, Params, Phase, Season, Seat, Table, Tape},
    CALLBOOK_SEED, SEASON_SEED, SEAT_COUNT, SEAT_SEED, TABLE_SEED, TAPE_SEED,
};
use crate::error::InsiderError;

#[derive(Accounts)]
pub struct InitTable<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Table::INIT_SPACE,
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump,
    )]
    pub table: Account<'info, Table>,
    pub system_program: Program<'info, System>,
}

/// Creates the table. Only the authority can set up its own table. The big accounts (tape, call
/// book, season) are created by their own instructions so no single frame holds all of them.
pub fn init_table(ctx: Context<InitTable>, params: Option<Params>) -> Result<()> {
    let table = &mut ctx.accounts.table;
    table.authority = ctx.accounts.authority.key();
    table.phase = Phase::Idle;
    table.round_id = 0;
    table.params = params.unwrap_or_default();
    table.bump = ctx.bumps.table;
    Ok(())
}

#[derive(Accounts)]
pub struct InitTape<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = 8 + Tape::INIT_SPACE,
        seeds = [TAPE_SEED, table.key().as_ref()],
        bump,
    )]
    pub tape: Box<Account<'info, Tape>>,
    pub system_program: Program<'info, System>,
}

pub fn init_tape(ctx: Context<InitTape>) -> Result<()> {
    ctx.accounts.tape.bump = ctx.bumps.tape;
    Ok(())
}

#[derive(Accounts)]
pub struct InitCallBook<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = CallBook::SPACE,
        seeds = [CALLBOOK_SEED, table.key().as_ref()],
        bump,
    )]
    pub call_book: AccountLoader<'info, CallBook>,
    pub system_program: Program<'info, System>,
}

pub fn init_call_book(ctx: Context<InitCallBook>) -> Result<()> {
    ctx.accounts.call_book.load_init()?.bump = ctx.bumps.call_book;
    Ok(())
}

#[derive(Accounts)]
pub struct InitSeason<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = 8 + Season::INIT_SPACE,
        seeds = [SEASON_SEED, table.key().as_ref()],
        bump,
    )]
    pub season: Box<Account<'info, Season>>,
    pub system_program: Program<'info, System>,
}

pub fn init_season(ctx: Context<InitSeason>) -> Result<()> {
    ctx.accounts.season.bump = ctx.bumps.season;
    Ok(())
}

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct InitSeat<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = 8 + Seat::INIT_SPACE,
        seeds = [SEAT_SEED, table.key().as_ref(), &[index]],
        bump,
    )]
    pub seat: Account<'info, Seat>,
    pub system_program: Program<'info, System>,
}

/// Creates one free seat. Seats 0-4 are bot seats, 5-6 AI analysts, 7-9 human-first.
pub fn init_seat(ctx: Context<InitSeat>, index: u8) -> Result<()> {
    require!((index as usize) < SEAT_COUNT, InsiderError::InvalidSeat);
    let seat = &mut ctx.accounts.seat;
    seat.index = index;
    seat.kind = Seat::kind_for_index(index);
    seat.bump = ctx.bumps.seat;
    Ok(())
}

// ---- delegation: one instruction per account kind, six per transaction on the client ----------

/// Delegates the table to the validator in the first remaining account (the TEE).
#[delegate]
#[derive(Accounts)]
pub struct DelegateTable<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table PDA being delegated; the Delegation Program validates the seeds.
    #[account(mut, del, seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
}

pub fn delegate_table(ctx: Context<DelegateTable>) -> Result<()> {
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    ctx.accounts.delegate_table(
        &ctx.accounts.payer,
        &[TABLE_SEED, ctx.accounts.payer.key().as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateTape<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the tape seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the tape PDA being delegated.
    #[account(mut, del, seeds = [TAPE_SEED, table.key().as_ref()], bump)]
    pub tape: UncheckedAccount<'info>,
}

pub fn delegate_tape(ctx: Context<DelegateTape>) -> Result<()> {
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    let table = ctx.accounts.table.key();
    ctx.accounts.delegate_tape(
        &ctx.accounts.payer,
        &[TAPE_SEED, table.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateCallBook<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the call book seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the call book PDA being delegated.
    #[account(mut, del, seeds = [CALLBOOK_SEED, table.key().as_ref()], bump)]
    pub call_book: UncheckedAccount<'info>,
}

pub fn delegate_call_book(ctx: Context<DelegateCallBook>) -> Result<()> {
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    let table = ctx.accounts.table.key();
    ctx.accounts.delegate_call_book(
        &ctx.accounts.payer,
        &[CALLBOOK_SEED, table.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

/// Season is delegated on its own so it can be committed and undelegated every epoch (G8).
#[delegate]
#[derive(Accounts)]
pub struct DelegateSeason<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the season seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the season PDA being delegated.
    #[account(mut, del, seeds = [SEASON_SEED, table.key().as_ref()], bump)]
    pub season: UncheckedAccount<'info>,
}

pub fn delegate_season(ctx: Context<DelegateSeason>) -> Result<()> {
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    let table = ctx.accounts.table.key();
    ctx.accounts.delegate_season(
        &ctx.accounts.payer,
        &[SEASON_SEED, table.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(index: u8)]
pub struct DelegateSeat<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the seat seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the seat PDA being delegated.
    #[account(mut, del, seeds = [SEAT_SEED, table.key().as_ref(), &[index]], bump)]
    pub seat: UncheckedAccount<'info>,
}

pub fn delegate_seat(ctx: Context<DelegateSeat>, index: u8) -> Result<()> {
    require!((index as usize) < SEAT_COUNT, InsiderError::InvalidSeat);
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    let table = ctx.accounts.table.key();
    ctx.accounts.delegate_seat(
        &ctx.accounts.payer,
        &[SEAT_SEED, table.as_ref(), &[index]],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

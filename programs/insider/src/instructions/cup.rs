//! The Alpha Cup (spec section 9): five rounds, human seats only, top three paid.
//!
//! The program keeps entries, scores and the ranking. Money moves through Private Payments, signed by
//! the operator (the table authority): the operator sees a buy-in arrive and only then co-signs
//! `cup_join`; after `cup_settle` it pays the winners and calls `cup_close`.
//!
//! `cup_record` must run after `finish_round` and before the next seed, while the X-ray still holds
//! the scored round; the bots do it. A round that is missed is simply not counted.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};

use crate::{
    error::InsiderError,
    state::{Cup, CupError, Phase, Seat, SeatKind, Table, Xray},
    CUP_ROUNDS, CUP_SEED, SEAT_COUNT, SEAT_SEED, TABLE_SEED, XRAY_SEED,
};

impl From<CupError> for InsiderError {
    fn from(error: CupError) -> Self {
        match error {
            CupError::NotHumanSeat => InsiderError::NotHumanSeat,
            CupError::AlreadyJoined => InsiderError::CupAlreadyJoined,
            CupError::Started => InsiderError::CupStarted,
            CupError::NothingToRecord => InsiderError::CupNothingToRecord,
        }
    }
}

// ---- setup (base layer) ------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitCup<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: the table. It is delegated after setup, so it is not deserialised on the base layer;
    /// its seeds tie it to `authority`.
    #[account(seeds = [TABLE_SEED, authority.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Cup::INIT_SPACE,
        seeds = [CUP_SEED, table.key().as_ref()],
        bump,
    )]
    pub cup: Box<Account<'info, Cup>>,
    pub system_program: Program<'info, System>,
}

pub fn init_cup(ctx: Context<InitCup>) -> Result<()> {
    let cup = &mut ctx.accounts.cup;
    cup.cup_id = 1;
    cup.bump = ctx.bumps.cup;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateCup<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the cup seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the cup PDA being delegated.
    #[account(mut, del, seeds = [CUP_SEED, table.key().as_ref()], bump)]
    pub cup: UncheckedAccount<'info>,
}

pub fn delegate_cup(ctx: Context<DelegateCup>) -> Result<()> {
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    let table = ctx.accounts.table.key();
    ctx.accounts.delegate_cup(
        &ctx.accounts.payer,
        &[CUP_SEED, table.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

// ---- cup_join ----------------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct CupJoin<'info> {
    pub owner: Signer<'info>,
    /// The operator: the table authority, who confirmed the buy-in.
    #[account(constraint = operator.key() == table.authority @ InsiderError::NotAuthority)]
    pub operator: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(seeds = [SEAT_SEED, table.key().as_ref(), &[index]], bump = seat.bump,
        constraint = seat.owner == owner.key() @ InsiderError::NotSeatOwner)]
    pub seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [CUP_SEED, table.key().as_ref()], bump = cup.bump)]
    pub cup: Box<Account<'info, Cup>>,
}

/// Enters the cup with a human seat. Needs the seat owner and the operator, so nobody joins without
/// a confirmed buy-in.
pub fn cup_join(ctx: Context<CupJoin>, index: u8) -> Result<()> {
    require!(usize::from(index) < SEAT_COUNT, InsiderError::InvalidSeat);
    require!(
        ctx.accounts.seat.kind == SeatKind::Human,
        InsiderError::NotHumanSeat
    );
    ctx.accounts
        .cup
        .join(index, ctx.accounts.owner.key())
        .map_err(InsiderError::from)?;
    Ok(())
}

// ---- cup_record --------------------------------------------------------------------------------

#[derive(Accounts)]
pub struct CupRecord<'info> {
    pub payer: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(seeds = [XRAY_SEED, table.key().as_ref()], bump = xray.load()?.bump)]
    pub xray: AccountLoader<'info, Xray>,
    #[account(mut, seeds = [CUP_SEED, table.key().as_ref()], bump = cup.bump)]
    pub cup: Box<Account<'info, Cup>>,
}

/// Anyone: adds the scored round the X-ray holds to the cup (once per round).
pub fn cup_record(ctx: Context<CupRecord>) -> Result<()> {
    let table = &ctx.accounts.table;
    let xray = ctx.accounts.xray.load()?;
    require!(
        matches!(table.phase, Phase::Xray | Phase::Idle)
            && xray.round_id == table.round_id
            && xray.finalized != 0,
        InsiderError::WrongPhase
    );
    ctx.accounts
        .cup
        .record(xray.round_id, &xray.scores, &xray.seat_owners)
        .map_err(InsiderError::from)?;
    Ok(())
}

// ---- cup_settle and cup_close ------------------------------------------------------------------

#[derive(Accounts)]
pub struct CupSettle<'info> {
    pub payer: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [CUP_SEED, table.key().as_ref()], bump = cup.bump)]
    pub cup: Box<Account<'info, Cup>>,
}

/// Anyone: once the cup has run its rounds, ranks the entrants and fixes the prize split.
pub fn cup_settle(ctx: Context<CupSettle>) -> Result<()> {
    require!(
        ctx.accounts.cup.rounds_recorded >= CUP_ROUNDS && !ctx.accounts.cup.settled,
        InsiderError::CupNotReady
    );
    ctx.accounts.cup.settle();
    Ok(())
}

#[derive(Accounts)]
pub struct CupClose<'info> {
    #[account(constraint = operator.key() == table.authority @ InsiderError::NotAuthority)]
    pub operator: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [CUP_SEED, table.key().as_ref()], bump = cup.bump)]
    pub cup: Box<Account<'info, Cup>>,
}

/// The operator, after paying the prizes: starts the next cup.
pub fn cup_close(ctx: Context<CupClose>) -> Result<()> {
    require!(ctx.accounts.cup.settled, InsiderError::CupNotReady);
    ctx.accounts.cup.start_next();
    Ok(())
}

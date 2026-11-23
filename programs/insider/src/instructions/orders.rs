use anchor_lang::prelude::*;

use crate::{
    engine::orders::push_order,
    error::InsiderError,
    state::{Market, Mempool, Phase, Seat, SendEvent, Table, Tape},
    MARKET_FLOOR, MARKET_SEED, MEMPOOL_SEED, SEAT_COUNT, SEAT_SEED, TAPE_SEED,
};

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct SendOrder<'info> {
    pub owner: Signer<'info>,
    pub table: Account<'info, Table>,
    #[account(
        mut,
        seeds = [SEAT_SEED, table.key().as_ref(), &[index]],
        bump = seat.bump,
        constraint = seat.owner == owner.key() @ InsiderError::NotSeatOwner,
    )]
    pub seat: Account<'info, Seat>,
    #[account(
        seeds = [MARKET_SEED, table.key().as_ref(), &[MARKET_FLOOR]],
        bump = market.load()?.bump,
    )]
    pub market: AccountLoader<'info, Market>,
    #[account(
        mut,
        seeds = [MEMPOOL_SEED, table.key().as_ref()],
        bump = mempool.load()?.bump,
    )]
    pub mempool: AccountLoader<'info, Mempool>,
    #[account(mut, seeds = [TAPE_SEED, table.key().as_ref()], bump = tape.bump)]
    pub tape: Box<Account<'info, Tape>>,
}

pub fn send_order(ctx: Context<SendOrder>, index: u8, side_size: i16, lane: u8) -> Result<()> {
    require!(usize::from(index) < SEAT_COUNT, InsiderError::InvalidSeat);
    require!(
        ctx.accounts.table.phase == Phase::Live,
        InsiderError::WrongPhase
    );
    require!(
        ctx.accounts.market.load()?.liquidated_mask & (1u16 << index) == 0,
        InsiderError::Liquidated
    );
    let tick = ctx.accounts.table.tick;
    push_order(
        &ctx.accounts.table.params,
        tick,
        &mut ctx.accounts.seat,
        &mut *ctx.accounts.mempool.load_mut()?,
        side_size,
        lane,
    )?;
    ctx.accounts.tape.push_send(SendEvent {
        seat: index,
        lane,
        sent_tick: tick,
    });
    ctx.accounts.seat.last_seen_tick = tick;
    Ok(())
}

//! Seats: `claim_seat` and `ping` (spec 7.6). Both run inside the rollup.

use anchor_lang::prelude::*;

use crate::{
    error::InsiderError,
    state::{Seat, SeatKind, Table},
    BANKROLL_CHIPS, DESK_BANKROLL, SEAT_COUNT, SEAT_IDLE_TICKS, SEAT_SEED,
};

/// Number of entries in the fixed name list the app ships (no free text on chain).
pub const NAME_COUNT: u8 = 32;

/// Name index from a key: stable, and spread evenly enough for ten seats.
pub fn name_index(owner: &Pubkey) -> u8 {
    let bytes = owner.to_bytes();
    (bytes[0] ^ bytes[15] ^ bytes[31]) % NAME_COUNT
}

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct ClaimSeat<'info> {
    pub owner: Signer<'info>,
    pub table: Account<'info, Table>,
    #[account(
        mut,
        seeds = [SEAT_SEED, table.key().as_ref(), &[index]],
        bump = seat.bump,
    )]
    pub seat: Account<'info, Seat>,
}

/// A seat can be claimed when it is free, or when it is a bot seat whose bot has been idle for
/// `SEAT_IDLE_TICKS`. AI seats (5-6) are protected: only a free one can be claimed.
pub fn claim_seat(ctx: Context<ClaimSeat>, index: u8) -> Result<()> {
    require!((index as usize) < SEAT_COUNT, InsiderError::InvalidSeat);
    let tick = ctx.accounts.table.tick;
    let owner = ctx.accounts.owner.key();
    let seat = &mut ctx.accounts.seat;

    if !seat.is_free() && seat.owner != owner {
        let idle = tick.saturating_sub(seat.last_seen_tick) >= SEAT_IDLE_TICKS;
        // Never hand a bot's open position or queued orders to a newcomer: resetting `chips` and
        // `position` mid-round would erase them while orders still sit in the mempool.
        let flat = seat.position == 0 && seat.pending_count == 0;
        let displaceable = seat.kind == SeatKind::Bot && idle && flat;
        require!(displaceable, InsiderError::SeatTaken);
    }

    if seat.owner != owner {
        seat.owner = owner;
        seat.name_idx = name_index(&owner);
        seat.chips = BANKROLL_CHIPS;
        seat.position = 0;
        seat.entry = 0;
        seat.fees_paid = 0;
        seat.leak_spend = 0;
        seat.pending_count = 0;
        seat.desk_chips = DESK_BANKROLL;
        seat.desk_position = 0;
        seat.claims = seat.claims.checked_add(1).ok_or(InsiderError::Overflow)?;
    }
    seat.last_seen_tick = tick;
    Ok(())
}

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct Ping<'info> {
    pub owner: Signer<'info>,
    pub table: Account<'info, Table>,
    #[account(
        mut,
        seeds = [SEAT_SEED, table.key().as_ref(), &[index]],
        bump = seat.bump,
        constraint = seat.owner == owner.key() @ InsiderError::NotSeatOwner,
    )]
    pub seat: Account<'info, Seat>,
}

/// Keeps the seat from going idle (and from being displaced).
pub fn ping(ctx: Context<Ping>, _index: u8) -> Result<()> {
    ctx.accounts.seat.last_seen_tick = ctx.accounts.table.tick;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_in_range_and_stable() {
        let key = Pubkey::new_unique();
        assert_eq!(name_index(&key), name_index(&key));
        for _ in 0..200 {
            assert!(name_index(&Pubkey::new_unique()) < NAME_COUNT);
        }
    }
}

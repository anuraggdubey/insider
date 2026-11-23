use anchor_lang::prelude::*;

use crate::{
    error::InsiderError,
    state::{Mempool, Params, PendingOrder, Seat},
    LANE_PRIORITY, LANE_STANDARD,
};

pub fn push_order(
    params: &Params,
    tick: u16,
    seat: &mut Seat,
    mempool: &mut Mempool,
    side_size: i16,
    lane: u8,
) -> Result<PendingOrder> {
    require!(
        lane == LANE_STANDARD || lane == LANE_PRIORITY,
        InsiderError::InvalidLane
    );
    require!(side_size != 0, InsiderError::ZeroOrder);
    require!(
        side_size.unsigned_abs() <= params.max_order_units,
        InsiderError::OrderTooLarge
    );
    require!(
        seat.pending_count < params.max_pending,
        InsiderError::TooManyPending
    );
    let slot = mempool
        .orders
        .iter()
        .position(PendingOrder::is_empty)
        .ok_or(InsiderError::MempoolFull)?;
    let pending: i64 = mempool
        .orders
        .iter()
        .filter(|o| !o.is_empty() && o.seat == seat.index)
        .map(|o| i64::from(o.side_size))
        .sum();
    let position = i64::from(seat.position) + pending + i64::from(side_size);
    require!(
        position.unsigned_abs() <= u64::from(params.max_position_units),
        InsiderError::PositionLimit
    );
    let delay = if lane == LANE_PRIORITY {
        params.priority_delay
    } else {
        params.standard_delay
    };
    let land_tick = tick
        .checked_add(u16::from(delay))
        .ok_or(InsiderError::Overflow)?;
    let fee = if lane == LANE_PRIORITY {
        u64::from(params.priority_fee)
    } else {
        0
    };
    let chips = seat
        .chips
        .checked_sub(fee as i64)
        .ok_or(InsiderError::Overflow)?;
    let fees_paid = seat
        .fees_paid
        .checked_add(fee)
        .ok_or(InsiderError::Overflow)?;
    let count = mempool.count.checked_add(1).ok_or(InsiderError::Overflow)?;
    let order = PendingOrder {
        seat: seat.index,
        lane,
        side_size,
        land_tick,
        seq: mempool.next_seq,
    };
    mempool.next_seq = mempool.next_seq.wrapping_add(1);
    mempool.orders[slot] = order;
    mempool.count = count;
    seat.pending_count += 1;
    seat.chips = chips;
    seat.fees_paid = fees_paid;
    Ok(order)
}

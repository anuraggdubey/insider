use anchor_lang::prelude::*;

use crate::{
    error::InsiderError,
    state::{
        Board, LeakHeader, LeakKind, LeakState, LeakVault, SandwichTag, Season, Seat, Table, Xray,
        XrayOrder,
    },
    BANKROLL_CHIPS, DROPS_PER_ROUND, LANE_PRIORITY, LANE_STANDARD, LEAK_PAYLOAD_ORDERS,
    LEAK_READERS, LEAK_SLOTS, PRICE_ONE, SANDWICH_WINDOW_TICKS, SEAT_COUNT, XRAY_ORDERS, XRAY_TAGS,
};

pub fn finalize_round(
    table: &Table,
    board: &Board,
    vaults: &[&LeakVault],
    xray: &mut Xray,
    seats: &mut [&mut Seat],
    season: &mut Season,
) -> Result<()> {
    require!(
        board.round_id == table.round_id && xray.round_id == table.round_id,
        InsiderError::WrongPhase
    );
    if xray.finalized != 0 {
        return Ok(());
    }
    require!(vaults.len() == LEAK_SLOTS, InsiderError::InvalidLeakSlot);
    require!(seats.len() == SEAT_COUNT, InsiderError::InvalidSeat);
    require!(
        usize::from(xray.leak_count) <= DROPS_PER_ROUND,
        InsiderError::Overflow
    );
    for (header, vault) in board.headers.iter().zip(vaults.iter()) {
        if header.state != LeakState::Empty as u8 {
            require!(
                vault.round_id == table.round_id && vault.leak_id == header.leak_id,
                InsiderError::InvalidLeakSlot
            );
        }
    }
    for seat in seats.iter() {
        if !seat.is_free() {
            let score = seat
                .chips
                .checked_sub(BANKROLL_CHIPS)
                .ok_or(InsiderError::Overflow)?;
            i32::try_from(score).map_err(|_| InsiderError::Overflow)?;
        }
    }

    for (header, vault) in board.headers.iter().zip(vaults.iter()) {
        if header.state != LeakState::Empty as u8 {
            archive_leak(xray, header, vault)?;
        }
    }

    xray.tag_count = 0;
    tag_sandwiches(board, vaults, xray, seats);
    for (index, seat) in seats.iter_mut().enumerate() {
        xray.seat_owners[index] = seat.owner;
        xray.seat_kinds[index] = seat.kind as u8;
        xray.name_idx[index] = seat.name_idx;
        xray.scores[index] = 0;
        if !seat.is_free() {
            let score = seat
                .chips
                .checked_sub(BANKROLL_CHIPS)
                .ok_or(InsiderError::Overflow)?;
            xray.scores[index] = i32::try_from(score).map_err(|_| InsiderError::Overflow)?;
            season.record_score(seat.owner, score);
        }
        seat.chips = BANKROLL_CHIPS;
        seat.position = 0;
        seat.entry = 0;
        seat.fees_paid = 0;
        seat.leak_spend = 0;
        seat.pending_count = 0;
    }
    season.rounds_played = season.rounds_played.saturating_add(1);
    xray.round_id = table.round_id;
    xray.finalized = 1;
    Ok(())
}

pub(super) fn archive_leak(xray: &mut Xray, header: &LeakHeader, vault: &LeakVault) -> Result<()> {
    require!(
        vault.round_id == xray.round_id && vault.leak_id == header.leak_id,
        InsiderError::InvalidLeakSlot
    );
    let count = usize::from(xray.leak_count);
    require!(count <= DROPS_PER_ROUND, InsiderError::Overflow);
    if xray.leaks[..count]
        .iter()
        .any(|leak| leak.header.leak_id == header.leak_id)
    {
        return Ok(());
    }
    require!(count < DROPS_PER_ROUND, InsiderError::Overflow);
    let leak = &mut xray.leaks[count];
    leak.header = *header;
    leak.fields = vault.fields;
    leak.orders = vault.orders;
    leak.order_count = vault.order_count.min(LEAK_PAYLOAD_ORDERS as u8);
    xray.leak_count += 1;
    Ok(())
}

fn tag_sandwiches(board: &Board, vaults: &[&LeakVault], xray: &mut Xray, seats: &[&mut Seat]) {
    let order_count = usize::from(xray.order_count).min(XRAY_ORDERS);
    let mut priority: [Vec<u8>; SEAT_COUNT * 2] = std::array::from_fn(|_| Vec::new());
    let mut orders: [Vec<u8>; SEAT_COUNT * 2] = std::array::from_fn(|_| Vec::new());
    for (index, order) in xray.orders[..order_count].iter().enumerate() {
        let seat = usize::from(order.seat);
        if seat >= SEAT_COUNT || order.side_size == 0 {
            continue;
        }
        let key = seat * 2 + usize::from(order.side_size < 0);
        orders[key].push(index as u8);
        if order.lane == LANE_PRIORITY {
            priority[key].push(index as u8);
        }
    }
    for list in priority.iter_mut().chain(orders.iter_mut()) {
        list.sort_unstable_by_key(|&index| xray.orders[usize::from(index)].land_tick);
    }
    let mut candidates = [0u16; 2];
    for front in 0..SEAT_COUNT {
        for side in 0..2 {
            if !priority[front * 2 + side].is_empty() && !orders[front * 2 + (1 - side)].is_empty()
            {
                candidates[side] |= 1 << front;
            }
        }
    }
    if candidates == [0, 0] {
        return;
    }
    for victim_index in 0..order_count {
        let victim = xray.orders[victim_index];
        if victim.lane != LANE_STANDARD
            || usize::from(victim.seat) >= SEAT_COUNT
            || victim.side_size == 0
        {
            continue;
        }
        let side = usize::from(victim.side_size < 0);
        for front in 0..SEAT_COUNT {
            if candidates[side] & (1 << front) == 0 || front == usize::from(victim.seat) {
                continue;
            }
            let fronts = &priority[front * 2 + side];
            let exits = &orders[front * 2 + (1 - side)];
            let front_end = fronts.partition_point(|&index| {
                xray.orders[usize::from(index)].land_tick < victim.land_tick
            });
            let exit_start = exits.partition_point(|&index| {
                xray.orders[usize::from(index)].land_tick <= victim.land_tick
            });
            if front_end == 0 || exit_start == exits.len() {
                continue;
            }
            let open = xray.orders[usize::from(fronts[front_end - 1])];
            let exit = xray.orders[usize::from(exits[exit_start])];
            if exit.land_tick > victim.land_tick.saturating_add(SANDWICH_WINDOW_TICKS) {
                continue;
            }
            let owner = seats[front].owner;
            if owner == Pubkey::default() {
                continue;
            }
            let Some(slot) = board
                .headers
                .iter()
                .zip(vaults.iter())
                .position(|(header, vault)| {
                    header.state != LeakState::Empty as u8
                        && header.readers[..usize::from(header.reader_count).min(LEAK_READERS)]
                            .contains(&owner)
                        && contains_victim(vault, &victim)
                })
            else {
                continue;
            };
            let size = i64::from(
                open.side_size
                    .unsigned_abs()
                    .min(exit.side_size.unsigned_abs()),
            );
            let price_diff = i64::from(exit.fill_price) - i64::from(open.fill_price);
            let profit =
                price_diff * size / i64::from(PRICE_ONE) * i64::from(open.side_size.signum());
            xray.tags[usize::from(xray.tag_count)] = SandwichTag {
                front: front as u8,
                victim: victim.seat,
                leak_slot: slot as u8,
                _pad: 0,
                front_tick: open.land_tick,
                victim_tick: victim.land_tick,
                profit_estimate: profit as i32,
            };
            xray.tag_count += 1;
            if usize::from(xray.tag_count) == XRAY_TAGS {
                return;
            }
        }
    }
}

fn contains_victim(vault: &LeakVault, victim: &XrayOrder) -> bool {
    match LeakKind::from_u8(vault.kind) {
        LeakKind::Flow => {
            i32::from(victim.scheduled_tick) >= vault.fields[2]
                && i32::from(victim.scheduled_tick) <= vault.fields[3]
        }
        LeakKind::Spotlight | LeakKind::FullBook => vault.orders
            [..usize::from(vault.order_count).min(LEAK_PAYLOAD_ORDERS)]
            .iter()
            .any(|order| {
                order.seat == victim.seat
                    && order.side_size == victim.side_size
                    && order.land_tick == victim.scheduled_tick
            }),
        _ => false,
    }
}

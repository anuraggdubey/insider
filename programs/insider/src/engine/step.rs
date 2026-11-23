use anchor_lang::prelude::*;

use crate::{
    error::InsiderError,
    math::{
        arb::arb_pull,
        dutch::auction_over,
        payloads::{build_payload, payload_window},
        vamm::{FillQuote, Vamm},
    },
    state::{
        Board, Fill, Future, LeakHeader, LeakState, LeakVault, Market, Mempool, PendingOrder,
        Rarity, Seat, Table, Tape, Xray, XrayOrder,
    },
    CLOSING_END_TICK, DROPS_PER_ROUND, LEAK_SLOTS, MAX_FILLS_PER_TICK, MAX_LIVE_LEAKS,
    MEMPOOL_SLOTS, NO_SEAT, PATH_LEN, PRICE_ONE, SEAT_COUNT, WHALE_SEAT, XRAY_ORDERS,
};

pub struct StepAccounts<'a, 'b> {
    pub market: &'a mut Market,
    pub mempool: &'a mut Mempool,
    pub future: &'a Future,
    pub board: &'a mut Board,
    pub vaults: &'a mut [&'b mut LeakVault],
    pub seats: &'a mut [&'b mut Seat],
    pub tape: &'a mut Tape,
    pub xray: &'a mut Xray,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct StepReport {
    pub fills: u8,
    pub carried: u8,
    pub minted: u8,
    pub expired: u8,
    pub liquidated: u8,
    pub closed_out: bool,
}

/// Processes one tick: orders, arbitrage, history, drops, auctions, liquidations, and closeout.
/// Phase changes remain in `tick::advance_ticks`.
pub fn step(table: &Table, tick: u16, accounts: &mut StepAccounts) -> Result<StepReport> {
    require!(
        accounts.seats.len() == SEAT_COUNT && accounts.vaults.len() == LEAK_SLOTS,
        InsiderError::InvalidSeat
    );
    let mut report = StepReport::default();
    let mut mature = [0usize; MEMPOOL_SLOTS];
    let mut count = 0;
    for (index, order) in accounts.mempool.orders.iter().enumerate() {
        if !order.is_empty() && order.land_tick <= tick {
            mature[count] = index;
            count += 1;
        }
    }
    mature[..count].sort_unstable_by_key(|&i| {
        let order = accounts.mempool.orders[i];
        (order.land_tick, order.seq)
    });
    report.carried = count.saturating_sub(MAX_FILLS_PER_TICK) as u8;
    let mut vamm = Vamm {
        base: accounts.market.base,
        quote: accounts.market.quote,
    };
    for index in mature[..count.min(MAX_FILLS_PER_TICK)].iter().copied() {
        let order = accounts.mempool.orders[index];
        let seat_index = usize::from(order.seat);
        if order.seat != WHALE_SEAT {
            require!(seat_index < SEAT_COUNT, InsiderError::InvalidSeat);
        }
        accounts.mempool.orders[index] = PendingOrder::default();
        accounts.mempool.count = accounts.mempool.count.saturating_sub(1);
        if order.seat != WHALE_SEAT {
            let seat = &mut accounts.seats[seat_index];
            seat.pending_count = seat.pending_count.saturating_sub(1);
            if accounts.market.liquidated_mask & (1 << seat_index) != 0 {
                continue;
            }
        }
        let fill = vamm.apply_fill(order.side_size, table.params.fee_bps)?;
        if order.seat != WHALE_SEAT {
            apply_seat_fill(accounts.seats[seat_index], order.side_size, fill)?;
            accounts.seats[seat_index].last_seen_tick = tick;
        }
        accounts.tape.push_fill(Fill {
            seat: order.seat,
            side: order.side_size.signum() as i8,
            size: fill.units as u16,
            price: fill.avg_price,
            landed_tick: tick,
        });
        if usize::from(accounts.xray.order_count) < XRAY_ORDERS {
            accounts.xray.orders[usize::from(accounts.xray.order_count)] = XrayOrder {
                seat: order.seat,
                lane: order.lane,
                side_size: order.side_size,
                sent_tick: order.sent_tick(&table.params),
                land_tick: order.land_tick,
                fill_price: fill.avg_price,
            };
            accounts.xray.order_count += 1;
        } else {
            accounts.xray.dropped_orders = accounts.xray.dropped_orders.saturating_add(1);
        }
        accounts.market.volume = accounts
            .market
            .volume
            .checked_add(u64::from(fill.units))
            .ok_or(InsiderError::Overflow)?;
        report.fills += 1;
    }
    arb_pull(
        &mut vamm,
        accounts.future.path[usize::from(tick).min(PATH_LEN - 1)],
        table.params.arb_bps,
    )?;
    accounts.market.base = vamm.base;
    accounts.market.quote = vamm.quote;
    accounts.market.price = vamm.price();
    accounts.market.last_tick = tick;
    if usize::from(tick) < PATH_LEN {
        accounts.market.history[usize::from(tick)] = accounts.market.price;
    }

    let drop_index = usize::from(accounts.board.drop_index);
    if drop_index < DROPS_PER_ROUND && accounts.mempool.drops[drop_index].tick == tick {
        accounts.board.drop_index += 1;
        let live = accounts
            .board
            .headers
            .iter()
            .filter(|h| {
                matches!(
                    LeakState::from_u8(h.state),
                    LeakState::Auction | LeakState::Owned | LeakState::Listed | LeakState::Opened
                )
            })
            .count();
        let slot = accounts.board.headers.iter().position(|h| {
            h.state == LeakState::Empty as u8
                || (h.state == LeakState::Expired as u8 && h.reader_count == 0)
        });
        if live < MAX_LIVE_LEAKS {
            if let Some(slot) = slot {
                let spec = accounts.mempool.drops[drop_index];
                let leak_id = accounts.board.next_leak_id;
                accounts.board.next_leak_id =
                    leak_id.checked_add(1).ok_or(InsiderError::Overflow)?;
                let vault = &mut accounts.vaults[slot];
                vault.leak_id = leak_id;
                vault.round_id = table.round_id;
                vault.slot = slot as u8;
                build_payload(&spec, tick, accounts.mempool, accounts.future, vault);
                let (window_start, window_end) = payload_window(&spec, tick, vault);
                let rarity = Rarity::from_u8(spec.rarity);
                accounts.board.headers[slot] = LeakHeader {
                    leak_id,
                    kind: spec.kind,
                    rarity: spec.rarity,
                    state: LeakState::Auction as u8,
                    owner_seat: NO_SEAT,
                    window_start,
                    window_end,
                    minted_tick: tick,
                    auction_start: tick,
                    start_price: rarity.start_price(),
                    floor_price: rarity.floor_price(),
                    ..LeakHeader::default()
                };
                report.minted += 1;
            }
        }
    }
    for header in &mut accounts.board.headers {
        let expired = match LeakState::from_u8(header.state) {
            LeakState::Auction => auction_over(header.auction_start, tick),
            LeakState::Owned | LeakState::Listed | LeakState::Opened => tick > header.window_end,
            _ => false,
        };
        if expired {
            header.state = LeakState::Expired as u8;
            report.expired += 1;
        }
    }
    for (i, seat) in accounts.seats.iter_mut().enumerate() {
        if seat.is_free() || accounts.market.liquidated_mask & (1 << i) != 0 {
            continue;
        }
        let value =
            i128::from(seat.position) * i128::from(accounts.market.price) / i128::from(PRICE_ONE);
        if i128::from(seat.chips) + value <= 0 {
            close_position(seat, accounts.market.price)?;
            accounts.market.liquidated_mask |= 1 << i;
            report.liquidated += 1;
            for order in &mut accounts.mempool.orders {
                if !order.is_empty() && usize::from(order.seat) == i {
                    *order = PendingOrder::default();
                    accounts.mempool.count = accounts.mempool.count.saturating_sub(1);
                }
            }
            seat.pending_count = 0;
        }
    }
    if tick == CLOSING_END_TICK {
        for seat in accounts.seats.iter_mut() {
            close_position(seat, accounts.market.price)?;
            seat.pending_count = 0;
        }
        accounts.mempool.orders.fill(PendingOrder::default());
        accounts.mempool.count = 0;
        report.closed_out = true;
    }
    Ok(report)
}

fn apply_seat_fill(seat: &mut Seat, size: i16, fill: FillQuote) -> Result<()> {
    let quote = i128::from(fill.quote);
    let fee = i128::from(fill.fee);
    let cash = if size > 0 { -quote - fee } else { quote - fee };
    let chips = i64::try_from(i128::from(seat.chips) + cash).map_err(|_| InsiderError::Overflow)?;
    let old = seat.position;
    let new = old
        .checked_add(i32::from(size))
        .ok_or(InsiderError::Overflow)?;
    let entry = if new == 0 {
        0
    } else if old == 0 || old.signum() != new.signum() {
        u64::from(fill.avg_price)
    } else if old.signum() == i32::from(size).signum() {
        let weighted = u128::from(seat.entry) * u128::from(old.unsigned_abs())
            + u128::from(fill.avg_price) * u128::from(size.unsigned_abs());
        u64::try_from(weighted / u128::from(new.unsigned_abs()))
            .map_err(|_| InsiderError::Overflow)?
    } else {
        seat.entry
    };
    seat.chips = chips;
    seat.position = new;
    seat.entry = entry;
    seat.fees_paid = seat
        .fees_paid
        .checked_add(fill.fee)
        .ok_or(InsiderError::Overflow)?;
    Ok(())
}

fn close_position(seat: &mut Seat, price: u32) -> Result<()> {
    let value = i128::from(seat.position) * i128::from(price) / i128::from(PRICE_ONE);
    seat.chips =
        i64::try_from(i128::from(seat.chips) + value).map_err(|_| InsiderError::Overflow)?;
    seat.position = 0;
    seat.entry = 0;
    Ok(())
}

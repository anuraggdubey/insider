use anchor_lang::prelude::{require, Result};

use crate::{
    error::InsiderError,
    math::{seed::seed_round, vamm::Vamm},
    state::{
        Board, Future, LeakHeader, Market, Mempool, PendingOrder, SandwichTag, Table, Xray,
        XrayOrder,
    },
    NO_SEAT,
};

/// Resets round state, seeds the future, and schedules whales and drops.
pub fn begin_round(
    table: &Table,
    randomness: &[u8; 32],
    market: &mut Market,
    mempool: &mut Mempool,
    future: &mut Future,
    board: &mut Board,
    xray: &mut Xray,
) -> Result<()> {
    require!(
        board.headers.iter().all(|header| header.reader_count == 0),
        InsiderError::WrongPhase
    );
    market.round_id = table.round_id;
    market.base = table.params.vamm_base;
    market.quote = table.params.vamm_quote;
    market.price = Vamm {
        base: market.base,
        quote: market.quote,
    }
    .price();
    market.last_tick = 0;
    market.volume = 0;
    market.liquidated_mask = 0;
    market.history.fill(0);
    market.history[0] = market.price;
    mempool.round_id = table.round_id;
    mempool.orders.fill(PendingOrder::default());
    mempool.count = 0;
    mempool.next_seq = 0;
    future.round_id = table.round_id;
    let seed = seed_round(randomness, future);
    mempool.drops = seed.drops;
    for mut whale in seed.whales[..usize::from(seed.whale_count)].iter().copied() {
        whale.seq = mempool.next_seq;
        mempool.orders[usize::from(mempool.count)] = whale;
        mempool.count += 1;
        mempool.next_seq = mempool.next_seq.wrapping_add(1);
    }
    board.round_id = table.round_id;
    board.drop_index = 0;
    for header in &mut board.headers {
        *header = LeakHeader {
            owner_seat: NO_SEAT,
            ..LeakHeader::default()
        };
    }
    xray.round_id = table.round_id;
    xray.order_count = 0;
    xray.dropped_orders = 0;
    xray.leak_count = 0;
    xray.tag_count = 0;
    xray.finalized = 0;
    xray.orders.fill(XrayOrder::default());
    for leak in &mut xray.leaks {
        *leak = bytemuck::Zeroable::zeroed();
    }
    xray.tags.fill(SandwichTag::default());
    Ok(())
}

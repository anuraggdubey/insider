use anchor_lang::prelude::Result;

use crate::state::{Board, Future, Market, Mempool, Table, Xray};

/// Resets round state, seeds the future, and schedules whales and drops.
pub fn begin_round(
    _table: &Table,
    _randomness: &[u8; 32],
    _market: &mut Market,
    _mempool: &mut Mempool,
    _future: &mut Future,
    _board: &mut Board,
    _xray: &mut Xray,
) -> Result<()> {
    todo!()
}

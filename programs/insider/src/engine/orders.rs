use anchor_lang::prelude::Result;

use crate::state::{Mempool, Params, PendingOrder, Seat};

pub fn push_order(
    _params: &Params,
    _tick: u16,
    _seat: &mut Seat,
    _mempool: &mut Mempool,
    _side_size: i16,
    _lane: u8,
) -> Result<PendingOrder> {
    todo!()
}

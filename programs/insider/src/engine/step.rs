use anchor_lang::prelude::Result;

use crate::state::{Board, Future, LeakVault, Market, Mempool, Seat, Table, Tape, Xray};

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
pub fn step(_table: &Table, _tick: u16, _accounts: &mut StepAccounts) -> Result<StepReport> {
    todo!()
}

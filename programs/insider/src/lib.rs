#![allow(ambiguous_glob_reexports)]

pub mod constants;
pub mod engine;
pub mod error;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub use constants::*;
pub use instructions::*;
pub use state::*;

// New game program ID (the Phase 2 lab program 5Tbt... stays deployed on devnet, tagged phase-2-lab).
declare_id!("7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW");

#[ephemeral]
#[program]
pub mod insider {
    use super::*;

    // Setup (base layer)
    pub fn init_table(ctx: Context<InitTable>, params: Option<Params>) -> Result<()> {
        setup::init_table(ctx, params)
    }

    pub fn init_tape(ctx: Context<InitTape>) -> Result<()> {
        setup::init_tape(ctx)
    }

    pub fn init_call_book(ctx: Context<InitCallBook>) -> Result<()> {
        setup::init_call_book(ctx)
    }

    pub fn init_season(ctx: Context<InitSeason>) -> Result<()> {
        setup::init_season(ctx)
    }

    pub fn init_seat(ctx: Context<InitSeat>, index: u8) -> Result<()> {
        setup::init_seat(ctx, index)
    }

    pub fn delegate_table(ctx: Context<DelegateTable>) -> Result<()> {
        setup::delegate_table(ctx)
    }

    pub fn delegate_tape(ctx: Context<DelegateTape>) -> Result<()> {
        setup::delegate_tape(ctx)
    }

    pub fn delegate_call_book(ctx: Context<DelegateCallBook>) -> Result<()> {
        setup::delegate_call_book(ctx)
    }

    pub fn delegate_season(ctx: Context<DelegateSeason>) -> Result<()> {
        setup::delegate_season(ctx)
    }

    pub fn delegate_seat(ctx: Context<DelegateSeat>, index: u8) -> Result<()> {
        setup::delegate_seat(ctx, index)
    }

    // Automation (rollup)
    pub fn schedule_ticks<'info>(
        ctx: Context<'info, ScheduleTicks<'info>>,
        task_id: i64,
        interval_millis: i64,
        iterations: i64,
    ) -> Result<()> {
        cranks::schedule_ticks(ctx, task_id, interval_millis, iterations)
    }

    pub fn rearm_ticks<'info>(
        ctx: Context<'info, ScheduleTicks<'info>>,
        task_id: i64,
        interval_millis: i64,
        iterations: i64,
    ) -> Result<()> {
        cranks::rearm_ticks(ctx, task_id, interval_millis, iterations)
    }

    pub fn tick(ctx: Context<TickAccounts>) -> Result<()> {
        tick::tick(ctx)
    }

    // Orders (Misbah)
    pub fn send_order(ctx: Context<SendOrder>, index: u8, side_size: i16, lane: u8) -> Result<()> {
        orders::send_order(ctx, index, side_size, lane)
    }

    // Leaks (Misbah)
    pub fn bid(ctx: Context<LeakAction>, index: u8, slot: u8) -> Result<()> {
        leaks::bid(ctx, index, slot)
    }

    pub fn open_leak(ctx: Context<OpenLeak>, index: u8, slot: u8) -> Result<()> {
        leaks::open_leak(ctx, index, slot)
    }

    pub fn list_leak(ctx: Context<LeakAction>, index: u8, slot: u8, ask: u32) -> Result<()> {
        leaks::list_leak(ctx, index, slot, ask)
    }

    pub fn buy_listed(ctx: Context<BuyListed>, index: u8, slot: u8, seller_index: u8) -> Result<()> {
        leaks::buy_listed(ctx, index, slot, seller_index)
    }

    pub fn offer_license(ctx: Context<LeakAction>, index: u8, slot: u8, ask: u32) -> Result<()> {
        licenses::offer_license(ctx, index, slot, ask)
    }

    pub fn buy_license(ctx: Context<BuyLicense>, index: u8, slot: u8, owner_index: u8) -> Result<()> {
        licenses::buy_license(ctx, index, slot, owner_index)
    }

    pub fn finish_round(ctx: Context<FinishRound>) -> Result<()> {
        finish_round::finish_round(ctx)
    }

    pub fn reseal_leaks<'info>(
        ctx: Context<'info, ResealLeaks<'info>>,
        slot_from: u8,
        slot_to: u8,
    ) -> Result<()> {
        finish_round::reseal_leaks(ctx, slot_from, slot_to)
    }

    // Seats (rollup)
    pub fn claim_seat(ctx: Context<ClaimSeat>, index: u8) -> Result<()> {
        seats::claim_seat(ctx, index)
    }

    pub fn ping(ctx: Context<Ping>, index: u8) -> Result<()> {
        seats::ping(ctx, index)
    }
}

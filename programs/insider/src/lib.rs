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

    pub fn init_market(ctx: Context<InitMarket>, kind: u8) -> Result<()> {
        engine_setup::init_market(ctx, kind)
    }

    pub fn init_mempool(ctx: Context<InitMempool>) -> Result<()> {
        engine_setup::init_mempool(ctx)
    }

    pub fn init_future(ctx: Context<InitFuture>) -> Result<()> {
        engine_setup::init_future(ctx)
    }

    pub fn init_board(ctx: Context<InitBoard>) -> Result<()> {
        engine_setup::init_board(ctx)
    }

    pub fn init_xray(ctx: Context<InitXray>) -> Result<()> {
        engine_setup::init_xray(ctx)
    }

    pub fn init_leak_vault(ctx: Context<InitLeakVault>, slot: u8) -> Result<()> {
        engine_setup::init_leak_vault(ctx, slot)
    }

    pub fn delegate_market(ctx: Context<DelegateMarket>, kind: u8) -> Result<()> {
        engine_setup::delegate_market(ctx, kind)
    }

    pub fn delegate_mempool(ctx: Context<DelegateMempool>) -> Result<()> {
        engine_setup::delegate_mempool(ctx)
    }

    pub fn delegate_future(ctx: Context<DelegateFuture>) -> Result<()> {
        engine_setup::delegate_future(ctx)
    }

    pub fn delegate_board(ctx: Context<DelegateBoard>) -> Result<()> {
        engine_setup::delegate_board(ctx)
    }

    pub fn delegate_xray(ctx: Context<DelegateXray>) -> Result<()> {
        engine_setup::delegate_xray(ctx)
    }

    pub fn delegate_leak_vault(ctx: Context<DelegateLeakVault>, slot: u8) -> Result<()> {
        engine_setup::delegate_leak_vault(ctx, slot)
    }

    // Permissions (rollup)
    pub fn init_permission(ctx: Context<InitPermission>, target: u8, slot: u8) -> Result<()> {
        engine_setup::init_permission(ctx, target, slot)
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

    // Desk
    pub fn mint_call(
        ctx: Context<MintCall>,
        index: u8,
        direction: i8,
        horizon: u16,
        stake: u64,
        license_ask: u64,
        confidence: u8,
    ) -> Result<()> {
        desk::mint_call(ctx, index, direction, horizon, stake, license_ask, confidence)
    }

    pub fn buy_call_license(
        ctx: Context<BuyCallLicense>,
        index: u8,
        author_index: u8,
    ) -> Result<()> {
        desk::buy_call_license(ctx, index, author_index)
    }

    pub fn settle_call(ctx: Context<SettleCall>, author_index: u8) -> Result<()> {
        desk::settle_call(ctx, author_index)
    }

    pub fn desk_trade(ctx: Context<DeskTrade>, index: u8, size: i16) -> Result<()> {
        desk::desk_trade(ctx, index, size)
    }

    pub fn init_call_vault(ctx: Context<InitCallVault>, slot: u8) -> Result<()> {
        engine_setup::init_call_vault(ctx, slot)
    }

    pub fn delegate_call_vault(ctx: Context<DelegateCallVault>, slot: u8) -> Result<()> {
        engine_setup::delegate_call_vault(ctx, slot)
    }

    // Alpha Cup
    pub fn init_cup(ctx: Context<InitCup>) -> Result<()> {
        instructions::cup::init_cup(ctx)
    }

    pub fn delegate_cup(ctx: Context<DelegateCup>) -> Result<()> {
        instructions::cup::delegate_cup(ctx)
    }

    pub fn cup_join(ctx: Context<CupJoin>, index: u8) -> Result<()> {
        instructions::cup::cup_join(ctx, index)
    }

    pub fn cup_record(ctx: Context<CupRecord>) -> Result<()> {
        instructions::cup::cup_record(ctx)
    }

    pub fn cup_settle(ctx: Context<CupSettle>) -> Result<()> {
        instructions::cup::cup_settle(ctx)
    }

    pub fn cup_close(ctx: Context<CupClose>) -> Result<()> {
        instructions::cup::cup_close(ctx)
    }

    // Recovery
    pub fn teardown<'info>(
        ctx: Context<'info, Teardown<'info>>,
        kinds: Vec<u8>,
        slots: Vec<u8>,
        force: bool,
    ) -> Result<()> {
        instructions::recovery::teardown(ctx, kinds, slots, force)
    }

    pub fn request_undelegation(ctx: Context<Recover>, kind: u8, slot: u8) -> Result<()> {
        instructions::recovery::request_undelegation(ctx, kind, slot)
    }

    pub fn rollback_undelegation(ctx: Context<Recover>, kind: u8, slot: u8) -> Result<()> {
        instructions::recovery::rollback_undelegation(ctx, kind, slot)
    }

    // Epoch
    pub fn commit_epoch(ctx: Context<CommitEpoch>) -> Result<()> {
        epoch::commit_epoch(ctx)
    }

    pub fn open_epoch(ctx: Context<OpenEpoch>) -> Result<()> {
        epoch::open_epoch(ctx)
    }

    // Round seed (VRF)
    pub fn request_round_seed(ctx: Context<RequestRoundSeed>) -> Result<()> {
        round_seed::request_round_seed(ctx)
    }

    pub fn round_seed_callback(
        ctx: Context<RoundSeedCallback>,
        randomness: [u8; 32],
    ) -> Result<()> {
        round_seed::round_seed_callback(ctx, randomness)
    }

    pub fn cancel_vrf(ctx: Context<CancelVrf>) -> Result<()> {
        round_seed::cancel_vrf(ctx)
    }

    pub fn tick<'info>(ctx: Context<'info, TickAccounts<'info>>) -> Result<()> {
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

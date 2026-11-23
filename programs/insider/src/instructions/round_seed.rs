//! The VRF round seed: `request_round_seed` (table `Idle`), `round_seed_callback` (the oracle's
//! answer starts the round through `engine::begin_round`) and `cancel_vrf` (stuck request).
//!
//! The table sits in `Seeding` between request and callback. Ticks do not run then, so the
//! timeout is measured on the rollup clock, not on `table.tick`: `vrf_requested_tick` holds
//! `slot / SLOTS_PER_TICK` truncated to 16 bits and `cancel_vrf` compares with wrapping maths.
#![allow(deprecated)]

use anchor_lang::{prelude::*, Discriminator};
use ephemeral_rollups_sdk::{
    anchor::{vrf, vrf_callback},
    vrf::{
        self,
        consts::program_identity_pubkey,
        instructions::{create_request_randomness_ix_const, RequestRandomnessParams},
        types::SerializableAccountMeta,
    },
};

use crate::{
    engine::round::begin_round,
    error::InsiderError,
    state::{Board, Future, Market, Mempool, Phase, Table, Xray},
    BOARD_SEED, FUTURE_SEED, MARKET_FLOOR, MARKET_SEED, MEMPOOL_SEED, SLOTS_PER_TICK, XRAY_SEED,
    VRF_TIMEOUT_TICKS,
};

const PROGRAM_IDENTITY: Pubkey = program_identity_pubkey(&crate::ID);
/// Compile-time scoped VRF identity (docs/phase-2-findings.md: SDK 0.18 burns ~270k CU otherwise).
const SCOPED_VRF_IDENTITY: Pubkey =
    Pubkey::new_from_array(vrf::consts::scoped_vrf_identity_const(&crate::ID).0);

/// The rollup clock in ticks, truncated to 16 bits (wraps after about nine hours).
pub fn wall_tick(slot: u64) -> u16 {
    ((slot / SLOTS_PER_TICK) & 0xFFFF) as u16
}

/// True once `VRF_TIMEOUT_TICKS` of rollup time passed since the request.
pub fn vrf_timed_out(requested: u16, slot: u64) -> bool {
    wall_tick(slot).wrapping_sub(requested) >= VRF_TIMEOUT_TICKS
}

#[vrf]
#[derive(Accounts)]
pub struct RequestRoundSeed<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub table: Box<Account<'info, Table>>,
    #[account(seeds = [BOARD_SEED, table.key().as_ref()], bump = board.load()?.bump)]
    pub board: AccountLoader<'info, Board>,
    #[account(seeds = [XRAY_SEED, table.key().as_ref()], bump = xray.load()?.bump)]
    pub xray: AccountLoader<'info, Xray>,
    #[account(seeds = [MARKET_SEED, table.key().as_ref(), &[MARKET_FLOOR]], bump = market.load()?.bump)]
    pub market: AccountLoader<'info, Market>,
    #[account(seeds = [MEMPOOL_SEED, table.key().as_ref()], bump = mempool.load()?.bump)]
    pub mempool: AccountLoader<'info, Mempool>,
    #[account(seeds = [FUTURE_SEED, table.key().as_ref()], bump = future.load()?.bump)]
    pub future: AccountLoader<'info, Future>,
    /// CHECK: VRF oracle queue; restricted to the known queues.
    #[account(
        mut,
        constraint = oracle_queue.key() == vrf::consts::DEFAULT_QUEUE
            || oracle_queue.key() == vrf::consts::DEFAULT_EPHEMERAL_QUEUE
            || oracle_queue.key() == vrf::consts::DEFAULT_TEST_QUEUE
            || oracle_queue.key() == vrf::consts::DEFAULT_EPHEMERAL_TEST_QUEUE,
    )]
    pub oracle_queue: UncheckedAccount<'info>,
}

/// Starts the next round. Anyone may call it while the table is `Idle` and the last round has been
/// scored (`finish_round`) and resealed (`reseal_leaks`), so a stray call only starts the round
/// everybody is waiting for.
pub fn request_round_seed(ctx: Context<RequestRoundSeed>) -> Result<()> {
    let table = &mut ctx.accounts.table;
    require!(table.phase == Phase::Idle, InsiderError::WrongPhase);
    require!(!table.vrf_pending, InsiderError::VrfPending);
    if table.round_id > 0 {
        let xray = ctx.accounts.xray.load()?;
        let board = ctx.accounts.board.load()?;
        require!(
            xray.round_id == table.round_id
                && xray.finalized != 0
                && board.headers.iter().all(|header| header.reader_count == 0),
            InsiderError::RoundNotClosed
        );
    }
    let slot = Clock::get()?.slot;
    table.phase = Phase::Seeding;
    table.vrf_pending = true;
    table.vrf_nonce = table.vrf_nonce.wrapping_add(1);
    table.vrf_requested_tick = wall_tick(slot);

    let mut caller_seed = [0u8; 32];
    caller_seed[..4].copy_from_slice(&table.vrf_nonce.to_le_bytes());
    caller_seed[4..8].copy_from_slice(&table.round_id.to_le_bytes());
    let meta = |pubkey: Pubkey| SerializableAccountMeta {
        pubkey,
        is_signer: false,
        is_writable: true,
    };
    let ix = create_request_randomness_ix_const(
        RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::RoundSeedCallback::DISCRIMINATOR.to_vec(),
            caller_seed,
            accounts_metas: Some(vec![
                meta(table.key()),
                meta(ctx.accounts.market.key()),
                meta(ctx.accounts.mempool.key()),
                meta(ctx.accounts.future.key()),
                meta(ctx.accounts.board.key()),
                meta(ctx.accounts.xray.key()),
            ]),
            callback_args: None,
        },
        PROGRAM_IDENTITY,
    );
    // the table was edited through the typed account above; the CPI does not touch it
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    Ok(())
}

#[vrf_callback]
#[derive(Accounts)]
pub struct RoundSeedCallback<'info> {
    #[account(address = SCOPED_VRF_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [MARKET_SEED, table.key().as_ref(), &[MARKET_FLOOR]], bump = market.load()?.bump)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut, seeds = [MEMPOOL_SEED, table.key().as_ref()], bump = mempool.load()?.bump)]
    pub mempool: AccountLoader<'info, Mempool>,
    #[account(mut, seeds = [FUTURE_SEED, table.key().as_ref()], bump = future.load()?.bump)]
    pub future: AccountLoader<'info, Future>,
    #[account(mut, seeds = [BOARD_SEED, table.key().as_ref()], bump = board.load()?.bump)]
    pub board: AccountLoader<'info, Board>,
    #[account(mut, seeds = [XRAY_SEED, table.key().as_ref()], bump = xray.load()?.bump)]
    pub xray: AccountLoader<'info, Xray>,
}

/// The oracle's answer: seeds the future, the whales and the drop schedule, then the round is
/// `Live` from tick 0 at the current rollup slot.
pub fn round_seed_callback(ctx: Context<RoundSeedCallback>, randomness: [u8; 32]) -> Result<()> {
    let table = &mut ctx.accounts.table;
    require!(
        table.phase == Phase::Seeding && table.vrf_pending,
        InsiderError::NoVrfPending
    );
    table.round_id = table
        .round_id
        .checked_add(1)
        .ok_or(InsiderError::Overflow)?;
    begin_round(
        table,
        &randomness,
        &mut *ctx.accounts.market.load_mut()?,
        &mut *ctx.accounts.mempool.load_mut()?,
        &mut *ctx.accounts.future.load_mut()?,
        &mut *ctx.accounts.board.load_mut()?,
        &mut *ctx.accounts.xray.load_mut()?,
    )?;
    table.round_start_slot = Clock::get()?.slot;
    table.tick = 0;
    table.phase = Phase::Live;
    table.vrf_pending = false;
    Ok(())
}

#[derive(Accounts)]
pub struct CancelVrf<'info> {
    pub payer: Signer<'info>,
    #[account(mut)]
    pub table: Box<Account<'info, Table>>,
}

/// Frees a table whose seed request never came back.
pub fn cancel_vrf(ctx: Context<CancelVrf>) -> Result<()> {
    let table = &mut ctx.accounts.table;
    require!(
        table.phase == Phase::Seeding && table.vrf_pending,
        InsiderError::NoVrfPending
    );
    require!(
        vrf_timed_out(table.vrf_requested_tick, Clock::get()?.slot),
        InsiderError::VrfNotTimedOut
    );
    table.phase = Phase::Idle;
    table.vrf_pending = false;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timeout_uses_the_rollup_clock_and_survives_wraparound() {
        let requested = wall_tick(10 * SLOTS_PER_TICK);
        assert!(!vrf_timed_out(requested, (10 + VRF_TIMEOUT_TICKS as u64 - 1) * SLOTS_PER_TICK));
        assert!(vrf_timed_out(requested, (10 + VRF_TIMEOUT_TICKS as u64) * SLOTS_PER_TICK));
        // the 16-bit counter wraps: a request just before the wrap still times out after it
        let before = wall_tick(65_535 * SLOTS_PER_TICK);
        assert!(!vrf_timed_out(before, 65_536 * SLOTS_PER_TICK));
        assert!(vrf_timed_out(before, (65_535 + VRF_TIMEOUT_TICKS as u64) * SLOTS_PER_TICK));
    }
}

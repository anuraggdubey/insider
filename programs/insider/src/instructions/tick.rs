//! The `tick` crank target. Clock-derived and idempotent (gate G9): the tick comes from the
//! rollup slot (gate G1, `SLOTS_PER_TICK`), so late, duplicate or stale crank calls are harmless.

use anchor_lang::prelude::*;

use crate::{
    constants::CRANK_PROGRAM_ID,
    error::InsiderError,
    engine::{self, step::StepAccounts},
    state::{Board, Future, LeakVault, Market, Mempool, Phase, Seat, Table, Tape, Xray},
    BOARD_SEED, FUTURE_SEED, LEAK_SEED, LEAK_SLOTS, MARKET_FLOOR, MARKET_SEED, MAX_CATCH_UP_TICKS,
    MEMPOOL_SEED, ROUND_TICKS, SEAT_COUNT, SEAT_SEED, TAPE_SEED, XRAY_SEED,
};

/// The only signer the crank scheduler adds to a scheduled instruction: a PDA of the crank
/// program derived from the account that scheduled the task.
pub fn crank_signer_pda(scheduler: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"crank-executor", scheduler.as_ref()], &CRANK_PROGRAM_ID).0
}

/// Result of one `advance_ticks` call.
#[derive(Debug, PartialEq, Eq)]
pub struct Advance {
    /// Ticks processed by this call (0 for a duplicate or early call).
    pub processed: u16,
    /// True when this call moved the table past the last tick of the round.
    pub round_over: bool,
}

/// Moves the table forward to the tick derived from `slot`, at most `MAX_CATCH_UP_TICKS` per call.
/// `on_tick` runs once per processed tick, in order: this is where `engine::step` plugs in.
/// Calling it again with the same slot does nothing.
pub fn advance_ticks(
    table: &mut Table,
    slot: u64,
    mut on_tick: impl FnMut(&Table, u16) -> Result<()>,
) -> Result<Advance> {
    if !matches!(table.phase, Phase::Live | Phase::Closing | Phase::Xray) {
        return Ok(Advance {
            processed: 0,
            round_over: false,
        });
    }
    let target = table.derived_tick(slot);
    let behind = target.saturating_sub(table.tick);
    let steps = behind.min(MAX_CATCH_UP_TICKS);
    let mut processed = 0u16;
    let mut round_over = false;
    for _ in 0..steps {
        let next = table.tick + 1;
        on_tick(table, next)?;
        table.tick = next;
        processed += 1;
        match Phase::for_tick(next) {
            Some(phase) => table.phase = phase,
            None => {
                table.phase = Phase::Idle;
                table.rounds_this_epoch = table.rounds_this_epoch.saturating_add(1);
                round_over = true;
                break;
            }
        }
    }
    debug_assert!(table.tick <= ROUND_TICKS);
    Ok(Advance {
        processed,
        round_over,
    })
}

/// Named accounts of one tick. The six vaults and ten seats follow as remaining accounts: a
/// struct with all 26 does not fit the SBF stack frame when Anchor deserialises it.
///
/// The scheduler lists these after `[table, scheduler, crank_signer]` (see `cranks.rs`), in exactly
/// this order, so the order is part of the client contract: market, mempool, future, board, xray,
/// tape, then vault 0..5, then seat 0..9.
#[derive(Accounts)]
pub struct TickAccounts<'info> {
    #[account(mut)]
    pub table: Box<Account<'info, Table>>,
    /// The account that scheduled the crank task, or any caller.
    /// CHECK: unused. Kept so the account order stays stable for existing tasks and clients.
    pub scheduler: UncheckedAccount<'info>,
    /// Validator 2.0 (Hydra) rejects signer metas in scheduled instructions, so `tick` is
    /// permissionless: it is clock-derived and idempotent, so any caller only advances the table to
    /// where the rollup clock already says it is.
    /// CHECK: unused. Kept so the account order stays stable for existing tasks and clients.
    pub crank_signer: UncheckedAccount<'info>,
    #[account(mut, seeds = [MARKET_SEED, table.key().as_ref(), &[MARKET_FLOOR]], bump = market.load()?.bump)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut, seeds = [MEMPOOL_SEED, table.key().as_ref()], bump = mempool.load()?.bump)]
    pub mempool: AccountLoader<'info, Mempool>,
    #[account(seeds = [FUTURE_SEED, table.key().as_ref()], bump = future.load()?.bump)]
    pub future: AccountLoader<'info, Future>,
    #[account(mut, seeds = [BOARD_SEED, table.key().as_ref()], bump = board.load()?.bump)]
    pub board: AccountLoader<'info, Board>,
    #[account(mut, seeds = [XRAY_SEED, table.key().as_ref()], bump = xray.load()?.bump)]
    pub xray: AccountLoader<'info, Xray>,
    #[account(mut, seeds = [TAPE_SEED, table.key().as_ref()], bump = tape.bump)]
    pub tape: Box<Account<'info, Tape>>,
}

/// A leak vault passed as a remaining account: owned by this program, writable and at the PDA of
/// its slot. The stored bump makes the check one hash instead of a bump search.
fn checked_vault<'info>(
    info: &'info AccountInfo<'info>,
    table: &Pubkey,
    slot: usize,
) -> Result<AccountLoader<'info, LeakVault>> {
    require!(info.is_writable, InsiderError::InvalidEngineAccount);
    let loader = AccountLoader::<LeakVault>::try_from(info)?;
    let bump = loader.load()?.bump;
    let expected = Pubkey::create_program_address(
        &[LEAK_SEED, table.as_ref(), &[slot as u8], &[bump]],
        &crate::ID,
    )
    .map_err(|_| error!(InsiderError::InvalidEngineAccount))?;
    require_keys_eq!(info.key(), expected, InsiderError::InvalidEngineAccount);
    Ok(loader)
}

/// A seat passed as a remaining account, checked the same way.
fn checked_seat<'info>(
    info: &'info AccountInfo<'info>,
    table: &Pubkey,
    index: usize,
) -> Result<Account<'info, Seat>> {
    require!(info.is_writable, InsiderError::InvalidEngineAccount);
    let seat = Account::<Seat>::try_from(info)?;
    let expected = Pubkey::create_program_address(
        &[SEAT_SEED, table.as_ref(), &[index as u8], &[seat.bump]],
        &crate::ID,
    )
    .map_err(|_| error!(InsiderError::InvalidEngineAccount))?;
    require_keys_eq!(info.key(), expected, InsiderError::InvalidEngineAccount);
    Ok(seat)
}

/// Scheduled by `schedule_ticks` and `rearm_ticks`: runs `engine::step` once for every tick the
/// rollup clock has passed (at most `MAX_CATCH_UP_TICKS`), then moves the phase.
pub fn tick<'info>(ctx: Context<'info, TickAccounts<'info>>) -> Result<()> {
    let slot = Clock::get()?.slot;
    let remaining = ctx.remaining_accounts;
    let accounts = ctx.accounts;
    require!(
        remaining.len() == LEAK_SLOTS + SEAT_COUNT,
        InsiderError::InvalidEngineAccount
    );
    if !matches!(
        accounts.table.phase,
        Phase::Live | Phase::Closing | Phase::Xray
    ) {
        return Ok(());
    }
    let table_key = accounts.table.key();
    let vault_loaders = remaining[..LEAK_SLOTS]
        .iter()
        .enumerate()
        .map(|(slot, info)| checked_vault(info, &table_key, slot))
        .collect::<Result<Vec<_>>>()?;
    let mut seat_accounts = remaining[LEAK_SLOTS..]
        .iter()
        .enumerate()
        .map(|(index, info)| checked_seat(info, &table_key, index))
        .collect::<Result<Vec<_>>>()?;

    {
        let mut market = accounts.market.load_mut()?;
        let mut mempool = accounts.mempool.load_mut()?;
        let future = accounts.future.load()?;
        let mut board = accounts.board.load_mut()?;
        let mut xray = accounts.xray.load_mut()?;
        let mut vault_guards = vault_loaders
            .iter()
            .map(|loader| loader.load_mut())
            .collect::<Result<Vec<_>>>()?;
        let mut vaults: Vec<&mut LeakVault> = vault_guards.iter_mut().map(|g| &mut **g).collect();
        let mut seats: Vec<&mut Seat> = seat_accounts.iter_mut().map(|a| &mut **a).collect();
        let mut step_accounts = StepAccounts {
            market: &mut market,
            mempool: &mut mempool,
            future: &future,
            board: &mut board,
            vaults: &mut vaults,
            seats: &mut seats,
            tape: &mut accounts.tape,
            xray: &mut xray,
        };
        advance_ticks(&mut accounts.table, slot, |table, tick| {
            engine::step::step(table, tick, &mut step_accounts)?;
            Ok(())
        })?;
    }
    // remaining accounts are not written back by Anchor's exit
    for seat in &seat_accounts {
        seat.exit(&crate::ID)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::Params;

    fn live_table(start_slot: u64) -> Table {
        Table {
            authority: Pubkey::new_unique(),
            epoch: 0,
            round_id: 1,
            phase: Phase::Live,
            round_start_slot: start_slot,
            tick: 0,
            armed_until_slot: 0,
            vrf_nonce: 0,
            vrf_pending: false,
            vrf_requested_tick: 0,
            rounds_this_epoch: 0,
            params: Params::default(),
            bump: 0,
        }
    }

    const STEP: u64 = crate::SLOTS_PER_TICK;

    #[test]
    fn advances_to_the_derived_tick() {
        let mut table = live_table(1_000);
        let mut seen = vec![];
        let advance = advance_ticks(&mut table, 1_000 + 3 * STEP, |_, t| {
            seen.push(t);
            Ok(())
        })
        .unwrap();
        assert_eq!(advance.processed, 3);
        assert_eq!(table.tick, 3);
        assert_eq!(seen, vec![1, 2, 3]);
    }

    #[test]
    fn duplicate_and_early_calls_are_no_ops() {
        let mut table = live_table(1_000);
        advance_ticks(&mut table, 1_000 + 5 * STEP, |_, _| Ok(())).unwrap();
        let mut calls = 0;
        // the same slot again (a duplicate crank task)
        let again = advance_ticks(&mut table, 1_000 + 5 * STEP, |_, _| {
            calls += 1;
            Ok(())
        })
        .unwrap();
        assert_eq!(again.processed, 0);
        // an older slot (a stale call)
        let stale = advance_ticks(&mut table, 1_000 + 2 * STEP, |_, _| {
            calls += 1;
            Ok(())
        })
        .unwrap();
        assert_eq!(stale.processed, 0);
        assert_eq!(calls, 0);
        assert_eq!(table.tick, 5);
    }

    #[test]
    fn catch_up_is_bounded_per_call() {
        let mut table = live_table(0);
        let far = 100 * STEP;
        let first = advance_ticks(&mut table, far, |_, _| Ok(())).unwrap();
        assert_eq!(first.processed, MAX_CATCH_UP_TICKS);
        assert_eq!(table.tick, MAX_CATCH_UP_TICKS);
        // repeated calls keep catching up, never overshooting the derived tick
        for _ in 0..20 {
            advance_ticks(&mut table, far, |_, _| Ok(())).unwrap();
        }
        assert_eq!(table.tick, 100);
    }

    #[test]
    fn phases_change_on_schedule_and_the_round_ends_idle() {
        let mut table = live_table(0);
        let mut slot = 0;
        let mut phases = vec![];
        while table.phase != Phase::Idle {
            slot += STEP;
            advance_ticks(&mut table, slot, |_, _| Ok(())).unwrap();
            if phases.last() != Some(&table.phase) {
                phases.push(table.phase);
            }
        }
        assert_eq!(
            phases,
            vec![Phase::Live, Phase::Closing, Phase::Xray, Phase::Idle]
        );
        assert_eq!(table.tick, ROUND_TICKS);
        assert_eq!(table.rounds_this_epoch, 1);
    }

    #[test]
    fn nothing_happens_outside_a_round() {
        for phase in [Phase::Idle, Phase::Seeding] {
            let mut table = live_table(0);
            table.phase = phase;
            let advance = advance_ticks(&mut table, 50 * STEP, |_, _| Ok(())).unwrap();
            assert_eq!(advance.processed, 0);
            assert_eq!(table.tick, 0);
        }
    }

    #[test]
    fn the_engine_hook_runs_once_per_tick_in_order() {
        let mut table = live_table(0);
        let mut order = vec![];
        advance_ticks(&mut table, 8 * STEP, |_, t| {
            order.push(t);
            Ok(())
        })
        .unwrap();
        assert_eq!(order, (1..=8).collect::<Vec<u16>>());
    }

    #[test]
    fn crank_signer_depends_on_the_scheduler() {
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        assert_ne!(crank_signer_pda(&a), crank_signer_pda(&b));
        assert_eq!(crank_signer_pda(&a), crank_signer_pda(&a));
    }
}

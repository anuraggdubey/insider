//! The `tick` crank target. Clock-derived and idempotent (gate G9): the tick comes from the
//! rollup slot (gate G1, `SLOTS_PER_TICK`), so late, duplicate or stale crank calls are harmless.

use anchor_lang::prelude::*;

use crate::{
    constants::CRANK_PROGRAM_ID,
    state::{Phase, Table},
    MAX_CATCH_UP_TICKS, ROUND_TICKS,
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

#[derive(Accounts)]
pub struct TickAccounts<'info> {
    #[account(mut)]
    pub table: Account<'info, Table>,
    /// The account that scheduled the crank task. Any key may schedule (`rearm_ticks` is
    /// permissionless); the signer below proves the call came from the scheduler.
    /// CHECK: only used to derive the expected crank signer.
    pub scheduler: UncheckedAccount<'info>,
    #[account(address = crank_signer_pda(&scheduler.key()))]
    pub crank_signer: Signer<'info>,
}

/// Scheduled by `schedule_ticks` and `rearm_ticks`. Engine accounts (market, mempool, future,
/// board, vaults) arrive as remaining accounts once the engine is wired.
pub fn tick(ctx: Context<TickAccounts>) -> Result<()> {
    let slot = Clock::get()?.slot;
    advance_ticks(&mut ctx.accounts.table, slot, |_table, _tick| {
        // engine::step(...) is called here (handoff H-API).
        Ok(())
    })?;
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

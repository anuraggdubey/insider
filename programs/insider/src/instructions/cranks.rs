//! Crank scheduling. The TEE cannot cancel a task (Phase 2 D), so the table schedules finite
//! tasks and `rearm_ticks` is permissionless: any seat keeps the crank alive. Duplicate tasks are
//! harmless because `tick` is time-gated (gate G9).
#![allow(deprecated)]

use anchor_lang::{
    prelude::*,
    solana_program::instruction::{AccountMeta, Instruction},
    InstructionData,
};
use ephemeral_rollups_sdk::{
    consts::MAGIC_PROGRAM_ID,
    crank::{ScheduleCrankCpi, ScheduleTaskArgs},
};

use crate::{
    error::InsiderError,
    instructions::tick::crank_signer_pda,
    state::Table,
    REARM_WINDOW_TICKS, SLOTS_PER_TICK, TABLE_SEED, TICK_MILLIS,
};

/// Longest finite task one call may schedule (10 minutes of ticks).
pub const MAX_TASK_ITERATIONS: i64 = 1_200;

/// Accounts shared by `schedule_ticks` and `rearm_ticks`. Clients pass
/// `[payer, magic_program, table, ...engine accounts]` again as remaining accounts: the SDK's
/// crank CPI borrows `AccountInfo<'a>`, which only the long-lived remaining accounts satisfy.
#[derive(Accounts)]
pub struct ScheduleTicks<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table; read and updated by hand so Anchor does not re-serialise stale data
    /// after the scheduler CPI.
    #[account(mut)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: fixed Magic program address.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

fn schedule<'info>(
    ctx: &Context<'info, ScheduleTicks<'info>>,
    task_id: i64,
    interval_millis: i64,
    iterations: i64,
    authority_only: bool,
) -> Result<()> {
    require!(
        interval_millis >= TICK_MILLIS && (1..=MAX_TASK_ITERATIONS).contains(&iterations),
        InsiderError::NotRearmable
    );
    let [payer, magic_program, table, extras @ ..] = ctx.remaining_accounts else {
        return err!(ErrorCode::AccountNotEnoughKeys);
    };
    require_keys_eq!(payer.key(), ctx.accounts.payer.key());
    require_keys_eq!(magic_program.key(), ctx.accounts.magic_program.key());
    require_keys_eq!(table.key(), ctx.accounts.table.key());

    // read and update the table before the CPI
    let slot = Clock::get()?.slot;
    {
        let mut data = table.try_borrow_mut_data()?;
        let mut state = Table::try_deserialize(&mut &data[..])?;
        require_keys_eq!(
            table.key(),
            Pubkey::find_program_address(&[TABLE_SEED, state.authority.as_ref()], &crate::ID).0
        );
        if authority_only {
            require_keys_eq!(payer.key(), state.authority, InsiderError::NotAuthority);
        } else {
            // permissionless, but only when the armed window is about to run out
            let window = REARM_WINDOW_TICKS * SLOTS_PER_TICK;
            require!(
                state.armed_until_slot <= slot.saturating_add(window),
                InsiderError::NotRearmable
            );
        }
        let covered = (iterations as u64)
            .saturating_mul(interval_millis as u64)
            .saturating_mul(SLOTS_PER_TICK)
            / TICK_MILLIS as u64;
        state.armed_until_slot = state.armed_until_slot.max(slot).saturating_add(covered);
        state.try_serialize(&mut &mut data[..])?;
    }

    let mut metas = vec![
        AccountMeta::new(table.key(), false),
        AccountMeta::new_readonly(payer.key(), false),
        AccountMeta::new_readonly(crank_signer_pda(&payer.key()), true),
    ];
    for extra in extras {
        metas.push(AccountMeta {
            pubkey: extra.key(),
            is_signer: false,
            is_writable: extra.is_writable,
        });
    }
    let tick_ix = Instruction {
        program_id: crate::ID,
        accounts: metas,
        data: crate::instruction::Tick {}.data(),
    };

    ScheduleCrankCpi {
        payer,
        magic_program,
        instruction_accounts: &ctx.remaining_accounts[2..],
        args: ScheduleTaskArgs {
            task_id,
            execution_interval_millis: interval_millis,
            iterations,
            instructions: vec![tick_ix],
        },
    }
    .invoke()?;
    Ok(())
}

/// Authority only: the first arming at setup.
pub fn schedule_ticks<'info>(
    ctx: Context<'info, ScheduleTicks<'info>>,
    task_id: i64,
    interval_millis: i64,
    iterations: i64,
) -> Result<()> {
    schedule(&ctx, task_id, interval_millis, iterations, true)
}

/// Anyone: extends the crank once less than `REARM_WINDOW_TICKS` of it remain.
pub fn rearm_ticks<'info>(
    ctx: Context<'info, ScheduleTicks<'info>>,
    task_id: i64,
    interval_millis: i64,
    iterations: i64,
) -> Result<()> {
    schedule(&ctx, task_id, interval_millis, iterations, false)
}

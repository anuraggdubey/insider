#![allow(deprecated)]

use anchor_lang::{
    prelude::*,
    solana_program::instruction::{AccountMeta, Instruction},
    InstructionData,
};
use ephemeral_rollups_sdk::{
    consts::MAGIC_PROGRAM_ID,
    crank::{CancelCrankCpi, ScheduleCrankCpi, ScheduleTaskArgs},
};

use crate::{
    constants::{LAB_SEED, TASK_CONTEXT_ID},
    instructions::lab_tick::crank_signer_pda,
};

/// Runs inside the rollup: asks the crank scheduler to call `lab_tick` on an interval.
///
/// The SDK's crank CPI structs borrow `&'a AccountInfo<'a>`, which only the long-lived
/// `remaining_accounts` can satisfy. Clients therefore pass `[authority, magic_program, lab]`
/// again as remaining accounts; they are checked against the typed accounts below.
#[derive(Accounts)]
pub struct LabScheduleTick<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: the lab PDA; unchecked so Anchor does not re-serialise stale data after the CPI.
    #[account(mut, seeds = [LAB_SEED, authority.key().as_ref()], bump)]
    pub lab: UncheckedAccount<'info>,
    /// CHECK: fixed Magic program address.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

pub fn schedule_handler<'info>(
    ctx: Context<'info, LabScheduleTick<'info>>,
    task_id: i64,
    interval_millis: i64,
    iterations: i64,
) -> Result<()> {
    let [authority, magic_program, lab, ..] = ctx.remaining_accounts else {
        return err!(ErrorCode::AccountNotEnoughKeys);
    };
    require_keys_eq!(authority.key(), ctx.accounts.authority.key());
    require_keys_eq!(magic_program.key(), ctx.accounts.magic_program.key());
    require_keys_eq!(lab.key(), ctx.accounts.lab.key());

    let tick_ix = Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new(lab.key(), false),
            AccountMeta::new_readonly(crank_signer_pda(&authority.key()), true),
        ],
        data: crate::instruction::LabTick {}.data(),
    };

    ScheduleCrankCpi {
        payer: authority,
        magic_program,
        instruction_accounts: std::slice::from_ref(lab),
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

/// Runs inside the rollup: cancels a scheduled task owned by the signer. Clients pass
/// `[authority, task_context, magic_program]` again as remaining accounts.
#[derive(Accounts)]
pub struct LabCancelTick<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: the scheduler's task context account.
    #[account(mut, address = TASK_CONTEXT_ID)]
    pub task_context: UncheckedAccount<'info>,
    /// CHECK: fixed Magic program address.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

pub fn cancel_handler<'info>(
    ctx: Context<'info, LabCancelTick<'info>>,
    task_id: i64,
) -> Result<()> {
    let [authority, task_context, magic_program, ..] = ctx.remaining_accounts else {
        return err!(ErrorCode::AccountNotEnoughKeys);
    };
    require_keys_eq!(authority.key(), ctx.accounts.authority.key());
    require_keys_eq!(task_context.key(), ctx.accounts.task_context.key());
    require_keys_eq!(magic_program.key(), ctx.accounts.magic_program.key());

    CancelCrankCpi {
        authority,
        task_context,
        magic_program,
        crank_id: task_id,
    }
    .invoke()?;
    Ok(())
}

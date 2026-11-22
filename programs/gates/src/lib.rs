//! Throwaway probe program for the Block 0 gates (G0-G10).
//!
//! One `Probe` account is created, delegated to the TEE and poked by the gate scripts. It is
//! deleted from the repo once every gate has a result; the game program never depends on it.
#![allow(deprecated)]

use anchor_lang::{
    prelude::*,
    solana_program::instruction::{AccountMeta, Instruction},
    system_program::{transfer, Transfer},
    Discriminator, InstructionData,
};
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::{
            CloseEphemeralPermissionCpi, CreateEphemeralPermissionCpi, UpdateEphemeralPermissionCpi,
        },
        structs::{EphemeralMembersArgs, EphemeralPermission, Member, PERMISSION_SEED},
    },
    anchor::{commit, delegate, ephemeral, vrf, vrf_callback},
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    cpi::DelegateConfig,
    crank::{ScheduleCrankCpi, ScheduleTaskArgs},
    ephem::MagicIntentBundleBuilder,
    ephemeral_accounts,
    vrf::{
        self,
        consts::program_identity_pubkey,
        instructions::{create_request_randomness_ix_const, RequestRandomnessParams},
        types::SerializableAccountMeta,
    },
};

declare_id!("3h7wNZEN4hqcwwCh5KfmrXaq74PXuKKCJ8xgdGDA4wa8");

pub const PROBE_SEED: &[u8] = b"probe";
pub const MAX_MEMBERS: usize = 4;
pub const CRANK_PROGRAM_ID: Pubkey = pubkey!("Crank11111111111111111111111111111111111111");
pub const PRICING_ORACLE_ID: Pubkey = pubkey!("PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd");

const PROGRAM_IDENTITY: Pubkey = program_identity_pubkey(&crate::ID);
/// Compile-time scoped VRF identity (see docs/phase-2-findings.md, SDK 0.18 gotcha).
const SCOPED_VRF_IDENTITY: Pubkey =
    Pubkey::new_from_array(vrf::consts::scoped_vrf_identity_const(&crate::ID).0);

#[error_code]
pub enum GateError {
    #[msg("Oracle account has the wrong owner")]
    BadOracleOwner,
    #[msg("Oracle account is too small")]
    OracleTooSmall,
    #[msg("Too many permission members")]
    TooManyMembers,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct TickRecord {
    pub slot: u64,
    pub unix_timestamp: i64,
}

#[account]
#[derive(InitSpace)]
pub struct Probe {
    pub authority: Pubkey,
    /// G0: written by `send_secret`.
    pub secret: i16,
    pub sends: u32,
    pub last_sender: Pubkey,
    /// G1 / G9: every crank invocation, and the ones that advanced the gate.
    pub calls: u32,
    pub ticks: u32,
    pub gate_slot: u64,
    pub log_len: u32,
    pub log: [TickRecord; 16],
    /// G4: last decoded oracle price.
    pub oracle_price: i64,
    pub oracle_publish_time: i64,
    pub oracle_posted_slot: u64,
    pub oracle_clock: i64,
    /// G10 / VRF.
    pub vrf_pending: bool,
    pub vrf_calls: u32,
    pub vrf_out: [u8; 32],
    pub bump: u8,
}

pub fn crank_signer_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"crank-executor", authority.as_ref()], &CRANK_PROGRAM_ID).0
}

#[ephemeral]
#[program]
pub mod gates {
    use super::*;

    /// Base layer: create the probe and pre-fund its permission rent.
    pub fn probe_init(ctx: Context<ProbeInit>) -> Result<()> {
        let rent = ephemeral_accounts::rent(EphemeralPermission::size_of(MAX_MEMBERS) as u32);
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.probe.to_account_info(),
                },
            ),
            rent,
        )?;
        let probe = &mut ctx.accounts.probe;
        probe.authority = ctx.accounts.authority.key();
        probe.bump = ctx.bumps.probe;
        Ok(())
    }

    /// Base layer: delegate to the validator passed as the first remaining account.
    pub fn probe_delegate(ctx: Context<ProbeDelegate>) -> Result<()> {
        let validator = ctx.remaining_accounts.first().map(|a| a.key());
        ctx.accounts.delegate_probe(
            &ctx.accounts.payer,
            &[PROBE_SEED, ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn probe_permission_create(
        ctx: Context<ProbePermission>,
        is_private: bool,
        members: Vec<Member>,
    ) -> Result<()> {
        require!(members.len() <= MAX_MEMBERS, GateError::TooManyMembers);
        if ctx.accounts.permission.owner == &PERMISSION_PROGRAM_ID
            && !ctx.accounts.permission.data_is_empty()
        {
            return Ok(());
        }
        let bump = [ctx.accounts.probe.bump];
        let seeds: [&[u8]; 3] = [PROBE_SEED, ctx.accounts.probe.authority.as_ref(), &bump];
        CreateEphemeralPermissionCpi {
            payer: ctx.accounts.probe.to_account_info(),
            permissioned_account: ctx.accounts.probe.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: EphemeralMembersArgs {
                is_private,
                members,
            },
        }
        .invoke_signed(&[&seeds])?;
        Ok(())
    }

    pub fn probe_permission_update(
        ctx: Context<ProbePermission>,
        is_private: bool,
        members: Vec<Member>,
    ) -> Result<()> {
        require!(members.len() <= MAX_MEMBERS, GateError::TooManyMembers);
        let bump = [ctx.accounts.probe.bump];
        let seeds: [&[u8]; 3] = [PROBE_SEED, ctx.accounts.probe.authority.as_ref(), &bump];
        UpdateEphemeralPermissionCpi {
            payer: ctx.accounts.probe.to_account_info(),
            permissioned_account: ctx.accounts.probe.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            authority: ctx.accounts.probe.to_account_info(),
            authority_is_signer: false,
            args: EphemeralMembersArgs {
                is_private,
                members,
            },
        }
        .invoke_signed(&[&seeds])?;
        Ok(())
    }

    pub fn probe_permission_close(ctx: Context<ProbePermission>) -> Result<()> {
        let bump = [ctx.accounts.probe.bump];
        let seeds: [&[u8]; 3] = [PROBE_SEED, ctx.accounts.probe.authority.as_ref(), &bump];
        CloseEphemeralPermissionCpi {
            payer: ctx.accounts.probe.to_account_info(),
            permissioned_account: ctx.accounts.probe.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            authority: ctx.accounts.probe.to_account_info(),
            authority_is_signer: false,
        }
        .invoke_signed(&[&seeds])?;
        Ok(())
    }

    /// G0: any signer writes a side-and-size into the (private) probe. Emits no logs.
    pub fn probe_send_secret(ctx: Context<ProbeSendSecret>, side_size: i16) -> Result<()> {
        let probe = &mut ctx.accounts.probe;
        probe.secret = side_size;
        probe.sends = probe.sends.wrapping_add(1);
        probe.last_sender = ctx.accounts.sender.key();
        Ok(())
    }

    /// G3: a signer-only instruction that touches no account.
    pub fn probe_ping(_ctx: Context<ProbePing>) -> Result<()> {
        Ok(())
    }

    /// G1 / G9: crank target. Records the clock; only advances when `min_slots` have passed since
    /// the last effective tick, so duplicate or late calls are harmless.
    pub fn probe_tick(ctx: Context<ProbeTick>, min_slots: u64) -> Result<()> {
        let clock = Clock::get()?;
        let probe = &mut ctx.accounts.probe;
        probe.calls = probe.calls.wrapping_add(1);
        if clock.slot >= probe.gate_slot.saturating_add(min_slots) {
            probe.gate_slot = clock.slot;
            probe.ticks = probe.ticks.wrapping_add(1);
            let index = (probe.log_len as usize) % probe.log.len();
            probe.log[index] = TickRecord {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
            };
            probe.log_len = probe.log_len.wrapping_add(1);
        }
        Ok(())
    }

    /// Rollup: schedule `target` ("tick" or "vrf") on an interval. Clients pass
    /// `[authority, magic_program, probe]` again as remaining accounts (SDK lifetime quirk).
    pub fn probe_schedule<'info>(
        ctx: Context<'info, ProbeSchedule<'info>>,
        task_id: i64,
        interval_millis: i64,
        iterations: i64,
        min_slots: u64,
        target_vrf: bool,
    ) -> Result<()> {
        let [authority, magic_program, probe, ..] = ctx.remaining_accounts else {
            return err!(ErrorCode::AccountNotEnoughKeys);
        };
        require_keys_eq!(authority.key(), ctx.accounts.authority.key());
        require_keys_eq!(magic_program.key(), ctx.accounts.magic_program.key());
        require_keys_eq!(probe.key(), ctx.accounts.probe.key());

        let crank_signer = crank_signer_pda(&authority.key());
        let (ix, accounts): (Instruction, Vec<AccountInfo<'info>>) = if target_vrf {
            let queue = ctx
                .remaining_accounts
                .get(3)
                .ok_or(ErrorCode::AccountNotEnoughKeys)?;
            (
                Instruction {
                    program_id: crate::ID,
                    accounts: vec![
                        AccountMeta::new(crank_signer, true),
                        AccountMeta::new(probe.key(), false),
                        AccountMeta::new(queue.key(), false),
                    ],
                    data: instruction::ProbeRequestVrf { client_seed: 7 }.data(),
                },
                vec![probe.clone(), queue.clone()],
            )
        } else {
            (
                Instruction {
                    program_id: crate::ID,
                    accounts: vec![
                        AccountMeta::new(probe.key(), false),
                        AccountMeta::new_readonly(crank_signer, true),
                    ],
                    data: instruction::ProbeTick { min_slots }.data(),
                },
                vec![probe.clone()],
            )
        };
        ScheduleCrankCpi {
            payer: authority,
            magic_program,
            instruction_accounts: &accounts,
            args: ScheduleTaskArgs {
                task_id,
                execution_interval_millis: interval_millis,
                iterations,
                instructions: vec![ix],
            },
        }
        .invoke()?;
        Ok(())
    }

    /// G4: decode a price feed account inside the rollup and store it in the probe.
    pub fn probe_read_oracle(ctx: Context<ProbeReadOracle>) -> Result<()> {
        let feed = &ctx.accounts.feed;
        require_keys_eq!(*feed.owner, PRICING_ORACLE_ID, GateError::BadOracleOwner);
        let data = feed.try_borrow_data()?;
        let price = decode_price_update(&data).ok_or(GateError::OracleTooSmall)?;
        let probe = &mut ctx.accounts.probe;
        probe.oracle_price = price.price;
        probe.oracle_publish_time = price.publish_time;
        probe.oracle_posted_slot = price.posted_slot;
        probe.oracle_clock = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// VRF request. Signed by a wallet (direct call) or by the crank signer PDA (G10).
    pub fn probe_request_vrf(ctx: Context<ProbeRequestVrf>, client_seed: u8) -> Result<()> {
        let probe_key = ctx.accounts.probe.key();
        ctx.accounts.probe.vrf_pending = true;
        let ix = create_request_randomness_ix_const(
            RequestRandomnessParams {
                payer: ctx.accounts.payer.key(),
                oracle_queue: ctx.accounts.oracle_queue.key(),
                callback_program_id: crate::ID,
                callback_discriminator: instruction::ProbeVrfCallback::DISCRIMINATOR.to_vec(),
                caller_seed: [client_seed; 32],
                accounts_metas: Some(vec![SerializableAccountMeta {
                    pubkey: probe_key,
                    is_signer: false,
                    is_writable: true,
                }]),
                callback_args: None,
            },
            PROGRAM_IDENTITY,
        );
        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    pub fn probe_vrf_callback(ctx: Context<ProbeVrfCallback>, randomness: [u8; 32]) -> Result<()> {
        let probe = &mut ctx.accounts.probe;
        probe.vrf_pending = false;
        probe.vrf_out = randomness;
        probe.vrf_calls = probe.vrf_calls.wrapping_add(1);
        Ok(())
    }

    /// G8: commit without undelegating.
    pub fn probe_commit(ctx: Context<ProbeCommit>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.probe.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// G8: commit and return the account to the base layer.
    pub fn probe_undelegate(ctx: Context<ProbeUndelegate>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.probe.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

pub struct PriceFields {
    pub price: i64,
    pub publish_time: i64,
    pub posted_slot: u64,
}

/// Decodes the Pyth-compatible `PriceUpdateV2/V3` layout the pricing oracle writes:
/// discriminator 8, write_authority 32, verification_level (1 byte when `Full`, else 2),
/// then feed_id 32, price i64, conf u64, exponent i32, publish_time i64, prev_publish_time i64,
/// ema_price i64, ema_conf u64, posted_slot u64.
pub fn decode_price_update(data: &[u8]) -> Option<PriceFields> {
    let mut offset = 8 + 32;
    let level_tag = *data.get(offset)?;
    offset += if level_tag == 0 { 2 } else { 1 };
    offset += 32; // feed_id
    let price = i64::from_le_bytes(data.get(offset..offset + 8)?.try_into().ok()?);
    offset += 8 + 8 + 4; // price, conf, exponent
    let publish_time = i64::from_le_bytes(data.get(offset..offset + 8)?.try_into().ok()?);
    offset += 8 + 8 + 8 + 8; // publish_time, prev_publish_time, ema_price, ema_conf
    let posted_slot = u64::from_le_bytes(data.get(offset..offset + 8)?.try_into().ok()?);
    Some(PriceFields {
        price,
        publish_time,
        posted_slot,
    })
}

#[derive(Accounts)]
pub struct ProbeInit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Probe::INIT_SPACE,
        seeds = [PROBE_SEED, authority.key().as_ref()],
        bump,
    )]
    pub probe: Account<'info, Probe>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct ProbeDelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the probe PDA being delegated; the Delegation Program validates the seeds.
    #[account(mut, del, seeds = [PROBE_SEED, payer.key().as_ref()], bump)]
    pub probe: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ProbePermission<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [PROBE_SEED, probe.authority.as_ref()],
        bump = probe.bump,
        has_one = authority,
    )]
    pub probe: Account<'info, Probe>,
    /// CHECK: derived and checked under the Permission Program.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, probe.key().as_ref()],
        bump,
        seeds::program = permission_program.key(),
    )]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed Permission Program address.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed ephemeral vault address.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed Magic program address.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ProbeSendSecret<'info> {
    pub sender: Signer<'info>,
    #[account(mut)]
    pub probe: Account<'info, Probe>,
}

#[derive(Accounts)]
pub struct ProbePing<'info> {
    pub sender: Signer<'info>,
}

#[derive(Accounts)]
pub struct ProbeTick<'info> {
    #[account(mut)]
    pub probe: Account<'info, Probe>,
    #[account(address = crank_signer_pda(&probe.authority))]
    pub crank_signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct ProbeSchedule<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: the probe PDA; unchecked so Anchor does not re-serialise stale data after the CPI.
    #[account(mut, seeds = [PROBE_SEED, authority.key().as_ref()], bump)]
    pub probe: UncheckedAccount<'info>,
    /// CHECK: fixed Magic program address.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ProbeReadOracle<'info> {
    #[account(mut)]
    pub probe: Account<'info, Probe>,
    /// CHECK: owner and layout are validated in the handler.
    pub feed: UncheckedAccount<'info>,
}

#[vrf]
#[derive(Accounts)]
pub struct ProbeRequestVrf<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PROBE_SEED, probe.authority.as_ref()], bump = probe.bump)]
    pub probe: Account<'info, Probe>,
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

#[vrf_callback]
#[derive(Accounts)]
pub struct ProbeVrfCallback<'info> {
    #[account(address = SCOPED_VRF_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub probe: Account<'info, Probe>,
}

#[commit]
#[derive(Accounts)]
pub struct ProbeCommit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PROBE_SEED, payer.key().as_ref()], bump = probe.bump)]
    pub probe: Account<'info, Probe>,
}

#[commit]
#[derive(Accounts)]
pub struct ProbeUndelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PROBE_SEED, payer.key().as_ref()], bump = probe.bump)]
    pub probe: Account<'info, Probe>,
}

use anchor_lang::{prelude::*, Discriminator};
use ephemeral_rollups_sdk::{
    access_control::structs::PERMISSION_SEED,
    anchor::vrf,
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    vrf::{
        self,
        consts::program_identity_pubkey,
        instructions::{create_request_randomness_ix_const, RequestRandomnessParams},
        types::SerializableAccountMeta,
    },
};

use crate::{constants::LAB_SEED, error::InsiderError, state::Lab};

const PROGRAM_IDENTITY: Pubkey = program_identity_pubkey(&crate::ID);

/// Requests randomness whose callback also rewrites the lab's private permission, so that only
/// the wallet picked by the VRF can read the lab afterwards. Runs inside the TEE rollup.
#[vrf]
#[derive(Accounts)]
pub struct LabRequestPick<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [LAB_SEED, payer.key().as_ref()], bump = lab.bump)]
    pub lab: Account<'info, Lab>,
    /// CHECK: derived and checked under the Permission Program.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, lab.key().as_ref()],
        bump,
        seeds::program = PERMISSION_PROGRAM_ID,
    )]
    pub permission: UncheckedAccount<'info>,
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

pub fn handler(ctx: Context<LabRequestPick>, client_seed: u8) -> Result<()> {
    let lab_key = ctx.accounts.lab.key();
    {
        let lab = &mut ctx.accounts.lab;
        require!(!lab.pending, InsiderError::RollPending);
        lab.pending = true;
    }

    let writable = |pubkey: Pubkey| SerializableAccountMeta {
        pubkey,
        is_signer: false,
        is_writable: true,
    };
    let readonly = |pubkey: Pubkey| SerializableAccountMeta {
        pubkey,
        is_signer: false,
        is_writable: false,
    };

    let ix = create_request_randomness_ix_const(
        RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::LabPickCallback::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            // Order must match the accounts of `LabPickCallback` after the VRF identity.
            accounts_metas: Some(vec![
                writable(lab_key),
                writable(ctx.accounts.permission.key()),
                readonly(PERMISSION_PROGRAM_ID),
                writable(EPHEMERAL_VAULT_ID),
                readonly(MAGIC_PROGRAM_ID),
            ]),
            callback_args: None,
        },
        PROGRAM_IDENTITY,
    );
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    Ok(())
}

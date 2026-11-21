use anchor_lang::{prelude::*, Discriminator};
use ephemeral_rollups_sdk::{
    anchor::vrf,
    vrf::{
        self,
        consts::program_identity_pubkey,
        instructions::{create_request_randomness_ix_const, RequestRandomnessParams},
        types::SerializableAccountMeta,
    },
};

use crate::{constants::LAB_SEED, error::InsiderError, state::Lab};

const PROGRAM_IDENTITY: Pubkey = program_identity_pubkey(&crate::ID);

/// Runs on the base layer (default queue) or inside an ER (delegated ephemeral queue).
#[vrf]
#[derive(Accounts)]
pub struct LabRequestRoll<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [LAB_SEED, payer.key().as_ref()], bump = lab.bump)]
    pub lab: Account<'info, Lab>,
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

pub fn handler(ctx: Context<LabRequestRoll>, client_seed: u8) -> Result<()> {
    let lab_key = ctx.accounts.lab.key();
    {
        let lab = &mut ctx.accounts.lab;
        require!(!lab.pending, InsiderError::RollPending);
        lab.pending = true;
    }

    let ix = create_request_randomness_ix_const(
        RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::LabRollCallback::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: lab_key,
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

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::UpdateEphemeralPermissionCpi,
        structs::{EphemeralMembersArgs, Member, TX_BALANCES_FLAG, TX_LOGS_FLAG, TX_MESSAGE_FLAG},
    },
    anchor::vrf_callback,
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    vrf,
};

use crate::{
    constants::{LAB_MAX_CANDIDATES, LAB_SEED},
    error::InsiderError,
    state::Lab,
};

/// Compile-time scoped VRF identity; see `lab_roll_callback` for why this is declared here.
const SCOPED_VRF_IDENTITY: Pubkey =
    Pubkey::new_from_array(vrf::consts::scoped_vrf_identity_const(&crate::ID).0);

const READER_FLAGS: u8 = TX_LOGS_FLAG | TX_BALANCES_FLAG | TX_MESSAGE_FLAG;

/// VRF callback that picks the reader and makes the lab private to that wallet alone.
#[vrf_callback]
#[derive(Accounts)]
pub struct LabPickCallback<'info> {
    #[account(address = SCOPED_VRF_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub lab: Account<'info, Lab>,
    /// CHECK: fixed by the request.
    #[account(mut)]
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

pub fn handler(ctx: Context<LabPickCallback>, randomness: [u8; 32]) -> Result<()> {
    let (reader, authority, bump) = {
        let lab = &mut ctx.accounts.lab;
        require!(lab.pending, InsiderError::NoRollPending);

        let index = vrf::rnd::random_u8_with_range(&randomness, 0, (LAB_MAX_CANDIDATES - 1) as u8);
        lab.randomness = randomness;
        lab.reader = lab.candidates[index as usize];
        lab.pending = false;
        lab.rolls = lab.rolls.checked_add(1).ok_or(InsiderError::Overflow)?;
        (lab.reader, lab.authority, [lab.bump])
    };

    let seeds: [&[u8]; 3] = [LAB_SEED, authority.as_ref(), &bump];
    UpdateEphemeralPermissionCpi {
        payer: ctx.accounts.lab.to_account_info(),
        permissioned_account: ctx.accounts.lab.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        authority: ctx.accounts.lab.to_account_info(),
        authority_is_signer: false,
        args: EphemeralMembersArgs {
            is_private: true,
            members: vec![Member {
                flags: READER_FLAGS,
                pubkey: reader,
            }],
        },
    }
    .invoke_signed(&[&seeds])?;
    Ok(())
}

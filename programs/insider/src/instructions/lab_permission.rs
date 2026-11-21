use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::{
            CloseEphemeralPermissionCpi, CreateEphemeralPermissionCpi, UpdateEphemeralPermissionCpi,
        },
        structs::{EphemeralMembersArgs, Member, PERMISSION_SEED},
    },
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
};

use crate::{
    constants::{LAB_MAX_PERMISSION_MEMBERS, LAB_SEED},
    error::InsiderError,
    state::Lab,
};

/// Accounts shared by create, update and close. All three run inside the TEE rollup and are
/// signed by the lab PDA itself, authorised by the lab authority.
#[derive(Accounts)]
pub struct LabPermission<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [LAB_SEED, lab.authority.as_ref()],
        bump = lab.bump,
        has_one = authority,
    )]
    pub lab: Account<'info, Lab>,
    /// CHECK: derived and checked under the Permission Program.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, lab.key().as_ref()],
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

fn lab_signer_seeds<'a>(authority: &'a Pubkey, bump: &'a [u8; 1]) -> [&'a [u8]; 3] {
    [LAB_SEED, authority.as_ref(), bump]
}

/// Creates the lab's ephemeral permission. Idempotent: clients may retry ER transactions.
pub fn create_handler(
    ctx: Context<LabPermission>,
    is_private: bool,
    members: Vec<Member>,
) -> Result<()> {
    require!(
        members.len() <= LAB_MAX_PERMISSION_MEMBERS,
        InsiderError::TooManyMembers
    );
    if ctx.accounts.permission.owner == &PERMISSION_PROGRAM_ID
        && !ctx.accounts.permission.data_is_empty()
    {
        return Ok(());
    }

    let bump = [ctx.accounts.lab.bump];
    let seeds = lab_signer_seeds(&ctx.accounts.lab.authority, &bump);
    CreateEphemeralPermissionCpi {
        payer: ctx.accounts.lab.to_account_info(),
        permissioned_account: ctx.accounts.lab.to_account_info(),
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

/// Replaces the whole member list. Omitting a member revokes that member.
pub fn update_handler(
    ctx: Context<LabPermission>,
    is_private: bool,
    members: Vec<Member>,
) -> Result<()> {
    require!(
        members.len() <= LAB_MAX_PERMISSION_MEMBERS,
        InsiderError::TooManyMembers
    );

    let bump = [ctx.accounts.lab.bump];
    let seeds = lab_signer_seeds(&ctx.accounts.lab.authority, &bump);
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
            is_private,
            members,
        },
    }
    .invoke_signed(&[&seeds])?;
    Ok(())
}

/// Closes the permission and refunds its rent to the lab before the lab leaves the rollup.
pub fn close_handler(ctx: Context<LabPermission>) -> Result<()> {
    let bump = [ctx.accounts.lab.bump];
    let seeds = lab_signer_seeds(&ctx.accounts.lab.authority, &bump);
    CloseEphemeralPermissionCpi {
        payer: ctx.accounts.lab.to_account_info(),
        permissioned_account: ctx.accounts.lab.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        authority: ctx.accounts.lab.to_account_info(),
        authority_is_signer: false,
    }
    .invoke_signed(&[&seeds])?;
    Ok(())
}

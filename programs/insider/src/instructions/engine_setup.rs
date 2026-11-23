//! Setup for the engine accounts (Misbah's H-API types): `Market`, `Mempool`, `Future`, `Board`,
//! the six `LeakVault`s and `Xray`. Each has its own `init_*` (base layer) and `delegate_*`
//! instruction, plus `init_permission` (rollup) which makes the Mempool, the Future and the vaults
//! private to the keyless `nobody` member. They are never closed or made public during play.
//!
//! Rent for the permission account is pre-funded into the three private kinds at init time,
//! because the permission is created later, inside the rollup, from the account's own lamports.

use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::CreateEphemeralPermissionCpi,
        structs::{
            EphemeralMembersArgs, EphemeralPermission, Member, PERMISSION_SEED, TX_LOGS_FLAG,
        },
    },
    anchor::delegate,
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    cpi::DelegateConfig,
    ephemeral_accounts,
};

use crate::{
    error::InsiderError,
    state::{Board, Future, LeakVault, Market, Mempool, Table, Xray},
    BOARD_SEED, FUTURE_SEED, LEAK_READERS, LEAK_SEED, LEAK_SLOTS, MARKET_DESK, MARKET_FLOOR,
    MARKET_SEED, MEMPOOL_SEED, NOBODY_SEED, TABLE_SEED, XRAY_SEED,
};

/// Which private account `init_permission` protects.
pub const TARGET_MEMPOOL: u8 = 0;
pub const TARGET_FUTURE: u8 = 1;
pub const TARGET_VAULT: u8 = 2;

/// Lamports that must sit in a private account before delegation so its permission can be created.
pub fn permission_rent() -> u64 {
    ephemeral_accounts::rent(EphemeralPermission::size_of(LEAK_READERS) as u32)
}

fn prefund<'info>(
    authority: &Signer<'info>,
    target: AccountInfo<'info>,
    system_program: &Program<'info, System>,
) -> Result<()> {
    transfer(
        CpiContext::new(
            system_program.key(),
            Transfer {
                from: authority.to_account_info(),
                to: target,
            },
        ),
        permission_rent(),
    )
}


#[derive(Accounts)]
pub struct InitMempool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = Mempool::SPACE,
        seeds = [MEMPOOL_SEED, table.key().as_ref()],
        bump,
    )]
    pub mempool: AccountLoader<'info, Mempool>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitFuture<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = Future::SPACE,
        seeds = [FUTURE_SEED, table.key().as_ref()],
        bump,
    )]
    pub future: AccountLoader<'info, Future>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitBoard<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = Board::SPACE,
        seeds = [BOARD_SEED, table.key().as_ref()],
        bump,
    )]
    pub board: AccountLoader<'info, Board>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitXray<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = Xray::SPACE,
        seeds = [XRAY_SEED, table.key().as_ref()],
        bump,
    )]
    pub xray: AccountLoader<'info, Xray>,
    pub system_program: Program<'info, System>,
}

pub fn init_mempool(ctx: Context<InitMempool>) -> Result<()> {
    ctx.accounts.mempool.load_init()?.bump = ctx.bumps.mempool;
    prefund(
        &ctx.accounts.authority,
        ctx.accounts.mempool.to_account_info(),
        &ctx.accounts.system_program,
    )
}

pub fn init_future(ctx: Context<InitFuture>) -> Result<()> {
    ctx.accounts.future.load_init()?.bump = ctx.bumps.future;
    prefund(
        &ctx.accounts.authority,
        ctx.accounts.future.to_account_info(),
        &ctx.accounts.system_program,
    )
}

pub fn init_board(ctx: Context<InitBoard>) -> Result<()> {
    ctx.accounts.board.load_init()?.bump = ctx.bumps.board;
    Ok(())
}

pub fn init_xray(ctx: Context<InitXray>) -> Result<()> {
    ctx.accounts.xray.load_init()?.bump = ctx.bumps.xray;
    Ok(())
}

#[derive(Accounts)]
#[instruction(kind: u8)]
pub struct InitMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = Market::SPACE,
        seeds = [MARKET_SEED, table.key().as_ref(), &[kind]],
        bump,
    )]
    pub market: AccountLoader<'info, Market>,
    pub system_program: Program<'info, System>,
}

/// Creates the Floor (0) or Desk (1) market.
pub fn init_market(ctx: Context<InitMarket>, kind: u8) -> Result<()> {
    require!(
        kind == MARKET_FLOOR || kind == MARKET_DESK,
        InsiderError::InvalidMarket
    );
    let mut market = ctx.accounts.market.load_init()?;
    market.kind = kind;
    market.bump = ctx.bumps.market;
    Ok(())
}

#[derive(Accounts)]
#[instruction(slot: u8)]
pub struct InitLeakVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [TABLE_SEED, authority.key().as_ref()],
        bump = table.bump,
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    #[account(
        init,
        payer = authority,
        space = LeakVault::SPACE,
        seeds = [LEAK_SEED, table.key().as_ref(), &[slot]],
        bump,
    )]
    pub vault: AccountLoader<'info, LeakVault>,
    pub system_program: Program<'info, System>,
}

pub fn init_leak_vault(ctx: Context<InitLeakVault>, slot: u8) -> Result<()> {
    require!(usize::from(slot) < LEAK_SLOTS, InsiderError::InvalidLeakSlot);
    {
        let mut vault = ctx.accounts.vault.load_init()?;
        vault.slot = slot;
        vault.bump = ctx.bumps.vault;
    }
    prefund(
        &ctx.accounts.authority,
        ctx.accounts.vault.to_account_info(),
        &ctx.accounts.system_program,
    )
}

// ---- permissions (rollup) ----------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitPermission<'info> {
    pub authority: Signer<'info>,
    #[account(
        has_one = authority @ InsiderError::NotAuthority,
    )]
    pub table: Account<'info, Table>,
    /// CHECK: the mempool, future or vault; its key is derived and compared in the handler.
    #[account(mut)]
    pub target: UncheckedAccount<'info>,
    /// CHECK: PDA under the permission program.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, target.key().as_ref()],
        bump,
        seeds::program = permission_program.key(),
    )]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: fixed permission program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: fixed ephemeral vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: fixed Magic program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

/// Makes the mempool, the future or a vault private to the keyless `nobody` member. Idempotent.
pub fn init_permission(ctx: Context<InitPermission>, target: u8, slot: u8) -> Result<()> {
    let table_key = ctx.accounts.table.key();
    let slot_seed = [slot];
    let mut seeds: Vec<&[u8]> = match target {
        TARGET_MEMPOOL => vec![MEMPOOL_SEED, table_key.as_ref()],
        TARGET_FUTURE => vec![FUTURE_SEED, table_key.as_ref()],
        TARGET_VAULT => {
            require!(usize::from(slot) < LEAK_SLOTS, InsiderError::InvalidLeakSlot);
            vec![LEAK_SEED, table_key.as_ref(), &slot_seed]
        }
        _ => return err!(InsiderError::InvalidPermissionTarget),
    };
    let (expected, bump) = Pubkey::find_program_address(&seeds, ctx.program_id);
    require_keys_eq!(
        ctx.accounts.target.key(),
        expected,
        InsiderError::InvalidPermissionTarget
    );
    if ctx.accounts.permission.owner == &PERMISSION_PROGRAM_ID
        && !ctx.accounts.permission.data_is_empty()
    {
        return Ok(());
    }
    let bump_seed = [bump];
    seeds.push(&bump_seed);
    let nobody = Pubkey::find_program_address(&[NOBODY_SEED], ctx.program_id).0;
    CreateEphemeralPermissionCpi {
        payer: ctx.accounts.target.to_account_info(),
        permissioned_account: ctx.accounts.target.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        args: EphemeralMembersArgs {
            is_private: true,
            members: vec![Member {
                flags: TX_LOGS_FLAG,
                pubkey: nobody,
            }],
        },
    }
    .invoke_signed(&[&seeds])?;
    Ok(())
}

// ---- delegation --------------------------------------------------------------------------------


#[delegate]
#[derive(Accounts)]
pub struct DelegateMempool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the account seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the PDA being delegated; the Delegation Program validates the seeds.
    #[account(mut, del, seeds = [MEMPOOL_SEED, table.key().as_ref()], bump)]
    pub mempool: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateFuture<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the account seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the PDA being delegated; the Delegation Program validates the seeds.
    #[account(mut, del, seeds = [FUTURE_SEED, table.key().as_ref()], bump)]
    pub future: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateBoard<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the account seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the PDA being delegated; the Delegation Program validates the seeds.
    #[account(mut, del, seeds = [BOARD_SEED, table.key().as_ref()], bump)]
    pub board: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateXray<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the account seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the PDA being delegated; the Delegation Program validates the seeds.
    #[account(mut, del, seeds = [XRAY_SEED, table.key().as_ref()], bump)]
    pub xray: UncheckedAccount<'info>,
}

fn config(remaining: &[AccountInfo]) -> DelegateConfig {
    DelegateConfig {
        validator: remaining.first().map(|account| account.key()),
        ..Default::default()
    }
}

pub fn delegate_mempool(ctx: Context<DelegateMempool>) -> Result<()> {
    let table = ctx.accounts.table.key();
    let config = config(ctx.remaining_accounts);
    ctx.accounts
        .delegate_mempool(&ctx.accounts.payer, &[MEMPOOL_SEED, table.as_ref()], config)?;
    Ok(())
}

pub fn delegate_future(ctx: Context<DelegateFuture>) -> Result<()> {
    let table = ctx.accounts.table.key();
    let config = config(ctx.remaining_accounts);
    ctx.accounts
        .delegate_future(&ctx.accounts.payer, &[FUTURE_SEED, table.as_ref()], config)?;
    Ok(())
}

pub fn delegate_board(ctx: Context<DelegateBoard>) -> Result<()> {
    let table = ctx.accounts.table.key();
    let config = config(ctx.remaining_accounts);
    ctx.accounts
        .delegate_board(&ctx.accounts.payer, &[BOARD_SEED, table.as_ref()], config)?;
    Ok(())
}

pub fn delegate_xray(ctx: Context<DelegateXray>) -> Result<()> {
    let table = ctx.accounts.table.key();
    let config = config(ctx.remaining_accounts);
    ctx.accounts
        .delegate_xray(&ctx.accounts.payer, &[XRAY_SEED, table.as_ref()], config)?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(kind: u8)]
pub struct DelegateMarket<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the market seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the market PDA being delegated.
    #[account(mut, del, seeds = [MARKET_SEED, table.key().as_ref(), &[kind]], bump)]
    pub market: UncheckedAccount<'info>,
}

pub fn delegate_market(ctx: Context<DelegateMarket>, kind: u8) -> Result<()> {
    require!(
        kind == MARKET_FLOOR || kind == MARKET_DESK,
        InsiderError::InvalidMarket
    );
    let table = ctx.accounts.table.key();
    let config = config(ctx.remaining_accounts);
    ctx.accounts.delegate_market(
        &ctx.accounts.payer,
        &[MARKET_SEED, table.as_ref(), &[kind]],
        config,
    )?;
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(slot: u8)]
pub struct DelegateLeakVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the vault seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the vault PDA being delegated.
    #[account(mut, del, seeds = [LEAK_SEED, table.key().as_ref(), &[slot]], bump)]
    pub vault: UncheckedAccount<'info>,
}

pub fn delegate_leak_vault(ctx: Context<DelegateLeakVault>, slot: u8) -> Result<()> {
    require!(usize::from(slot) < LEAK_SLOTS, InsiderError::InvalidLeakSlot);
    let table = ctx.accounts.table.key();
    let config = config(ctx.remaining_accounts);
    ctx.accounts.delegate_vault(
        &ctx.accounts.payer,
        &[LEAK_SEED, table.as_ref(), &[slot]],
        config,
    )?;
    Ok(())
}

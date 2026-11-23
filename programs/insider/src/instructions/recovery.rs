//! Recovery (spec section 11): getting delegated accounts back to the base layer.
//!
//! * `teardown` (rollup, authority): commit-and-undelegate a group of at most eight accounts in one
//!   Magic intent (the TEE stalls above nine). Used to take the whole table down in a few groups.
//! * `request_undelegation` (base layer, authority): asks the Delegation program for the owner-
//!   authorised undelegation of one account, for when the rollup is not answering. The validator
//!   normally honours the request; if it does not, `rollback_undelegation` returns the account at
//!   the last committed state once the request's timeout has passed.
//!
//! Every account is named by a (kind, slot) pair that the program turns into its PDA, so these
//! instructions can only ever touch this table's own accounts.
#![allow(deprecated)]

use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::invoke_signed,
    },
    system_program,
};
use ephemeral_rollups_sdk::{
    anchor::commit,
    ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder},
};

use crate::{
    error::InsiderError,
    state::{Phase, Table},
    BOARD_SEED, CALLBOOK_SEED, CALLVAULT_SEED, CUP_SEED, FUTURE_SEED, LEAK_SEED, LEAK_SLOTS,
    MARKET_DESK, MARKET_FLOOR, MARKET_SEED, MEMPOOL_SEED, SEASON_SEED, SEAT_COUNT, SEAT_SEED,
    TABLE_SEED, TAPE_SEED, XRAY_SEED,
};

/// The Delegation program.
pub const DELEGATION_PROGRAM_ID: Pubkey = pubkey!("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

/// Most accounts one teardown intent may hold (the TEE hangs at ten).
pub const MAX_TEARDOWN_GROUP: usize = 8;

// What kind of account a recovery names. The slot is the market kind, the vault slot or the seat.
pub const KIND_TABLE: u8 = 0;
pub const KIND_TAPE: u8 = 1;
pub const KIND_CALL_BOOK: u8 = 2;
pub const KIND_SEASON: u8 = 3;
pub const KIND_MARKET: u8 = 4;
pub const KIND_CUP: u8 = 5;
pub const KIND_MEMPOOL: u8 = 6;
pub const KIND_FUTURE: u8 = 7;
pub const KIND_BOARD: u8 = 8;
pub const KIND_XRAY: u8 = 9;
pub const KIND_LEAK_VAULT: u8 = 10;
pub const KIND_CALL_VAULT: u8 = 11;
pub const KIND_SEAT: u8 = 12;

/// The PDA seeds (without the bump) of a table account, or `None` for an unknown kind or slot.
pub fn seeds_for(kind: u8, slot: u8, table: &Pubkey) -> Option<Vec<Vec<u8>>> {
    let t = table.to_bytes().to_vec();
    let one = |seed: &[u8]| Some(vec![seed.to_vec(), t.clone()]);
    let two = |seed: &[u8]| Some(vec![seed.to_vec(), t.clone(), vec![slot]]);
    match kind {
        // the table is derived from its authority, which this helper does not know
        KIND_TABLE => None,
        KIND_TAPE => one(TAPE_SEED),
        KIND_CALL_BOOK => one(CALLBOOK_SEED),
        KIND_SEASON => one(SEASON_SEED),
        KIND_CUP => one(CUP_SEED),
        KIND_MEMPOOL => one(MEMPOOL_SEED),
        KIND_FUTURE => one(FUTURE_SEED),
        KIND_BOARD => one(BOARD_SEED),
        KIND_XRAY => one(XRAY_SEED),
        KIND_MARKET if slot == MARKET_FLOOR || slot == MARKET_DESK => two(MARKET_SEED),
        KIND_LEAK_VAULT if usize::from(slot) < LEAK_SLOTS => two(LEAK_SEED),
        KIND_CALL_VAULT if usize::from(slot) < SEAT_COUNT => two(CALLVAULT_SEED),
        KIND_SEAT if usize::from(slot) < SEAT_COUNT => two(SEAT_SEED),
        _ => None,
    }
}

/// The address and bump of a table account. The table itself needs its authority.
pub fn address_for(
    kind: u8,
    slot: u8,
    table: &Pubkey,
    authority: &Pubkey,
) -> Option<(Pubkey, Vec<Vec<u8>>, u8)> {
    let mut seeds = if kind == KIND_TABLE {
        vec![TABLE_SEED.to_vec(), authority.to_bytes().to_vec()]
    } else {
        seeds_for(kind, slot, table)?
    };
    let refs: Vec<&[u8]> = seeds.iter().map(|s| s.as_slice()).collect();
    let (key, bump) = Pubkey::find_program_address(&refs, &crate::ID);
    seeds.push(vec![bump]);
    Some((key, seeds, bump))
}

// ---- teardown (rollup) -------------------------------------------------------------------------

#[commit]
#[derive(Accounts)]
pub struct Teardown<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub table: Box<Account<'info, Table>>,
}

/// Commits and undelegates up to eight accounts. `kinds` and `slots` name them in order; the table
/// is the named `table` account, every other one follows as a remaining account in the same order.
/// Without `force` the table must be idle, so a round is never cut in half.
pub fn teardown<'info>(
    ctx: Context<'info, Teardown<'info>>,
    kinds: Vec<u8>,
    slots: Vec<u8>,
    force: bool,
) -> Result<()> {
    let table = &ctx.accounts.table;
    require_keys_eq!(ctx.accounts.payer.key(), table.authority, InsiderError::NotAuthority);
    require!(
        !kinds.is_empty() && kinds.len() == slots.len() && kinds.len() <= MAX_TEARDOWN_GROUP,
        InsiderError::InvalidRecoveryTarget
    );
    require!(
        force || (table.phase == Phase::Idle && !table.vrf_pending),
        InsiderError::WrongPhase
    );
    let table_key = table.key();
    let authority = table.authority;
    let mut remaining = ctx.remaining_accounts.iter();
    let mut infos: Vec<AccountInfo<'info>> = Vec::with_capacity(kinds.len());
    for (kind, slot) in kinds.iter().zip(slots.iter()) {
        let (expected, _, _) = address_for(*kind, *slot, &table_key, &authority)
            .ok_or(InsiderError::InvalidRecoveryTarget)?;
        let info = if *kind == KIND_TABLE {
            ctx.accounts.table.to_account_info()
        } else {
            remaining
                .next()
                .ok_or(InsiderError::InvalidRecoveryTarget)?
                .clone()
        };
        require_keys_eq!(info.key(), expected, InsiderError::InvalidRecoveryTarget);
        require!(info.is_writable, InsiderError::InvalidRecoveryTarget);
        infos.push(info);
    }
    require!(remaining.next().is_none(), InsiderError::InvalidRecoveryTarget);
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&infos)
    .build_and_invoke()?;
    Ok(())
}

// ---- request_undelegation and rollback (base layer) --------------------------------------------

/// Discriminators of the Delegation program (little-endian u64).
const DLP_REQUEST_UNDELEGATION: u64 = 26;
const DLP_UNDELEGATE_WITH_ROLLBACK_AFTER_TIMEOUT: u64 = 27;

/// The Delegation program's PDAs for one delegated account.
pub struct DlpAccounts {
    pub request: Pubkey,
    pub record: Pubkey,
    pub metadata: Pubkey,
    pub commit_state: Pubkey,
    pub commit_record: Pubkey,
}

pub fn dlp_accounts(delegated: &Pubkey) -> DlpAccounts {
    let find = |tag: &[u8]| {
        Pubkey::find_program_address(&[tag, delegated.as_ref()], &DELEGATION_PROGRAM_ID).0
    };
    DlpAccounts {
        request: find(b"undelegation-request"),
        record: find(b"delegation"),
        metadata: find(b"delegation-metadata"),
        commit_state: find(b"state-diff"),
        commit_record: find(b"commit-state-record"),
    }
}

#[derive(Accounts)]
pub struct Recover<'info> {
    /// The table authority. It is also the rent payer the delegation recorded.
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: the table; delegated, so it is not deserialised. Its seeds tie it to `authority`.
    #[account(seeds = [TABLE_SEED, authority.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the delegated account to recover; its address is derived from (kind, slot).
    #[account(mut)]
    pub target: UncheckedAccount<'info>,
    /// CHECK: the Delegation program's undelegation request PDA for `target`.
    #[account(mut)]
    pub undelegation_request: UncheckedAccount<'info>,
    /// CHECK: the Delegation program's delegation record PDA for `target`.
    #[account(mut)]
    pub delegation_record: UncheckedAccount<'info>,
    /// CHECK: the Delegation program's delegation metadata PDA for `target`.
    #[account(mut)]
    pub delegation_metadata: UncheckedAccount<'info>,
    /// CHECK: the Delegation program's commit state PDA (used by the rollback only).
    #[account(mut)]
    pub commit_state: UncheckedAccount<'info>,
    /// CHECK: the Delegation program's commit record PDA (used by the rollback only).
    #[account(mut)]
    pub commit_record: UncheckedAccount<'info>,
    /// CHECK: the Delegation program.
    #[account(address = DELEGATION_PROGRAM_ID)]
    pub delegation_program: UncheckedAccount<'info>,
    /// CHECK: this program, the owner of the delegated account.
    #[account(address = crate::ID)]
    pub owner_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// Verifies the account list against what the Delegation program derives for the target.
fn checked_target(ctx: &Context<Recover>, kind: u8, slot: u8) -> Result<(Vec<Vec<u8>>, DlpAccounts)> {
    let (expected, seeds, _) = address_for(kind, slot, &ctx.accounts.table.key(), &ctx.accounts.authority.key())
        .ok_or(InsiderError::InvalidRecoveryTarget)?;
    require_keys_eq!(ctx.accounts.target.key(), expected, InsiderError::InvalidRecoveryTarget);
    // a delegated account is owned by the Delegation program; anything else needs no recovery
    require_keys_eq!(
        *ctx.accounts.target.owner,
        DELEGATION_PROGRAM_ID,
        InsiderError::NotDelegated
    );
    let dlp = dlp_accounts(&expected);
    require_keys_eq!(ctx.accounts.undelegation_request.key(), dlp.request, InsiderError::InvalidRecoveryTarget);
    require_keys_eq!(ctx.accounts.delegation_record.key(), dlp.record, InsiderError::InvalidRecoveryTarget);
    require_keys_eq!(ctx.accounts.delegation_metadata.key(), dlp.metadata, InsiderError::InvalidRecoveryTarget);
    require_keys_eq!(ctx.accounts.commit_state.key(), dlp.commit_state, InsiderError::InvalidRecoveryTarget);
    require_keys_eq!(ctx.accounts.commit_record.key(), dlp.commit_record, InsiderError::InvalidRecoveryTarget);
    Ok((seeds, dlp))
}

/// Asks the Delegation program to undelegate `target`, signed by this program as the account's owner.
/// The validator picks the request up and returns the account to the base layer.
pub fn request_undelegation(ctx: Context<Recover>, kind: u8, slot: u8) -> Result<()> {
    let (seeds, dlp) = checked_target(&ctx, kind, slot)?;
    let ix = Instruction {
        program_id: DELEGATION_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.authority.key(), true),
            AccountMeta::new_readonly(ctx.accounts.target.key(), true),
            AccountMeta::new_readonly(crate::ID, false),
            AccountMeta::new(dlp.request, false),
            AccountMeta::new_readonly(dlp.record, false),
            AccountMeta::new(dlp.metadata, false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: DLP_REQUEST_UNDELEGATION.to_le_bytes().to_vec(),
    };
    let signer: Vec<&[u8]> = seeds.iter().map(|s| s.as_slice()).collect();
    invoke_signed(
        &ix,
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.target.to_account_info(),
            ctx.accounts.owner_program.to_account_info(),
            ctx.accounts.undelegation_request.to_account_info(),
            ctx.accounts.delegation_record.to_account_info(),
            ctx.accounts.delegation_metadata.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[&signer],
    )?;
    Ok(())
}

/// After the request's timeout: returns `target` to the base layer at its last committed state, for
/// a validator that never answered. The Delegation program refuses it before the timeout.
pub fn rollback_undelegation(ctx: Context<Recover>, kind: u8, slot: u8) -> Result<()> {
    let (seeds, dlp) = checked_target(&ctx, kind, slot)?;
    let ix = Instruction {
        program_id: DELEGATION_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.target.key(), true),
            AccountMeta::new_readonly(crate::ID, false),
            AccountMeta::new(dlp.request, false),
            AccountMeta::new(dlp.record, false),
            AccountMeta::new(dlp.metadata, false),
            AccountMeta::new(ctx.accounts.authority.key(), false),
            AccountMeta::new(dlp.commit_state, false),
            AccountMeta::new(dlp.commit_record, false),
            AccountMeta::new(ctx.accounts.authority.key(), false),
        ],
        data: DLP_UNDELEGATE_WITH_ROLLBACK_AFTER_TIMEOUT.to_le_bytes().to_vec(),
    };
    let signer: Vec<&[u8]> = seeds.iter().map(|s| s.as_slice()).collect();
    invoke_signed(
        &ix,
        &[
            ctx.accounts.target.to_account_info(),
            ctx.accounts.owner_program.to_account_info(),
            ctx.accounts.undelegation_request.to_account_info(),
            ctx.accounts.delegation_record.to_account_info(),
            ctx.accounts.delegation_metadata.to_account_info(),
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.commit_state.to_account_info(),
            ctx.accounts.commit_record.to_account_info(),
            ctx.accounts.authority.to_account_info(),
        ],
        &[&signer],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_maps_to_the_pda_the_setup_uses() {
        let authority = Pubkey::new_unique();
        let table = Pubkey::find_program_address(&[TABLE_SEED, authority.as_ref()], &crate::ID).0;
        let find = |seeds: &[&[u8]]| Pubkey::find_program_address(seeds, &crate::ID).0;
        let key = |kind, slot| address_for(kind, slot, &table, &authority).unwrap().0;
        assert_eq!(key(KIND_TABLE, 0), table);
        assert_eq!(key(KIND_TAPE, 0), find(&[TAPE_SEED, table.as_ref()]));
        assert_eq!(key(KIND_CALL_BOOK, 0), find(&[CALLBOOK_SEED, table.as_ref()]));
        assert_eq!(key(KIND_SEASON, 0), find(&[SEASON_SEED, table.as_ref()]));
        assert_eq!(key(KIND_CUP, 0), find(&[CUP_SEED, table.as_ref()]));
        assert_eq!(key(KIND_MEMPOOL, 0), find(&[MEMPOOL_SEED, table.as_ref()]));
        assert_eq!(key(KIND_FUTURE, 0), find(&[FUTURE_SEED, table.as_ref()]));
        assert_eq!(key(KIND_BOARD, 0), find(&[BOARD_SEED, table.as_ref()]));
        assert_eq!(key(KIND_XRAY, 0), find(&[XRAY_SEED, table.as_ref()]));
        assert_eq!(key(KIND_MARKET, MARKET_DESK), find(&[MARKET_SEED, table.as_ref(), &[MARKET_DESK]]));
        assert_eq!(key(KIND_LEAK_VAULT, 5), find(&[LEAK_SEED, table.as_ref(), &[5]]));
        assert_eq!(key(KIND_CALL_VAULT, 9), find(&[CALLVAULT_SEED, table.as_ref(), &[9]]));
        assert_eq!(key(KIND_SEAT, 3), find(&[SEAT_SEED, table.as_ref(), &[3]]));
    }

    #[test]
    fn unknown_kinds_and_out_of_range_slots_name_nothing() {
        let authority = Pubkey::new_unique();
        let table = Pubkey::new_unique();
        for (kind, slot) in [(13u8, 0u8), (255, 0), (KIND_MARKET, 2), (KIND_LEAK_VAULT, 6), (KIND_CALL_VAULT, 10), (KIND_SEAT, 10)] {
            assert!(address_for(kind, slot, &table, &authority).is_none(), "{kind} {slot}");
        }
    }

    #[test]
    fn the_signing_seeds_end_with_the_bump_and_reproduce_the_address() {
        let authority = Pubkey::new_unique();
        let table = Pubkey::find_program_address(&[TABLE_SEED, authority.as_ref()], &crate::ID).0;
        for (kind, slot) in [(KIND_TABLE, 0u8), (KIND_SEAT, 4), (KIND_XRAY, 0)] {
            let (key, seeds, bump) = address_for(kind, slot, &table, &authority).unwrap();
            assert_eq!(seeds.last().unwrap(), &vec![bump]);
            let refs: Vec<&[u8]> = seeds.iter().map(|s| s.as_slice()).collect();
            assert_eq!(Pubkey::create_program_address(&refs, &crate::ID).unwrap(), key);
        }
    }

    #[test]
    fn the_delegation_program_addresses_are_distinct_per_account() {
        let a = dlp_accounts(&Pubkey::new_unique());
        let keys = [a.request, a.record, a.metadata, a.commit_state, a.commit_record];
        for (i, x) in keys.iter().enumerate() {
            for y in &keys[i + 1..] {
                assert_ne!(x, y);
            }
        }
        let b = dlp_accounts(&Pubkey::new_unique());
        assert_ne!(a.record, b.record);
    }
}

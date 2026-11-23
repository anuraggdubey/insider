//! The epoch cycle (spec section 6, gate G8). An epoch is `ROUNDS_PER_EPOCH` rounds. At its end
//! `commit_epoch` (rollup) commits `Season` to the base layer and undelegates it; `open_epoch`
//! (base layer, authority) starts the next season and delegates it again. The table accounts stay
//! delegated. `finish_round` needs `Season` on the rollup, so `open_epoch` must land before the
//! next round ends (a round lasts 100 seconds).

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::{commit, delegate},
    cpi::DelegateConfig,
    ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder},
};

use crate::{
    error::InsiderError,
    state::{Phase, Season, Table, Xray},
    ROUNDS_PER_EPOCH, SEASON_SEED, TABLE_SEED, XRAY_SEED,
};

#[commit]
#[derive(Accounts)]
pub struct CommitEpoch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub table: Box<Account<'info, Table>>,
    #[account(seeds = [XRAY_SEED, table.key().as_ref()], bump = xray.load()?.bump)]
    pub xray: AccountLoader<'info, Xray>,
    #[account(mut, seeds = [SEASON_SEED, table.key().as_ref()], bump = season.bump)]
    pub season: Box<Account<'info, Season>>,
}

/// True when the epoch is over and every round of it is scored, so the season is complete.
pub fn epoch_ready(table: &Table, xray_round: u32, xray_finalized: bool) -> bool {
    table.phase == Phase::Idle
        && table.rounds_this_epoch >= ROUNDS_PER_EPOCH
        && xray_round == table.round_id
        && xray_finalized
}

/// Anyone may call it once the epoch is over and the last round is scored: commits the season to
/// the base layer, undelegates it, and starts counting the next epoch.
pub fn commit_epoch(ctx: Context<CommitEpoch>) -> Result<()> {
    {
        let xray = ctx.accounts.xray.load()?;
        require!(
            epoch_ready(&ctx.accounts.table, xray.round_id, xray.finalized != 0),
            InsiderError::EpochNotOver
        );
    }
    let table = &mut ctx.accounts.table;
    table.epoch = table.epoch.saturating_add(1);
    table.rounds_this_epoch = 0;
    ctx.accounts.season.exit(&crate::ID)?;
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.season.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}

/// Opens the next season: the leaderboard and round counter start empty, the epoch number goes
/// up; analyst track records stay for the whole competition.
pub fn start_next_season(season: &mut Season) {
    season.epoch = season.epoch.saturating_add(1);
    season.rounds_played = 0;
    season.leaderboard = Default::default();
}

#[delegate]
#[derive(Accounts)]
pub struct OpenEpoch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the table, only used to derive the season seeds.
    #[account(seeds = [TABLE_SEED, payer.key().as_ref()], bump)]
    pub table: UncheckedAccount<'info>,
    /// CHECK: the season PDA; it must be back on the base layer (owned by this program).
    #[account(mut, del, seeds = [SEASON_SEED, table.key().as_ref()], bump)]
    pub season: UncheckedAccount<'info>,
}

/// Base layer, table authority: resets the undelegated season for the new epoch and delegates it
/// again to the validator named in the first remaining account.
pub fn open_epoch(ctx: Context<OpenEpoch>) -> Result<()> {
    require_keys_eq!(
        *ctx.accounts.season.owner,
        crate::ID,
        InsiderError::SeasonDelegated
    );
    {
        let mut data = ctx.accounts.season.try_borrow_mut_data()?;
        let mut season = Season::try_deserialize(&mut &data[..])?;
        start_next_season(&mut season);
        season.try_serialize(&mut &mut data[..])?;
    }
    let validator = ctx.remaining_accounts.first().map(|account| account.key());
    let table = ctx.accounts.table.key();
    ctx.accounts.delegate_season(
        &ctx.accounts.payer,
        &[SEASON_SEED, table.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{Params, ScoreEntry};

    fn table(phase: Phase, rounds: u32, round_id: u32) -> Table {
        Table {
            authority: Pubkey::default(),
            epoch: 0,
            round_id,
            phase,
            round_start_slot: 0,
            tick: 200,
            armed_until_slot: 0,
            vrf_nonce: 0,
            vrf_pending: false,
            vrf_requested_tick: 0,
            rounds_this_epoch: rounds,
            params: Params::default(),
            bump: 0,
        }
    }

    #[test]
    fn the_epoch_is_ready_only_when_full_idle_and_scored() {
        assert!(epoch_ready(&table(Phase::Idle, ROUNDS_PER_EPOCH, 12), 12, true));
        assert!(!epoch_ready(&table(Phase::Idle, ROUNDS_PER_EPOCH - 1, 12), 12, true));
        assert!(!epoch_ready(&table(Phase::Live, ROUNDS_PER_EPOCH, 12), 12, true));
        assert!(!epoch_ready(&table(Phase::Idle, ROUNDS_PER_EPOCH, 12), 11, true));
        assert!(!epoch_ready(&table(Phase::Idle, ROUNDS_PER_EPOCH, 12), 12, false));
    }

    #[test]
    fn a_new_season_clears_the_leaderboard_and_keeps_analyst_records() {
        let mut season = Season {
            epoch: 2,
            rounds_played: 10,
            leaderboard: [ScoreEntry::default(); crate::LEADERBOARD_SIZE],
            analysts: Default::default(),
            bump: 7,
        };
        season.record_score(Pubkey::new_unique(), 500);
        season.analysts[5].calls = 4;
        start_next_season(&mut season);
        assert_eq!(season.epoch, 3);
        assert_eq!(season.rounds_played, 0);
        assert!(season.leaderboard.iter().all(|e| e.owner == Pubkey::default() && e.score == 0));
        assert_eq!(season.analysts[5].calls, 4);
        assert_eq!(season.bump, 7);
    }
}

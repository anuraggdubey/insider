//! The Desk (spec section 8): oracle-settled Calls. A seat commits to "up" or "down" on SOL/USD
//! for 60, 120 or 180 seconds with a stake of Desk chips. The direction stays private (author, then
//! licensees) until the Call is judged against the oracle; then it is public and the author's
//! public track record in `Season` is updated. `desk_trade` trades Desk chips at the oracle price.
//!
//! Nothing here depends on the Floor, so the Desk runs in any phase.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::UpdateEphemeralPermissionCpi,
        structs::{EphemeralMembersArgs, Member, PERMISSION_SEED, TX_LOGS_FLAG},
    },
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
};

use crate::{
    error::InsiderError,
    instructions::leaks::PermissionAccounts,
    math::desk::{decode_oracle, judge, payout, record, trade_cost, trade_fee, OraclePrice, Verdict},
    state::{CallHeader, CallBook, CallState, CallVault, Market, Seat, Season, Table},
    CALLBOOK_SEED, CALLVAULT_SEED, CALL_HORIZONS, CALL_MAX_LICENSE, CALL_MAX_STAKE,
    CALL_MIN_STAKE, CALL_READERS, MARKET_DESK, MARKET_SEED, MAX_DESK_ORDER, MAX_DESK_POSITION,
    ORACLE_FEED, ORACLE_MAX_AGE_SECS, ORACLE_PROGRAM_ID, SEASON_SEED, SEAT_COUNT, SEAT_SEED,
};

/// Reads the SOL/USD feed: owned by the pricing oracle, decodable and fresh.
pub fn read_oracle(feed: &AccountInfo, now: i64) -> Result<OraclePrice> {
    require_keys_eq!(*feed.owner, ORACLE_PROGRAM_ID, InsiderError::OracleInvalid);
    let data = feed.try_borrow_data()?;
    let price = decode_oracle(&data).ok_or(InsiderError::OracleInvalid)?;
    require!(
        now.saturating_sub(price.publish_time) <= ORACLE_MAX_AGE_SECS,
        InsiderError::OracleStale
    );
    Ok(price)
}

/// Rewrites who may read a Call vault (the permission is created private at setup).
fn set_members<'info>(
    table: &Pubkey,
    index: u8,
    bump: u8,
    members: &[Pubkey],
    accounts: PermissionAccounts<'info>,
) -> Result<()> {
    let index_seed = [index];
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[CALLVAULT_SEED, table.as_ref(), &index_seed, &bump_seed];
    let members = members
        .iter()
        .map(|pubkey| Member {
            flags: TX_LOGS_FLAG,
            pubkey: *pubkey,
        })
        .collect();
    UpdateEphemeralPermissionCpi {
        payer: accounts.vault.clone(),
        permissioned_account: accounts.vault.clone(),
        permission: accounts.permission,
        vault: accounts.ephemeral_vault,
        magic_program: accounts.magic_program,
        permission_program: accounts.permission_program,
        authority: accounts.vault,
        authority_is_signer: false,
        args: EphemeralMembersArgs {
            is_private: true,
            members,
        },
    }
    .invoke_signed(&[seeds])?;
    Ok(())
}

// ---- mint_call ---------------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct MintCall<'info> {
    pub owner: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[index]], bump = seat.bump,
        constraint = seat.owner == owner.key() @ InsiderError::NotSeatOwner)]
    pub seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [CALLBOOK_SEED, table.key().as_ref()], bump = call_book.load()?.bump)]
    pub call_book: AccountLoader<'info, CallBook>,
    #[account(mut, seeds = [CALLVAULT_SEED, table.key().as_ref(), &[index]], bump = vault.load()?.bump)]
    pub vault: AccountLoader<'info, CallVault>,
    /// CHECK: PDA under the permission program.
    #[account(mut, seeds = [PERMISSION_SEED, vault.key().as_ref()], bump, seeds::program = permission_program.key())]
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
    /// CHECK: the SOL/USD feed; owner and layout are checked in the handler.
    #[account(address = ORACLE_FEED)]
    pub oracle: UncheckedAccount<'info>,
}

/// Commits to a direction. The stake leaves the seat's Desk chips now and comes back (with a
/// bonus) only if the Call is Right. One open Call per seat.
pub fn mint_call(
    ctx: Context<MintCall>,
    index: u8,
    direction: i8,
    horizon: u16,
    stake: u64,
    license_ask: u64,
    confidence: u8,
) -> Result<()> {
    require!(usize::from(index) < SEAT_COUNT, InsiderError::InvalidSeat);
    require!(
        (direction == 1 || direction == -1)
            && CALL_HORIZONS.contains(&horizon)
            && (CALL_MIN_STAKE..=CALL_MAX_STAKE).contains(&stake)
            && license_ask <= CALL_MAX_LICENSE
            && confidence <= 100,
        InsiderError::InvalidCall
    );
    let now = Clock::get()?.unix_timestamp;
    let price = read_oracle(&ctx.accounts.oracle, now)?;
    let seat = &mut ctx.accounts.seat;
    let stake_chips = i64::try_from(stake).map_err(|_| InsiderError::Overflow)?;
    require!(seat.desk_chips >= stake_chips, InsiderError::InsufficientChips);

    let call_id = {
        let mut book = ctx.accounts.call_book.load_mut()?;
        let call_id = book.next_call_id;
        let header = &mut book.headers[usize::from(index)];
        require!(
            header.call_state() != CallState::Open,
            InsiderError::CallSlotBusy
        );
        *header = CallHeader::default();
        header.call_id = call_id;
        header.author_seat = index;
        header.state = CallState::Open as u8;
        header.minted_ts = now;
        header.minted_price = price.price;
        header.horizon_secs = horizon;
        header.expiry_ts = now + i64::from(horizon);
        header.stake = stake;
        header.license_ask = license_ask;
        book.next_call_id = call_id.checked_add(1).ok_or(InsiderError::Overflow)?;
        call_id
    };
    seat.desk_chips -= stake_chips;
    let bump = {
        let mut vault = ctx.accounts.vault.load_mut()?;
        vault.call_id = call_id;
        vault.direction = direction;
        vault.confidence = confidence;
        vault.bump
    };
    set_members(
        &ctx.accounts.table.key(),
        index,
        bump,
        &[ctx.accounts.owner.key()],
        PermissionAccounts {
            vault: ctx.accounts.vault.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            ephemeral_vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
        },
    )
}

// ---- buy_call_license --------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(index: u8, author_index: u8)]
pub struct BuyCallLicense<'info> {
    pub owner: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[index]], bump = seat.bump,
        constraint = seat.owner == owner.key() @ InsiderError::NotSeatOwner)]
    pub seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[author_index]], bump = author_seat.bump)]
    pub author_seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [CALLBOOK_SEED, table.key().as_ref()], bump = call_book.load()?.bump)]
    pub call_book: AccountLoader<'info, CallBook>,
    #[account(mut, seeds = [CALLVAULT_SEED, table.key().as_ref(), &[author_index]], bump = vault.load()?.bump)]
    pub vault: AccountLoader<'info, CallVault>,
    /// CHECK: PDA under the permission program.
    #[account(mut, seeds = [PERMISSION_SEED, vault.key().as_ref()], bump, seeds::program = permission_program.key())]
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

/// Pays the author's asking price in Desk chips and joins the readers of an open Call (up to 4).
pub fn buy_call_license(ctx: Context<BuyCallLicense>, index: u8, author_index: u8) -> Result<()> {
    require!(
        usize::from(index) < SEAT_COUNT && usize::from(author_index) < SEAT_COUNT,
        InsiderError::InvalidSeat
    );
    require!(index != author_index, InsiderError::LicenseUnavailable);
    let now = Clock::get()?.unix_timestamp;
    let buyer = ctx.accounts.owner.key();
    let mut members = vec![ctx.accounts.author_seat.owner];
    {
        let mut book = ctx.accounts.call_book.load_mut()?;
        let header = &mut book.headers[usize::from(author_index)];
        require!(
            header.call_state() == CallState::Open
                && now < header.expiry_ts
                && header.license_ask > 0,
            InsiderError::LicenseUnavailable
        );
        let count = header
            .readers
            .iter()
            .filter(|reader| **reader != Pubkey::default())
            .count();
        require!(
            count < CALL_READERS && !header.readers.contains(&buyer),
            InsiderError::LicenseUnavailable
        );
        let ask = i64::try_from(header.license_ask).map_err(|_| InsiderError::Overflow)?;
        let seat = &mut ctx.accounts.seat;
        require!(seat.desk_chips >= ask, InsiderError::InsufficientChips);
        seat.desk_chips -= ask;
        let author = &mut ctx.accounts.author_seat;
        author.desk_chips = author
            .desk_chips
            .checked_add(ask)
            .ok_or(InsiderError::Overflow)?;
        header.readers[count] = buyer;
        members.extend(
            header
                .readers
                .iter()
                .filter(|reader| **reader != Pubkey::default())
                .copied(),
        );
    }
    let bump = ctx.accounts.vault.load()?.bump;
    set_members(
        &ctx.accounts.table.key(),
        author_index,
        bump,
        &members,
        PermissionAccounts {
            vault: ctx.accounts.vault.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            ephemeral_vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
        },
    )
}

// ---- settle_call -------------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(author_index: u8)]
pub struct SettleCall<'info> {
    pub payer: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[author_index]], bump = author_seat.bump)]
    pub author_seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [CALLBOOK_SEED, table.key().as_ref()], bump = call_book.load()?.bump)]
    pub call_book: AccountLoader<'info, CallBook>,
    #[account(seeds = [CALLVAULT_SEED, table.key().as_ref(), &[author_index]], bump = vault.load()?.bump)]
    pub vault: AccountLoader<'info, CallVault>,
    #[account(mut, seeds = [SEASON_SEED, table.key().as_ref()], bump = season.bump)]
    pub season: Box<Account<'info, Season>>,
    /// CHECK: the SOL/USD feed; owner and layout are checked in the handler.
    #[account(address = ORACLE_FEED)]
    pub oracle: UncheckedAccount<'info>,
}

/// Anyone may judge a due Call. It is Right when the oracle moved the author's way; the author
/// gets stake plus bonus back, a Wrong Call burns the stake. The direction becomes public in the
/// header and the author's track record in `Season` is updated.
pub fn settle_call(ctx: Context<SettleCall>, author_index: u8) -> Result<()> {
    require!(usize::from(author_index) < SEAT_COUNT, InsiderError::InvalidSeat);
    let now = Clock::get()?.unix_timestamp;
    let price = read_oracle(&ctx.accounts.oracle, now)?;
    let direction = {
        let vault = ctx.accounts.vault.load()?;
        let book = ctx.accounts.call_book.load()?;
        let header = &book.headers[usize::from(author_index)];
        require!(
            header.call_state() == CallState::Open,
            InsiderError::NoOpenCall
        );
        require!(now >= header.expiry_ts, InsiderError::CallNotDue);
        require!(vault.call_id == header.call_id, InsiderError::NoOpenCall);
        vault.direction
    };
    let mut book = ctx.accounts.call_book.load_mut()?;
    let header = &mut book.headers[usize::from(author_index)];
    let verdict = judge(direction, header.minted_price, price.price, header.expiry_ts, now);
    let (returned, profit) = payout(verdict, header.stake);
    let returned = i64::try_from(returned).map_err(|_| InsiderError::Overflow)?;
    let seat = &mut ctx.accounts.author_seat;
    seat.desk_chips = seat
        .desk_chips
        .checked_add(returned)
        .ok_or(InsiderError::Overflow)?;
    header.state = match verdict {
        Verdict::Right => CallState::Right,
        Verdict::Wrong => CallState::Wrong,
    } as u8;
    header.revealed_dir = direction;
    record(
        &mut ctx.accounts.season.analysts[usize::from(author_index)],
        verdict,
        profit,
    );
    Ok(())
}

// ---- desk_trade --------------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct DeskTrade<'info> {
    pub owner: Signer<'info>,
    pub table: Box<Account<'info, Table>>,
    #[account(mut, seeds = [SEAT_SEED, table.key().as_ref(), &[index]], bump = seat.bump,
        constraint = seat.owner == owner.key() @ InsiderError::NotSeatOwner)]
    pub seat: Box<Account<'info, Seat>>,
    #[account(mut, seeds = [MARKET_SEED, table.key().as_ref(), &[MARKET_DESK]], bump = market.load()?.bump)]
    pub market: AccountLoader<'info, Market>,
    /// CHECK: the SOL/USD feed; owner and layout are checked in the handler.
    #[account(address = ORACLE_FEED)]
    pub oracle: UncheckedAccount<'info>,
}

/// Trades `size` units (negative sells) at the oracle price: no price impact, a 0.1% fee. Buying
/// needs the chips; the position is capped at 2,000 units either way.
pub fn desk_trade(ctx: Context<DeskTrade>, index: u8, size: i16) -> Result<()> {
    require!(usize::from(index) < SEAT_COUNT, InsiderError::InvalidSeat);
    require!(
        size != 0 && size.unsigned_abs() <= MAX_DESK_ORDER as u16,
        InsiderError::DeskLimit
    );
    let now = Clock::get()?.unix_timestamp;
    let price = read_oracle(&ctx.accounts.oracle, now)?;
    let seat = &mut ctx.accounts.seat;
    let position = seat
        .desk_position
        .checked_add(i32::from(size))
        .ok_or(InsiderError::Overflow)?;
    require!(position.abs() <= MAX_DESK_POSITION, InsiderError::DeskLimit);
    let cost = trade_cost(size, price.price)
        .checked_add(trade_fee(size, price.price))
        .ok_or(InsiderError::Overflow)?;
    let chips = seat
        .desk_chips
        .checked_sub(cost)
        .ok_or(InsiderError::Overflow)?;
    require!(size < 0 || chips >= 0, InsiderError::InsufficientChips);
    seat.desk_chips = chips;
    seat.desk_position = position;
    let mut market = ctx.accounts.market.load_mut()?;
    market.mark_price = u32::try_from(price.price).map_err(|_| InsiderError::Overflow)?;
    market.oracle_ts = price.publish_time;
    market.volume = market.volume.saturating_add(u64::from(size.unsigned_abs()));
    Ok(())
}

use anchor_lang::prelude::*;

use crate::{
    error::InsiderError,
    math::dutch::{auction_over, dutch_price},
    state::{Board, LeakHeader, LeakState, Seat},
    LEAK_READERS, MAX_UNOPENED_PER_SEAT, SEAT_COUNT,
};

pub type Readers = ([Pubkey; LEAK_READERS], u8);

pub fn unopened_count(board: &Board, seat_index: u8) -> u8 {
    board
        .headers
        .iter()
        .filter(|header| {
            header.owner_seat == seat_index
                && matches!(
                    LeakState::from_u8(header.state),
                    LeakState::Owned | LeakState::Listed
                )
        })
        .count() as u8
}

fn header(board: &Board, slot: u8) -> Result<&LeakHeader> {
    board
        .headers
        .get(usize::from(slot))
        .ok_or_else(|| error!(InsiderError::InvalidLeakSlot))
}

fn owned_by(header: &LeakHeader, seat_index: u8) -> Result<()> {
    require!(header.owner_seat == seat_index, InsiderError::NotLeakOwner);
    Ok(())
}

fn check_seat(seat_index: u8) -> Result<()> {
    require!(
        usize::from(seat_index) < SEAT_COUNT,
        InsiderError::InvalidSeat
    );
    Ok(())
}

fn spend(seat: &Seat, price: u32) -> Result<(i64, u64)> {
    require!(
        seat.chips >= i64::from(price),
        InsiderError::InsufficientChips
    );
    Ok((
        seat.chips
            .checked_sub(i64::from(price))
            .ok_or(InsiderError::Overflow)?,
        seat.leak_spend
            .checked_add(u64::from(price))
            .ok_or(InsiderError::Overflow)?,
    ))
}

pub fn bid(board: &mut Board, slot: u8, seat_index: u8, seat: &mut Seat, tick: u16) -> Result<u32> {
    check_seat(seat_index)?;
    let leak = header(board, slot)?;
    if leak.state == LeakState::Expired as u8
        && leak.owner_seat == crate::NO_SEAT
        && auction_over(leak.auction_start, tick)
    {
        return err!(InsiderError::AuctionOver);
    }
    require!(
        leak.state == LeakState::Auction as u8,
        InsiderError::NotForSale
    );
    require!(
        !auction_over(leak.auction_start, tick),
        InsiderError::AuctionOver
    );
    require!(
        unopened_count(board, seat_index) < MAX_UNOPENED_PER_SEAT,
        InsiderError::HoardLimit
    );
    let price = dutch_price(leak.start_price, leak.floor_price, leak.auction_start, tick);
    let (chips, leak_spend) = spend(seat, price)?;
    seat.chips = chips;
    seat.leak_spend = leak_spend;
    let leak = &mut board.headers[usize::from(slot)];
    leak.owner_seat = seat_index;
    leak.state = LeakState::Owned as u8;
    leak.paid = price;
    Ok(price)
}

pub fn open(
    board: &mut Board,
    slot: u8,
    seat_index: u8,
    owner_key: Pubkey,
    tick: u16,
) -> Result<Readers> {
    check_seat(seat_index)?;
    let leak = header(board, slot)?;
    require!(
        leak.state != LeakState::Opened as u8,
        InsiderError::AlreadyOpened
    );
    require!(
        leak.state == LeakState::Owned as u8,
        InsiderError::NotForSale
    );
    owned_by(leak, seat_index)?;
    require!(tick <= leak.window_end, InsiderError::NotForSale);
    let leak = &mut board.headers[usize::from(slot)];
    leak.state = LeakState::Opened as u8;
    leak.opened_tick = tick;
    leak.readers = [Pubkey::default(); LEAK_READERS];
    leak.readers[0] = owner_key;
    leak.reader_count = 1;
    Ok((leak.readers, leak.reader_count))
}

pub fn list(board: &mut Board, slot: u8, seat_index: u8, ask: u32) -> Result<()> {
    check_seat(seat_index)?;
    let leak = header(board, slot)?;
    require!(
        leak.state != LeakState::Opened as u8,
        InsiderError::AlreadyOpened
    );
    require!(
        leak.state == LeakState::Owned as u8 || leak.state == LeakState::Listed as u8,
        InsiderError::NotForSale
    );
    owned_by(leak, seat_index)?;
    let next = match (LeakState::from_u8(leak.state), ask) {
        (LeakState::Owned, 1..) => LeakState::Listed,
        (LeakState::Listed, 0) => LeakState::Owned,
        _ => return err!(InsiderError::NotForSale),
    };
    let leak = &mut board.headers[usize::from(slot)];
    leak.ask = ask;
    leak.state = next as u8;
    Ok(())
}

pub fn buy_listed(
    board: &mut Board,
    slot: u8,
    buyer_index: u8,
    buyer: &mut Seat,
    seller: &mut Seat,
    tick: u16,
) -> Result<u32> {
    check_seat(buyer_index)?;
    let leak = header(board, slot)?;
    require!(
        leak.state == LeakState::Listed as u8,
        InsiderError::NotForSale
    );
    require!(
        tick <= leak.window_end && leak.ask > 0,
        InsiderError::NotForSale
    );
    require!(leak.owner_seat != buyer_index, InsiderError::NotForSale);
    require!(
        unopened_count(board, buyer_index) < MAX_UNOPENED_PER_SEAT,
        InsiderError::HoardLimit
    );
    let price = leak.ask;
    let (chips, leak_spend) = spend(buyer, price)?;
    let seller_chips = seller
        .chips
        .checked_add(i64::from(price))
        .ok_or(InsiderError::Overflow)?;
    let flips = leak.flips.checked_add(1).ok_or(InsiderError::Overflow)?;
    buyer.chips = chips;
    buyer.leak_spend = leak_spend;
    seller.chips = seller_chips;
    let leak = &mut board.headers[usize::from(slot)];
    leak.owner_seat = buyer_index;
    leak.state = LeakState::Owned as u8;
    leak.paid = price;
    leak.ask = 0;
    leak.flips = flips;
    Ok(price)
}

pub fn offer_license(board: &mut Board, slot: u8, seat_index: u8, ask: u32) -> Result<()> {
    check_seat(seat_index)?;
    let leak = header(board, slot)?;
    require!(
        leak.state == LeakState::Opened as u8,
        InsiderError::NotForSale
    );
    owned_by(leak, seat_index)?;
    board.headers[usize::from(slot)].license_ask = ask;
    Ok(())
}

pub fn buy_license(
    board: &mut Board,
    slot: u8,
    buyer_index: u8,
    buyer_key: Pubkey,
    buyer: &mut Seat,
    owner: &mut Seat,
    tick: u16,
) -> Result<Readers> {
    check_seat(buyer_index)?;
    let leak = header(board, slot)?;
    require!(
        leak.state == LeakState::Opened as u8,
        InsiderError::NotForSale
    );
    require!(
        tick <= leak.window_end && leak.license_ask > 0,
        InsiderError::NotForSale
    );
    require!(leak.owner_seat != buyer_index, InsiderError::NotForSale);
    let count = usize::from(leak.reader_count);
    require!(count < LEAK_READERS, InsiderError::ReaderLimit);
    require!(
        !leak.readers[..count].contains(&buyer_key),
        InsiderError::ReaderLimit
    );
    let price = leak.license_ask;
    let (chips, leak_spend) = spend(buyer, price)?;
    let owner_chips = owner
        .chips
        .checked_add(i64::from(price))
        .ok_or(InsiderError::Overflow)?;
    buyer.chips = chips;
    buyer.leak_spend = leak_spend;
    owner.chips = owner_chips;
    let leak = &mut board.headers[usize::from(slot)];
    leak.readers[count] = buyer_key;
    leak.reader_count += 1;
    Ok((leak.readers, leak.reader_count))
}

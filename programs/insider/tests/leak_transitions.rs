use ::insider::{
    engine::leaks::{bid, buy_license, buy_listed, list, offer_license, open, unopened_count},
    *,
};
use anchor_lang::prelude::Pubkey;
use bytemuck::Zeroable;

fn seat(index: u8, chips: i64) -> Seat {
    Seat {
        index,
        owner: Pubkey::new_unique(),
        name_idx: 0,
        kind: SeatKind::Bot,
        chips,
        position: 0,
        entry: 0,
        fees_paid: 0,
        leak_spend: 0,
        pending_count: 0,
        desk_chips: 0,
        desk_position: 0,
        last_seen_tick: 0,
        claims: 0,
        bump: 0,
    }
}

fn leak(state: LeakState, owner: u8) -> LeakHeader {
    LeakHeader {
        leak_id: 1,
        state: state as u8,
        owner_seat: owner,
        window_end: 100,
        auction_start: 10,
        start_price: 60,
        floor_price: 5,
        ..LeakHeader::default()
    }
}

fn error<T>(result: anchor_lang::Result<T>, expected: &str) {
    let actual = format!("{:?}", result.err().expect("expected an error"));
    assert!(
        actual.contains(expected),
        "{actual} did not contain {expected}"
    );
}

#[test]
fn bidding_prices_burns_and_rejects_invalid_purchases() {
    let mut board = Board::zeroed();
    let mut buyer = seat(0, 100);
    board.headers[0] = leak(LeakState::Auction, NO_SEAT);
    assert_eq!(bid(&mut board, 0, 0, &mut buyer, 16).unwrap(), 30);
    assert_eq!((buyer.chips, buyer.leak_spend), (70, 30));
    assert_eq!(
        (
            board.headers[0].state,
            board.headers[0].owner_seat,
            board.headers[0].paid
        ),
        (LeakState::Owned as u8, 0, 30)
    );
    error(bid(&mut board, 0, 0, &mut buyer, 16), "NotForSale");
    board.headers[1] = leak(LeakState::Auction, NO_SEAT);
    error(bid(&mut board, 1, 0, &mut buyer, 22), "AuctionOver");
    board.headers[1].state = LeakState::Expired as u8;
    error(bid(&mut board, 1, 0, &mut buyer, 22), "AuctionOver");
    board.headers[1].state = LeakState::Auction as u8;
    error(bid(&mut board, 9, 0, &mut buyer, 10), "InvalidLeakSlot");
    error(bid(&mut board, 1, 10, &mut buyer, 10), "InvalidSeat");
    buyer.chips = 5;
    error(bid(&mut board, 1, 0, &mut buyer, 10), "InsufficientChips");
    assert_eq!(board.headers[1].state, LeakState::Auction as u8);
    buyer.chips = 100;
    board.headers[2] = leak(LeakState::Listed, 0);
    assert_eq!(unopened_count(&board, 0), 2);
    error(bid(&mut board, 1, 0, &mut buyer, 10), "HoardLimit");
    assert_eq!((buyer.chips, buyer.leak_spend), (100, 30));
}

#[test]
fn last_accepted_bid_pays_the_floor() {
    let mut board = Board::zeroed();
    board.headers[0] = leak(LeakState::Auction, NO_SEAT);
    let mut buyer = seat(0, 100);
    assert_eq!(bid(&mut board, 0, 0, &mut buyer, 21).unwrap(), 5);
    board.headers[1] = leak(LeakState::Auction, NO_SEAT);
    error(bid(&mut board, 1, 0, &mut buyer, 22), "AuctionOver");
}

#[test]
fn opening_requires_owner_unlisted_and_unexpired() {
    let mut board = Board::zeroed();
    let owner = Pubkey::new_unique();
    board.headers[0] = leak(LeakState::Owned, 0);
    error(open(&mut board, 0, 1, owner, 10), "NotLeakOwner");
    error(open(&mut board, 0, 0, owner, 101), "NotForSale");
    list(&mut board, 0, 0, 30).unwrap();
    error(open(&mut board, 0, 0, owner, 10), "NotForSale");
    list(&mut board, 0, 0, 0).unwrap();
    let (readers, count) = open(&mut board, 0, 0, owner, 100).unwrap();
    assert_eq!(
        (count, readers[0], board.headers[0].opened_tick),
        (1, owner, 100)
    );
    assert_eq!(board.headers[0].state, LeakState::Opened as u8);
    error(open(&mut board, 0, 0, owner, 100), "AlreadyOpened");
    error(list(&mut board, 0, 0, 20), "AlreadyOpened");
}

#[test]
fn flipping_and_delisting_preserve_chips_and_enforce_limits() {
    let mut board = Board::zeroed();
    let mut seller = seat(0, 100);
    let mut buyer = seat(1, 80);
    board.headers[0] = leak(LeakState::Owned, 0);
    error(list(&mut board, 0, 1, 30), "NotLeakOwner");
    error(list(&mut board, 0, 0, 0), "NotForSale");
    list(&mut board, 0, 0, 30).unwrap();
    error(list(&mut board, 0, 0, 31), "NotForSale");
    list(&mut board, 0, 0, 0).unwrap();
    assert_eq!(
        (board.headers[0].state, board.headers[0].ask),
        (LeakState::Owned as u8, 0)
    );
    list(&mut board, 0, 0, 30).unwrap();
    error(
        buy_listed(&mut board, 0, 0, &mut buyer, &mut seller, 20),
        "NotForSale",
    );
    error(
        buy_listed(&mut board, 0, 1, &mut buyer, &mut seller, 101),
        "NotForSale",
    );
    buyer.chips = 29;
    error(
        buy_listed(&mut board, 0, 1, &mut buyer, &mut seller, 20),
        "InsufficientChips",
    );
    buyer.chips = 80;
    board.headers[1] = leak(LeakState::Owned, 1);
    board.headers[2] = leak(LeakState::Listed, 1);
    error(
        buy_listed(&mut board, 0, 1, &mut buyer, &mut seller, 20),
        "HoardLimit",
    );
    board.headers[2] = LeakHeader::default();
    assert_eq!(
        buy_listed(&mut board, 0, 1, &mut buyer, &mut seller, 20).unwrap(),
        30
    );
    assert_eq!((buyer.chips, seller.chips, buyer.leak_spend), (50, 130, 30));
    assert_eq!(buyer.chips + seller.chips, 180);
    assert_eq!(
        (
            board.headers[0].owner_seat,
            board.headers[0].state,
            board.headers[0].paid,
            board.headers[0].ask,
            board.headers[0].flips
        ),
        (1, LeakState::Owned as u8, 30, 0, 1)
    );
}

#[test]
fn licensing_transfers_chips_and_enforces_reader_and_expiry_limits() {
    let mut board = Board::zeroed();
    let mut owner = seat(0, 100);
    let mut buyer = seat(1, 80);
    let buyer_key = buyer.owner;
    board.headers[0] = leak(LeakState::Owned, 0);
    error(offer_license(&mut board, 0, 0, 20), "NotForSale");
    open(&mut board, 0, 0, owner.owner, 15).unwrap();
    error(offer_license(&mut board, 0, 1, 20), "NotLeakOwner");
    offer_license(&mut board, 0, 0, 20).unwrap();
    error(
        buy_license(&mut board, 0, 1, buyer_key, &mut buyer, &mut owner, 101),
        "NotForSale",
    );
    buyer.chips = 19;
    error(
        buy_license(&mut board, 0, 1, buyer_key, &mut buyer, &mut owner, 20),
        "InsufficientChips",
    );
    buyer.chips = 80;
    let (readers, count) =
        buy_license(&mut board, 0, 1, buyer_key, &mut buyer, &mut owner, 100).unwrap();
    assert_eq!((readers[0], readers[1], count), (owner.owner, buyer_key, 2));
    assert_eq!((buyer.chips, owner.chips, buyer.leak_spend), (60, 120, 20));
    assert_eq!(buyer.chips + owner.chips, 180);
    error(
        buy_license(&mut board, 0, 1, buyer_key, &mut buyer, &mut owner, 20),
        "ReaderLimit",
    );
    board.headers[0].reader_count = LEAK_READERS as u8;
    error(
        buy_license(
            &mut board,
            0,
            2,
            Pubkey::new_unique(),
            &mut buyer,
            &mut owner,
            20,
        ),
        "ReaderLimit",
    );
    offer_license(&mut board, 0, 0, 0).unwrap();
    error(
        buy_license(
            &mut board,
            0,
            2,
            Pubkey::new_unique(),
            &mut buyer,
            &mut owner,
            20,
        ),
        "NotForSale",
    );
}

#[test]
fn overflow_does_not_partially_transfer_or_change_ownership() {
    let mut board = Board::zeroed();
    board.headers[0] = leak(LeakState::Listed, 0);
    board.headers[0].ask = 1;
    let mut buyer = seat(1, 20);
    let mut seller = seat(0, i64::MAX);
    error(
        buy_listed(&mut board, 0, 1, &mut buyer, &mut seller, 20),
        "Overflow",
    );
    assert_eq!(
        (buyer.chips, buyer.leak_spend, board.headers[0].owner_seat),
        (20, 0, 0)
    );
}

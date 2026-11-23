use ::insider::{engine::finish::finalize_round, *};
use anchor_lang::prelude::Pubkey;
use bytemuck::Zeroable;

fn seat(index: u8, owner: Pubkey) -> Seat {
    Seat {
        index,
        owner,
        name_idx: 0,
        kind: SeatKind::Bot,
        chips: 1_000,
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

struct Fixture {
    table: Table,
    board: Board,
    vaults: [LeakVault; LEAK_SLOTS],
    xray: Box<Xray>,
    seats: Vec<Seat>,
    season: Season,
}

impl Fixture {
    fn new(kind: LeakKind) -> Self {
        let table = Table {
            authority: Pubkey::new_unique(),
            epoch: 0,
            round_id: 7,
            phase: Phase::Xray,
            round_start_slot: 0,
            tick: 180,
            armed_until_slot: 0,
            vrf_nonce: 0,
            vrf_pending: false,
            vrf_requested_tick: 0,
            rounds_this_epoch: 0,
            params: Params::default(),
            bump: 0,
        };
        let mut board = Board::zeroed();
        board.round_id = 7;
        let mut xray = Box::new(Xray::zeroed());
        xray.round_id = 7;
        xray.order_count = 3;
        xray.orders[0] = XrayOrder {
            seat: 0,
            lane: LANE_PRIORITY,
            side_size: 10,
            sent_tick: 4,
            land_tick: 8,
            fill_price: 1_000_000,
            scheduled_tick: 8,
            _pad: [0; 2],
        };
        xray.orders[1] = XrayOrder {
            seat: 1,
            lane: LANE_STANDARD,
            side_size: 20,
            sent_tick: 0,
            land_tick: 10,
            fill_price: 1_100_000,
            scheduled_tick: 10,
            _pad: [0; 2],
        };
        xray.orders[2] = XrayOrder {
            seat: 0,
            lane: LANE_STANDARD,
            side_size: -10,
            sent_tick: 0,
            land_tick: 15,
            fill_price: 1_200_000,
            scheduled_tick: 15,
            _pad: [0; 2],
        };
        let mut seats: Vec<_> = (0..SEAT_COUNT as u8)
            .map(|i| {
                seat(
                    i,
                    if i < 2 {
                        Pubkey::new_unique()
                    } else {
                        Pubkey::default()
                    },
                )
            })
            .collect();
        seats[0].chips = 1_025;
        seats[0].entry = 100;
        seats[0].fees_paid = 7;
        seats[0].leak_spend = 15;
        seats[0].pending_count = 2;
        seats[1].chips = 950;
        board.headers[2] = LeakHeader {
            leak_id: 19,
            kind: kind as u8,
            state: LeakState::Opened as u8,
            owner_seat: 0,
            opened_tick: 3,
            reader_count: 1,
            readers: [
                seats[0].owner,
                Pubkey::default(),
                Pubkey::default(),
                Pubkey::default(),
            ],
            ..LeakHeader::default()
        };
        let mut vaults = [LeakVault::zeroed(); LEAK_SLOTS];
        let vault = &mut vaults[2];
        vault.leak_id = 19;
        vault.round_id = 7;
        vault.kind = kind as u8;
        vault.fields[2] = 10;
        vault.fields[3] = 12;
        vault.orders[0] = PendingOrder {
            seat: 1,
            lane: LANE_STANDARD,
            side_size: 20,
            land_tick: 10,
            seq: 5,
        };
        vault.order_count = 1;
        let season = Season {
            epoch: 0,
            rounds_played: 0,
            leaderboard: [ScoreEntry::default(); LEADERBOARD_SIZE],
            analysts: [AnalystStats::default(); SEAT_COUNT],
            bump: 0,
        };
        Self {
            table,
            board,
            vaults,
            xray,
            seats,
            season,
        }
    }

    fn finalize(&mut self) -> anchor_lang::Result<()> {
        let vaults: Vec<_> = self.vaults.iter().collect();
        let mut seats: Vec<_> = self.seats.iter_mut().collect();
        finalize_round(
            &self.table,
            &self.board,
            &vaults,
            &mut self.xray,
            &mut seats,
            &mut self.season,
        )
    }
}

#[test]
fn finalization_copies_scores_resets_and_is_idempotent() {
    let mut f = Fixture::new(LeakKind::Spotlight);
    let first_owner = f.seats[0].owner;
    let second_owner = f.seats[1].owner;
    f.seats[0].name_idx = 9;
    f.seats[0].kind = SeatKind::Human;
    f.seats[1].name_idx = 13;
    f.seats[1].kind = SeatKind::Ai;
    f.seats[2].chips = -4_000;
    let expected: Vec<_> = f
        .seats
        .iter()
        .map(|seat| {
            (
                seat.owner,
                if seat.is_free() {
                    0
                } else {
                    (seat.chips - BANKROLL_CHIPS) as i32
                },
                seat.kind as u8,
                seat.name_idx,
            )
        })
        .collect();
    f.finalize().unwrap();
    for (index, (owner, score, kind, name)) in expected.iter().enumerate() {
        assert_eq!(f.xray.seat_owners[index], *owner);
        assert_eq!(f.xray.scores[index], *score);
        assert_eq!(f.xray.seat_kinds[index], *kind);
        assert_eq!(f.xray.name_idx[index], *name);
    }
    assert_eq!(
        (f.xray.finalized, f.xray.round_id, f.xray.leak_count),
        (1, 7, 1)
    );
    let copy = &f.xray.leaks[0];
    assert_eq!(
        (
            copy.header.leak_id,
            copy.header.readers[0],
            copy.order_count
        ),
        (19, first_owner, 1)
    );
    assert_eq!(
        (
            copy.fields[2],
            copy.orders[0].seat,
            copy.orders[0].side_size
        ),
        (10, 1, 20)
    );
    assert_eq!(
        (f.season.leaderboard[0].owner, f.season.leaderboard[0].score),
        (first_owner, 25)
    );
    assert_eq!(
        (f.season.leaderboard[1].owner, f.season.leaderboard[1].score),
        (second_owner, -50)
    );
    assert_eq!(
        (
            f.seats[0].chips,
            f.seats[0].position,
            f.seats[0].entry,
            f.seats[0].fees_paid,
            f.seats[0].leak_spend,
            f.seats[0].pending_count
        ),
        (1_000, 0, 0, 0, 0, 0)
    );
    f.seats[0].chips = 1_777;
    f.finalize().unwrap();
    assert_eq!(f.seats[0].chips, 1_777);
    assert_eq!(f.xray.scores[0], 25);
    assert_eq!(f.xray.seat_owners[0], first_owner);
    assert_eq!(f.season.leaderboard[0].rounds, 1);
    assert_eq!(f.season.rounds_played, 1);
}

#[test]
fn finalization_accepts_i32_score_boundaries_and_ignores_free_balance() {
    let mut f = Fixture::new(LeakKind::Spotlight);
    f.seats[0].chips = i64::from(i32::MAX) + BANKROLL_CHIPS;
    f.seats[1].chips = i64::from(i32::MIN) + BANKROLL_CHIPS;
    f.seats[2].chips = i64::MAX;
    f.finalize().unwrap();
    assert_eq!(f.xray.scores[0], i32::MAX);
    assert_eq!(f.xray.scores[1], i32::MIN);
    assert_eq!(f.xray.scores[2], 0);
}

#[test]
fn finalization_preserves_existing_archives_and_deduplicates_current_headers() {
    let mut f = Fixture::new(LeakKind::Spotlight);
    f.xray.leak_count = 2;
    f.xray.leaks[0].header.leak_id = 11;
    f.xray.leaks[0].fields[0] = 44;
    f.xray.leaks[1].header = f.board.headers[2];
    f.xray.leaks[1].fields[0] = 55;
    f.finalize().unwrap();
    assert_eq!(f.xray.leak_count, 2);
    assert_eq!(
        (f.xray.leaks[0].header.leak_id, f.xray.leaks[0].fields[0]),
        (11, 44)
    );
    assert_eq!(
        (f.xray.leaks[1].header.leak_id, f.xray.leaks[1].fields[0]),
        (19, 55)
    );
}

#[test]
fn finalization_deduplicates_at_capacity_and_rejects_overflow() {
    let mut full = Fixture::new(LeakKind::Spotlight);
    full.xray.leak_count = DROPS_PER_ROUND as u8;
    for (i, leak) in full.xray.leaks.iter_mut().enumerate() {
        leak.header.leak_id = i as u32;
    }
    full.xray.leaks[DROPS_PER_ROUND - 1].header.leak_id = 19;
    full.finalize().unwrap();
    assert_eq!(usize::from(full.xray.leak_count), DROPS_PER_ROUND);

    let mut overflow = Fixture::new(LeakKind::Spotlight);
    overflow.xray.leak_count = DROPS_PER_ROUND as u8;
    for (i, leak) in overflow.xray.leaks.iter_mut().enumerate() {
        leak.header.leak_id = i as u32;
    }
    let error = overflow.finalize().unwrap_err();
    assert!(format!("{error:?}").contains("Overflow"));
    assert_eq!(usize::from(overflow.xray.leak_count), DROPS_PER_ROUND);
    assert_eq!(overflow.xray.finalized, 0);
}

#[test]
fn spotlight_full_book_and_flow_produce_one_sandwich() {
    for kind in [LeakKind::Spotlight, LeakKind::FullBook, LeakKind::Flow] {
        let mut f = Fixture::new(kind);
        f.finalize().unwrap();
        assert_eq!(f.xray.tag_count, 1, "{kind:?}");
        let tag = &f.xray.tags[0];
        assert_eq!(
            (
                tag.front,
                tag.victim,
                tag.leak_slot,
                tag.front_tick,
                tag.victim_tick,
                tag.profit_estimate
            ),
            (0, 1, 2, 8, 10, 2)
        );
    }
}

#[test]
fn carried_victims_match_scheduled_payloads_but_tags_use_actual_landing_ticks() {
    for kind in [LeakKind::Spotlight, LeakKind::FullBook, LeakKind::Flow] {
        let mut carried = Fixture::new(kind);
        carried.xray.orders[1].land_tick = 12;
        carried.finalize().unwrap();
        assert_eq!(carried.xray.tag_count, 1, "{kind:?}");
        assert_eq!(carried.xray.tags[0].victim_tick, 12);

        let mut too_late = Fixture::new(kind);
        too_late.xray.orders[1].land_tick = 16;
        too_late.finalize().unwrap();
        assert_eq!(too_late.xray.tag_count, 0, "{kind:?}");
    }
}

#[test]
fn license_reader_and_sell_side_profit_are_supported() {
    let mut f = Fixture::new(LeakKind::FullBook);
    f.board.headers[2].owner_seat = 1;
    f.board.headers[2].reader_count = 2;
    f.board.headers[2].readers[0] = f.seats[1].owner;
    f.board.headers[2].readers[1] = f.seats[0].owner;
    f.xray.orders[0].side_size = -10;
    f.xray.orders[0].fill_price = 1_200_000;
    f.xray.orders[1].side_size = -20;
    f.xray.orders[2].side_size = 10;
    f.xray.orders[2].fill_price = 1_000_000;
    f.vaults[2].orders[0].side_size = -20;
    f.finalize().unwrap();
    assert_eq!(f.xray.tag_count, 1);
    assert_eq!(f.xray.tags[0].profit_estimate, 2);
}

#[test]
fn no_tag_for_unread_wrong_side_outside_window_or_self() {
    for scenario in 0..5 {
        let mut f = Fixture::new(LeakKind::Spotlight);
        match scenario {
            0 => f.board.headers[2].reader_count = 0,
            1 => f.xray.orders[0].side_size = -10,
            2 => f.xray.orders[2].land_tick = 17,
            3 => f.xray.orders[1].seat = 0,
            4 => f.vaults[2].orders[0].side_size = 19,
            _ => unreachable!(),
        }
        f.finalize().unwrap();
        assert_eq!(f.xray.tag_count, 0, "scenario {scenario}");
    }
}

#[test]
fn tag_limit_round_validation_and_vault_matching() {
    let mut f = Fixture::new(LeakKind::Flow);
    for i in 3..23 {
        f.xray.orders[i] = f.xray.orders[1];
    }
    f.xray.order_count = 23;
    f.finalize().unwrap();
    assert_eq!(usize::from(f.xray.tag_count), XRAY_TAGS);
    let mut wrong = Fixture::new(LeakKind::Flow);
    wrong.vaults[2].leak_id = 99;
    assert!(wrong.finalize().is_err());
    assert_eq!(wrong.xray.finalized, 0);
    wrong.vaults[2].leak_id = 19;
    wrong.board.round_id = 8;
    assert!(wrong.finalize().is_err());
    assert_eq!(wrong.seats[0].chips, 1_025);
}

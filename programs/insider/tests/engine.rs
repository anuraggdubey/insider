use ::insider::{
    engine::{
        finish::finalize_round,
        orders::push_order,
        round::begin_round,
        step::{step, StepAccounts, StepReport},
    },
    math::{
        arb::{arb_pull, isqrt_u128},
        dutch::{auction_over, dutch_price},
        path::fundamental_path,
        payloads::{build_payload, payload_window},
        prng::Prng,
        seed::seed_round,
        vamm::Vamm,
    },
    *,
};
use anchor_lang::prelude::Pubkey;
use bytemuck::Zeroable;

fn table() -> Table {
    Table {
        authority: Pubkey::new_unique(),
        epoch: 0,
        round_id: 7,
        phase: Phase::Live,
        round_start_slot: 0,
        tick: 0,
        armed_until_slot: 0,
        vrf_nonce: 0,
        vrf_pending: false,
        vrf_requested_tick: 0,
        rounds_this_epoch: 0,
        params: Params::default(),
        bump: 0,
    }
}

fn seat(index: u8) -> Seat {
    Seat {
        index,
        owner: Pubkey::new_unique(),
        name_idx: 0,
        kind: SeatKind::Bot,
        chips: 100_000,
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

fn tape() -> Tape {
    Tape {
        sends: [SendEvent::default(); TAPE_RING],
        sends_head: 0,
        fills: [Fill::default(); TAPE_RING],
        fills_head: 0,
        bump: 0,
    }
}

struct Fixture {
    table: Table,
    market: Market,
    mempool: Mempool,
    future: Future,
    board: Board,
    vaults: [LeakVault; LEAK_SLOTS],
    seats: Vec<Seat>,
    tape: Tape,
    xray: Box<Xray>,
}

impl Fixture {
    fn new() -> Self {
        let mut f = Self {
            table: table(),
            market: Market::zeroed(),
            mempool: Mempool::zeroed(),
            future: Future::zeroed(),
            board: Board::zeroed(),
            vaults: [LeakVault::zeroed(); LEAK_SLOTS],
            seats: (0..SEAT_COUNT as u8).map(seat).collect(),
            tape: tape(),
            xray: Box::new(Xray::zeroed()),
        };
        begin_round(
            &f.table,
            &[7; 32],
            &mut f.market,
            &mut f.mempool,
            &mut f.future,
            &mut f.board,
            &mut f.xray,
        )
        .unwrap();
        f
    }

    fn clear_orders(&mut self) {
        self.mempool.orders.fill(PendingOrder::default());
        self.mempool.count = 0;
        self.mempool.next_seq = 0;
        for s in &mut self.seats {
            s.pending_count = 0;
        }
    }

    fn try_tick(&mut self, tick: u16) -> anchor_lang::Result<StepReport> {
        let mut vaults: Vec<_> = self.vaults.iter_mut().collect();
        let mut seats: Vec<_> = self.seats.iter_mut().collect();
        step(
            &self.table,
            tick,
            &mut StepAccounts {
                market: &mut self.market,
                mempool: &mut self.mempool,
                future: &self.future,
                board: &mut self.board,
                vaults: &mut vaults,
                seats: &mut seats,
                tape: &mut self.tape,
                xray: &mut self.xray,
            },
        )
    }

    fn tick(&mut self, tick: u16) -> StepReport {
        self.try_tick(tick).unwrap()
    }
}

fn order(seat: u8, side_size: i16, land_tick: u16, seq: u16) -> PendingOrder {
    PendingOrder {
        seat,
        lane: LANE_STANDARD,
        side_size,
        land_tick,
        seq,
    }
}

#[test]
fn random_streams_and_paths_are_deterministic_and_bounded() {
    let seed = [3; 32];
    let mut a = Prng::derive(&seed, 1);
    let mut b = Prng::derive(&seed, 1);
    let mut c = Prng::derive(&seed, 2);
    let first = a.next_u64();
    assert_eq!(first, b.next_u64());
    assert_ne!(first, c.next_u64());
    assert_ne!(Prng::from_seed(&[0; 32]).next_u64(), 0);
    for n in 0u64..200 {
        let mut seed = [0u8; 32];
        seed[..8].copy_from_slice(&n.to_le_bytes());
        let mut a = [0; PATH_LEN];
        let mut b = [0; PATH_LEN];
        let out = fundamental_path(&mut Prng::derive(&seed, 1), &mut a);
        let other = fundamental_path(&mut Prng::derive(&seed, 1), &mut b);
        assert_eq!(a, b);
        assert_eq!(a[0], PRICE_ONE);
        assert!(a
            .iter()
            .all(|p| (PRICE_ONE / 2..=PRICE_ONE * 2).contains(p)));
        assert!((2..=4).contains(&out.shock_count));
        assert_eq!(out.shock_count, other.shock_count);
        let shocks = &out.shocks[..usize::from(out.shock_count)];
        for shock in shocks {
            assert!((21..=165).contains(&shock.tick));
            assert!((3..=6).contains(&shock.len));
            assert!((800..=1_500).contains(&shock.bps.unsigned_abs()));
        }
        assert!(shocks
            .windows(2)
            .all(|p| p[0].tick + u16::from(p[0].len) <= p[1].tick));
    }
}

#[test]
fn vamm_quotes_rounding_and_arbitrage() {
    let initial = Vamm {
        base: 50_000,
        quote: 50_000,
    };
    let mut pool = initial;
    let q = pool.quote_fill(2_000, 10).unwrap();
    assert_eq!(q, pool.apply_fill(2_000, 10).unwrap());
    assert!((1_080_000..=1_090_000).contains(&pool.price()));
    let sell = pool.apply_fill(-2_000, 10).unwrap();
    assert!(q.quote + q.fee > sell.quote.saturating_sub(sell.fee));
    assert!(initial.quote_fill(i16::MAX, 10).is_ok());
    assert!(Vamm {
        base: 2_000,
        quote: 2_000
    }
    .quote_fill(2_000, 10)
    .is_err());
    let mut pool = Vamm {
        base: 50_000,
        quote: 60_000,
    };
    let old = pool.price();
    arb_pull(&mut pool, PRICE_ONE, 400).unwrap();
    let new = pool.price();
    assert!(new >= PRICE_ONE && new < old);
    assert!((6_000..=10_000).contains(&(old - new)));
    let mut small = Vamm { base: 1, quote: 1 };
    arb_pull(&mut small, PRICE_ONE + 1, 10_000).unwrap();
    assert!(small.price() <= PRICE_ONE + 1);
}

#[test]
fn sqrt_and_dutch_endpoints() {
    for n in [1u128, 2, 17, 1_000_000, u64::MAX as u128] {
        let square = n * n;
        assert_eq!(isqrt_u128(square), n);
        assert_eq!(isqrt_u128(square - 1), n - 1);
        if square < u128::MAX {
            assert_eq!(isqrt_u128(square + 1), n);
        }
    }
    assert_eq!(dutch_price(120, 10, 10, 10), 120);
    assert_eq!(dutch_price(120, 10, 10, 22), 10);
    assert!(!auction_over(10, 21));
    assert!(auction_over(10, 22));
}

#[test]
fn seeded_drop_distribution_and_kind_rules() {
    let mut counts = [0usize; 3];
    for i in 0u64..5_000 {
        let mut seed = [0u8; 32];
        seed[..8].copy_from_slice(&i.to_le_bytes());
        let mut future = Future::zeroed();
        let round = seed_round(&seed, &mut future);
        assert!((3..=5).contains(&round.whale_count));
        for w in &round.whales[..usize::from(round.whale_count)] {
            assert_eq!(w.seat, WHALE_SEAT);
            assert!((1500..=3000).contains(&w.side_size.unsigned_abs()));
            assert!((30..=170).contains(&w.land_tick));
        }
        for (j, drop) in round.drops.iter().enumerate() {
            assert_eq!(drop.tick, FIRST_DROP_TICK + j as u16 * DROP_EVERY_TICKS);
            counts[drop.rarity as usize] += 1;
            let kind = LeakKind::from_u8(drop.kind);
            match Rarity::from_u8(drop.rarity) {
                Rarity::Common => assert!(matches!(
                    kind,
                    LeakKind::Flow | LeakKind::Pin | LeakKind::Drift
                )),
                Rarity::Rare => assert!(matches!(
                    kind,
                    LeakKind::Spotlight | LeakKind::Whale | LeakKind::Shockwave
                )),
                Rarity::Epic => assert!(matches!(kind, LeakKind::FullBook | LeakKind::Summit)),
            }
        }
    }
    assert!((25_000..27_000).contains(&counts[0]), "{counts:?}");
    assert!((11_000..13_000).contains(&counts[1]), "{counts:?}");
    assert!((1_500..2_500).contains(&counts[2]), "{counts:?}");
}

#[test]
fn every_payload_is_computed_from_source_state() {
    let mut f = Fixture::new();
    f.clear_orders();
    let source = [
        order(1, 50, 35, 3),
        order(2, -70, 38, 2),
        order(WHALE_SEAT, 2000, 45, 4),
        order(3, 70, 40, 1),
        order(WHALE_SEAT, -1800, 42, 5),
    ];
    f.mempool.orders[..source.len()].copy_from_slice(&source);
    for (i, p) in f.future.path.iter_mut().enumerate() {
        *p = PRICE_ONE + i as u32 * 1000;
    }
    f.future.shock_count = 2;
    f.future.shocks[0] = Shock {
        tick: 45,
        bps: -300,
        len: 3,
        _pad: [0; 3],
    };
    f.future.shocks[1] = Shock {
        tick: 65,
        bps: 400,
        len: 4,
        _pad: [0; 3],
    };
    let mut vault = LeakVault::zeroed();
    for kind in [
        LeakKind::Flow,
        LeakKind::Spotlight,
        LeakKind::Whale,
        LeakKind::FullBook,
        LeakKind::Pin,
        LeakKind::Drift,
        LeakKind::Shockwave,
        LeakKind::Summit,
    ] {
        let spec = DropSpec {
            kind: kind as u8,
            window_offset: 10,
            window_len: 10,
            ..DropSpec::default()
        };
        build_payload(&spec, 30, &f.mempool, &f.future, &mut vault);
        match kind {
            LeakKind::Flow => {
                let selected: Vec<_> = source
                    .iter()
                    .filter(|o| (40..=49).contains(&o.land_tick))
                    .collect();
                assert_eq!(
                    vault.fields[..4],
                    [
                        selected.iter().map(|o| i32::from(o.side_size)).sum(),
                        selected.len() as i32,
                        40,
                        49
                    ]
                );
                assert_eq!(payload_window(&spec, 30, &vault), (40, 49));
            }
            LeakKind::Spotlight => assert_eq!(vault.orders[0], source[3]),
            LeakKind::Whale => assert_eq!(vault.orders[0], source[4]),
            LeakKind::FullBook => {
                let mut sorted = source.to_vec();
                sorted.sort_by_key(|o| (o.land_tick, o.seq));
                assert_eq!(&vault.orders[..5], &sorted);
            }
            LeakKind::Pin => assert_eq!(vault.fields[..2], [40, f.future.path[40] as i32]),
            LeakKind::Drift => {
                let bps = (i64::from(f.future.path[40]) - i64::from(f.future.path[30])) * 10_000
                    / i64::from(f.future.path[30]);
                assert_eq!(
                    vault.fields,
                    [30, 40, bps.signum() as i32, 0, bps as i32, 0]
                );
                assert_eq!(payload_window(&spec, 30, &vault), (31, 40));
            }
            LeakKind::Shockwave => assert_eq!(vault.fields, [1, 45, -1, 70, 0, 0]),
            LeakKind::Summit => assert_eq!(
                vault.fields,
                [
                    f.future.path[90] as i32,
                    90,
                    f.future.path[31] as i32,
                    31,
                    31,
                    90
                ]
            ),
        }
    }
}

#[test]
fn order_validation_fees_and_delays() {
    let mut f = Fixture::new();
    f.clear_orders();
    let params = f.table.params;
    let err = |r: anchor_lang::Result<PendingOrder>, name: &str| {
        assert!(format!("{:?}", r.unwrap_err()).contains(name))
    };
    err(
        push_order(&params, 10, &mut f.seats[0], &mut f.mempool, 0, 3),
        "InvalidLane",
    );
    err(
        push_order(&params, 10, &mut f.seats[0], &mut f.mempool, 0, 0),
        "ZeroOrder",
    );
    err(
        push_order(&params, 10, &mut f.seats[0], &mut f.mempool, 2001, 0),
        "OrderTooLarge",
    );
    f.seats[0].pending_count = params.max_pending;
    err(
        push_order(&params, 10, &mut f.seats[0], &mut f.mempool, 1, 0),
        "TooManyPending",
    );
    f.seats[0].pending_count = 0;
    f.mempool.orders.fill(order(WHALE_SEAT, 1, 99, 0));
    err(
        push_order(&params, 10, &mut f.seats[0], &mut f.mempool, 1, 0),
        "MempoolFull",
    );
    f.clear_orders();
    f.seats[0].position = i32::from(params.max_position_units);
    err(
        push_order(&params, 10, &mut f.seats[0], &mut f.mempool, 1, 0),
        "PositionLimit",
    );
    f.seats[0].position = 0;
    let standard = push_order(
        &params,
        10,
        &mut f.seats[0],
        &mut f.mempool,
        100,
        LANE_STANDARD,
    )
    .unwrap();
    let priority = push_order(
        &params,
        10,
        &mut f.seats[0],
        &mut f.mempool,
        -50,
        LANE_PRIORITY,
    )
    .unwrap();
    assert_eq!((standard.land_tick, priority.land_tick), (30, 14));
    assert_eq!((standard.seq, priority.seq), (0, 1));
    assert_eq!(f.seats[0].chips, 100_000 - i64::from(params.priority_fee));
    assert_eq!(f.seats[0].fees_paid, u64::from(params.priority_fee));
    assert_eq!(f.seats[0].pending_count, 2);
    f.seats[0].position = 4_950;
    err(
        push_order(
            &params,
            10,
            &mut f.seats[0],
            &mut f.mempool,
            1,
            LANE_STANDARD,
        ),
        "PositionLimit",
    );
}

#[test]
fn round_reset_preserves_bumps_and_next_leak_id() {
    let mut f = Fixture::new();
    f.market.bump = 3;
    f.mempool.bump = 4;
    f.future.bump = 5;
    f.board.bump = 6;
    f.xray.bump = 7;
    f.board.next_leak_id = 42;
    f.board.headers[0].state = LeakState::Opened as u8;
    f.xray.order_count = 5;
    f.xray.seat_owners[0] = Pubkey::new_unique();
    f.xray.scores[0] = 41;
    f.xray.seat_kinds[0] = 2;
    f.xray.name_idx[0] = 9;
    f.xray._seat_pad = [1; 4];
    f.market.liquidated_mask = 1023;
    begin_round(
        &f.table,
        &[4; 32],
        &mut f.market,
        &mut f.mempool,
        &mut f.future,
        &mut f.board,
        &mut f.xray,
    )
    .unwrap();
    assert_eq!(
        (
            f.market.bump,
            f.mempool.bump,
            f.future.bump,
            f.board.bump,
            f.xray.bump
        ),
        (3, 4, 5, 6, 7)
    );
    assert_eq!(f.board.next_leak_id, 42);
    assert!(f
        .board
        .headers
        .iter()
        .all(|h| h.state == LeakState::Empty as u8 && h.owner_seat == NO_SEAT));
    assert_eq!(
        (
            f.market.history[0],
            f.market.price,
            f.market.liquidated_mask
        ),
        (PRICE_ONE, PRICE_ONE, 0)
    );
    assert_eq!(f.xray.order_count, 0);
    assert!(f
        .xray
        .seat_owners
        .iter()
        .all(|owner| *owner == Pubkey::default()));
    assert!(f.xray.scores.iter().all(|score| *score == 0));
    assert!(f.xray.seat_kinds.iter().all(|kind| *kind == 0));
    assert!(f.xray.name_idx.iter().all(|name| *name == 0));
    assert_eq!(f.xray._seat_pad, [0; 4]);
    assert_eq!(f.market.round_id, f.table.round_id);
    assert_eq!(f.future.round_id, f.table.round_id);
    assert_eq!(f.board.round_id, f.table.round_id);
    assert_eq!(f.mempool.round_id, f.table.round_id);
    assert_eq!(f.xray.round_id, f.table.round_id);
    for (i, whale) in f.mempool.orders[..usize::from(f.mempool.count)]
        .iter()
        .enumerate()
    {
        assert_eq!((whale.seat, whale.seq), (WHALE_SEAT, i as u16));
    }
}

#[test]
fn next_round_waits_for_all_vaults_to_be_resealed() {
    let mut f = Fixture::new();
    f.board.headers[0].reader_count = 1;
    f.board.headers[0].readers[0] = Pubkey::new_unique();
    let old_round = f.market.round_id;
    f.table.round_id += 1;
    let result = begin_round(
        &f.table,
        &[9; 32],
        &mut f.market,
        &mut f.mempool,
        &mut f.future,
        &mut f.board,
        &mut f.xray,
    );
    assert!(result.is_err());
    assert_eq!(f.market.round_id, old_round);
    assert_eq!(f.board.headers[0].reader_count, 1);
    f.board.headers[0].reader_count = 0;
    begin_round(
        &f.table,
        &[9; 32],
        &mut f.market,
        &mut f.mempool,
        &mut f.future,
        &mut f.board,
        &mut f.xray,
    )
    .unwrap();
    assert_eq!(f.board.round_id, f.table.round_id);
}

#[test]
fn payload_caps_clamping_and_empty_cases() {
    let mut f = Fixture::new();
    f.clear_orders();
    let mut vault = LeakVault::zeroed();
    for kind in [LeakKind::Spotlight, LeakKind::Whale, LeakKind::FullBook] {
        let spec = DropSpec {
            kind: kind as u8,
            ..DropSpec::default()
        };
        build_payload(&spec, 170, &f.mempool, &f.future, &mut vault);
        assert_eq!(vault.order_count, 0);
        assert_eq!(payload_window(&spec, 170, &vault), (171, 179));
    }
    for i in 0..MEMPOOL_SLOTS {
        f.mempool.orders[i] = order(1, 1, 100 - i as u16, i as u16);
    }
    let spec = DropSpec {
        kind: LeakKind::FullBook as u8,
        ..DropSpec::default()
    };
    build_payload(&spec, 50, &f.mempool, &f.future, &mut vault);
    assert_eq!(vault.order_count as usize, LEAK_PAYLOAD_ORDERS);
    assert!(vault
        .orders
        .windows(2)
        .all(|w| (w[0].land_tick, w[0].seq) <= (w[1].land_tick, w[1].seq)));
    for kind in [
        LeakKind::Flow,
        LeakKind::Pin,
        LeakKind::Drift,
        LeakKind::Shockwave,
        LeakKind::Summit,
    ] {
        let spec = DropSpec {
            kind: kind as u8,
            window_offset: 20,
            window_len: 60,
            ..DropSpec::default()
        };
        build_payload(&spec, 170, &f.mempool, &f.future, &mut vault);
        let (start, end) = payload_window(&spec, 170, &vault);
        assert!(start <= 179 && end <= 179);
    }
}

#[test]
fn step_orders_maturity_cap_carry_whales_and_history() {
    let mut f = Fixture::new();
    f.clear_orders();
    for i in 0..15 {
        f.mempool.orders[i] = order(
            if i == 0 { WHALE_SEAT } else { (i % 10) as u8 },
            10 + i as i16,
            if i < 2 { 8 } else { 9 },
            (15 - i) as u16,
        );
        if i != 0 {
            f.seats[i % 10].pending_count += 1;
        }
    }
    f.mempool.count = 15;
    let mut expected = f.mempool.orders[..15].to_vec();
    expected.sort_by_key(|o| (o.land_tick, o.seq));
    let before = f.market.price;
    let report = f.tick(10);
    assert_eq!((report.fills, report.carried), (12, 3));
    assert_eq!(f.mempool.count, 3);
    let landed = &f.xray.orders[..12];
    assert_eq!((landed[0].land_tick, landed[0].seat), (8, 1));
    assert_eq!((landed[1].land_tick, landed[1].seat), (8, WHALE_SEAT));
    assert_eq!(
        landed.iter().map(|o| o.side_size).collect::<Vec<_>>(),
        expected[..12]
            .iter()
            .map(|o| o.side_size)
            .collect::<Vec<_>>()
    );
    assert!(landed[2..]
        .windows(2)
        .all(|w| w[0].land_tick <= w[1].land_tick));
    assert_eq!(f.tape.fills_head, 12);
    assert_eq!(f.seats[1].last_seen_tick, 10);
    assert_eq!(f.market.history[10], f.market.price);
    assert_eq!(f.market.last_tick, 10);
    assert_ne!(f.market.price, before);
    assert_eq!(f.tick(11).fills, 3);
}

#[test]
fn step_applies_arb_after_fills() {
    let mut f = Fixture::new();
    f.clear_orders();
    f.future.path[10] = PRICE_ONE;
    f.mempool.orders[0] = order(WHALE_SEAT, 2_000, 10, 0);
    f.mempool.count = 1;
    let mut expected = Vamm {
        base: f.market.base,
        quote: f.market.quote,
    };
    expected.apply_fill(2_000, f.table.params.fee_bps).unwrap();
    let pre_arb = expected.price();
    arb_pull(&mut expected, PRICE_ONE, f.table.params.arb_bps).unwrap();
    f.tick(10);
    assert_eq!(
        (f.market.base, f.market.quote, f.market.price),
        (expected.base, expected.quote, expected.price())
    );
    assert!(f.market.price < pre_arb);
    assert_eq!(f.market.history[10], f.market.price);
}

#[test]
fn seat_entry_weight_reduce_flip_and_flat() {
    let mut f = Fixture::new();
    f.clear_orders();
    f.table.params.arb_bps = 0;
    let mut fill = |size| {
        let p = f.table.params;
        push_order(&p, 0, &mut f.seats[0], &mut f.mempool, size, LANE_PRIORITY).unwrap();
        f.tick(4);
        (
            f.seats[0].position,
            f.seats[0].entry,
            f.xray.orders[usize::from(f.xray.order_count) - 1].fill_price,
        )
    };
    let (_, first, _) = fill(100);
    let (pos, second, price) = fill(100);
    assert_eq!(pos, 200);
    assert_eq!(second, (first + u64::from(price)) / 2);
    let (_, reduced, _) = fill(-50);
    assert_eq!(reduced, second);
    let (pos, flipped, price) = fill(-200);
    assert_eq!(pos, -50);
    assert_eq!(flipped, u64::from(price));
    let (pos, entry, _) = fill(50);
    assert_eq!((pos, entry), (0, 0));
}

#[test]
fn mint_expire_caps_and_opened_slot_is_never_reused() {
    let mut f = Fixture::new();
    f.clear_orders();
    f.mempool.drops[0] = DropSpec {
        tick: 10,
        kind: LeakKind::Pin as u8,
        rarity: Rarity::Rare as u8,
        window_offset: 20,
        ..DropSpec::default()
    };
    let report = f.tick(10);
    assert_eq!(report.minted, 1);
    let h = f.board.headers[0];
    assert_eq!(
        (h.state, h.kind, h.owner_seat, h.window_start, h.window_end),
        (
            LeakState::Auction as u8,
            LeakKind::Pin as u8,
            NO_SEAT,
            30,
            30
        )
    );
    assert_eq!((h.start_price, h.floor_price), (20, 2));
    assert_eq!(f.vaults[0].leak_id, h.leak_id);
    assert_eq!(f.tick(22).expired, 1);
    f.board.headers[0].reader_count = 1;
    f.board.headers[0].readers[0] = Pubkey::new_unique();
    f.mempool.drops[1] = DropSpec {
        tick: 30,
        kind: LeakKind::Flow as u8,
        window_offset: 2,
        window_len: 10,
        ..DropSpec::default()
    };
    assert_eq!(f.tick(30).minted, 1);
    assert_eq!(f.board.headers[0].state, LeakState::Expired as u8);
    assert_eq!(f.board.headers[1].state, LeakState::Auction as u8);
    f.board.headers[1].state = LeakState::Opened as u8;
    f.board.headers[1].window_end = 31;
    f.board.headers[1].reader_count = 1;
    assert_eq!(f.tick(32).expired, 1);
    for h in &mut f.board.headers[2..6] {
        h.state = LeakState::Owned as u8;
        h.window_end = 100;
    }
    f.mempool.drops[2].tick = 50;
    assert_eq!(f.tick(50).minted, 0);
    assert_eq!(f.board.drop_index, 3);
}

#[test]
fn unread_expired_leak_is_archived_only_after_its_window() {
    let mut f = Fixture::new();
    f.clear_orders();
    f.mempool.orders[0] = order(1, 123, 30, 7);
    f.mempool.count = 1;
    f.seats[1].pending_count = 1;
    f.mempool.drops[0] = DropSpec {
        tick: 10,
        kind: LeakKind::Spotlight as u8,
        ..DropSpec::default()
    };
    for (index, tick) in [(1, 25), (2, 30), (3, 31)] {
        f.mempool.drops[index] = DropSpec {
            tick,
            kind: LeakKind::Pin as u8,
            window_offset: 30,
            ..DropSpec::default()
        };
    }
    assert_eq!(f.tick(10).minted, 1);
    let original_header = f.board.headers[0];
    let original_fields = f.vaults[0].fields;
    let original_orders = f.vaults[0].orders;
    let original_order_count = f.vaults[0].order_count;
    assert_eq!(original_header.window_end, 30);
    assert_eq!(original_order_count, 1);
    assert_eq!(f.tick(22).expired, 1);
    for tick in [25, 30] {
        assert_eq!(f.tick(tick).minted, 1);
        assert_eq!(f.board.headers[0].leak_id, original_header.leak_id);
        assert_eq!(f.xray.leak_count, 0, "payload exposed at tick {tick}");
    }
    assert_eq!(f.tick(31).minted, 1);
    assert_ne!(f.board.headers[0].leak_id, original_header.leak_id);
    assert_eq!(f.xray.leak_count, 1);
    let archived = &f.xray.leaks[0];
    assert_eq!(archived.header.leak_id, original_header.leak_id);
    assert_eq!(archived.header.state, LeakState::Expired as u8);
    assert_eq!(archived.header.window_end, 30);
    assert_eq!(archived.fields, original_fields);
    assert_eq!(archived.orders, original_orders);
    assert_eq!(archived.order_count, original_order_count);
}

#[test]
fn no_reuse_when_all_expired_slots_are_still_private_or_have_readers() {
    let mut f = Fixture::new();
    f.clear_orders();
    for slot in 0..LEAK_SLOTS {
        f.board.headers[slot] = LeakHeader {
            leak_id: slot as u32,
            state: LeakState::Expired as u8,
            window_end: 100,
            ..LeakHeader::default()
        };
        f.vaults[slot].leak_id = slot as u32;
        f.vaults[slot].round_id = f.table.round_id;
    }
    f.board.headers[0].reader_count = 1;
    f.mempool.drops[0].tick = 99;
    f.mempool.drops[1].tick = 100;
    f.mempool.drops[2].tick = 101;
    for tick in [99, 100] {
        assert_eq!(f.tick(tick).minted, 0);
        assert_eq!(f.xray.leak_count, 0);
    }
    assert_eq!(f.tick(101).minted, 1);
    assert_eq!(f.board.headers[0].state, LeakState::Expired as u8);
    assert_eq!(f.xray.leaks[0].header.leak_id, 1);
}

#[test]
fn step_rejects_xray_from_a_different_round() {
    let mut f = Fixture::new();
    f.xray.round_id += 1;
    let error = f.try_tick(10).unwrap_err();
    assert!(format!("{error:?}").contains("WrongPhase"));
    assert_eq!(f.board.drop_index, 0);
    assert_eq!(f.xray.leak_count, 0);
}

#[test]
fn step_does_not_overwrite_a_leak_when_the_archive_is_full() {
    let mut f = Fixture::new();
    f.clear_orders();
    f.board.headers[0] = LeakHeader {
        leak_id: 99,
        state: LeakState::Expired as u8,
        window_end: 9,
        ..LeakHeader::default()
    };
    f.vaults[0].leak_id = 99;
    f.vaults[0].round_id = f.table.round_id;
    f.vaults[0].fields[0] = 123;
    f.xray.leak_count = DROPS_PER_ROUND as u8;
    for (i, leak) in f.xray.leaks.iter_mut().enumerate() {
        leak.header.leak_id = i as u32;
    }
    f.mempool.drops[0].tick = 10;
    let error = f.try_tick(10).unwrap_err();
    assert!(format!("{error:?}").contains("Overflow"));
    assert_eq!(f.board.headers[0].leak_id, 99);
    assert_eq!(f.vaults[0].fields[0], 123);
    assert_eq!(usize::from(f.xray.leak_count), DROPS_PER_ROUND);
}

#[test]
fn step_does_not_archive_the_same_leak_twice() {
    let mut f = Fixture::new();
    f.clear_orders();
    f.board.headers[0] = LeakHeader {
        leak_id: 99,
        state: LeakState::Expired as u8,
        window_end: 9,
        ..LeakHeader::default()
    };
    f.vaults[0].leak_id = 99;
    f.vaults[0].round_id = f.table.round_id;
    f.xray.leak_count = 1;
    f.xray.leaks[0].header = f.board.headers[0];
    f.xray.leaks[0].fields[0] = 123;
    f.mempool.drops[0].tick = 10;
    assert_eq!(f.tick(10).minted, 1);
    assert_eq!(f.xray.leak_count, 1);
    assert_eq!(f.xray.leaks[0].fields[0], 123);
    assert_ne!(f.board.headers[0].leak_id, 99);
}

#[test]
fn full_round_xray_contains_every_minted_leak_exactly_once() {
    let mut f = Fixture::new();
    f.clear_orders();
    for (i, drop) in f.mempool.drops.iter_mut().enumerate() {
        *drop = DropSpec {
            tick: FIRST_DROP_TICK + i as u16 * DROP_EVERY_TICKS,
            kind: LeakKind::Pin as u8,
            window_offset: if i == 0 { 30 } else { 15 },
            ..DropSpec::default()
        };
    }
    let mut minted = Vec::new();
    for tick in 1..ROUND_TICKS {
        if f.tick(tick).minted != 0 {
            let (slot, header) = f
                .board
                .headers
                .iter()
                .enumerate()
                .find(|(_, header)| header.minted_tick == tick)
                .unwrap();
            let vault = &f.vaults[slot];
            minted.push((
                header.leak_id,
                vault.fields,
                vault.orders,
                vault.order_count,
            ));
        }
        for leak in &f.xray.leaks[..usize::from(f.xray.leak_count)] {
            assert!(
                tick > leak.header.window_end,
                "early disclosure at tick {tick}"
            );
        }
    }
    assert_eq!(minted.len(), DROPS_PER_ROUND);
    assert!(f.xray.leak_count > 0);
    f.table.phase = Phase::Xray;
    f.table.tick = CLOSING_END_TICK;
    let mut season = Season {
        epoch: 0,
        rounds_played: 0,
        leaderboard: [ScoreEntry::default(); LEADERBOARD_SIZE],
        analysts: [AnalystStats::default(); SEAT_COUNT],
        bump: 0,
    };
    let vaults: Vec<_> = f.vaults.iter().collect();
    let mut seats: Vec<_> = f.seats.iter_mut().collect();
    finalize_round(
        &f.table,
        &f.board,
        &vaults,
        &mut f.xray,
        &mut seats,
        &mut season,
    )
    .unwrap();
    assert_eq!(usize::from(f.xray.leak_count), minted.len());
    for (leak_id, fields, orders, order_count) in minted {
        let matching: Vec<_> = f.xray.leaks[..usize::from(f.xray.leak_count)]
            .iter()
            .filter(|leak| leak.header.leak_id == leak_id)
            .collect();
        assert_eq!(matching.len(), 1, "leak {leak_id}");
        assert_eq!(matching[0].fields, fields);
        assert_eq!(matching[0].orders, orders);
        assert_eq!(matching[0].order_count, order_count);
    }
}

#[test]
fn finalization_rejects_scores_outside_i32_without_mutation() {
    for chips in [i64::from(i32::MIN) + 999, i64::from(i32::MAX) + 1_001] {
        let mut f = Fixture::new();
        f.seats[0].chips = chips;
        let mut season = Season {
            epoch: 0,
            rounds_played: 0,
            leaderboard: [ScoreEntry::default(); LEADERBOARD_SIZE],
            analysts: [AnalystStats::default(); SEAT_COUNT],
            bump: 0,
        };
        let vaults: Vec<_> = f.vaults.iter().collect();
        let mut seats: Vec<_> = f.seats.iter_mut().collect();
        assert!(finalize_round(
            &f.table,
            &f.board,
            &vaults,
            &mut f.xray,
            &mut seats,
            &mut season,
        )
        .is_err());
        assert_eq!(seats[0].chips, chips);
        assert_eq!(f.xray.finalized, 0);
        assert_eq!(season.rounds_played, 0);
    }
}

#[test]
fn liquidation_cancels_pending_and_closeout_clears_positions() {
    let mut f = Fixture::new();
    f.clear_orders();
    f.seats[0].chips = -10;
    f.seats[0].position = 5;
    f.seats[0].entry = 1_000_000;
    f.mempool.orders[0] = order(0, 10, 50, 0);
    f.mempool.count = 1;
    f.seats[0].pending_count = 1;
    assert_eq!(f.tick(1).liquidated, 1);
    assert_eq!(f.market.liquidated_mask & 1, 1);
    assert_eq!(
        (
            f.seats[0].position,
            f.seats[0].pending_count,
            f.mempool.count
        ),
        (0, 0, 0)
    );
    f.seats[1].position = -10;
    f.seats[1].entry = 2_000_000;
    f.seats[1].pending_count = 1;
    f.mempool.orders[0] = order(1, 1, 190, 1);
    f.mempool.count = 1;
    assert!(f.tick(180).closed_out);
    assert!(f
        .seats
        .iter()
        .all(|s| s.position == 0 && s.pending_count == 0));
    assert_eq!(f.mempool.count, 0);
}

#[test]
fn full_round_conserves_cash_after_external_arb_whales_and_mark_settlement() {
    let mut f = Fixture::new();
    let initial_chips: i128 = f.seats.iter().map(|s| i128::from(s.chips)).sum();
    let initial_quote = i128::from(f.market.quote);
    let mut rng = Prng::derive(&[45; 32], 9);
    let mut whale_cash = 0i128;
    let mut arb_cash = 0i128;
    let mut settlement = 0i128;
    for tick in 1..200 {
        if tick < 130 && rng.below(3) == 0 {
            let index = rng.below(10) as usize;
            let size = rng.range_inclusive(-100, 100) as i16;
            if size != 0 {
                let _ = push_order(
                    &f.table.params,
                    tick,
                    &mut f.seats[index],
                    &mut f.mempool,
                    size,
                    LANE_STANDARD,
                );
            }
        }
        let mut trade_pool = Vamm {
            base: f.market.base,
            quote: f.market.quote,
        };
        let old_count = f.xray.order_count as usize;
        let positions: Vec<_> = f.seats.iter().map(|s| s.position).collect();
        f.tick(tick);
        for fill in &f.xray.orders[old_count..f.xray.order_count as usize] {
            let q = trade_pool
                .apply_fill(fill.side_size, f.table.params.fee_bps)
                .unwrap();
            if fill.seat == WHALE_SEAT {
                whale_cash += if fill.side_size > 0 {
                    -i128::from(q.quote)
                } else {
                    i128::from(q.quote)
                };
            }
        }
        arb_cash += i128::from(f.market.quote) - i128::from(trade_pool.quote);
        if tick == CLOSING_END_TICK {
            settlement += positions
                .iter()
                .map(|p| i128::from(*p) * i128::from(f.market.price) / i128::from(PRICE_ONE))
                .sum::<i128>();
        }
    }
    let chips: i128 = f.seats.iter().map(|s| i128::from(s.chips)).sum();
    let fees: i128 = f.seats.iter().map(|s| i128::from(s.fees_paid)).sum();
    assert!(f.seats.iter().all(|s| s.position == 0));
    let unadjusted = chips - initial_chips + i128::from(f.market.quote) - initial_quote + fees;
    assert_ne!(unadjusted, 0);
    assert_eq!(unadjusted, arb_cash + settlement - whale_cash);
    assert_eq!(unadjusted + whale_cash - arb_cash - settlement, 0);
}

use ::insider::{
    engine::{
        finish::finalize_round,
        leaks::{bid, buy_license, buy_listed, list, offer_license, open},
        orders::push_order,
        round::begin_round,
        step::{step, StepAccounts},
    },
    math::{dutch::dutch_price, path::fundamental_path_with, prng::Prng, vamm::Vamm},
    *,
};
use anchor_lang::prelude::Pubkey;
use bytemuck::Zeroable;
use std::{collections::BTreeMap, sync::OnceLock, time::Instant};

const ROUNDS: usize = 1_000;
const AGENTS: usize = 9;
const GATE_AGENTS: usize = 8;
const NAMES: [&str; AGENTS] = [
    "Blind",
    "Front-runner",
    "Fundamentalist",
    "Hoarder",
    "Flipper",
    "Crowd C1",
    "Crowd C2",
    "Crowd C3",
    "Flow bot",
];
const KINDS: [&str; 8] = [
    "Flow",
    "Spotlight",
    "Whale",
    "FullBook",
    "Pin",
    "Drift",
    "Shockwave",
    "Summit",
];

#[derive(Clone, Copy)]
struct PriceSet {
    name: &'static str,
    prices: [(u32, u32); 3],
}

const PRICE_A: PriceSet = PriceSet {
    name: "A",
    prices: [(60, 5), (120, 10), (200, 20)],
};
const PRICE_B: PriceSet = PriceSet {
    name: "B",
    prices: [(30, 3), (60, 6), (100, 10)],
};
const PRICE_C: PriceSet = PriceSet {
    name: "C",
    prices: [(20, 2), (40, 4), (80, 8)],
};
const PRICE_C_LOW: PriceSet = PriceSet {
    name: "C-low",
    prices: [(8, 1), (40, 4), (80, 8)],
};
const PRICE_R20: PriceSet = PriceSet {
    name: "R20",
    prices: [(8, 1), (20, 2), (80, 8)],
};
const PRICE_R30: PriceSet = PriceSet {
    name: "R30",
    prices: [(8, 1), (30, 3), (80, 8)],
};
const PRICE_ENGINE: PriceSet = PriceSet {
    name: "engine",
    prices: [(8, 1), (20, 2), (60, 6)],
};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum SummitRule {
    S1,
    S2,
}

#[derive(Clone, Copy)]
struct SweepSettings {
    fund_size: i16,
    shock_min_bps: i16,
    shock_max_bps: i16,
    shock_exit_offset: u16,
    summit_rule: SummitRule,
}

const DEFAULT_SETTINGS: SweepSettings = SweepSettings {
    fund_size: 800,
    shock_min_bps: 800,
    shock_max_bps: 1_500,
    shock_exit_offset: 30,
    summit_rule: SummitRule::S2,
};

fn e1_params() -> Params {
    // table must be initialised with priority_fee = 3; Anurag to change the default
    Params {
        priority_fee: 3,
        ..Params::default()
    }
}

fn randomness(round: usize) -> [u8; 32] {
    let mut state = round as u64 ^ 0xe1e1;
    let mut bytes = [0; 32];
    for chunk in bytes.chunks_exact_mut(8) {
        state = state.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut z = state;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        chunk.copy_from_slice(&(z ^ (z >> 31)).to_le_bytes());
    }
    bytes
}

fn seat(index: usize, active: bool) -> Seat {
    Seat {
        index: index as u8,
        owner: if active {
            Pubkey::new_from_array([index as u8 + 1; 32])
        } else {
            Pubkey::default()
        },
        name_idx: 0,
        kind: Seat::kind_for_index(index as u8),
        chips: BANKROLL_CHIPS,
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

struct Trade {
    leak_id: u32,
    kind: u8,
    size: i16,
    exit_tick: u16,
    entry_filled: bool,
    exit_sent: bool,
    cash: i64,
    trading_pnl: i64,
}

struct Agent {
    rng: Prng,
    trade: Option<Trade>,
}

#[derive(Clone, Copy, Default, Debug, PartialEq, Eq)]
struct LeakEdge {
    opened: u32,
    paid: u64,
    pairs: u32,
    pnl: i64,
    closing_skips: u32,
    closing_exits: u32,
    rejected_exits: u32,
    delayed_exits: u32,
    deadline_skips: u32,
}

#[derive(Default)]
struct CrowdLeak {
    readers: u8,
    profit: i64,
    trades: usize,
}

#[derive(Clone, Copy, Default, Debug, PartialEq, Eq)]
struct AgentMetrics {
    trading_pnl: i64,
    leak_spend: i64,
    priority_fees: i64,
    flip_income: i64,
    license_income: i64,
    leaks_bought: u32,
    leaks_opened: u32,
    orders_sent: u32,
    fills: u32,
}

impl AgentMetrics {
    fn add(&mut self, other: Self) {
        self.trading_pnl += other.trading_pnl;
        self.leak_spend += other.leak_spend;
        self.priority_fees += other.priority_fees;
        self.flip_income += other.flip_income;
        self.license_income += other.license_income;
        self.leaks_bought += other.leaks_bought;
        self.leaks_opened += other.leaks_opened;
        self.orders_sent += other.orders_sent;
        self.fills += other.fills;
    }

    fn score(&self) -> i64 {
        self.trading_pnl - self.leak_spend - self.priority_fees
            + self.flip_income
            + self.license_income
    }
}

struct Simulation {
    table: Table,
    market: Market,
    mempool: Mempool,
    future: Future,
    board: Board,
    vaults: [LeakVault; LEAK_SLOTS],
    seats: Vec<Seat>,
    tape: Tape,
    xray: Box<Xray>,
    agents: Vec<Agent>,
    listings: [Option<(u32, u16)>; LEAK_SLOTS],
    crowd_leaks: BTreeMap<u32, CrowdLeak>,
    clearing_sum: f64,
    sold: usize,
    bid_attempts: [usize; AGENTS],
    auction_buys: [usize; AGENTS],
    licenses: [usize; AGENTS],
    metrics: [AgentMetrics; AGENTS],
    leak_edges: [[LeakEdge; 8]; AGENTS],
    prices: PriceSet,
    settings: SweepSettings,
}

impl Simulation {
    fn new(round: usize, crowd: usize) -> Self {
        Self::with_params(round, crowd, e1_params())
    }

    fn with_params(round: usize, crowd: usize, params: Params) -> Self {
        Self::with_prices(round, crowd, params, PRICE_ENGINE)
    }

    fn with_prices(round: usize, crowd: usize, params: Params, prices: PriceSet) -> Self {
        Self::with_settings(round, crowd, params, prices, DEFAULT_SETTINGS)
    }

    fn with_settings(
        round: usize,
        crowd: usize,
        params: Params,
        prices: PriceSet,
        settings: SweepSettings,
    ) -> Self {
        let seed = randomness(round);
        let mut sim = Self {
            table: Table {
                authority: Pubkey::new_from_array([42; 32]),
                epoch: 0,
                round_id: round as u32 + 1,
                phase: Phase::Live,
                round_start_slot: 0,
                tick: 0,
                armed_until_slot: 0,
                vrf_nonce: 0,
                vrf_pending: false,
                vrf_requested_tick: 0,
                rounds_this_epoch: 0,
                params,
                bump: 0,
            },
            market: Market::zeroed(),
            mempool: Mempool::zeroed(),
            future: Future::zeroed(),
            board: Board::zeroed(),
            vaults: [LeakVault::zeroed(); LEAK_SLOTS],
            seats: (0..SEAT_COUNT)
                .map(|i| seat(i, i < 5 + crowd || i == 8))
                .collect(),
            tape: Tape {
                sends: [SendEvent::default(); TAPE_RING],
                sends_head: 0,
                fills: [Fill::default(); TAPE_RING],
                fills_head: 0,
                bump: 0,
            },
            xray: Box::new(Xray::zeroed()),
            agents: (0..AGENTS)
                .map(|i| Agent {
                    rng: Prng::derive(&seed, 100 + i as u8),
                    trade: None,
                })
                .collect(),
            listings: [None; LEAK_SLOTS],
            crowd_leaks: BTreeMap::new(),
            clearing_sum: 0.0,
            sold: 0,
            bid_attempts: [0; AGENTS],
            auction_buys: [0; AGENTS],
            licenses: [0; AGENTS],
            metrics: [AgentMetrics::default(); AGENTS],
            leak_edges: [[LeakEdge::default(); 8]; AGENTS],
            prices,
            settings,
        };
        begin_round(
            &sim.table,
            &seed,
            &mut sim.market,
            &mut sim.mempool,
            &mut sim.future,
            &mut sim.board,
            &mut sim.xray,
        )
        .unwrap();
        if (settings.shock_min_bps, settings.shock_max_bps) != (800, 1_500) {
            let output = fundamental_path_with(
                &mut Prng::derive(&seed, 1),
                &mut sim.future.path,
                settings.shock_min_bps,
                settings.shock_max_bps,
            );
            sim.future.shocks = output.shocks;
            sim.future.shock_count = output.shock_count;
        }
        sim
    }

    fn send(&mut self, seat: usize, size: i16, lane: u8, tick: u16) -> bool {
        if tick >= LIVE_TICKS || self.market.liquidated_mask & (1 << seat) != 0 {
            return false;
        }
        if push_order(
            &self.table.params,
            tick,
            &mut self.seats[seat],
            &mut self.mempool,
            size,
            lane,
        )
        .is_err()
        {
            return false;
        }
        self.tape.push_send(SendEvent {
            seat: seat as u8,
            lane,
            sent_tick: tick,
        });
        self.metrics[seat].orders_sent += 1;
        if lane == LANE_PRIORITY {
            self.metrics[seat].priority_fees += i64::from(self.table.params.priority_fee);
        }
        self.seats[seat].last_seen_tick = tick;
        true
    }

    fn trade_payload(&mut self, seat: usize, slot: usize, tick: u16) {
        if self.agents[seat].trade.is_some() || tick >= LIVE_TICKS {
            return;
        }
        let vault = &self.vaults[slot];
        let kind = LeakKind::from_u8(vault.kind);
        let fields = vault.fields;
        let selective_flow = seat == 1 || (5..=7).contains(&seat);
        let selective_fund = seat == 2;
        let fund_size = if selective_fund {
            self.settings.fund_size
        } else {
            800
        };
        let flow_size = |size: u32| {
            if selective_flow {
                ((size * 4 / 5 / 50) * 50).min(2_000) as i16
            } else {
                (size / 2).min(1_000) as i16
            }
        };
        let signal = match kind {
            LeakKind::Flow => {
                let net = fields[0];
                let target = fields[2] as u16;
                let eligible = if selective_flow {
                    net.abs() >= 1_500 && target >= tick + 6
                } else {
                    net.abs() >= 400 && target > tick + 4
                };
                eligible.then(|| {
                    (
                        net.signum() as i16,
                        flow_size(net.unsigned_abs()),
                        target - 3,
                    )
                })
            }
            LeakKind::Spotlight | LeakKind::Whale | LeakKind::FullBook => vault.orders
                [..usize::from(vault.order_count)]
                .iter()
                .filter(|order| usize::from(order.seat) != seat && order.land_tick >= tick + 6)
                .max_by_key(|order| (order.side_size.unsigned_abs(), std::cmp::Reverse(order.seq)))
                .filter(|order| {
                    order.side_size.unsigned_abs() >= if selective_flow { 1_000 } else { 400 }
                })
                .map(|order| {
                    (
                        order.side_size.signum(),
                        flow_size(u32::from(order.side_size.unsigned_abs())),
                        order.land_tick - 3,
                    )
                }),
            LeakKind::Pin => {
                let delta = i64::from(fields[1]) - i64::from(self.market.price);
                let eligible = if selective_fund {
                    delta.abs() * 100 >= 2 * i64::from(self.market.price)
                } else {
                    delta.abs() * 100 > i64::from(self.market.price)
                };
                eligible.then(|| {
                    (
                        delta.signum() as i16,
                        fund_size,
                        (fields[0] as u16).saturating_sub(if selective_fund { 4 } else { 3 }),
                    )
                })
            }
            LeakKind::Drift => {
                let eligible = if selective_fund {
                    fields[3] == 2
                } else {
                    fields[3] >= 1
                };
                (eligible && fields[2] != 0).then(|| {
                    (
                        fields[2] as i16,
                        fund_size,
                        (fields[1] as u16).saturating_sub(4),
                    )
                })
            }
            LeakKind::Shockwave => (fields[0] != 0 && fields[2] != 0).then(|| {
                (
                    fields[2] as i16,
                    fund_size,
                    fields[1] as u16
                        + if selective_fund {
                            self.settings.shock_exit_offset
                                - u16::from(self.table.params.priority_delay)
                        } else {
                            3
                        },
                )
            }),
            LeakKind::Summit => {
                let farthest = selective_fund && self.settings.summit_rule == SummitRule::S2;
                let price = i64::from(self.market.price);
                let high_delta = i64::from(fields[0]) - price;
                let low_delta = i64::from(fields[2]) - price;
                let high_first = fields[1] <= fields[3];
                let choose_high = if farthest && high_delta.abs() != low_delta.abs() {
                    high_delta.abs() > low_delta.abs()
                } else {
                    high_first
                };
                let (when, delta) = if choose_high {
                    (fields[1] as u16, high_delta)
                } else {
                    (fields[3] as u16, low_delta)
                };
                let direction = if farthest {
                    delta.signum() as i16
                } else if choose_high {
                    1
                } else {
                    -1
                };
                let threshold = if farthest { 3 } else { 2 };
                let eligible = !selective_fund || delta.abs() * 100 >= threshold * price;
                let landing_tick = when + if farthest { 15 } else { 0 };
                if eligible && farthest && landing_tick >= LIVE_TICKS {
                    self.leak_edges[seat][kind as usize].closing_skips += 1;
                    None
                } else {
                    eligible.then(|| {
                        (
                            direction,
                            fund_size,
                            landing_tick.saturating_sub(if selective_fund { 4 } else { 3 }),
                        )
                    })
                }
            }
        };
        if let Some((direction, size, exit_tick)) = signal {
            if exit_tick >= LIVE_TICKS {
                self.leak_edges[seat][kind as usize].closing_skips += 1;
                return;
            }
            let shockwave = selective_fund && kind == LeakKind::Shockwave;
            if kind.family() == LeakFamily::Fundamentals
                && if shockwave {
                    exit_tick < tick
                } else {
                    exit_tick <= tick + 4
                }
            {
                if selective_fund {
                    self.leak_edges[seat][kind as usize].deadline_skips += 1;
                }
                return;
            }
            let size = direction * size;
            let leak_id = vault.leak_id;
            if self.send(seat, size, LANE_PRIORITY, tick) {
                self.agents[seat].trade = Some(Trade {
                    leak_id,
                    kind: kind as u8,
                    size,
                    exit_tick,
                    entry_filled: false,
                    exit_sent: false,
                    cash: -i64::from(self.table.params.priority_fee),
                    trading_pnl: 0,
                });
                if (5..=7).contains(&seat) {
                    if let Some(leak) = self.crowd_leaks.get_mut(&leak_id) {
                        leak.trades += 1;
                    }
                }
                if shockwave && exit_tick == tick {
                    if self.send(seat, -size, LANE_PRIORITY, tick) {
                        let trade = self.agents[seat].trade.as_mut().unwrap();
                        trade.exit_sent = true;
                        trade.cash -= i64::from(self.table.params.priority_fee);
                    } else {
                        self.leak_edges[seat][kind as usize].rejected_exits += 1;
                    }
                }
            }
        }
    }

    fn opened(&mut self, seat: usize, slot: usize, tick: u16) {
        let owner = self.seats[seat].owner;
        if open(&mut self.board, slot as u8, seat as u8, owner, tick).is_ok() {
            self.metrics[seat].leaks_opened += 1;
            let header = self.board.headers[slot];
            let edge = &mut self.leak_edges[seat][usize::from(header.kind)];
            edge.opened += 1;
            edge.paid += u64::from(header.paid);
            if seat == 5 {
                let paid = self.board.headers[slot].paid;
                let _ = offer_license(&mut self.board, slot as u8, seat as u8, paid / 2);
                self.crowd_leaks
                    .entry(self.board.headers[slot].leak_id)
                    .or_default();
            }
            self.trade_payload(seat, slot, tick);
        }
    }

    fn act(&mut self, seat: usize, tick: u16) {
        if seat == 8 {
            if tick < LIVE_TICKS && tick % 3 == 0 {
                let position = self.seats[seat].position;
                let size = if position.abs() >= 3_000 {
                    -position.signum() * 1_000
                } else {
                    let momentum = i64::from(self.market.price)
                        - i64::from(self.market.history[usize::from(tick.saturating_sub(6))]);
                    let rng = &mut self.agents[seat].rng;
                    let direction = if momentum == 0 {
                        if rng.below(2) == 0 {
                            -1
                        } else {
                            1
                        }
                    } else if rng.chance_bps(6_000) {
                        momentum.signum() as i32
                    } else {
                        -(momentum.signum() as i32)
                    };
                    direction * (400 + 50 * rng.below(17) as i32)
                };
                self.send(seat, size as i16, LANE_STANDARD, tick);
            }
            return;
        }
        if let Some(trade) = self.agents[seat].trade.as_ref() {
            if tick == trade.exit_tick && !trade.exit_sent {
                let size = -trade.size;
                let kind = usize::from(trade.kind);
                if self.send(seat, size, LANE_PRIORITY, tick) {
                    let trade = self.agents[seat].trade.as_mut().unwrap();
                    trade.exit_sent = true;
                    trade.cash -= i64::from(self.table.params.priority_fee);
                } else if tick >= LIVE_TICKS {
                    self.leak_edges[seat][kind].closing_exits += 1;
                } else {
                    self.leak_edges[seat][kind].rejected_exits += 1;
                }
            }
        }
        if seat == 0 {
            if tick < LIVE_TICKS && tick >= 6 && tick % 6 == 0 {
                let position = self.seats[seat].position;
                let momentum = i64::from(self.market.price)
                    - i64::from(self.market.history[usize::from(tick - 6)]);
                let size = if position.abs() >= 1_500 {
                    -position.signum() * 750
                } else {
                    momentum.signum() as i32 * 300
                };
                if size != 0 {
                    self.send(seat, size as i16, LANE_STANDARD, tick);
                }
            }
            return;
        }
        for slot in 0..LEAK_SLOTS {
            let header = self.board.headers[slot];
            let family = LeakKind::from_u8(header.kind).family();
            if seat == 4 && header.state == LeakState::Listed as u8 && header.owner_seat == 4 {
                if self.listings[slot]
                    .is_some_and(|(id, at)| id == header.leak_id && tick >= at + 6)
                    && list(&mut self.board, slot as u8, 4, 0).is_ok()
                {
                    self.opened(seat, slot, tick);
                }
                continue;
            }
            if (seat == 6 || seat == 7)
                && header.state == LeakState::Opened as u8
                && header.owner_seat == 5
                && header.license_ask > 0
            {
                let owner_key = self.seats[seat].owner;
                let (a, b) = self.seats.split_at_mut(seat);
                if buy_license(
                    &mut self.board,
                    slot as u8,
                    seat as u8,
                    owner_key,
                    &mut b[0],
                    &mut a[5],
                    tick,
                )
                .is_ok()
                {
                    self.licenses[seat] += 1;
                    self.metrics[5].license_income += i64::from(header.license_ask);
                    self.trade_payload(seat, slot, tick);
                }
                continue;
            }
            let wanted = match seat {
                1 | 5 => family == LeakFamily::Flow,
                2 => family == LeakFamily::Fundamentals,
                3 | 4 => true,
                _ => false,
            };
            if !wanted {
                continue;
            }
            if header.state == LeakState::Auction as u8 {
                let price = dutch_price(
                    header.start_price,
                    header.floor_price,
                    header.auction_start,
                    tick,
                );
                let threshold = match seat {
                    3 => tick == header.auction_start + DUTCH_TICKS - 1,
                    4 => price * 2 <= header.start_price,
                    _ => price * 5 <= header.start_price * 3,
                };
                if threshold {
                    self.bid_attempts[seat] += 1;
                    if let Ok(paid) = bid(
                        &mut self.board,
                        slot as u8,
                        seat as u8,
                        &mut self.seats[seat],
                        tick,
                    ) {
                        self.clearing_sum += f64::from(paid) / f64::from(header.start_price);
                        self.sold += 1;
                        self.auction_buys[seat] += 1;
                        self.metrics[seat].leaks_bought += 1;
                        if seat == 4 {
                            let ask = (paid * 14 + 5) / 10;
                            if list(&mut self.board, slot as u8, seat as u8, ask).is_ok() {
                                self.listings[slot] = Some((header.leak_id, tick));
                            }
                        } else {
                            self.opened(seat, slot, tick);
                        }
                    }
                }
            } else if (seat == 1 || seat == 2 || seat == 5)
                && header.state == LeakState::Listed as u8
                && header.ask * 5 <= header.start_price * 4
                && usize::from(header.owner_seat) != seat
            {
                let seller = usize::from(header.owner_seat);
                if seller >= self.seats.len() {
                    continue;
                }
                let (buyer_ref, seller_ref) = if seat < seller {
                    let (left, right) = self.seats.split_at_mut(seller);
                    (&mut left[seat], &mut right[0])
                } else {
                    let (left, right) = self.seats.split_at_mut(seat);
                    (&mut right[0], &mut left[seller])
                };
                if buy_listed(
                    &mut self.board,
                    slot as u8,
                    seat as u8,
                    buyer_ref,
                    seller_ref,
                    tick,
                )
                .is_ok()
                {
                    self.metrics[seat].leaks_bought += 1;
                    self.metrics[seller].flip_income += i64::from(header.ask);
                    self.opened(seat, slot, tick);
                }
            }
        }
    }

    fn finish_trade(&mut self, seat: usize, completed: bool) {
        if let Some(trade) = self.agents[seat].trade.take() {
            if completed && trade.entry_filled {
                let edge = &mut self.leak_edges[seat][usize::from(trade.kind)];
                edge.pairs += 1;
                edge.pnl += trade.trading_pnl;
            }
            if (5..=7).contains(&seat) {
                if let Some(leak) = self.crowd_leaks.get_mut(&trade.leak_id) {
                    leak.profit += trade.cash;
                }
            }
        }
    }

    fn advance(&mut self, tick: u16) {
        let before: [i64; AGENTS] = std::array::from_fn(|i| self.seats[i].chips);
        let fills_head = self.tape.fills_head;
        let first_new_leak = self.board.next_leak_id;
        let mut vaults: Vec<_> = self.vaults.iter_mut().collect();
        let mut seats: Vec<_> = self.seats.iter_mut().collect();
        let report = step(
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
        .unwrap();
        let mut changed = 0;
        for header in &mut self.board.headers {
            if header.state == LeakState::Auction as u8
                && header.leak_id >= first_new_leak
                && header.minted_tick == tick
            {
                if self.prices.name != PRICE_ENGINE.name {
                    (header.start_price, header.floor_price) =
                        self.prices.prices[usize::from(header.rarity)];
                }
                changed += 1;
            }
        }
        assert_eq!(changed, usize::from(report.minted));
        for head in fills_head..self.tape.fills_head {
            let fill = self.tape.fills[head as usize % TAPE_RING];
            if usize::from(fill.seat) < AGENTS {
                self.metrics[usize::from(fill.seat)].fills += 1;
            }
        }
        for (i, &cash_before) in before.iter().enumerate().take(AGENTS) {
            self.metrics[i].trading_pnl += self.seats[i].chips - cash_before;
            if let Some(trade) = self.agents[i].trade.as_mut() {
                let pnl = self.seats[i].chips - cash_before;
                trade.cash += pnl;
                trade.trading_pnl += pnl;
                trade.entry_filled |= (fills_head..self.tape.fills_head).any(|head| {
                    let fill = self.tape.fills[head as usize % TAPE_RING];
                    usize::from(fill.seat) == i
                        && fill.side == trade.size.signum() as i8
                        && fill.size == trade.size.unsigned_abs()
                });
                let exited = trade.exit_sent
                    && (fills_head..self.tape.fills_head).any(|head| {
                        let fill = self.tape.fills[head as usize % TAPE_RING];
                        usize::from(fill.seat) == i
                            && fill.side == -trade.size.signum() as i8
                            && fill.size == trade.size.unsigned_abs()
                    });
                if exited && tick > trade.exit_tick + u16::from(self.table.params.priority_delay) {
                    self.leak_edges[i][usize::from(trade.kind)].delayed_exits += 1;
                }
                if exited || self.market.liquidated_mask & (1 << i) != 0 || tick == CLOSING_END_TICK
                {
                    self.finish_trade(i, exited);
                }
            }
        }
    }

    fn run(mut self, crowd: usize) -> RoundResult {
        let active = 5 + crowd;
        for tick in 0..CLOSING_END_TICK {
            self.table.tick = tick;
            self.table.phase = if tick < LIVE_TICKS {
                Phase::Live
            } else {
                Phase::Closing
            };
            for offset in 0..AGENTS {
                let seat = (usize::from(tick) + offset) % AGENTS;
                if seat < active || seat == 8 {
                    self.act(seat, tick);
                }
            }
            for header in &self.board.headers {
                if let Some(leak) = self.crowd_leaks.get_mut(&header.leak_id) {
                    if header.owner_seat == 5 {
                        leak.readers = leak.readers.max(header.reader_count);
                    }
                }
            }
            self.advance(tick + 1);
        }
        self.table.tick = CLOSING_END_TICK;
        self.table.phase = Phase::Xray;
        let scores = std::array::from_fn(|i| self.seats[i].chips - BANKROLL_CHIPS);
        for (i, &score) in scores.iter().enumerate() {
            self.metrics[i].leak_spend = i64::try_from(self.seats[i].leak_spend).unwrap();
            assert_eq!(
                self.metrics[i].score(),
                score,
                "score decomposition seat {i}"
            );
        }
        let liquidations =
            (self.market.liquidated_mask & ((1 << GATE_AGENTS) - 1)).count_ones() as usize;
        let mut season = Season {
            epoch: 0,
            rounds_played: 0,
            leaderboard: [ScoreEntry::default(); LEADERBOARD_SIZE],
            analysts: [AnalystStats::default(); SEAT_COUNT],
            bump: 0,
        };
        let vaults: Vec<_> = self.vaults.iter().collect();
        let mut seats: Vec<_> = self.seats.iter_mut().collect();
        finalize_round(
            &self.table,
            &self.board,
            &vaults,
            &mut self.xray,
            &mut seats,
            &mut season,
        )
        .unwrap();
        let mut reader_counts = [0; LEAK_READERS + 1];
        let mut traded_leaks = 0;
        let edges: Vec<_> = self
            .crowd_leaks
            .values()
            .filter(|leak| leak.readers > 0)
            .map(|leak| {
                reader_counts[usize::from(leak.readers)] += 1;
                traded_leaks += usize::from(leak.trades > 0);
                leak.profit as f64 / f64::from(leak.readers)
            })
            .collect();
        RoundResult {
            scores,
            liquidations,
            clearing_sum: self.clearing_sum,
            sold: self.sold,
            edges,
            reader_counts,
            traded_leaks,
            bid_attempts: self.bid_attempts,
            auction_buys: self.auction_buys,
            licenses: self.licenses,
            metrics: self.metrics,
            leak_edges: self.leak_edges,
        }
    }
}

struct RoundResult {
    scores: [i64; AGENTS],
    liquidations: usize,
    clearing_sum: f64,
    sold: usize,
    edges: Vec<f64>,
    reader_counts: [usize; LEAK_READERS + 1],
    traded_leaks: usize,
    bid_attempts: [usize; AGENTS],
    auction_buys: [usize; AGENTS],
    licenses: [usize; AGENTS],
    metrics: [AgentMetrics; AGENTS],
    leak_edges: [[LeakEdge; 8]; AGENTS],
}

struct Results {
    rounds: usize,
    scores: [Vec<i64>; AGENTS],
    liquidations: usize,
    clearing_sum: f64,
    sold: usize,
    edges: [Vec<f64>; 3],
    reader_counts: [[usize; LEAK_READERS + 1]; 3],
    traded_leaks: [usize; 3],
    bid_attempts: [usize; AGENTS],
    auction_buys: [usize; AGENTS],
    licenses: [usize; AGENTS],
    metrics: [AgentMetrics; AGENTS],
    leak_edges: [[LeakEdge; 8]; AGENTS],
    params: Params,
    prices: PriceSet,
    settings: SweepSettings,
    elapsed: f64,
}

fn mean(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len() as f64
}

fn stats(values: &[f64]) -> (f64, f64) {
    let avg = mean(values);
    let variance =
        values.iter().map(|x| (x - avg).powi(2)).sum::<f64>() / (values.len() - 1) as f64;
    (avg, (variance / values.len() as f64).sqrt())
}

impl Results {
    fn calculate(rounds: usize) -> Self {
        Self::calculate_with_params(rounds, e1_params())
    }

    fn calculate_with_params(rounds: usize, params: Params) -> Self {
        Self::calculate_with_prices(rounds, params, PRICE_ENGINE)
    }

    fn calculate_with_prices(rounds: usize, params: Params, prices: PriceSet) -> Self {
        Self::calculate_with_settings(rounds, params, prices, DEFAULT_SETTINGS)
    }

    fn calculate_with_settings(
        rounds: usize,
        params: Params,
        prices: PriceSet,
        settings: SweepSettings,
    ) -> Self {
        let started = Instant::now();
        let mut results = Self {
            rounds,
            scores: std::array::from_fn(|_| Vec::with_capacity(rounds)),
            liquidations: 0,
            clearing_sum: 0.0,
            sold: 0,
            edges: std::array::from_fn(|_| Vec::new()),
            reader_counts: [[0; LEAK_READERS + 1]; 3],
            traded_leaks: [0; 3],
            bid_attempts: [0; AGENTS],
            auction_buys: [0; AGENTS],
            licenses: [0; AGENTS],
            metrics: [AgentMetrics::default(); AGENTS],
            leak_edges: [[LeakEdge::default(); 8]; AGENTS],
            params,
            prices,
            settings,
            elapsed: 0.0,
        };
        for crowd in 1..=3 {
            for round in 0..rounds {
                let run =
                    Simulation::with_settings(round, crowd, params, prices, settings).run(crowd);
                results.edges[crowd - 1].extend(run.edges);
                results.traded_leaks[crowd - 1] += run.traded_leaks;
                for (i, count) in run.reader_counts.into_iter().enumerate() {
                    results.reader_counts[crowd - 1][i] += count;
                }
                if crowd == 3 {
                    for (i, score) in run.scores.into_iter().enumerate() {
                        results.scores[i].push(score);
                    }
                    results.liquidations += run.liquidations;
                    results.clearing_sum += run.clearing_sum;
                    results.sold += run.sold;
                    for i in 0..AGENTS {
                        results.bid_attempts[i] += run.bid_attempts[i];
                        results.auction_buys[i] += run.auction_buys[i];
                        results.licenses[i] += run.licenses[i];
                        results.metrics[i].add(run.metrics[i]);
                        for kind in 0..8 {
                            let dst = &mut results.leak_edges[i][kind];
                            let src = run.leak_edges[i][kind];
                            dst.opened += src.opened;
                            dst.paid += src.paid;
                            dst.pairs += src.pairs;
                            dst.pnl += src.pnl;
                            dst.closing_skips += src.closing_skips;
                            dst.closing_exits += src.closing_exits;
                            dst.rejected_exits += src.rejected_exits;
                            dst.delayed_exits += src.delayed_exits;
                            dst.deadline_skips += src.deadline_skips;
                        }
                    }
                }
            }
        }
        results.elapsed = started.elapsed().as_secs_f64();
        results.print();
        results
    }

    fn agent_stats(&self, seat: usize) -> (f64, f64) {
        stats(
            &self.scores[seat]
                .iter()
                .map(|&v| v as f64)
                .collect::<Vec<_>>(),
        )
    }
    fn difference(&self, seat: usize) -> (f64, f64) {
        stats(
            &self.scores[seat]
                .iter()
                .zip(&self.scores[0])
                .map(|(&a, &b)| (a - b) as f64)
                .collect::<Vec<_>>(),
        )
    }
    fn edge(&self, crowd: usize) -> f64 {
        mean(&self.edges[crowd - 1])
    }
    fn clearing(&self) -> f64 {
        self.clearing_sum / self.sold as f64
    }
    fn liquidation_rate(&self) -> f64 {
        self.liquidations as f64 / (self.rounds * GATE_AGENTS) as f64
    }
    fn assertions(&self) -> [bool; 6] {
        let (front_diff, front_se) = self.difference(1);
        let (fund_diff, fund_se) = self.difference(2);
        let max = self
            .scores
            .iter()
            .take(GATE_AGENTS)
            .flat_map(|s| s.iter())
            .max()
            .unwrap();
        [
            front_diff > 2.0 * front_se && fund_diff > 2.0 * fund_se && *max < 3 * BANKROLL_CHIPS,
            self.agent_stats(3).0 < self.agent_stats(1).0.min(self.agent_stats(2).0),
            self.edge(1) > self.edge(2) && self.edge(2) > self.edge(3),
            (0.25..=0.75).contains(&self.clearing()),
            self.liquidation_rate() < 0.05,
            self.agent_stats(1).0 > 0.0 && self.agent_stats(2).0 > 0.0,
        ]
    }

    fn print(&self) {
        println!(
            "\nE1 results: reserves={}, arb_bps={}, priority_fee={}, prices={}, fund_size={}, shocks={}-{}, shock_exit=+{}, summit={:?}; {} seeds x 3 crowd sizes, {:.3}s",
            self.params.vamm_base, self.params.arb_bps, self.params.priority_fee, self.prices.name,
            self.settings.fund_size, self.settings.shock_min_bps, self.settings.shock_max_bps,
            self.settings.shock_exit_offset, self.settings.summit_rule, self.rounds, self.elapsed
        );
        println!(
            "{:<17} {:>12} {:>12} {:>10}",
            "agent", "mean", "std error", "max"
        );
        for (i, name) in NAMES.iter().enumerate() {
            let (avg, se) = self.agent_stats(i);
            println!(
                "{name:<17} {avg:>12.3} {se:>12.3} {:>10}",
                self.scores[i].iter().max().unwrap()
            );
            let m = self.metrics[i];
            let n = self.rounds as f64;
            println!("  per round: bought {:.3}, opened {:.3}, sent {:.3}, filled {:.3}; trading pnl {:.3}",
                m.leaks_bought as f64 / n, m.leaks_opened as f64 / n, m.orders_sent as f64 / n,
                m.fills as f64 / n, m.trading_pnl as f64 / n);
        }
        println!("Decomposition per round: score = trading - leak/license spend - priority fees + flip income + license income");
        for i in [1, 2, 0, 5] {
            let m = self.metrics[i];
            let n = self.rounds as f64;
            println!("  {}: score {:.3} = trading {:.3} - spend {:.3} - priority {:.3} + flip {:.3} + license {:.3}",
                NAMES[i], m.score() as f64 / n, m.trading_pnl as f64 / n, m.leak_spend as f64 / n,
                m.priority_fees as f64 / n, m.flip_income as f64 / n, m.license_income as f64 / n);
        }
        println!("Per-leak trading edge (completed entry/exit pairs, priority fees excluded):");
        for seat in [1, 2, 5] {
            for (kind, name) in KINDS.iter().enumerate() {
                let edge = self.leak_edges[seat][kind];
                let avg = if edge.opened == 0 {
                    "n/a".to_owned()
                } else {
                    format!("{:.3}", edge.pnl as f64 / f64::from(edge.opened))
                };
                let avg_paid = if edge.opened == 0 {
                    "n/a".to_owned()
                } else {
                    format!("{:.3}", edge.paid as f64 / f64::from(edge.opened))
                };
                println!(
                    "  {} {name}: {avg} (avg paid {avg_paid}, opened {}, pairs {}, pnl {}, closing skips {}, deadline skips {}, exits rejected {}, exits blocked by closing {}, exits delayed {})",
                    NAMES[seat], edge.opened, edge.pairs, edge.pnl, edge.closing_skips, edge.deadline_skips,
                    edge.rejected_exits, edge.closing_exits, edge.delayed_exits
                );
            }
            for (family, range) in [("Flow family", 0..4), ("Fundamentals family", 4..8)] {
                let (pnl, opened) = range.fold((0_i64, 0_u32), |(p, n), k| {
                    (
                        p + self.leak_edges[seat][k].pnl,
                        n + self.leak_edges[seat][k].opened,
                    )
                });
                if opened > 0 {
                    println!(
                        "  {} {family}: {:.3} (opened {opened})",
                        NAMES[seat],
                        pnl as f64 / f64::from(opened)
                    );
                }
            }
        }
        let mut pool = Vamm {
            base: self.params.vamm_base,
            quote: self.params.vamm_quote,
        };
        let initial = pool.price();
        pool.apply_fill(2_000, self.params.fee_bps).unwrap();
        let buy_move = (f64::from(pool.price()) / f64::from(initial) - 1.0) * 100.0;
        let mut pool = Vamm {
            base: self.params.vamm_base,
            quote: self.params.vamm_quote,
        };
        pool.apply_fill(2_500, self.params.fee_bps).unwrap();
        let whale_move = (f64::from(pool.price()) / f64::from(initial) - 1.0) * 100.0;
        let mut pool = Vamm {
            base: self.params.vamm_base,
            quote: self.params.vamm_quote,
        };
        pool.apply_fill(-2_500, self.params.fee_bps).unwrap();
        let whale_sell = (f64::from(pool.price()) / f64::from(initial) - 1.0) * 100.0;
        println!("Initial spot move: 2,000-unit buy {buy_move:.4}%; 2,500-unit whale buy {whale_move:.4}% / sell {whale_sell:.4}%");
        for i in [1, 2] {
            let (delta, se) = self.difference(i);
            println!("{} - Blind: {delta:.3}, SE_diff {se:.3}", NAMES[i]);
        }
        println!(
            "Clearing: {:.4} ({} sold); liquidations: {:.4}% ({}/{})",
            self.clearing(),
            self.sold,
            self.liquidation_rate() * 100.0,
            self.liquidations,
            self.rounds * GATE_AGENTS
        );
        for crowd in 1..=3 {
            println!(
                "Crowd {crowd} per-reader edge: {:.4} ({} leaks, {} traded; readers 1/2/3/4: {:?})",
                self.edge(crowd),
                self.edges[crowd - 1].len(),
                self.traded_leaks[crowd - 1],
                &self.reader_counts[crowd - 1][1..]
            );
        }
        println!("Auction bid attempts by seat: {:?}", self.bid_attempts);
        println!("Auction buys by seat:         {:?}", self.auction_buys);
        println!("Licenses bought by seat:      {:?}", self.licenses);
        for (i, pass) in self.assertions().into_iter().enumerate() {
            println!(
                "E1 assertion {}: {}",
                i + 1,
                if pass { "PASS" } else { "FAIL" }
            );
        }
    }
}

fn results() -> &'static Results {
    static RUN: OnceLock<Results> = OnceLock::new();
    RUN.get_or_init(|| Results::calculate(ROUNDS))
}

fn test_leak(sim: &mut Simulation, kind: LeakKind, state: LeakState, owner: u8) {
    sim.board.headers[0] = LeakHeader {
        leak_id: 42,
        kind: kind as u8,
        state: state as u8,
        owner_seat: owner,
        auction_start: 10,
        start_price: 60,
        floor_price: 5,
        window_end: 100,
        ..LeakHeader::default()
    };
    sim.vaults[0].leak_id = 42;
    sim.vaults[0].round_id = sim.table.round_id;
    sim.vaults[0].kind = kind as u8;
}

#[test]
fn policies_hoard_at_floor_and_delist_after_six_ticks() {
    let mut hoarder = Simulation::new(0, 3);
    test_leak(&mut hoarder, LeakKind::Flow, LeakState::Auction, NO_SEAT);
    hoarder.act(3, 20);
    assert_eq!(hoarder.board.headers[0].state, LeakState::Auction as u8);
    hoarder.act(3, 21);
    assert_eq!(hoarder.board.headers[0].paid, 5);
    assert_eq!(hoarder.board.headers[0].state, LeakState::Opened as u8);
    assert_eq!(hoarder.seats[3].chips, BANKROLL_CHIPS - 5);

    let mut flipper = Simulation::new(0, 3);
    test_leak(&mut flipper, LeakKind::Flow, LeakState::Auction, NO_SEAT);
    flipper.act(4, 16);
    assert_eq!(flipper.board.headers[0].paid, 30);
    assert_eq!(flipper.board.headers[0].ask, 42);
    flipper.act(4, 21);
    assert_eq!(flipper.board.headers[0].state, LeakState::Listed as u8);
    flipper.act(4, 22);
    assert_eq!(flipper.board.headers[0].state, LeakState::Opened as u8);
    assert_eq!(flipper.board.headers[0].ask, 0);
}

#[test]
fn policies_flow_and_spotlight_choose_valid_targets_and_send_exits() {
    let mut flow = Simulation::new(0, 3);
    test_leak(&mut flow, LeakKind::Flow, LeakState::Owned, 1);
    flow.vaults[0].fields = [1_500, 1, 11, 20, 0, 0];
    flow.opened(1, 0, 5);
    let trade = flow.agents[1].trade.as_ref().unwrap();
    assert_eq!((trade.size, trade.exit_tick, trade.cash), (1_200, 8, -3));
    assert_eq!(flow.tape.sends[0].sent_tick, 5);
    flow.act(1, 8);
    assert!(flow.agents[1].trade.as_ref().unwrap().exit_sent);
    assert_eq!(flow.tape.sends[1].sent_tick, 8);

    let mut spotlight = Simulation::new(0, 3);
    test_leak(&mut spotlight, LeakKind::FullBook, LeakState::Owned, 1);
    spotlight.vaults[0].order_count = 3;
    spotlight.vaults[0].orders[..3].copy_from_slice(&[
        PendingOrder {
            seat: 1,
            side_size: 1_000,
            land_tick: 15,
            ..PendingOrder::default()
        },
        PendingOrder {
            seat: 3,
            side_size: -1_253,
            land_tick: 12,
            ..PendingOrder::default()
        },
        PendingOrder {
            seat: WHALE_SEAT,
            side_size: 1_500,
            land_tick: 10,
            ..PendingOrder::default()
        },
    ]);
    spotlight.opened(1, 0, 5);
    let trade = spotlight.agents[1].trade.as_ref().unwrap();
    assert_eq!((trade.size, trade.exit_tick), (-1_000, 9));
}

#[test]
fn policies_pin_threshold_and_exit_deadline_are_strict() {
    let mut sim = Simulation::new(0, 3);
    test_leak(&mut sim, LeakKind::Pin, LeakState::Opened, 2);
    sim.market.price = 1_000_000;
    sim.vaults[0].fields = [13, 1_019_999, 0, 0, 0, 0];
    sim.trade_payload(2, 0, 5);
    assert!(sim.agents[2].trade.is_none());
    sim.vaults[0].fields = [12, 1_020_000, 0, 0, 0, 0];
    sim.trade_payload(2, 0, 5);
    assert!(sim.agents[2].trade.is_none());
    sim.vaults[0].fields[0] = 13;
    sim.trade_payload(2, 0, 5);
    assert!(sim.agents[2].trade.is_none());
    sim.vaults[0].fields[0] = 14;
    sim.trade_payload(2, 0, 5);
    let trade = sim.agents[2].trade.as_ref().unwrap();
    assert_eq!((trade.size, trade.exit_tick), (800, 10));
}

#[test]
fn policies_use_drift_shock_and_summit_payloads() {
    for (kind, fields, expected) in [
        (LeakKind::Drift, [0, 40, -1, 2, -320, 0], (-800, 36)),
        (LeakKind::Shockwave, [1, 20, 1, 45, 0, 0], (800, 31)),
        (
            LeakKind::Summit,
            [1_100_000, 30, 900_000, 20, 6, 65],
            (-800, 16),
        ),
        (
            LeakKind::Summit,
            [1_100_000, 20, 900_000, 30, 6, 65],
            (800, 16),
        ),
    ] {
        let settings = SweepSettings {
            shock_exit_offset: 15,
            summit_rule: SummitRule::S1,
            ..DEFAULT_SETTINGS
        };
        let mut sim = Simulation::with_settings(0, 3, e1_params(), PRICE_ENGINE, settings);
        test_leak(&mut sim, kind, LeakState::Opened, 2);
        sim.vaults[0].fields = fields;
        sim.trade_payload(2, 0, 5);
        let trade = sim.agents[2].trade.as_ref().unwrap();
        assert_eq!((trade.size, trade.exit_tick), expected);
        sim.act(2, expected.1);
        let exit = sim
            .mempool
            .orders
            .iter()
            .find(|order| !order.is_empty() && order.seat == 2 && order.side_size == -expected.0)
            .unwrap();
        assert_eq!(
            exit.land_tick,
            expected.1 + u16::from(sim.table.params.priority_delay)
        );
    }
}

#[test]
fn summit_s2_chooses_farthest_extreme_and_applies_three_percent_threshold() {
    let cases = [
        ([1_030_000, 20, 970_001, 10, 6, 65], Some((800, 31))),
        ([1_029_999, 10, 970_000, 20, 6, 65], Some((-800, 31))),
        ([1_029_999, 10, 970_001, 20, 6, 65], None),
        ([1_030_000, 20, 970_000, 10, 6, 65], Some((-800, 21))),
    ];
    for (fields, expected) in cases {
        let settings = SweepSettings {
            fund_size: 800,
            summit_rule: SummitRule::S2,
            ..DEFAULT_SETTINGS
        };
        let mut sim = Simulation::with_settings(0, 3, e1_params(), PRICE_R20, settings);
        sim.market.price = 1_000_000;
        test_leak(&mut sim, LeakKind::Summit, LeakState::Opened, 2);
        sim.vaults[0].fields = fields;
        sim.trade_payload(2, 0, 5);
        assert_eq!(
            sim.agents[2].trade.as_ref().map(|t| (t.size, t.exit_tick)),
            expected
        );
        if let Some((size, exit_tick)) = expected {
            sim.act(2, exit_tick);
            let exit = sim
                .mempool
                .orders
                .iter()
                .find(|o| !o.is_empty() && o.seat == 2 && o.side_size == -size)
                .unwrap();
            assert_eq!(
                exit.land_tick,
                exit_tick + u16::from(sim.table.params.priority_delay)
            );
        }
    }
}

#[test]
fn summit_s2_requires_landing_during_live() {
    for (extreme_tick, enters) in [(144, true), (145, false)] {
        let settings = SweepSettings {
            fund_size: 800,
            summit_rule: SummitRule::S2,
            ..DEFAULT_SETTINGS
        };
        let mut sim = Simulation::with_settings(0, 3, e1_params(), PRICE_R20, settings);
        sim.market.price = 1_000_000;
        test_leak(&mut sim, LeakKind::Summit, LeakState::Opened, 2);
        sim.vaults[0].fields = [1_100_000, extreme_tick, 990_000, 20, 6, 159];
        sim.trade_payload(2, 0, 5);
        assert_eq!(sim.agents[2].trade.is_some(), enters);
        if enters {
            let exit_tick = sim.agents[2].trade.as_ref().unwrap().exit_tick;
            assert_eq!(exit_tick, 155);
            sim.act(2, exit_tick);
            let exit = sim
                .mempool
                .orders
                .iter()
                .find(|o| !o.is_empty() && o.seat == 2 && o.side_size == -800)
                .unwrap();
            assert_eq!(exit.land_tick, 159);
        } else {
            assert_eq!(sim.metrics[2].orders_sent, 0);
            assert_eq!(
                sim.leak_edges[2][LeakKind::Summit as usize].closing_skips,
                1
            );
        }
    }
}

#[test]
fn configurable_fundamentalist_size_and_target_landing() {
    for size in [800, 1_500] {
        let settings = SweepSettings {
            fund_size: size,
            ..DEFAULT_SETTINGS
        };
        let mut sim = Simulation::with_settings(1, 3, e1_params(), PRICE_C, settings);
        sim.market.price = 1_000_000;
        test_leak(&mut sim, LeakKind::Pin, LeakState::Opened, 2);
        sim.vaults[0].fields = [20, 1_020_000, 0, 0, 0, 0];
        sim.trade_payload(2, 0, 5);
        let trade = sim.agents[2].trade.as_ref().unwrap();
        assert_eq!((trade.size, trade.exit_tick), (size, 16));
        sim.act(2, 16);
        let exit = sim
            .mempool
            .orders
            .iter()
            .find(|order| !order.is_empty() && order.seat == 2 && order.side_size == -size)
            .unwrap();
        assert_eq!(exit.land_tick, 20);
    }
}

#[test]
fn closing_phase_exit_is_skipped_before_entry() {
    let mut sim = Simulation::new(0, 3);
    test_leak(&mut sim, LeakKind::Shockwave, LeakState::Opened, 2);
    sim.vaults[0].fields = [1, 150, 1, 159, 0, 0];
    sim.trade_payload(2, 0, 120);
    assert!(sim.agents[2].trade.is_none());
    assert_eq!(sim.metrics[2].orders_sent, 0);
    assert_eq!(
        sim.leak_edges[2][LeakKind::Shockwave as usize].closing_skips,
        1
    );
}

#[test]
fn all_trading_agents_skip_exits_in_closing_at_the_boundary() {
    for seat in [1, 3, 4, 5, 6, 7] {
        for (target, enters) in [(162, true), (163, false)] {
            let mut sim = Simulation::new(0, 3);
            test_leak(&mut sim, LeakKind::FullBook, LeakState::Opened, seat as u8);
            sim.vaults[0].order_count = 1;
            sim.vaults[0].orders[0] = PendingOrder {
                seat: WHALE_SEAT,
                side_size: 1_500,
                land_tick: target,
                ..PendingOrder::default()
            };
            sim.trade_payload(seat, 0, 140);
            assert_eq!(sim.agents[seat].trade.is_some(), enters);
            assert_eq!(sim.metrics[seat].orders_sent, u32::from(enters));
        }
    }
    for (shock_tick, enters) in [(133, true), (134, false)] {
        let mut sim = Simulation::new(0, 3);
        test_leak(&mut sim, LeakKind::Shockwave, LeakState::Opened, 2);
        sim.vaults[0].fields = [1, shock_tick, 1, 159, 0, 0];
        sim.trade_payload(2, 0, 140);
        assert_eq!(sim.agents[2].trade.is_some(), enters);
        assert_eq!(sim.metrics[2].orders_sent, u32::from(enters));
    }
}

#[test]
fn shockwave_exit_offset_changes_the_actual_landing_tick() {
    for offset in [15, 30] {
        let settings = SweepSettings {
            fund_size: 800,
            shock_exit_offset: offset,
            ..DEFAULT_SETTINGS
        };
        let mut sim = Simulation::with_settings(0, 3, e1_params(), PRICE_C_LOW, settings);
        test_leak(&mut sim, LeakKind::Shockwave, LeakState::Opened, 2);
        sim.vaults[0].fields = [1, 40, 1, 60, 0, 0];
        sim.trade_payload(2, 0, 5);
        let exit_tick = 40 + offset - u16::from(sim.table.params.priority_delay);
        assert_eq!(sim.agents[2].trade.as_ref().unwrap().exit_tick, exit_tick);
        sim.act(2, exit_tick);
        let exit = sim
            .mempool
            .orders
            .iter()
            .find(|order| !order.is_empty() && order.seat == 2 && order.side_size == -800)
            .unwrap();
        assert_eq!(exit.land_tick, 40 + offset);
    }
}

#[test]
fn opened_price_records_auction_and_resale_actual_paid() {
    let mut auction = Simulation::new(0, 3);
    test_leak(&mut auction, LeakKind::Pin, LeakState::Auction, NO_SEAT);
    auction.act(2, 16);
    assert_eq!(auction.board.headers[0].paid, 30);
    let edge = auction.leak_edges[2][LeakKind::Pin as usize];
    assert_eq!((edge.opened, edge.paid), (1, 30));

    let mut resale = Simulation::new(0, 3);
    test_leak(&mut resale, LeakKind::Pin, LeakState::Listed, 4);
    resale.board.headers[0].ask = 42;
    resale.act(2, 16);
    assert_eq!(resale.board.headers[0].paid, 42);
    let edge = resale.leak_edges[2][LeakKind::Pin as usize];
    assert_eq!((edge.opened, edge.paid), (1, 42));
}

#[test]
fn shockwave_sends_exit_even_before_the_entry_lands() {
    for (now, shock, entry_lands, exit_sends) in
        [(99, 92, 103, 103), (59, 51, 63, 62), (61, 50, 65, 61)]
    {
        let settings = SweepSettings {
            shock_exit_offset: 15,
            ..DEFAULT_SETTINGS
        };
        let mut sim = Simulation::with_settings(0, 3, e1_params(), PRICE_ENGINE, settings);
        test_leak(&mut sim, LeakKind::Shockwave, LeakState::Opened, 2);
        sim.vaults[0].fields = [1, shock, 1, 159, 0, 0];
        sim.trade_payload(2, 0, now);
        if exit_sends != now {
            sim.act(2, exit_sends);
        }
        assert!(sim.agents[2].trade.as_ref().unwrap().exit_sent);
        let orders: Vec<_> = sim
            .mempool
            .orders
            .iter()
            .filter(|o| !o.is_empty() && o.seat == 2)
            .collect();
        assert_eq!(orders.len(), 2);
        assert_eq!(
            orders.iter().find(|o| o.side_size > 0).unwrap().land_tick,
            entry_lands
        );
        assert_eq!(
            orders.iter().find(|o| o.side_size < 0).unwrap().land_tick,
            shock as u16 + 15
        );
    }
}

#[test]
fn reports_a_carried_exit_as_delayed() {
    let mut sim = Simulation::new(0, 3);
    sim.market.price = 1_000_000;
    test_leak(&mut sim, LeakKind::Pin, LeakState::Opened, 2);
    sim.vaults[0].fields = [20, 1_020_000, 0, 0, 0, 0];
    sim.trade_payload(2, 0, 5);
    for tick in 6..=21 {
        sim.table.tick = tick - 1;
        if tick == 17 {
            sim.act(2, 16);
        }
        if tick == 20 {
            for _ in 0..MAX_FILLS_PER_TICK {
                let order = sim
                    .mempool
                    .orders
                    .iter_mut()
                    .find(|o| o.is_empty())
                    .unwrap();
                *order = PendingOrder {
                    seat: WHALE_SEAT,
                    lane: LANE_STANDARD,
                    side_size: 1,
                    land_tick: 20,
                    seq: 0,
                };
                sim.mempool.count += 1;
            }
        }
        sim.advance(tick);
    }
    assert_eq!(sim.leak_edges[2][LeakKind::Pin as usize].delayed_exits, 1);
}

#[test]
fn configured_future_uses_same_seed_and_shock_range() {
    for seed in 0..20 {
        let settings = SweepSettings {
            shock_min_bps: 500,
            shock_max_bps: 1_200,
            ..DEFAULT_SETTINGS
        };
        let sim = Simulation::with_settings(seed, 3, e1_params(), PRICE_C, settings);
        let mut path = [0; PATH_LEN];
        let expected = fundamental_path_with(
            &mut Prng::derive(&randomness(seed), 1),
            &mut path,
            500,
            1_200,
        );
        assert_eq!(sim.future.path, path);
        assert_eq!(sim.future.shock_count, expected.shock_count);
        for i in 0..usize::from(expected.shock_count) {
            let a = sim.future.shocks[i];
            let b = expected.shocks[i];
            assert_eq!((a.tick, a.len, a.bps), (b.tick, b.len, b.bps));
        }
    }
}

#[test]
fn selective_boundaries_and_legacy_hoarder_flipper_rules() {
    for seat in [1, 5, 6, 7] {
        let mut sim = Simulation::new(0, 3);
        test_leak(&mut sim, LeakKind::Flow, LeakState::Opened, seat as u8);
        sim.vaults[0].fields = [1_499, 1, 11, 20, 0, 0];
        sim.trade_payload(seat, 0, 5);
        assert!(sim.agents[seat].trade.is_none());
        sim.vaults[0].fields = [1_500, 1, 10, 19, 0, 0];
        sim.trade_payload(seat, 0, 5);
        assert!(sim.agents[seat].trade.is_none());
        sim.vaults[0].fields[2] = 11;
        sim.trade_payload(seat, 0, 5);
        assert_eq!(sim.agents[seat].trade.as_ref().unwrap().size, 1_200);
    }
    for seat in [3, 4] {
        let mut sim = Simulation::new(0, 3);
        test_leak(&mut sim, LeakKind::Flow, LeakState::Opened, seat as u8);
        sim.vaults[0].fields = [400, 1, 10, 19, 0, 0];
        sim.trade_payload(seat, 0, 5);
        assert_eq!(sim.agents[seat].trade.as_ref().unwrap().size, 200);
    }
    let mut capped = Simulation::new(0, 3);
    test_leak(&mut capped, LeakKind::Whale, LeakState::Opened, 1);
    capped.vaults[0].order_count = 1;
    capped.vaults[0].orders[0] = PendingOrder {
        seat: WHALE_SEAT,
        side_size: 3_000,
        land_tick: 11,
        ..PendingOrder::default()
    };
    capped.trade_payload(1, 0, 5);
    assert_eq!(capped.agents[1].trade.as_ref().unwrap().size, 2_000);

    let mut fundamentalist = Simulation::new(0, 3);
    fundamentalist.market.price = 1_000_000;
    test_leak(&mut fundamentalist, LeakKind::Drift, LeakState::Opened, 2);
    fundamentalist.vaults[0].fields = [0, 40, -1, 1, -120, 0];
    fundamentalist.trade_payload(2, 0, 5);
    assert!(fundamentalist.agents[2].trade.is_none());
    fundamentalist.vaults[0].fields[3] = 3;
    fundamentalist.trade_payload(2, 0, 5);
    assert!(fundamentalist.agents[2].trade.is_none());
    fundamentalist.vaults[0].kind = LeakKind::Summit as u8;
    fundamentalist.vaults[0].fields = [1_029_999, 20, 970_001, 30, 6, 65];
    fundamentalist.trade_payload(2, 0, 5);
    assert!(fundamentalist.agents[2].trade.is_none());
    fundamentalist.vaults[0].fields[0] = 1_030_000;
    fundamentalist.trade_payload(2, 0, 5);
    assert_eq!(fundamentalist.agents[2].trade.as_ref().unwrap().size, 800);
}

#[test]
fn price_sets_apply_only_to_newly_minted_headers() {
    for prices in [
        PRICE_ENGINE,
        PRICE_A,
        PRICE_B,
        PRICE_C,
        PRICE_C_LOW,
        PRICE_R20,
        PRICE_R30,
    ] {
        let mut seen = 0_u8;
        for seed in 0..30 {
            let mut sim = Simulation::with_prices(seed, 3, e1_params(), prices);
            for tick in 1..=150 {
                sim.table.tick = tick - 1;
                let first_new = sim.board.next_leak_id;
                sim.advance(tick);
                for header in &sim.board.headers {
                    if header.state == LeakState::Auction as u8
                        && header.leak_id >= first_new
                        && header.minted_tick == tick
                    {
                        let rarity = usize::from(header.rarity);
                        seen |= 1 << rarity;
                        assert_eq!(
                            (header.start_price, header.floor_price),
                            prices.prices[rarity]
                        );
                    }
                }
            }
        }
        assert_eq!(seen, 0b111, "missing rarity in price set {}", prices.name);
    }
}

#[test]
fn e1_uses_final_table_parameters_and_engine_prices() {
    let params = e1_params();
    assert_eq!((params.vamm_base, params.vamm_quote), (50_000, 50_000));
    assert_eq!(
        (params.arb_bps, params.fee_bps, params.priority_fee),
        (400, 10, 3)
    );
    for (rarity, prices) in [
        (Rarity::Common, (8, 1)),
        (Rarity::Rare, (20, 2)),
        (Rarity::Epic, (60, 6)),
    ] {
        assert_eq!((rarity.start_price(), rarity.floor_price()), prices);
    }
}

#[test]
fn crowd_licenses_and_trade_profit_use_actual_cash_flows() {
    let mut sim = Simulation::new(0, 3);
    test_leak(&mut sim, LeakKind::Flow, LeakState::Owned, 5);
    sim.board.headers[0].paid = 40;
    sim.vaults[0].fields = [1_500, 1, 11, 20, 0, 0];
    sim.opened(5, 0, 5);
    assert_eq!(sim.board.headers[0].license_ask, 20);
    sim.act(6, 5);
    sim.act(7, 5);
    assert_eq!(sim.board.headers[0].reader_count, 3);
    assert_eq!(sim.seats[6].chips, BANKROLL_CHIPS - 23);
    assert_eq!(sim.seats[7].chips, BANKROLL_CHIPS - 23);
    let c1_before = BANKROLL_CHIPS + 40;
    for tick in 6..=12 {
        sim.table.tick = tick - 1;
        if tick == 9 {
            for seat in 5..=7 {
                sim.act(seat, 8);
            }
        }
        sim.advance(tick);
    }
    for seat in 5..=7 {
        assert!(sim.agents[seat].trade.is_none());
    }
    let crowd_pnl = sim.seats[5].chips - c1_before + sim.seats[6].chips - (BANKROLL_CHIPS - 20)
        + sim.seats[7].chips
        - (BANKROLL_CHIPS - 20);
    assert_eq!(sim.crowd_leaks[&42].profit, crowd_pnl);
    for seat in 5..=7 {
        let mut metrics = sim.metrics[seat];
        metrics.leak_spend = i64::try_from(sim.seats[seat].leak_spend).unwrap();
        assert_eq!(metrics.score(), sim.seats[seat].chips - BANKROLL_CHIPS);
        assert_eq!((metrics.orders_sent, metrics.fills), (2, 2));
    }
    assert_eq!(sim.metrics[5].license_income, 40);
    assert_eq!(sim.metrics[5].leaks_opened, 1);
    assert_eq!(sim.leak_edges[5][0].opened, 1);
    assert_eq!(sim.leak_edges[5][0].pairs, 1);
    assert_eq!(sim.leak_edges[5][0].pnl, sim.metrics[5].trading_pnl);
}

#[test]
fn flip_income_and_buyer_spend_reconcile() {
    let mut sim = Simulation::new(0, 3);
    test_leak(&mut sim, LeakKind::Flow, LeakState::Auction, NO_SEAT);
    sim.act(4, 16);
    sim.act(1, 17);
    assert_eq!(sim.metrics[4].flip_income, 42);
    assert_eq!(sim.metrics[4].leaks_bought, 1);
    assert_eq!(sim.metrics[1].leaks_bought, 1);
    assert_eq!(sim.metrics[1].leaks_opened, 1);
    for seat in [1, 4] {
        let mut metrics = sim.metrics[seat];
        metrics.leak_spend = i64::try_from(sim.seats[seat].leak_spend).unwrap();
        assert_eq!(metrics.score(), sim.seats[seat].chips - BANKROLL_CHIPS);
    }
}

#[test]
fn simulation_repeats_exactly_for_a_seed() {
    for seed in [0, 22, 999] {
        let a = Simulation::new(seed, 3).run(3);
        let b = Simulation::new(seed, 3).run(3);
        assert_eq!(a.scores, b.scores);
        assert_eq!(a.liquidations, b.liquidations);
        assert_eq!(a.sold, b.sold);
        assert_eq!(a.clearing_sum.to_bits(), b.clearing_sum.to_bits());
        assert_eq!(a.edges, b.edges);
        assert_eq!(a.reader_counts, b.reader_counts);
        assert_eq!(a.traded_leaks, b.traded_leaks);
        assert_eq!(a.bid_attempts, b.bid_attempts);
        assert_eq!(a.auction_buys, b.auction_buys);
        assert_eq!(a.licenses, b.licenses);
        assert_eq!(a.metrics, b.metrics);
        assert_eq!(a.leak_edges, b.leak_edges);
    }
}

#[test]
fn e1_significant_selective_edge_and_score_cap() {
    let r = results();
    let (front, front_se) = r.difference(1);
    let (fund, fund_se) = r.difference(2);
    let max = *r
        .scores
        .iter()
        .take(GATE_AGENTS)
        .flat_map(|scores| scores.iter())
        .max()
        .unwrap();
    assert!(
        front > 2.0 * front_se && fund > 2.0 * fund_se && max < 3 * BANKROLL_CHIPS,
        "Front-runner delta {front} (SE {front_se}); Fundamentalist delta {fund} (SE {fund_se}); maximum {max}"
    );
}

#[test]
fn e1_hoarder_underperforms_selective_buyers() {
    let r = results();
    assert!(r.agent_stats(3).0 < r.agent_stats(1).0.min(r.agent_stats(2).0));
}

#[test]
fn e1_per_reader_edge_decays() {
    let r = results();
    assert!(
        r.edge(1) > r.edge(2) && r.edge(2) > r.edge(3),
        "edges: {}, {}, {}",
        r.edge(1),
        r.edge(2),
        r.edge(3)
    );
}

#[test]
fn e1_auction_clearing_range() {
    let ratio = results().clearing();
    assert!((0.25..=0.75).contains(&ratio), "clearing: {ratio}");
}

#[test]
fn e1_liquidation_rate() {
    let ratio = results().liquidation_rate();
    assert!(ratio < 0.05, "liquidation rate: {ratio}");
}

#[test]
fn e1_both_selective_families_profitable() {
    let r = results();
    assert!(
        r.agent_stats(1).0 > 0.0 && r.agent_stats(2).0 > 0.0,
        "means: {}, {}",
        r.agent_stats(1).0,
        r.agent_stats(2).0
    );
}

#[test]
#[ignore = "5,000-round E1 confirmation"]
fn e1_tuning_5000_rounds() {
    let results = Results::calculate(5_000);
    let assertions = results.assertions();
    assert!(
        assertions.into_iter().all(|pass| pass),
        "E1 assertions: {assertions:?}"
    );
}

#[test]
#[ignore = "tuning history: parameter sweep"]
fn e1_sweep() {
    for reserves in [50_000, 100_000, 200_000, 400_000] {
        for arb_bps in [400, 800, 1_500] {
            let params = Params {
                vamm_base: reserves,
                vamm_quote: reserves,
                arb_bps,
                ..e1_params()
            };
            Results::calculate_with_params(ROUNDS, params);
        }
    }
}

#[test]
fn flow_bot_uses_its_seeded_stream_and_position_guard() {
    let mut opening = Simulation::new(42, 1);
    opening.act(8, 0);
    opening.act(8, 3);
    let early: Vec<_> = opening
        .mempool
        .orders
        .iter()
        .filter(|o| o.seat == 8 && !o.is_empty())
        .collect();
    assert_eq!(early.len(), 2);
    for order in early {
        assert_eq!(order.lane, LANE_STANDARD);
        assert!((400..=1_200).contains(&order.side_size.unsigned_abs()));
        assert_eq!((order.side_size.unsigned_abs() - 400) % 50, 0);
    }

    let mut sim = Simulation::new(42, 3);
    assert_ne!(sim.seats[8].owner, Pubkey::default());
    sim.market.history[0] = 900_000;
    sim.market.price = 1_000_000;
    let mut rng = Prng::derive(&randomness(42), 108);
    let direction = if rng.chance_bps(6_000) { 1 } else { -1 };
    let size = direction * (400 + 50 * rng.below(17) as i16);
    sim.act(8, 6);
    let order = sim
        .mempool
        .orders
        .iter()
        .find(|o| o.seat == 8 && !o.is_empty())
        .unwrap();
    assert_eq!(
        (order.side_size, order.lane, order.land_tick),
        (size, LANE_STANDARD, 26)
    );
    sim.act(8, 7);
    assert_eq!(sim.metrics[8].orders_sent, 1);

    let mut guard = Simulation::new(42, 1);
    guard.seats[8].position = 3_000;
    guard.act(8, 6);
    let order = guard
        .mempool
        .orders
        .iter()
        .find(|o| o.seat == 8 && !o.is_empty())
        .unwrap();
    assert_eq!(order.side_size, -1_000);
    guard.act(8, LIVE_TICKS);
    assert_eq!(guard.metrics[8].orders_sent, 1);
}

#[test]
#[ignore = "tuning history: background flow parameter sweep"]
fn e1_sweep2() {
    for reserves in [100_000, 200_000] {
        for arb_bps in [800, 1_500] {
            for priority_fee in [10, 3] {
                let params = Params {
                    vamm_base: reserves,
                    vamm_quote: reserves,
                    arb_bps,
                    priority_fee,
                    ..e1_params()
                };
                Results::calculate_with_params(ROUNDS, params);
            }
        }
    }
}

#[test]
#[ignore = "tuning history: selective policy and leak price sweep"]
fn e1_sweep3() {
    for reserves in [50_000, 100_000] {
        for arb_bps in [400, 800] {
            for prices in [PRICE_A, PRICE_B, PRICE_C] {
                let params = Params {
                    vamm_base: reserves,
                    vamm_quote: reserves,
                    arb_bps,
                    priority_fee: 3,
                    ..e1_params()
                };
                Results::calculate_with_prices(ROUNDS, params, prices);
            }
        }
    }
}

#[test]
#[ignore = "tuning history: shock and size parameter sweep"]
fn e1_sweep4() {
    let params = Params {
        vamm_base: 50_000,
        vamm_quote: 50_000,
        arb_bps: 400,
        priority_fee: 3,
        ..e1_params()
    };
    for fund_size in [800, 1_500] {
        for (shock_min_bps, shock_max_bps) in [(300, 800), (500, 1_200)] {
            for prices in [PRICE_C, PRICE_C_LOW] {
                let settings = SweepSettings {
                    fund_size,
                    shock_min_bps,
                    shock_max_bps,
                    ..DEFAULT_SETTINGS
                };
                Results::calculate_with_settings(ROUNDS, params, prices, settings);
            }
        }
    }
}

#[test]
#[ignore = "tuning history: shock exit timing parameter sweep"]
fn e1_sweep5() {
    for (shock_min_bps, shock_max_bps) in [(500, 1_200), (800, 1_500)] {
        for shock_exit_offset in [15, 30] {
            for arb_bps in [400, 600] {
                let params = Params {
                    vamm_base: 50_000,
                    vamm_quote: 50_000,
                    priority_fee: 3,
                    arb_bps,
                    ..e1_params()
                };
                let settings = SweepSettings {
                    fund_size: 800,
                    shock_min_bps,
                    shock_max_bps,
                    shock_exit_offset,
                    ..DEFAULT_SETTINGS
                };
                Results::calculate_with_settings(ROUNDS, params, PRICE_C_LOW, settings);
            }
        }
    }
}

#[test]
#[ignore = "tuning history: rare price and summit policy sweep"]
fn e1_sweep6() {
    let params = Params {
        vamm_base: 50_000,
        vamm_quote: 50_000,
        arb_bps: 400,
        priority_fee: 3,
        ..e1_params()
    };
    for prices in [PRICE_R20, PRICE_R30] {
        for summit_rule in [SummitRule::S1, SummitRule::S2] {
            let settings = SweepSettings {
                fund_size: 800,
                shock_min_bps: 800,
                shock_max_bps: 1_500,
                shock_exit_offset: 30,
                summit_rule,
            };
            Results::calculate_with_settings(ROUNDS, params, prices, settings);
        }
    }
}

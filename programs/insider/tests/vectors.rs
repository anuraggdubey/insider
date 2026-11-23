use std::fmt::Display;

use ::insider::{
    engine::{
        finish::finalize_round,
        orders::push_order,
        round::begin_round,
        step::{step, StepAccounts},
    },
    math::{arb::arb_pull, dutch::dutch_price, vamm::Vamm},
    *,
};
use anchor_lang::{prelude::Pubkey, Discriminator};
use bytemuck::Zeroable;

fn array<T>(items: impl IntoIterator<Item = T>, f: impl Fn(T) -> String) -> String {
    format!(
        "[{}]",
        items.into_iter().map(f).collect::<Vec<_>>().join(",")
    )
}
fn nums<T: Display>(items: impl IntoIterator<Item = T>) -> String {
    array(items, |n| n.to_string())
}
fn quoted<T: Display>(n: T) -> String {
    format!("\"{n}\"")
}
fn base64(bytes: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for part in bytes.chunks(3) {
        let n = (u32::from(part[0]) << 16)
            | (u32::from(*part.get(1).unwrap_or(&0)) << 8)
            | u32::from(*part.get(2).unwrap_or(&0));
        out.push(CHARS[(n >> 18) as usize] as char);
        out.push(CHARS[((n >> 12) & 63) as usize] as char);
        out.push(if part.len() > 1 {
            CHARS[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if part.len() > 2 {
            CHARS[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}
fn raw<T: Discriminator + bytemuck::Pod>(value: &T) -> String {
    let mut data = T::DISCRIMINATOR.to_vec();
    data.extend_from_slice(bytemuck::bytes_of(value));
    quoted(base64(&data))
}
fn header(h: &LeakHeader) -> String {
    format!(
        "{{\"leakId\":{},\"kind\":{},\"rarity\":{},\"state\":{},\"ownerSeat\":{},\"windowStart\":{},\"windowEnd\":{},\"mintedTick\":{},\"auctionStart\":{},\"startPrice\":{},\"floorPrice\":{},\"paid\":{},\"ask\":{},\"licenseAsk\":{},\"openedTick\":{},\"flips\":{},\"readerCount\":{},\"readers\":{}}}",
        h.leak_id, h.kind, h.rarity, h.state, h.owner_seat, h.window_start, h.window_end,
        h.minted_tick, h.auction_start, h.start_price, h.floor_price, h.paid, h.ask,
        h.license_ask, h.opened_tick, h.flips, h.reader_count, array(&h.readers, quoted)
    )
}
fn order(o: &PendingOrder) -> String {
    format!(
        "{{\"seat\":{},\"lane\":{},\"sideSize\":{},\"landTick\":{},\"seq\":{}}}",
        o.seat, o.lane, o.side_size, o.land_tick, o.seq
    )
}
fn xray_leak(leak: &XrayLeak) -> String {
    format!(
        "{{\"header\":{},\"fields\":{},\"orders\":{},\"orderCount\":{},\"pad\":{}}}",
        header(&leak.header),
        nums(leak.fields),
        array(&leak.orders, order),
        leak.order_count,
        nums(leak._pad)
    )
}
fn market_json(m: &Market) -> String {
    format!(
        "{{\"roundId\":{},\"kind\":{},\"bump\":{},\"lastTick\":{},\"base\":{},\"quote\":{},\"price\":{},\"markPrice\":{},\"oracleTs\":{},\"volume\":{},\"history\":{},\"liquidatedMask\":{},\"pad\":{}}}",
        m.round_id, m.kind, m.bump, m.last_tick, quoted(m.base), quoted(m.quote), m.price, m.mark_price,
        quoted(m.oracle_ts), quoted(m.volume), nums(m.history), m.liquidated_mask, nums(m._pad)
    )
}
fn board_json(b: &Board) -> String {
    format!("{{\"roundId\":{},\"nextLeakId\":{},\"dropIndex\":{},\"bump\":{},\"pad\":{},\"headers\":{}}}",
        b.round_id, b.next_leak_id, b.drop_index, b.bump, nums(b._pad), array(&b.headers, header))
}
fn vault_json(v: &LeakVault) -> String {
    format!(
        "{{\"leakId\":{},\"roundId\":{},\"mintedTick\":{},\"kind\":{},\"orderCount\":{},\"slot\":{},\"bump\":{},\"pad\":{},\"fields\":{},\"orders\":{}}}",
        v.leak_id, v.round_id, v.minted_tick, v.kind, v.order_count, v.slot, v.bump, nums(v._pad),
        nums(v.fields), array(&v.orders, order)
    )
}
fn mempool_json(m: &Mempool) -> String {
    let drops = array(&m.drops, |d| {
        format!(
        "{{\"tick\":{},\"kind\":{},\"rarity\":{},\"windowOffset\":{},\"windowLen\":{},\"pad\":{}}}",
        d.tick,d.kind,d.rarity,d.window_offset,d.window_len,nums(d._pad)
    )
    });
    format!(
        "{{\"roundId\":{},\"nextSeq\":{},\"count\":{},\"bump\":{},\"orders\":{},\"drops\":{}}}",
        m.round_id,
        m.next_seq,
        m.count,
        m.bump,
        array(&m.orders, order),
        drops
    )
}
fn xray_json(x: &Xray) -> String {
    let orders = array(&x.orders, |o| {
        format!(
        "{{\"seat\":{},\"lane\":{},\"sideSize\":{},\"sentTick\":{},\"landTick\":{},\"fillPrice\":{}}}",
        o.seat,o.lane,o.side_size,o.sent_tick,o.land_tick,o.fill_price
    )
    });
    let tags = array(&x.tags, |t| {
        format!(
        "{{\"front\":{},\"victim\":{},\"leakSlot\":{},\"pad\":{},\"frontTick\":{},\"victimTick\":{},\"profitEstimate\":{}}}",
        t.front,t.victim,t.leak_slot,t._pad,t.front_tick,t.victim_tick,t.profit_estimate
    )
    });
    format!(
        "{{\"roundId\":{},\"orderCount\":{},\"droppedOrders\":{},\"leakCount\":{},\"tagCount\":{},\"finalized\":{},\"bump\":{},\"orders\":{},\"leaks\":{},\"tags\":{},\"seatOwners\":{},\"scores\":{},\"seatKinds\":{},\"nameIdx\":{},\"seatPad\":{}}}",
        x.round_id,x.order_count,x.dropped_orders,x.leak_count,x.tag_count,x.finalized,x.bump,
        orders,array(&x.leaks,xray_leak),tags,array(&x.seat_owners,quoted),nums(x.scores),nums(x.seat_kinds),nums(x.name_idx),nums(x._seat_pad)
    )
}
fn seat(index: u8) -> Seat {
    Seat {
        index,
        owner: Pubkey::new_from_array([index + 1; 32]),
        name_idx: index,
        kind: SeatKind::Bot,
        chips: 10_000,
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

#[test]
fn shared_engine_vectors() {
    let table = Table {
        authority: Pubkey::new_from_array([9; 32]),
        epoch: 0,
        round_id: 7,
        phase: Phase::Live,
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
    let mut market = Market::zeroed();
    let mut mempool = Mempool::zeroed();
    let mut future = Future::zeroed();
    let mut board = Board::zeroed();
    let mut xray = Box::new(Xray::zeroed());
    let mut vaults = [LeakVault::zeroed(); LEAK_SLOTS];
    let mut seats: Vec<_> = (0..SEAT_COUNT as u8).map(seat).collect();
    let mut tape = Tape {
        sends: [SendEvent::default(); TAPE_RING],
        sends_head: 0,
        fills: [Fill::default(); TAPE_RING],
        fills_head: 0,
        bump: 0,
    };
    begin_round(
        &table,
        &[7; 32],
        &mut market,
        &mut mempool,
        &mut future,
        &mut board,
        &mut xray,
    )
    .unwrap();
    mempool.orders.fill(PendingOrder::default());
    mempool.count = 0;
    mempool.next_seq = 0;
    mempool.drops.fill(DropSpec::default());
    mempool.drops[0] = DropSpec {
        tick: 10,
        kind: LeakKind::Spotlight as u8,
        rarity: Rarity::Rare as u8,
        ..DropSpec::default()
    };
    push_order(
        &table.params,
        0,
        &mut seats[1],
        &mut mempool,
        250,
        LANE_STANDARD,
    )
    .unwrap();
    push_order(
        &table.params,
        0,
        &mut seats[2],
        &mut mempool,
        -100,
        LANE_PRIORITY,
    )
    .unwrap();
    for tick in 1..=10 {
        let mut v: Vec<_> = vaults.iter_mut().collect();
        let mut s: Vec<_> = seats.iter_mut().collect();
        step(
            &table,
            tick,
            &mut StepAccounts {
                market: &mut market,
                mempool: &mut mempool,
                future: &future,
                board: &mut board,
                vaults: &mut v,
                seats: &mut s,
                tape: &mut tape,
                xray: &mut xray,
            },
        )
        .unwrap();
    }
    let market_raw = raw(&market);
    let market_expected = market_json(&market);
    let board_raw = raw(&board);
    let board_expected = board_json(&board);
    let vault_raw = raw(&vaults[0]);
    let vault_expected = vault_json(&vaults[0]);
    let mempool_raw = raw(&mempool);
    let mempool_expected = mempool_json(&mempool);
    ::insider::engine::leaks::bid(&mut board, 0, 1, &mut seats[1], 10).unwrap();
    ::insider::engine::leaks::open(&mut board, 0, 1, seats[1].owner, 10).unwrap();
    for tick in 11..=180 {
        let mut v: Vec<_> = vaults.iter_mut().collect();
        let mut s: Vec<_> = seats.iter_mut().collect();
        step(
            &table,
            tick,
            &mut StepAccounts {
                market: &mut market,
                mempool: &mut mempool,
                future: &future,
                board: &mut board,
                vaults: &mut v,
                seats: &mut s,
                tape: &mut tape,
                xray: &mut xray,
            },
        )
        .unwrap();
    }
    seats[3].chips = 875;
    seats[4].owner = Pubkey::default();
    seats[4].chips = 22_222;
    seats[5].kind = SeatKind::Ai;
    seats[6].kind = SeatKind::Human;
    let mut season = Season {
        epoch: 0,
        rounds_played: 0,
        leaderboard: [ScoreEntry::default(); LEADERBOARD_SIZE],
        analysts: [AnalystStats::default(); SEAT_COUNT],
        bump: 0,
    };
    let v: Vec<_> = vaults.iter().collect();
    let mut s: Vec<_> = seats.iter_mut().collect();
    finalize_round(&table, &board, &v, &mut xray, &mut s, &mut season).unwrap();
    let cases = array(
        [
            (50_000, 50_000, 100, 10),
            (50_000, 50_000, -100, 10),
            (51_234, 49_876, 2_000, 100),
            (500, 1_000, -250, 0),
        ],
        |(base, quote, side, fee)| {
            let mut v = Vamm { base, quote };
            let fill = v.apply_fill(side, fee).unwrap();
            format!("{{\"base\":{},\"quote\":{},\"sideSize\":{},\"feeBps\":{},\"units\":{},\"amount\":{},\"fee\":{},\"avgPrice\":{},\"newBase\":{},\"newQuote\":{}}}",
            quoted(base),quoted(quote),side,fee,fill.units,quoted(fill.quote),quoted(fill.fee),
            fill.avg_price,quoted(v.base),quoted(v.quote))
        },
    );
    let arbs = array(
        [
            (50_000, 50_000, 1_200_000, 400),
            (50_000, 50_000, 800_000, 600),
            (30_000, 80_000, 1_500_000, 10_000),
        ],
        |(base, quote, target, bps)| {
            let mut v = Vamm { base, quote };
            arb_pull(&mut v, target, bps).unwrap();
            format!("{{\"base\":{},\"quote\":{},\"target\":{},\"bps\":{},\"newBase\":{},\"newQuote\":{}}}",
            quoted(base),quoted(quote),target,bps,quoted(v.base),quoted(v.quote))
        },
    );
    let dutch = array(
        [
            (8, 1, 10, 9),
            (8, 1, 10, 16),
            (8, 1, 10, 21),
            (8, 1, 10, 22),
            (20, 2, 30, 41),
            (20, 2, 30, 42),
            (60, 6, 30, 41),
            (60, 6, 30, 42),
        ],
        |(start, floor, at, tick)| {
            format!(
                "{{\"start\":{},\"floor\":{},\"auctionStart\":{},\"tick\":{},\"price\":{}}}",
                start,
                floor,
                at,
                tick,
                dutch_price(start, floor, at, tick)
            )
        },
    );
    let document = format!(
        "{{\"raw\":{{\"market\":{},\"board\":{},\"leakVault\":{},\"mempool\":{},\"xray\":{}}},\"expected\":{{\"market\":{},\"board\":{},\"leakVault\":{},\"mempool\":{},\"xray\":{}}},\"vamm\":{},\"arb\":{},\"dutch\":{}}}",
        market_raw,board_raw,vault_raw,mempool_raw,raw(&*xray),market_expected,board_expected,
        vault_expected,mempool_expected,xray_json(&xray),cases,arbs,dutch
    );
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../sdk/test/fixtures/vectors.json");
    if std::env::var_os("WRITE_VECTORS").is_some() {
        std::fs::write(&path, &document).unwrap();
    } else {
        let existing = std::fs::read_to_string(path).unwrap();
        let compact = |s: &str| {
            s.chars()
                .filter(|c| !c.is_ascii_whitespace())
                .collect::<String>()
        };
        assert_eq!(compact(&existing), compact(&document));
    }
}

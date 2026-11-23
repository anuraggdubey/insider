use crate::{
    math::{path::fundamental_path, prng::Prng},
    state::{DropSpec, Future, LeakKind, PendingOrder, Rarity},
    DROPS_PER_ROUND, DROP_EVERY_TICKS, FIRST_DROP_TICK, LANE_STANDARD, MAX_WHALES, WHALE_SEAT,
};

pub struct RoundSeed {
    pub whales: [PendingOrder; MAX_WHALES],
    pub whale_count: u8,
    pub drops: [DropSpec; DROPS_PER_ROUND],
}

/// Generates the fundamental path, whale orders and private drop schedule.
pub fn seed_round(randomness: &[u8; 32], future: &mut Future) -> RoundSeed {
    let path = fundamental_path(&mut Prng::derive(randomness, 1), &mut future.path);
    future.shocks = path.shocks;
    future.shock_count = path.shock_count;
    let mut rng = Prng::derive(randomness, 2);
    let whale_count = rng.range_inclusive(3, 5) as u8;
    let mut whales = [PendingOrder::default(); MAX_WHALES];
    for whale in &mut whales[..usize::from(whale_count)] {
        let size = rng.range_inclusive(1_500, 3_000) as i16;
        *whale = PendingOrder {
            seat: WHALE_SEAT,
            lane: LANE_STANDARD,
            side_size: if rng.below(2) == 0 { size } else { -size },
            land_tick: rng.range_inclusive(30, 170) as u16,
            seq: 0,
        };
    }
    let mut rng = Prng::derive(randomness, 3);
    let mut drops = [DropSpec::default(); DROPS_PER_ROUND];
    for (i, drop) in drops.iter_mut().enumerate() {
        let rarity = match rng.below(100) {
            0..=64 => Rarity::Common,
            65..=94 => Rarity::Rare,
            _ => Rarity::Epic,
        };
        let flow = rng.below(2) == 0;
        let kind = match (rarity, flow) {
            (Rarity::Common, true) => LeakKind::Flow,
            (Rarity::Common, false) => {
                if rng.below(2) == 0 {
                    LeakKind::Pin
                } else {
                    LeakKind::Drift
                }
            }
            (Rarity::Rare, true) => {
                if rng.below(2) == 0 {
                    LeakKind::Spotlight
                } else {
                    LeakKind::Whale
                }
            }
            (Rarity::Rare, false) => LeakKind::Shockwave,
            (Rarity::Epic, true) => LeakKind::FullBook,
            (Rarity::Epic, false) => LeakKind::Summit,
        };
        let (offset, len) = match kind {
            LeakKind::Flow => (rng.range_inclusive(2, 12) as u8, 10),
            LeakKind::Pin => (rng.range_inclusive(10, 30) as u8, 0),
            LeakKind::Drift => (rng.range_inclusive(20, 40) as u8, 0),
            LeakKind::Shockwave => (0, 40),
            LeakKind::Summit => (0, 60),
            _ => (0, 0),
        };
        *drop = DropSpec {
            tick: FIRST_DROP_TICK + i as u16 * DROP_EVERY_TICKS,
            kind: kind as u8,
            rarity: rarity as u8,
            window_offset: offset,
            window_len: len,
            _pad: [0; 2],
        };
    }
    RoundSeed {
        whales,
        whale_count,
        drops,
    }
}

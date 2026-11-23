use crate::{math::prng::Prng, state::Shock, MAX_SHOCKS, PATH_LEN, PRICE_ONE};

pub struct PathOutput {
    pub shocks: [Shock; MAX_SHOCKS],
    pub shock_count: u8,
}

/// Generates two volatility regimes and 2-4 shocks, clamped to [0.5, 2.0].
pub fn fundamental_path(rng: &mut Prng, path: &mut [u32; PATH_LEN]) -> PathOutput {
    let count = rng.range_inclusive(2, 4) as usize;
    let mut shocks = [Shock::default(); MAX_SHOCKS];
    for i in 0..count {
        loop {
            let tick = rng.range_inclusive(21, 165) as u16;
            let len = rng.range_inclusive(3, 6) as u8;
            if shocks[..i]
                .iter()
                .all(|s| tick >= s.tick + u16::from(s.len) || s.tick >= tick + u16::from(len))
            {
                let magnitude = rng.range_inclusive(300, 800) as i16;
                shocks[i] = Shock {
                    tick,
                    len,
                    bps: if rng.below(2) == 0 {
                        magnitude
                    } else {
                        -magnitude
                    },
                    _pad: [0; 3],
                };
                break;
            }
        }
    }
    shocks[..count].sort_unstable_by_key(|s| s.tick);
    let switch = rng.range_inclusive(40, 140) as usize;
    let wild_first = rng.below(2) == 0;
    path[0] = PRICE_ONE;
    for tick in 1..PATH_LEN {
        let wild = if tick < switch {
            wild_first
        } else {
            !wild_first
        };
        let vol = if wild { 35 } else { 10 };
        let mut bps = rng.range_inclusive(-vol, vol);
        for shock in &shocks[..count] {
            if (shock.tick..shock.tick + u16::from(shock.len)).contains(&(tick as u16)) {
                let total = i64::from(shock.bps);
                let len = i64::from(shock.len);
                let offset = tick as i64 - i64::from(shock.tick);
                bps += total / len
                    + if offset < total.abs() % len {
                        total.signum()
                    } else {
                        0
                    };
            }
        }
        let previous = i64::from(path[tick - 1]);
        path[tick] = (previous + previous * bps / 10_000)
            .clamp(i64::from(PRICE_ONE / 2), i64::from(PRICE_ONE * 2)) as u32;
    }
    PathOutput {
        shocks,
        shock_count: count as u8,
    }
}

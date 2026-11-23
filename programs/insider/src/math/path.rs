use crate::{math::prng::Prng, state::Shock, MAX_SHOCKS, PATH_LEN, PRICE_ONE};

pub struct PathOutput {
    pub shocks: [Shock; MAX_SHOCKS],
    pub shock_count: u8,
}

/// Generates two volatility regimes and 2-4 shocks, clamped to [0.5, 2.0].
pub fn fundamental_path(rng: &mut Prng, path: &mut [u32; PATH_LEN]) -> PathOutput {
    fundamental_path_with(rng, path, 800, 1_500)
}

pub fn fundamental_path_with(
    rng: &mut Prng,
    path: &mut [u32; PATH_LEN],
    shock_min_bps: i16,
    shock_max_bps: i16,
) -> PathOutput {
    assert!(shock_min_bps >= 0 && shock_min_bps <= shock_max_bps);
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
                let magnitude =
                    rng.range_inclusive(i64::from(shock_min_bps), i64::from(shock_max_bps)) as i16;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn original_range_matches_pre_parameterization_vectors() {
        for (byte, expected_hash, expected_rng) in [
            (0, 0xfc28_405d_48a5_9cf6, 0x786e_25e6_cb02_499a),
            (3, 0x1e71_cfdf_d802_0a4d, 0xb267_ebc9_c27f_e6e8),
            (42, 0x0749_474f_d793_b501, 0xd873_b8c4_d14c_7c5d),
        ] {
            let mut rng = Prng::derive(&[byte; 32], 1);
            let mut path = [0; PATH_LEN];
            fundamental_path_with(&mut rng, &mut path, 300, 800);
            let mut hash = 0xcbf2_9ce4_8422_2325_u64;
            for value in path {
                for byte in value.to_le_bytes() {
                    hash = (hash ^ u64::from(byte)).wrapping_mul(0x100_0000_01b3);
                }
            }
            assert_eq!(hash, expected_hash);
            assert_eq!(rng.next_u64(), expected_rng);
        }
    }

    #[test]
    fn default_path_uses_the_final_shock_range() {
        for byte in 0..100 {
            let seed = [byte; 32];
            let mut default_rng = Prng::derive(&seed, 1);
            let mut explicit_rng = Prng::derive(&seed, 1);
            let mut default_path = [0; PATH_LEN];
            let mut explicit_path = [0; PATH_LEN];
            let default = fundamental_path(&mut default_rng, &mut default_path);
            let explicit = fundamental_path_with(&mut explicit_rng, &mut explicit_path, 800, 1_500);
            assert_eq!(default_path, explicit_path);
            assert_eq!(default.shock_count, explicit.shock_count);
            for i in 0..usize::from(default.shock_count) {
                let a = default.shocks[i];
                let b = explicit.shocks[i];
                assert_eq!((a.tick, a.len, a.bps), (b.tick, b.len, b.bps));
                assert!((800..=1_500).contains(&a.bps.unsigned_abs()));
            }
            assert_eq!(default_rng.next_u64(), explicit_rng.next_u64());
        }
    }

    #[test]
    fn custom_shocks_remain_deterministic_and_in_range() {
        for byte in 0..100 {
            let seed = [byte; 32];
            let mut default_rng = Prng::derive(&seed, 1);
            let mut custom_rng = Prng::derive(&seed, 1);
            let mut default_path = [0; PATH_LEN];
            let mut custom_path = [0; PATH_LEN];
            let original = fundamental_path(&mut default_rng, &mut default_path);
            let custom = fundamental_path_with(&mut custom_rng, &mut custom_path, 500, 1_200);
            assert_eq!(original.shock_count, custom.shock_count);
            for i in 0..usize::from(custom.shock_count) {
                let a = original.shocks[i];
                let b = custom.shocks[i];
                assert_eq!(
                    (a.tick, a.len, a.bps.signum()),
                    (b.tick, b.len, b.bps.signum())
                );
                assert!((500..=1_200).contains(&b.bps.unsigned_abs()));
            }
            assert_eq!(default_rng.next_u64(), custom_rng.next_u64());
            assert!(custom_path
                .iter()
                .all(|price| (PRICE_ONE / 2..=PRICE_ONE * 2).contains(price)));
        }
        let mut path = [0; PATH_LEN];
        let out = fundamental_path_with(&mut Prng::derive(&[0; 32], 1), &mut path, 500, 500);
        assert!(out.shocks[..usize::from(out.shock_count)]
            .iter()
            .all(|shock| shock.bps.unsigned_abs() == 500));
    }
}

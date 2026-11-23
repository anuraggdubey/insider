use crate::{math::prng::Prng, state::Shock, MAX_SHOCKS, PATH_LEN};

pub struct PathOutput {
    pub shocks: [Shock; MAX_SHOCKS],
    pub shock_count: u8,
}

/// Generates two volatility regimes and 2-4 shocks, clamped to [0.5, 2.0].
pub fn fundamental_path(_rng: &mut Prng, _path: &mut [u32; PATH_LEN]) -> PathOutput {
    todo!()
}

#[allow(dead_code)]
pub struct Prng {
    s0: u64,
    s1: u64,
}

impl Prng {
    /// Initializes an xorshift128+ stream with a nonzero state.
    pub fn from_seed(_seed: &[u8; 32]) -> Self {
        todo!()
    }

    /// Derives an independent stream for a domain.
    pub fn derive(_seed: &[u8; 32], _domain: u8) -> Self {
        todo!()
    }

    pub fn next_u64(&mut self) -> u64 {
        todo!()
    }

    /// Uniform sample in [0, n); n must be positive.
    pub fn below(&mut self, _n: u64) -> u64 {
        todo!()
    }

    pub fn range_inclusive(&mut self, _lo: i64, _hi: i64) -> i64 {
        todo!()
    }

    pub fn chance_bps(&mut self, _bps: u32) -> bool {
        todo!()
    }
}

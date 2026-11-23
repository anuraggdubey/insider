pub struct Prng {
    s0: u64,
    s1: u64,
}

impl Prng {
    /// Initializes an xorshift128+ stream with a nonzero state.
    pub fn from_seed(seed: &[u8; 32]) -> Self {
        let word = |i: usize| u64::from_le_bytes(seed[i..i + 8].try_into().unwrap());
        let s0 = word(0) ^ word(16);
        let mut s1 = word(8) ^ word(24);
        if s0 == 0 && s1 == 0 {
            s1 = 0x9e37_79b9_7f4a_7c15;
        }
        Self { s0, s1 }
    }

    /// Derives an independent stream for a domain.
    pub fn derive(seed: &[u8; 32], domain: u8) -> Self {
        let mut mixed = *seed;
        mixed[0] ^= domain;
        let mut state = 0x9e37_79b9_7f4a_7c15u64;
        for chunk in mixed.chunks_exact_mut(8) {
            state ^= u64::from_le_bytes(chunk.try_into().unwrap());
            state = state.wrapping_add(0x9e37_79b9_7f4a_7c15);
            let mut z = state;
            z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
            z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
            chunk.copy_from_slice(&(z ^ (z >> 31)).to_le_bytes());
        }
        Self::from_seed(&mixed)
    }

    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.s0;
        let y = self.s1;
        self.s0 = y;
        x ^= x << 23;
        self.s1 = x ^ y ^ (x >> 17) ^ (y >> 26);
        self.s1.wrapping_add(y)
    }

    /// Uniform sample in [0, n); n must be positive.
    pub fn below(&mut self, n: u64) -> u64 {
        assert!(n > 0);
        ((u128::from(self.next_u64()) * u128::from(n)) >> 64) as u64
    }

    pub fn range_inclusive(&mut self, lo: i64, hi: i64) -> i64 {
        assert!(lo <= hi);
        let width = (i128::from(hi) - i128::from(lo) + 1) as u128;
        let offset = if width == (1u128 << 64) {
            self.next_u64()
        } else {
            self.below(width as u64)
        };
        (i128::from(lo) + i128::from(offset)) as i64
    }

    pub fn chance_bps(&mut self, bps: u32) -> bool {
        self.below(10_000) < u64::from(bps)
    }
}

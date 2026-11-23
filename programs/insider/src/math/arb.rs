use anchor_lang::prelude::Result;

use crate::math::vamm::Vamm;

pub fn isqrt_u128(mut n: u128) -> u128 {
    let mut result = 0u128;
    let mut bit = 1u128 << 126;
    while bit > n {
        bit >>= 2;
    }
    while bit != 0 {
        if n >= result + bit {
            n -= result + bit;
            result = (result >> 1) + bit;
        } else {
            result >>= 1;
        }
        bit >>= 2;
    }
    result
}

/// Rebalances at constant product toward the target by `arb_bps` of the gap.
pub fn arb_pull(_vamm: &mut Vamm, _target_price: u32, _arb_bps: u16) -> Result<()> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn integer_square_roots_round_down() {
        for (n, root) in [
            (0, 0),
            (1, 1),
            (2, 1),
            (3, 1),
            (4, 2),
            (15, 3),
            (16, 4),
            (17, 4),
            (9999, 99),
            (10000, 100),
        ] {
            assert_eq!(isqrt_u128(n), root);
        }
    }

    #[test]
    fn integer_square_root_handles_u128_limits() {
        let root = u64::MAX as u128;
        assert_eq!(isqrt_u128(u128::MAX), root);
        assert_eq!(isqrt_u128(root * root), root);
        assert_eq!(isqrt_u128(root * root - 1), root - 1);
    }
}

use anchor_lang::prelude::*;

use crate::{error::InsiderError, math::vamm::Vamm, PRICE_ONE};

pub fn isqrt_u128(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut x = 1u128 << ((128 - n.leading_zeros()).div_ceil(2));
    loop {
        let next = (x + n / x) / 2;
        if next >= x {
            return x;
        }
        x = next;
    }
}

/// Rebalances at constant product toward the target by `arb_bps` of the gap.
pub fn arb_pull(vamm: &mut Vamm, target_price: u32, arb_bps: u16) -> Result<()> {
    let price = vamm.price();
    if price == target_price || arb_bps == 0 {
        return Ok(());
    }
    let p = i128::from(price)
        + (i128::from(target_price) - i128::from(price)) * i128::from(arb_bps.min(10_000)) / 10_000;
    require!(
        p > 0 && vamm.base > 0 && vamm.quote > 0,
        InsiderError::Overflow
    );
    let k = u128::from(vamm.base) * u128::from(vamm.quote);
    let scaled = k
        .checked_mul(u128::from(PRICE_ONE))
        .ok_or(InsiderError::Overflow)?;
    let base = isqrt_u128(scaled / p as u128);
    if base == 0 {
        return Ok(());
    }
    let candidate = Vamm {
        base: u64::try_from(base).map_err(|_| InsiderError::Overflow)?,
        quote: u64::try_from(k / base).map_err(|_| InsiderError::Overflow)?,
    };
    let next = candidate.price();
    if (price < target_price && next >= price && next <= target_price)
        || (price > target_price && next <= price && next >= target_price)
    {
        *vamm = candidate;
    }
    Ok(())
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

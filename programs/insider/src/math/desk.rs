//! Pure Desk maths: decoding the oracle feed, judging a Call, paying it out and pricing a trade.

use crate::{
    state::AnalystStats, CALL_BONUS_PCT, CALL_GRACE_SECS, DESK_FEE_BPS, DESK_UNIT_DIVISOR,
    PRICE_ONE,
};

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct OraclePrice {
    /// USD price, fixed point 1e6.
    pub price: u64,
    pub publish_time: i64,
}

/// Decodes a `PriceUpdateV3` account (gate G4): discriminator 8, write authority 32, verification
/// level (1 byte when `Full`, else 2), feed id 32, then price i64, confidence u64, exponent i32,
/// publish time i64. The feed list gives exponent -8 for SOL/USD, so 1e6 fixed point is `raw / 100`.
pub fn decode_oracle(data: &[u8]) -> Option<OraclePrice> {
    let mut offset = 8 + 32;
    let level = *data.get(offset)?;
    offset += if level == 0 { 2 } else { 1 };
    offset += 32;
    let raw = i64::from_le_bytes(data.get(offset..offset + 8)?.try_into().ok()?);
    offset += 8 + 8 + 4;
    let publish_time = i64::from_le_bytes(data.get(offset..offset + 8)?.try_into().ok()?);
    let price = u64::try_from(raw / 100).ok().filter(|price| *price > 0)?;
    Some(OraclePrice {
        price,
        publish_time,
    })
}

/// What a Call turned out to be.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Verdict {
    Right,
    Wrong,
}

/// `direction` is +1 (up) or -1 (down). A flat price is Wrong, and so is a Call judged after the
/// grace period.
pub fn judge(direction: i8, minted: u64, now_price: u64, expiry: i64, now: i64) -> Verdict {
    if now > expiry.saturating_add(CALL_GRACE_SECS) {
        return Verdict::Wrong;
    }
    let right = (direction > 0 && now_price > minted) || (direction < 0 && now_price < minted);
    if right {
        Verdict::Right
    } else {
        Verdict::Wrong
    }
}

/// Chips returned to the author and the profit (negative when the stake is lost).
pub fn payout(verdict: Verdict, stake: u64) -> (u64, i64) {
    match verdict {
        Verdict::Right => {
            let bonus = stake * CALL_BONUS_PCT / 100;
            (stake + bonus, bonus as i64)
        }
        Verdict::Wrong => (0, -(stake as i64)),
    }
}

/// Updates an analyst's public track record after a Call is judged.
pub fn record(stats: &mut AnalystStats, verdict: Verdict, profit: i64) {
    stats.calls = stats.calls.saturating_add(1);
    stats.profit = stats.profit.saturating_add(profit);
    if verdict == Verdict::Right {
        stats.hits = stats.hits.saturating_add(1);
        stats.streak = stats.streak.saturating_add(1);
        stats.best_streak = stats.best_streak.max(stats.streak);
    } else {
        stats.streak = 0;
    }
}

/// Chips a trade of `size` units (1/100 SOL each) costs at `price` (1e6): negative when selling. The notional
/// rounds against the trader (up when buying, toward zero when selling).
pub fn trade_cost(size: i16, price: u64) -> i64 {
    let notional = i128::from(size) * i128::from(price);
    let one = i128::from(PRICE_ONE) * DESK_UNIT_DIVISOR;
    let chips = if notional >= 0 {
        (notional + one - 1) / one
    } else {
        notional / one
    };
    chips as i64
}

/// The fee, always paid by the trader and rounded up.
pub fn trade_fee(size: i16, price: u64) -> i64 {
    let notional = i128::from(size.unsigned_abs()) * i128::from(price);
    let unit = i128::from(PRICE_ONE) * DESK_UNIT_DIVISOR * 10_000;
    ((notional * i128::from(DESK_FEE_BPS) + unit - 1) / unit) as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feed(raw: i64, publish_time: i64, level: u8) -> Vec<u8> {
        let mut data = vec![0u8; 8 + 32];
        data.push(level);
        if level == 0 {
            data.push(0);
        }
        data.extend_from_slice(&[7u8; 32]);
        data.extend_from_slice(&raw.to_le_bytes());
        data.extend_from_slice(&0u64.to_le_bytes());
        data.extend_from_slice(&(-8i32).to_le_bytes());
        data.extend_from_slice(&publish_time.to_le_bytes());
        data
    }

    #[test]
    fn decodes_both_verification_layouts() {
        for level in [0u8, 1] {
            let price = decode_oracle(&feed(6_991_000_000, 1_700_000_000, level)).unwrap();
            assert_eq!(price.price, 69_910_000);
            assert_eq!(price.publish_time, 1_700_000_000);
        }
    }

    #[test]
    fn rejects_short_zero_and_negative_feeds() {
        assert!(decode_oracle(&[0u8; 20]).is_none());
        assert!(decode_oracle(&feed(0, 1, 1)).is_none());
        assert!(decode_oracle(&feed(-5, 1, 1)).is_none());
        let mut cut = feed(100_000_000, 1, 1);
        cut.truncate(cut.len() - 4);
        assert!(decode_oracle(&cut).is_none());
    }

    #[test]
    fn judges_direction_flat_and_late() {
        assert_eq!(judge(1, 100, 101, 1_000, 1_000), Verdict::Right);
        assert_eq!(judge(-1, 100, 99, 1_000, 1_000), Verdict::Right);
        assert_eq!(judge(1, 100, 99, 1_000, 1_000), Verdict::Wrong);
        assert_eq!(judge(-1, 100, 101, 1_000, 1_000), Verdict::Wrong);
        assert_eq!(judge(1, 100, 100, 1_000, 1_000), Verdict::Wrong);
        // inside the grace period it still counts; after it, it is Wrong even if the price fits
        assert_eq!(judge(1, 100, 101, 1_000, 1_000 + CALL_GRACE_SECS), Verdict::Right);
        assert_eq!(judge(1, 100, 101, 1_000, 1_001 + CALL_GRACE_SECS), Verdict::Wrong);
    }

    #[test]
    fn pays_a_bonus_on_right_and_burns_the_stake_on_wrong() {
        assert_eq!(payout(Verdict::Right, 100), (150, 50));
        assert_eq!(payout(Verdict::Wrong, 100), (0, -100));
        assert_eq!(payout(Verdict::Right, 11), (16, 5));
    }

    #[test]
    fn records_streaks_and_profit() {
        let mut stats = AnalystStats::default();
        for _ in 0..3 {
            record(&mut stats, Verdict::Right, 50);
        }
        record(&mut stats, Verdict::Wrong, -100);
        record(&mut stats, Verdict::Right, 50);
        assert_eq!(
            (stats.calls, stats.hits, stats.streak, stats.best_streak, stats.profit),
            (5, 4, 1, 3, 100)
        );
    }

    #[test]
    fn trades_round_against_the_trader() {
        // 100 units are 1 SOL: 69.91 chips, rounded up when buying and toward zero when selling
        assert_eq!(trade_cost(100, 69_910_000), 70);
        assert_eq!(trade_cost(-100, 69_910_000), -69);
        assert_eq!(trade_cost(1, 69_910_001), 1);
        assert_eq!(trade_cost(-1, 69_910_001), 0);
        assert_eq!(trade_cost(500, 69_910_000), 350);
        // 0.1% of 349.55 chips is 0.35: rounds up to 1
        assert_eq!(trade_fee(500, 69_910_000), 1);
        assert_eq!(trade_fee(-500, 69_910_000), 1);
        assert_eq!(trade_fee(0, 69_910_000), 0);
    }
}

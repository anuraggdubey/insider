use crate::DUTCH_TICKS;

pub fn dutch_price(start: u32, floor: u32, auction_start: u16, tick: u16) -> u32 {
    let elapsed = tick.saturating_sub(auction_start).min(DUTCH_TICKS);
    let discount =
        u64::from(start.saturating_sub(floor)) * u64::from(elapsed) / u64::from(DUTCH_TICKS);
    start - discount as u32
}

pub fn auction_over(auction_start: u16, tick: u16) -> bool {
    tick.saturating_sub(auction_start) >= DUTCH_TICKS
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn price_decreases_linearly_and_clamps_at_the_ends() {
        assert_eq!(dutch_price(60, 5, 10, 9), 60);
        assert_eq!(dutch_price(60, 5, 10, 10), 60);
        assert_eq!(dutch_price(60, 5, 10, 16), 33);
        assert_eq!(dutch_price(60, 5, 10, 22), 5);
        assert_eq!(dutch_price(60, 5, 10, 100), 5);
        assert_eq!(dutch_price(u32::MAX, 0, 0, 12), 0);
    }

    #[test]
    fn auction_ends_at_the_floor_tick() {
        assert!(!auction_over(10, 9));
        assert!(!auction_over(10, 21));
        assert!(auction_over(10, 22));
        assert!(auction_over(10, u16::MAX));
        assert!(!auction_over(u16::MAX - 2, u16::MAX));
    }
}

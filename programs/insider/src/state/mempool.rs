use anchor_lang::prelude::*;

use crate::{state::Params, DROPS_PER_ROUND, LANE_PRIORITY, MEMPOOL_SLOTS, WHALE_SEAT};

#[zero_copy]
#[repr(C)]
#[derive(Default, Debug, PartialEq, Eq)]
pub struct PendingOrder {
    pub seat: u8,
    pub lane: u8,
    pub side_size: i16,
    pub land_tick: u16,
    pub seq: u16,
}

impl PendingOrder {
    pub fn is_empty(&self) -> bool {
        self.side_size == 0
    }

    pub fn sent_tick(&self, p: &Params) -> u16 {
        if self.seat == WHALE_SEAT {
            return 0;
        }
        let delay = if self.lane == LANE_PRIORITY {
            p.priority_delay
        } else {
            p.standard_delay
        };
        self.land_tick.saturating_sub(u16::from(delay))
    }
}

#[zero_copy]
#[repr(C)]
#[derive(Default, Debug)]
pub struct DropSpec {
    pub tick: u16,
    pub kind: u8,
    pub rarity: u8,
    pub window_offset: u8,
    pub window_len: u8,
    pub _pad: [u8; 2],
}

/// Private order queue and drop schedule.
#[account(zero_copy)]
#[repr(C)]
pub struct Mempool {
    pub round_id: u32,
    pub next_seq: u16,
    pub count: u8,
    pub bump: u8,
    pub orders: [PendingOrder; MEMPOOL_SLOTS],
    pub drops: [DropSpec; DROPS_PER_ROUND],
}

impl Mempool {
    pub const SPACE: usize = 8 + core::mem::size_of::<Self>();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::LANE_STANDARD;

    #[test]
    fn size_is_fixed() {
        assert_eq!(core::mem::size_of::<PendingOrder>(), 8);
        assert_eq!(core::mem::size_of::<DropSpec>(), 8);
        assert_eq!(core::mem::size_of::<Mempool>(), 456);
        assert_eq!(Mempool::SPACE, 464);
    }

    #[test]
    fn empty_orders_have_zero_size() {
        let mut order = PendingOrder::default();
        assert!(order.is_empty());
        order.side_size = -1;
        assert!(!order.is_empty());
    }

    #[test]
    fn sent_tick_uses_lane_delay_and_whales_start_at_zero() {
        let p = Params::default();
        let mut order = PendingOrder {
            seat: 1,
            lane: LANE_STANDARD,
            side_size: 1,
            land_tick: 25,
            seq: 0,
        };
        assert_eq!(order.sent_tick(&p), 5);
        order.lane = LANE_PRIORITY;
        assert_eq!(order.sent_tick(&p), 21);
        order.land_tick = 1;
        assert_eq!(order.sent_tick(&p), 0);
        order.seat = WHALE_SEAT;
        order.land_tick = 100;
        assert_eq!(order.sent_tick(&p), 0);
    }
}

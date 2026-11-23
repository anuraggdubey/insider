use anchor_lang::prelude::*;

use crate::{
    state::{LeakHeader, PendingOrder},
    DROPS_PER_ROUND, LEAK_PAYLOAD_FIELDS, LEAK_PAYLOAD_ORDERS, SEAT_COUNT, XRAY_ORDERS, XRAY_TAGS,
};

#[zero_copy]
#[repr(C)]
#[derive(Default, Debug)]
pub struct XrayOrder {
    pub seat: u8,
    pub lane: u8,
    pub side_size: i16,
    pub sent_tick: u16,
    pub land_tick: u16,
    pub fill_price: u32,
    pub scheduled_tick: u16,
    pub _pad: [u8; 2],
}

#[zero_copy]
#[repr(C)]
pub struct XrayLeak {
    pub header: LeakHeader,
    pub fields: [i32; LEAK_PAYLOAD_FIELDS],
    pub orders: [PendingOrder; LEAK_PAYLOAD_ORDERS],
    pub order_count: u8,
    pub _pad: [u8; 3],
}

#[zero_copy]
#[repr(C)]
#[derive(Default, Debug)]
pub struct SandwichTag {
    pub front: u8,
    pub victim: u8,
    pub leak_slot: u8,
    pub _pad: u8,
    pub front_tick: u16,
    pub victim_tick: u16,
    pub profit_estimate: i32,
}

/// Public end-of-round trace.
#[account(zero_copy)]
#[repr(C)]
pub struct Xray {
    pub round_id: u32,
    pub order_count: u16,
    pub dropped_orders: u16,
    pub leak_count: u8,
    pub tag_count: u8,
    pub finalized: u8,
    pub bump: u8,
    pub orders: [XrayOrder; XRAY_ORDERS],
    pub leaks: [XrayLeak; DROPS_PER_ROUND],
    pub tags: [SandwichTag; XRAY_TAGS],
    pub seat_owners: [Pubkey; SEAT_COUNT],
    pub scores: [i32; SEAT_COUNT],
    pub seat_kinds: [u8; SEAT_COUNT],
    pub name_idx: [u8; SEAT_COUNT],
    pub _seat_pad: [u8; 4],
}

impl Xray {
    pub const SPACE: usize = 8 + core::mem::size_of::<Self>();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_is_fixed() {
        assert_eq!(core::mem::size_of::<XrayOrder>(), 16);
        assert_eq!(core::mem::size_of::<XrayLeak>(), 452);
        assert_eq!(core::mem::size_of::<SandwichTag>(), 12);
        assert_eq!(core::mem::size_of::<Xray>(), 7276);
        assert_eq!(Xray::SPACE, 7284);
    }
}

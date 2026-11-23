use crate::{
    state::{DropSpec, Future, PendingOrder},
    DROPS_PER_ROUND, MAX_WHALES,
};

pub struct RoundSeed {
    pub whales: [PendingOrder; MAX_WHALES],
    pub whale_count: u8,
    pub drops: [DropSpec; DROPS_PER_ROUND],
}

/// Generates the fundamental path, whale orders and private drop schedule.
pub fn seed_round(_randomness: &[u8; 32], _future: &mut Future) -> RoundSeed {
    todo!()
}

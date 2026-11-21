/// Seed for the Phase 1 spike account (`["spike", authority]`).
pub const SPIKE_SEED: &[u8] = b"spike";

/// Seed for the Phase 2 lab account (`["lab", authority]`).
pub const LAB_SEED: &[u8] = b"lab";

/// Number of reader candidates the lab can pick from with VRF.
pub const LAB_MAX_CANDIDATES: usize = 4;

/// Largest member list the lab's ephemeral permission may hold; the PDA is pre-funded for it.
pub const LAB_MAX_PERMISSION_MEMBERS: usize = 4;

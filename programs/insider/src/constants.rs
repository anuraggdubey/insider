use anchor_lang::prelude::*;

/// Seed for the Phase 1 spike account (`["spike", authority]`).
pub const SPIKE_SEED: &[u8] = b"spike";

/// Seed for the Phase 2 lab account (`["lab", authority]`).
pub const LAB_SEED: &[u8] = b"lab";

/// Number of reader candidates the lab can pick from with VRF.
pub const LAB_MAX_CANDIDATES: usize = 4;

/// Largest member list the lab's ephemeral permission may hold; the PDA is pre-funded for it.
pub const LAB_MAX_PERMISSION_MEMBERS: usize = 4;

/// Crank program that signs scheduled instructions on the rollup.
pub const CRANK_PROGRAM_ID: Pubkey = pubkey!("Crank11111111111111111111111111111111111111");

/// Account the rollup scheduler keeps its task list in.
pub const TASK_CONTEXT_ID: Pubkey = pubkey!("TaskContext11111111111111111111111111111111");

/// Seed for the Phase 2 slot accounts (`["slot", authority, index]`).
pub const SLOT_SEED: &[u8] = b"slot";

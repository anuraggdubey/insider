pub mod constants;
pub mod error;

use anchor_lang::prelude::*;

pub use constants::*;

// Placeholder ID from the Phase 2 lab. Replaced by the new program ID in task A-0.1 (docs/STEPS.md).
declare_id!("5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ");

#[program]
pub mod insider {}

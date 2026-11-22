pub mod constants;
pub mod error;

use anchor_lang::prelude::*;

pub use constants::*;

// New game program ID (the Phase 2 lab program 5Tbt... stays deployed on devnet, tagged phase-2-lab).
declare_id!("7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW");

#[program]
pub mod insider {}

use anchor_lang::prelude::*;

/// Crank program that signs scheduled instructions on the rollup.
pub const CRANK_PROGRAM_ID: Pubkey = pubkey!("Crank11111111111111111111111111111111111111");

/// Account the rollup scheduler keeps its task list in.
pub const TASK_CONTEXT_ID: Pubkey = pubkey!("TaskContext11111111111111111111111111111111");

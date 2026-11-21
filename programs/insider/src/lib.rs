pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ");

#[program]
pub mod insider {
    use super::*;

    pub fn spike_init(ctx: Context<SpikeInit>) -> Result<()> {
        spike_init::handler(ctx)
    }

    pub fn spike_increment(ctx: Context<SpikeIncrement>) -> Result<()> {
        spike_increment::handler(ctx)
    }
}

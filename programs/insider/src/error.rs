use anchor_lang::prelude::*;

#[error_code]
pub enum InsiderError {
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("A randomness request is already pending")]
    RollPending,
    #[msg("No randomness request is pending")]
    NoRollPending,
}

use anchor_lang::prelude::*;

#[error_code]
pub enum InsiderError {
    #[msg("Arithmetic overflow")]
    Overflow,
}

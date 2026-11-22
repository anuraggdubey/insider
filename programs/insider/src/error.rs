use anchor_lang::prelude::*;

#[error_code]
pub enum InsiderError {
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("The table is not in the phase this instruction needs")]
    WrongPhase,
    #[msg("Seat index must be 0-9")]
    InvalidSeat,
    #[msg("The seat is taken and cannot be displaced")]
    SeatTaken,
    #[msg("Only the seat owner may do this")]
    NotSeatOwner,
    #[msg("Only the table authority may do this")]
    NotAuthority,
    #[msg("A VRF request is already pending")]
    VrfPending,
    #[msg("No VRF request is pending")]
    NoVrfPending,
    #[msg("The VRF request has not timed out yet")]
    VrfNotTimedOut,
    #[msg("The callback does not match the pending request")]
    StaleVrfCallback,
    #[msg("Too many permission members")]
    TooManyMembers,
    #[msg("The crank is still armed; nothing to re-arm")]
    NotRearmable,
}

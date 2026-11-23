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
    // Engine (Misbah).
    #[msg("Order is too large")]
    OrderTooLarge,
    #[msg("Position limit exceeded")]
    PositionLimit,
    #[msg("Too many pending orders")]
    TooManyPending,
    #[msg("Mempool is full")]
    MempoolFull,
    #[msg("Order size is zero")]
    ZeroOrder,
    #[msg("Invalid lane")]
    InvalidLane,
    #[msg("Leak is not for sale")]
    NotForSale,
    #[msg("Auction is over")]
    AuctionOver,
    #[msg("Insufficient chips")]
    InsufficientChips,
    #[msg("Not the leak owner")]
    NotLeakOwner,
    #[msg("Leak already opened")]
    AlreadyOpened,
    #[msg("Unopened leak limit exceeded")]
    HoardLimit,
    #[msg("Invalid leak slot")]
    InvalidLeakSlot,
    #[msg("Reader limit exceeded")]
    ReaderLimit,
    #[msg("Seat is liquidated")]
    Liquidated,
    // Wiring (Anurag).
    #[msg("Invalid market kind")]
    InvalidMarket,
    #[msg("Not the expected account for this permission")]
    InvalidPermissionTarget,
    #[msg("An engine account does not match the table")]
    InvalidEngineAccount,
    #[msg("The previous round is not finished and resealed yet")]
    RoundNotClosed,
    #[msg("The epoch is not over or its last round is not scored yet")]
    EpochNotOver,
    #[msg("The season is still delegated to the rollup")]
    SeasonDelegated,
    #[msg("Invalid Call: direction, horizon, stake, license price or confidence")]
    InvalidCall,
    #[msg("This seat already has an open Call")]
    CallSlotBusy,
    #[msg("No open Call here")]
    NoOpenCall,
    #[msg("The Call is not due yet")]
    CallNotDue,
    #[msg("The oracle feed is invalid")]
    OracleInvalid,
    #[msg("The oracle feed is stale")]
    OracleStale,
    #[msg("This Call cannot be licensed")]
    LicenseUnavailable,
    #[msg("Desk order or position limit")]
    DeskLimit,
}

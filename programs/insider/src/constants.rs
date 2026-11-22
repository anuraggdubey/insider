use anchor_lang::prelude::*;

/// Crank program that signs scheduled instructions on the rollup.
pub const CRANK_PROGRAM_ID: Pubkey = pubkey!("Crank11111111111111111111111111111111111111");

/// Account the rollup scheduler keeps its task list in.
pub const TASK_CONTEXT_ID: Pubkey = pubkey!("TaskContext11111111111111111111111111111111");

// PDA seeds, one per account kind (alphabetical).
pub const CALLBOOK_SEED: &[u8] = b"callbook";
pub const SEASON_SEED: &[u8] = b"season";
pub const SEAT_SEED: &[u8] = b"seat";
pub const TABLE_SEED: &[u8] = b"table";
pub const TAPE_SEED: &[u8] = b"tape";

// Gate G1 result (docs/gates.md): the TEE advances 100 slots per second, so one 500 ms tick is
// 50 slots with about 1.5% jitter. A tick is derived from the rollup slot, not from
// `unix_timestamp` (whole seconds).
pub const SLOTS_PER_TICK: u64 = 50;
/// A tick lasts 500 ms.
pub const TICK_MILLIS: i64 = 500;
/// Most missed ticks one `tick` call processes (catch-up bound).
pub const MAX_CATCH_UP_TICKS: u16 = 8;

// Round shape: Live ticks 0-159, Closing 160-179, then the X-ray window of 20 ticks.
pub const LIVE_TICKS: u16 = 160;
pub const CLOSING_END_TICK: u16 = 180;
pub const ROUND_TICKS: u16 = 200;

// Seats: 0-4 bots, 5-6 AI analysts (protected), 7-9 human-first.
pub const SEAT_COUNT: usize = 10;
pub const FIRST_AI_SEAT: u8 = 5;
pub const FIRST_HUMAN_SEAT: u8 = 7;
/// A seat is idle after 60 ticks without `ping`, `send_order` or a trade.
pub const SEAT_IDLE_TICKS: u16 = 60;
/// Starting bankroll per round, in chips.
pub const BANKROLL_CHIPS: i64 = 1_000;

// Tape, call book and leaderboard sizes (spec section 5).
pub const TAPE_RING: usize = 64;
pub const CALL_SLOTS: usize = 10;
pub const CALL_READERS: usize = 4;
pub const LEADERBOARD_SIZE: usize = 20;

/// Epoch length in rounds (spec section 6).
pub const ROUNDS_PER_EPOCH: u32 = 10;

/// The VRF request is cancellable after this many ticks of silence.
pub const VRF_TIMEOUT_TICKS: u16 = 10;
/// `rearm_ticks` is open to everyone once fewer than this many ticks of crank remain.
pub const REARM_WINDOW_TICKS: u64 = 600;

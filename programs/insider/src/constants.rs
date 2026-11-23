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

// Engine (Misbah).
pub const BOARD_SEED: &[u8] = b"board";
pub const FUTURE_SEED: &[u8] = b"future";
pub const LEAK_SEED: &[u8] = b"leak";
pub const MARKET_SEED: &[u8] = b"market";
pub const MEMPOOL_SEED: &[u8] = b"mempool";
pub const XRAY_SEED: &[u8] = b"xray";
pub const NOBODY_SEED: &[u8] = b"nobody";
pub const PRICE_ONE: u32 = 1_000_000;
pub const PATH_LEN: usize = 192;
pub const MEMPOOL_SLOTS: usize = 48;
pub const WHALE_SEAT: u8 = 255;
pub const NO_SEAT: u8 = 254;
pub const LANE_STANDARD: u8 = 0;
pub const LANE_PRIORITY: u8 = 1;
pub const MAX_FILLS_PER_TICK: usize = 12;
pub const LEAK_SLOTS: usize = 6;
pub const LEAK_READERS: usize = 4;
pub const LEAK_PAYLOAD_ORDERS: usize = 32;
pub const LEAK_PAYLOAD_FIELDS: usize = 6;
pub const DROPS_PER_ROUND: usize = 8;
pub const FIRST_DROP_TICK: u16 = 10;
pub const DROP_EVERY_TICKS: u16 = 20;
pub const MAX_LIVE_LEAKS: usize = 4;
pub const MAX_UNOPENED_PER_SEAT: u8 = 2;
pub const DUTCH_TICKS: u16 = 12;
pub const MAX_WHALES: usize = 5;
pub const MAX_SHOCKS: usize = 4;
pub const XRAY_ORDERS: usize = 192;
pub const XRAY_TAGS: usize = 16;
pub const SANDWICH_WINDOW_TICKS: u16 = 6;
pub const MARKET_FLOOR: u8 = 0;
pub const MARKET_DESK: u8 = 1;

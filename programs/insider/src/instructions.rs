// Each instruction module exposes a `handler`; call sites use `module::handler`.
#![allow(ambiguous_glob_reexports)]

pub mod lab_cancel_roll;
pub mod lab_commit;
pub mod lab_delegate;
pub mod lab_init;
pub mod lab_permission;
pub mod lab_pick_callback;
pub mod lab_request_pick;
pub mod lab_request_roll;
pub mod lab_roll_callback;
pub mod lab_schedule_tick;
pub mod lab_tick;
pub mod lab_undelegate;
pub mod slot_batch;
pub mod spike_commit;
pub mod spike_delegate;
pub mod spike_increment;
pub mod spike_init;
pub mod spike_undelegate;

pub use lab_cancel_roll::*;
pub use lab_commit::*;
pub use lab_delegate::*;
pub use lab_init::*;
pub use lab_permission::*;
pub use lab_pick_callback::*;
pub use lab_request_pick::*;
pub use lab_request_roll::*;
pub use lab_roll_callback::*;
pub use lab_schedule_tick::*;
pub use lab_tick::*;
pub use lab_undelegate::*;
pub use slot_batch::*;
pub use spike_commit::*;
pub use spike_delegate::*;
pub use spike_increment::*;
pub use spike_init::*;
pub use spike_undelegate::*;

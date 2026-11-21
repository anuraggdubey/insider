// Each instruction module exposes a `handler`; call sites use `module::handler`.
#![allow(ambiguous_glob_reexports)]

pub mod spike_commit;
pub mod spike_delegate;
pub mod spike_increment;
pub mod spike_init;
pub mod spike_undelegate;

pub use spike_commit::*;
pub use spike_delegate::*;
pub use spike_increment::*;
pub use spike_init::*;
pub use spike_undelegate::*;

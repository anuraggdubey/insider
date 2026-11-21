// Each instruction module exposes a `handler`; call sites use `module::handler`.
#![allow(ambiguous_glob_reexports)]

pub mod spike_increment;
pub mod spike_init;

pub use spike_increment::*;
pub use spike_init::*;

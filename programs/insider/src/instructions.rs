// Shared registry: add your own modules in alphabetical order, never reformat the other person's.
// Each module exposes plain handler functions; `lib.rs` calls them as `module::handler`.
#![allow(ambiguous_glob_reexports)]

pub mod cranks;
pub mod engine_setup;
pub mod finish_round;
pub mod leaks;
pub mod licenses;
pub mod orders;
pub mod round_seed;
pub mod seats;
pub mod setup;
pub mod tick;

pub use cranks::*;
pub use engine_setup::*;
pub use finish_round::*;
pub use leaks::*;
pub use licenses::*;
pub use orders::*;
pub use round_seed::*;
pub use seats::*;
pub use setup::*;
pub use tick::*;

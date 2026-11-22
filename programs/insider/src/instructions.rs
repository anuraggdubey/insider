// Shared registry: add your own modules in alphabetical order, never reformat the other person's.
// Each module exposes plain handler functions; `lib.rs` calls them as `module::handler`.
#![allow(ambiguous_glob_reexports)]

pub mod cranks;
pub mod seats;
pub mod setup;
pub mod tick;

pub use cranks::*;
pub use seats::*;
pub use setup::*;
pub use tick::*;

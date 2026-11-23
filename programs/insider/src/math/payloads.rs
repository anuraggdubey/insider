use crate::state::{DropSpec, Future, LeakVault, Mempool};

/// Builds a leak payload from the private state at mint time.
pub fn build_payload(
    _spec: &DropSpec,
    _tick: u16,
    _mempool: &Mempool,
    _future: &Future,
    _vault: &mut LeakVault,
) {
    todo!()
}

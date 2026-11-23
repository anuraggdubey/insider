use crate::{
    state::{DropSpec, Future, LeakKind, LeakVault, Mempool, PendingOrder},
    CLOSING_END_TICK, LEAK_PAYLOAD_ORDERS, MEMPOOL_SLOTS, WHALE_SEAT,
};

/// Builds a leak payload from the private state at mint time.
pub fn build_payload(
    spec: &DropSpec,
    tick: u16,
    mempool: &Mempool,
    future: &Future,
    vault: &mut LeakVault,
) {
    let tick = tick.min(CLOSING_END_TICK - 1);
    vault.kind = spec.kind;
    vault.minted_tick = tick;
    vault.order_count = 0;
    vault.fields = [0; 6];
    vault.orders = [PendingOrder::default(); LEAK_PAYLOAD_ORDERS];
    let end = |delta: u16| tick.saturating_add(delta).min(CLOSING_END_TICK - 1);
    match LeakKind::from_u8(spec.kind) {
        LeakKind::Flow => {
            let start = end(u16::from(spec.window_offset));
            let stop = end(u16::from(spec.window_offset)
                .saturating_add(u16::from(spec.window_len).saturating_sub(1)));
            for order in mempool
                .orders
                .iter()
                .filter(|o| !o.is_empty() && (start..=stop).contains(&o.land_tick))
            {
                vault.fields[0] += i32::from(order.side_size);
                vault.fields[1] += 1;
            }
            vault.fields[2] = i32::from(start);
            vault.fields[3] = i32::from(stop);
        }
        LeakKind::Spotlight => {
            if let Some(order) = mempool
                .orders
                .iter()
                .filter(|o| !o.is_empty() && o.seat != WHALE_SEAT)
                .min_by_key(|o| (std::cmp::Reverse(o.side_size.unsigned_abs()), o.seq))
            {
                vault.orders[0] = *order;
                vault.order_count = 1;
            }
        }
        LeakKind::Whale => {
            if let Some(order) = mempool
                .orders
                .iter()
                .filter(|o| {
                    !o.is_empty()
                        && o.seat == WHALE_SEAT
                        && o.land_tick > tick
                        && o.land_tick <= end(60)
                })
                .min_by_key(|o| (o.land_tick, o.seq))
            {
                vault.orders[0] = *order;
                vault.order_count = 1;
            }
        }
        LeakKind::FullBook => {
            let mut orders = [PendingOrder::default(); MEMPOOL_SLOTS];
            let mut count = 0;
            for order in mempool.orders.iter().filter(|o| !o.is_empty()) {
                orders[count] = *order;
                count += 1;
            }
            orders[..count].sort_unstable_by_key(|o| (o.land_tick, o.seq));
            let count = count.min(LEAK_PAYLOAD_ORDERS);
            vault.orders[..count].copy_from_slice(&orders[..count]);
            vault.order_count = count as u8;
        }
        LeakKind::Pin => {
            let target = end(u16::from(spec.window_offset));
            vault.fields[0] = i32::from(target);
            vault.fields[1] = future.path[usize::from(target)] as i32;
        }
        LeakKind::Drift => {
            let stop = end(u16::from(spec.window_offset));
            let from = i64::from(future.path[usize::from(tick)]);
            let to = i64::from(future.path[usize::from(stop)]);
            let bps = if from == 0 {
                0
            } else {
                (to - from) * 10_000 / from
            };
            let bucket = if bps.abs() < 100 {
                0
            } else if bps.abs() <= 300 {
                1
            } else {
                2
            };
            vault.fields = [
                i32::from(tick),
                i32::from(stop),
                bps.signum() as i32,
                bucket,
                bps as i32,
                0,
            ];
        }
        LeakKind::Shockwave => {
            let stop = end(40);
            vault.fields[3] = i32::from(stop);
            if let Some(shock) = future.shocks
                [..usize::from(future.shock_count).min(future.shocks.len())]
                .iter()
                .filter(|s| s.tick > tick && s.tick <= stop)
                .min_by_key(|s| s.tick)
            {
                vault.fields[0] = 1;
                vault.fields[1] = i32::from(shock.tick);
                vault.fields[2] = i32::from(shock.bps.signum());
            }
        }
        LeakKind::Summit => {
            let start = end(1);
            let stop = end(60);
            let mut high = start;
            let mut low = start;
            for t in start..=stop {
                if future.path[usize::from(t)] > future.path[usize::from(high)] {
                    high = t;
                }
                if future.path[usize::from(t)] < future.path[usize::from(low)] {
                    low = t;
                }
            }
            vault.fields = [
                future.path[usize::from(high)] as i32,
                i32::from(high),
                future.path[usize::from(low)] as i32,
                i32::from(low),
                i32::from(start),
                i32::from(stop),
            ];
        }
    }
}

pub fn payload_window(spec: &DropSpec, tick: u16, vault: &LeakVault) -> (u16, u16) {
    let end = |delta: u16| tick.saturating_add(delta).min(CLOSING_END_TICK - 1);
    let start = end(1);
    match LeakKind::from_u8(spec.kind) {
        LeakKind::Flow => (vault.fields[2] as u16, vault.fields[3] as u16),
        LeakKind::Spotlight | LeakKind::Whale | LeakKind::FullBook => {
            let last = vault.orders[..usize::from(vault.order_count).min(LEAK_PAYLOAD_ORDERS)]
                .iter()
                .map(|o| o.land_tick)
                .max()
                .unwrap_or_else(|| end(20));
            (start, last.min(CLOSING_END_TICK - 1))
        }
        LeakKind::Pin => (vault.fields[0] as u16, vault.fields[0] as u16),
        LeakKind::Drift => (start, vault.fields[1] as u16),
        LeakKind::Shockwave => (start, vault.fields[3] as u16),
        LeakKind::Summit => (start, vault.fields[5] as u16),
    }
}

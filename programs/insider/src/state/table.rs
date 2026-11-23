use anchor_lang::prelude::*;

/// Round phase. `Live` accepts orders; `Closing` drains the mempool and closes positions.
#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace,
)]
pub enum Phase {
    #[default]
    Idle,
    Seeding,
    Live,
    Closing,
    Xray,
}

/// Market parameters the engine reads (spec sections 7.1-7.2). Stored on `Table` so gate E1 can
/// tune them without a program change.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace)]
pub struct Params {
    /// Arbitrage pull per tick toward the fundamental, in basis points (start 400 = 4%).
    pub arb_bps: u16,
    /// Trading fee in basis points (10 = 0.1%).
    pub fee_bps: u16,
    /// Priority-lane fee in chips.
    pub priority_fee: u32,
    /// Ticks until a standard order lands.
    pub standard_delay: u8,
    /// Ticks until a priority order lands.
    pub priority_delay: u8,
    /// Largest order in units.
    pub max_order_units: u16,
    /// Largest absolute position in units.
    pub max_position_units: u16,
    /// Most pending orders per seat.
    pub max_pending: u8,
    /// Virtual reserves reset every round.
    pub vamm_base: u64,
    pub vamm_quote: u64,
}

impl Default for Params {
    fn default() -> Self {
        Self {
            arb_bps: 400,
            fee_bps: 10,
            // Gate E1 tuning (docs/engine.md): the economics only pass with a fee of 3.
            priority_fee: 3,
            standard_delay: 20,
            priority_delay: 4,
            max_order_units: 2_000,
            max_position_units: 5_000,
            max_pending: 4,
            vamm_base: 50_000,
            vamm_quote: 50_000,
        }
    }
}

/// The one public table account: who runs it, which round and phase, and the automation state.
#[account]
#[derive(InitSpace)]
pub struct Table {
    pub authority: Pubkey,
    pub epoch: u32,
    pub round_id: u32,
    pub phase: Phase,
    /// Rollup slot at which tick 0 of the current round began.
    pub round_start_slot: u64,
    /// Last tick processed in this round (see `SLOTS_PER_TICK`).
    pub tick: u16,
    /// Slot at which the scheduled crank stops; `rearm_ticks` extends it.
    pub armed_until_slot: u64,
    /// Incremented per VRF request so a late callback for an old request is rejected.
    pub vrf_nonce: u32,
    pub vrf_pending: bool,
    /// Tick at which the pending VRF request was made (for `cancel_vrf`).
    pub vrf_requested_tick: u16,
    pub rounds_this_epoch: u32,
    pub params: Params,
    pub bump: u8,
}

impl Phase {
    /// Phase of an in-round tick: Live 0-159, Closing 160-179, X-ray 180-199, then the round is over.
    pub fn for_tick(tick: u16) -> Option<Phase> {
        if tick < crate::LIVE_TICKS {
            Some(Phase::Live)
        } else if tick < crate::CLOSING_END_TICK {
            Some(Phase::Closing)
        } else if tick < crate::ROUND_TICKS {
            Some(Phase::Xray)
        } else {
            None
        }
    }
}

impl Table {
    /// Tick number derived from the rollup slot. Idempotent: a late or duplicate crank call
    /// computes the same value.
    pub fn derived_tick(&self, slot: u64) -> u16 {
        let elapsed = slot.saturating_sub(self.round_start_slot) / crate::SLOTS_PER_TICK;
        elapsed.min(u16::MAX as u64) as u16
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table() -> Table {
        Table {
            authority: Pubkey::default(),
            epoch: 0,
            round_id: 1,
            phase: Phase::Live,
            round_start_slot: 1_000,
            tick: 0,
            armed_until_slot: 0,
            vrf_nonce: 0,
            vrf_pending: false,
            vrf_requested_tick: 0,
            rounds_this_epoch: 0,
            params: Params::default(),
            bump: 0,
        }
    }

    #[test]
    fn size_is_fixed() {
        // authority 32, epoch 4, round_id 4, phase 1, round_start_slot 8, tick 2,
        // armed_until_slot 8, vrf_nonce 4, vrf_pending 1, vrf_requested_tick 2,
        // rounds_this_epoch 4, params 31 (2+2+4+1+1+2+2+1+8+8), bump 1
        assert_eq!(Params::INIT_SPACE, 31);
        assert_eq!(Table::INIT_SPACE, 32 + 4 + 4 + 1 + 8 + 2 + 8 + 4 + 1 + 2 + 4 + 31 + 1);
    }

    #[test]
    fn phases_follow_the_tick() {
        assert_eq!(Phase::for_tick(0), Some(Phase::Live));
        assert_eq!(Phase::for_tick(159), Some(Phase::Live));
        assert_eq!(Phase::for_tick(160), Some(Phase::Closing));
        assert_eq!(Phase::for_tick(179), Some(Phase::Closing));
        assert_eq!(Phase::for_tick(180), Some(Phase::Xray));
        assert_eq!(Phase::for_tick(199), Some(Phase::Xray));
        assert_eq!(Phase::for_tick(200), None);
    }

    #[test]
    fn tick_is_derived_from_the_slot() {
        let table = table();
        assert_eq!(table.derived_tick(1_000), 0);
        assert_eq!(table.derived_tick(1_049), 0);
        assert_eq!(table.derived_tick(1_050), 1);
        assert_eq!(table.derived_tick(1_000 + 50 * 160), 160);
        // a slot before the round start never underflows
        assert_eq!(table.derived_tick(10), 0);
    }
}

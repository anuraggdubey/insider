use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::vrf_callback, vrf};

use crate::{constants::LAB_MAX_CANDIDATES, error::InsiderError, state::Lab};

/// Scoped VRF identity, evaluated at compile time. Left to `#[vrf_callback]`, the same `const fn`
/// runs at runtime in SDK 0.18 and burns about 270k compute units hashing a PDA, so the callback
/// never completes. Declaring the field ourselves makes the macro skip its own version.
const SCOPED_VRF_IDENTITY: Pubkey =
    Pubkey::new_from_array(vrf::consts::scoped_vrf_identity_const(&crate::ID).0);

/// Called by the VRF program with verified randomness. The identity signer proves the caller.
#[vrf_callback]
#[derive(Accounts)]
pub struct LabRollCallback<'info> {
    #[account(address = SCOPED_VRF_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    /// The lab is fixed by the request; the identity signer authenticates the callback.
    #[account(mut)]
    pub lab: Account<'info, Lab>,
}

pub fn handler(ctx: Context<LabRollCallback>, randomness: [u8; 32]) -> Result<()> {
    let lab = &mut ctx.accounts.lab;
    require!(lab.pending, InsiderError::NoRollPending);

    let index = vrf::rnd::random_u8_with_range(&randomness, 0, (LAB_MAX_CANDIDATES - 1) as u8);
    lab.randomness = randomness;
    lab.reader = lab.candidates[index as usize];
    lab.pending = false;
    lab.rolls = lab.rolls.checked_add(1).ok_or(InsiderError::Overflow)?;
    Ok(())
}

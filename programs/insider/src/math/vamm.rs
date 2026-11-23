use anchor_lang::prelude::*;

use crate::{error::InsiderError, PRICE_ONE};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Vamm {
    pub base: u64,
    pub quote: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FillQuote {
    pub units: u32,
    pub quote: u64,
    pub fee: u64,
    pub avg_price: u32,
}

impl Vamm {
    pub fn price(&self) -> u32 {
        if self.base == 0 {
            return u32::MAX;
        }
        (u128::from(self.quote) * u128::from(PRICE_ONE) / u128::from(self.base))
            .min(u128::from(u32::MAX)) as u32
    }

    pub fn quote_fill(&self, side_size: i16, fee_bps: u16) -> Result<FillQuote> {
        let mut copy = *self;
        copy.apply_fill(side_size, fee_bps)
    }

    pub fn apply_fill(&mut self, side_size: i16, fee_bps: u16) -> Result<FillQuote> {
        require!(side_size != 0, InsiderError::ZeroOrder);
        let units = u64::from(side_size.unsigned_abs());
        let new_base = if side_size > 0 {
            self.base.checked_sub(units).filter(|v| *v > 0)
        } else {
            self.base.checked_add(units).filter(|v| *v > 0)
        }
        .ok_or(InsiderError::Overflow)?;
        let k = u128::from(self.base) * u128::from(self.quote);
        let new_quote = k.div_ceil(u128::from(new_base));
        let new_quote = u64::try_from(new_quote).map_err(|_| InsiderError::Overflow)?;
        let amount = if side_size > 0 {
            new_quote.checked_sub(self.quote)
        } else {
            self.quote.checked_sub(new_quote)
        }
        .ok_or(InsiderError::Overflow)?;
        let fee = (u128::from(amount) * u128::from(fee_bps)).div_ceil(10_000);
        let fee = u64::try_from(fee).map_err(|_| InsiderError::Overflow)?;
        let avg_price = (u128::from(amount) * u128::from(PRICE_ONE) / u128::from(units))
            .min(u128::from(u32::MAX)) as u32;
        self.base = new_base;
        self.quote = new_quote;
        Ok(FillQuote {
            units: units as u32,
            quote: amount,
            fee,
            avg_price,
        })
    }
}

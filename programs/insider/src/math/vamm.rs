use anchor_lang::prelude::Result;

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
        todo!()
    }

    pub fn quote_fill(&self, _side_size: i16, _fee_bps: u16) -> Result<FillQuote> {
        todo!()
    }

    pub fn apply_fill(&mut self, _side_size: i16, _fee_bps: u16) -> Result<FillQuote> {
        todo!()
    }
}

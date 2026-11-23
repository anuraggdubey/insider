use anchor_lang::prelude::*;

/// The private part of a Desk Call: its direction and confidence. Readable by the author, then by
/// licensees; the direction becomes public in the header when the Call is judged.
#[account(zero_copy)]
#[repr(C)]
pub struct CallVault {
    pub call_id: u32,
    /// +1 up, -1 down, 0 empty.
    pub direction: i8,
    /// 0 to 100.
    pub confidence: u8,
    pub bump: u8,
    pub _pad: u8,
}

impl CallVault {
    pub const SPACE: usize = 8 + core::mem::size_of::<Self>();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_is_fixed() {
        assert_eq!(core::mem::size_of::<CallVault>(), 8);
        assert_eq!(CallVault::SPACE, 16);
    }
}

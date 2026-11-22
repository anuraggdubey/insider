use anchor_lang::prelude::*;

use crate::TAPE_RING;

/// Public trace of an order being sent: who, in which lane, when. The order's side and size are
/// never here; they live in the private mempool.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, Debug, InitSpace)]
pub struct SendEvent {
    pub seat: u8,
    /// 0 = standard, 1 = priority.
    pub lane: u8,
    pub sent_tick: u16,
}

/// A fill executed against the vAMM (public by design).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, Debug, InitSpace)]
pub struct Fill {
    /// 255 = whale.
    pub seat: u8,
    /// +1 buy, -1 sell.
    pub side: i8,
    pub size: u16,
    /// Average fill price, fixed point 1e6.
    pub price: u32,
    pub landed_tick: u16,
}

/// Two fixed ring buffers; `*_head` counts every push, so the newest entry is at
/// `(head - 1) % RING`.
#[account]
#[derive(InitSpace)]
pub struct Tape {
    pub sends: [SendEvent; TAPE_RING],
    pub sends_head: u32,
    pub fills: [Fill; TAPE_RING],
    pub fills_head: u32,
    pub bump: u8,
}

impl Tape {
    pub fn push_send(&mut self, event: SendEvent) {
        let index = (self.sends_head as usize) % TAPE_RING;
        self.sends[index] = event;
        self.sends_head = self.sends_head.wrapping_add(1);
    }

    pub fn push_fill(&mut self, fill: Fill) {
        let index = (self.fills_head as usize) % TAPE_RING;
        self.fills[index] = fill;
        self.fills_head = self.fills_head.wrapping_add(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty() -> Tape {
        Tape {
            sends: [SendEvent::default(); TAPE_RING],
            sends_head: 0,
            fills: [Fill::default(); TAPE_RING],
            fills_head: 0,
            bump: 0,
        }
    }

    #[test]
    fn size_is_fixed() {
        // 64 sends * 4 + 4 + 64 fills * 10 + 4 + 1
        assert_eq!(SendEvent::INIT_SPACE, 4);
        assert_eq!(Fill::INIT_SPACE, 10);
        assert_eq!(Tape::INIT_SPACE, 64 * 4 + 4 + 64 * 10 + 4 + 1);
    }

    #[test]
    fn rings_wrap_and_keep_the_newest() {
        let mut tape = empty();
        for i in 0..(TAPE_RING as u16 + 5) {
            tape.push_send(SendEvent {
                seat: 1,
                lane: 0,
                sent_tick: i,
            });
        }
        assert_eq!(tape.sends_head, TAPE_RING as u32 + 5);
        let newest = tape.sends[((tape.sends_head - 1) as usize) % TAPE_RING];
        assert_eq!(newest.sent_tick, TAPE_RING as u16 + 4);
        // the five oldest entries were overwritten
        assert_eq!(tape.sends[0].sent_tick, TAPE_RING as u16);
    }

    #[test]
    fn fills_wrap_too() {
        let mut tape = empty();
        for i in 0..(TAPE_RING as u16 * 2) {
            tape.push_fill(Fill {
                seat: 2,
                side: 1,
                size: 10,
                price: 1_000_000,
                landed_tick: i,
            });
        }
        assert_eq!(tape.fills_head, TAPE_RING as u32 * 2);
        assert_eq!(tape.fills[0].landed_tick, TAPE_RING as u16);
    }
}

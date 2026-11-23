use anchor_lang::prelude::*;

use crate::{CUP_ROUNDS, CUP_SLOTS, FIRST_HUMAN_SEAT, SEAT_COUNT};

/// One entrant: a human seat that bought in.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, Debug, PartialEq, Eq, InitSpace)]
pub struct CupEntry {
    pub owner: Pubkey,
    pub seat: u8,
    pub joined: bool,
    /// Sum of the entrant's round scores over the cup.
    pub score: i64,
}

/// The Alpha Cup: five rounds, human seats only, the top three are paid. The program only keeps
/// entries, scores and the ranking; the buy-ins and the prizes move through Private Payments, signed
/// by the operator (the table authority), who also co-signs every `cup_join` after seeing the buy-in.
#[account]
#[derive(InitSpace)]
pub struct Cup {
    pub cup_id: u32,
    pub rounds_recorded: u8,
    /// The last round whose scores were added (a round is counted once).
    pub last_round: u32,
    pub entries: [CupEntry; CUP_SLOTS],
    pub settled: bool,
    /// Entrants at settlement, and the ranking: winners with their share of the prize pool in basis
    /// points (the platform fee is taken off the pot before this split).
    pub entrants: u8,
    pub winners: [Pubkey; 3],
    pub winner_bps: [u16; 3],
    pub bump: u8,
}

/// Prize split for `entrants` players: 50/30/20 for three, 60/40 for two, everything for one.
pub fn payout_bps(entrants: usize) -> [u16; 3] {
    match entrants {
        0 => [0, 0, 0],
        1 => [10_000, 0, 0],
        2 => [6_000, 4_000, 0],
        _ => [5_000, 3_000, 2_000],
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum CupError {
    NotHumanSeat,
    AlreadyJoined,
    Started,
    NothingToRecord,
}

impl Cup {
    pub fn is_open(&self) -> bool {
        !self.settled && self.rounds_recorded == 0
    }

    pub fn joined(&self) -> impl Iterator<Item = &CupEntry> {
        self.entries.iter().filter(|entry| entry.joined)
    }

    /// Registers a human seat before the first round of the cup is recorded.
    pub fn join(&mut self, seat: u8, owner: Pubkey) -> core::result::Result<(), CupError> {
        if usize::from(seat) < usize::from(FIRST_HUMAN_SEAT) || usize::from(seat) >= SEAT_COUNT {
            return Err(CupError::NotHumanSeat);
        }
        if !self.is_open() {
            return Err(CupError::Started);
        }
        let entry = &mut self.entries[usize::from(seat - FIRST_HUMAN_SEAT)];
        if entry.joined {
            return Err(CupError::AlreadyJoined);
        }
        *entry = CupEntry {
            owner,
            seat,
            joined: true,
            score: 0,
        };
        Ok(())
    }

    /// Adds one finished round. An entrant scores only if the seat still belongs to them. A cup
    /// with no entrants does not count the round, so it waits for players.
    pub fn record(
        &mut self,
        round: u32,
        scores: &[i32; SEAT_COUNT],
        owners: &[Pubkey; SEAT_COUNT],
    ) -> core::result::Result<(), CupError> {
        if self.settled || self.rounds_recorded >= CUP_ROUNDS || round <= self.last_round {
            return Err(CupError::NothingToRecord);
        }
        self.last_round = round;
        if self.joined().next().is_none() {
            return Ok(());
        }
        for entry in self.entries.iter_mut().filter(|entry| entry.joined) {
            let seat = usize::from(entry.seat);
            if owners[seat] == entry.owner {
                entry.score = entry.score.saturating_add(i64::from(scores[seat]));
            }
        }
        self.rounds_recorded += 1;
        Ok(())
    }

    pub fn ready_to_settle(&self) -> bool {
        !self.settled && self.rounds_recorded >= CUP_ROUNDS
    }

    /// Ranks the entrants (best score first, the lower seat wins a tie) and fixes the prize split.
    pub fn settle(&mut self) {
        let mut ranked: Vec<CupEntry> = self.joined().copied().collect();
        ranked.sort_by(|a, b| b.score.cmp(&a.score).then(a.seat.cmp(&b.seat)));
        self.entrants = ranked.len() as u8;
        self.winners = [Pubkey::default(); 3];
        for (slot, entry) in ranked.iter().take(3).enumerate() {
            self.winners[slot] = entry.owner;
        }
        self.winner_bps = payout_bps(ranked.len());
        self.settled = true;
    }

    /// Starts the next cup once the operator has paid the prizes.
    pub fn start_next(&mut self) {
        self.cup_id = self.cup_id.saturating_add(1);
        self.rounds_recorded = 0;
        self.entries = [CupEntry::default(); CUP_SLOTS];
        self.settled = false;
        self.entrants = 0;
        self.winners = [Pubkey::default(); 3];
        self.winner_bps = [0; 3];
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty() -> Cup {
        Cup {
            cup_id: 1,
            rounds_recorded: 0,
            last_round: 0,
            entries: [CupEntry::default(); CUP_SLOTS],
            settled: false,
            entrants: 0,
            winners: [Pubkey::default(); 3],
            winner_bps: [0; 3],
            bump: 0,
        }
    }

    fn scores(values: [i32; 3]) -> [i32; SEAT_COUNT] {
        let mut out = [0; SEAT_COUNT];
        out[7..10].copy_from_slice(&values);
        out
    }

    fn owners(keys: [Pubkey; 3]) -> [Pubkey; SEAT_COUNT] {
        let mut out = [Pubkey::default(); SEAT_COUNT];
        out[7..10].copy_from_slice(&keys);
        out
    }

    #[test]
    fn the_prize_split_covers_one_two_and_three_players() {
        assert_eq!(payout_bps(0), [0, 0, 0]);
        assert_eq!(payout_bps(1), [10_000, 0, 0]);
        assert_eq!(payout_bps(2), [6_000, 4_000, 0]);
        assert_eq!(payout_bps(3), [5_000, 3_000, 2_000]);
        for n in 1..=3 {
            assert_eq!(payout_bps(n).iter().map(|b| u32::from(*b)).sum::<u32>(), 10_000);
        }
    }

    #[test]
    fn only_human_seats_join_once_before_the_cup_starts() {
        let mut cup = empty();
        let a = Pubkey::new_unique();
        for seat in [0u8, 4, 6] {
            assert_eq!(cup.join(seat, a), Err(CupError::NotHumanSeat));
        }
        assert_eq!(cup.join(10, a), Err(CupError::NotHumanSeat));
        assert_eq!(cup.join(7, a), Ok(()));
        assert_eq!(cup.join(7, a), Err(CupError::AlreadyJoined));
        let keys = [a, Pubkey::default(), Pubkey::default()];
        cup.record(1, &scores([5, 0, 0]), &owners(keys)).unwrap();
        // the cup has started: no late entries
        assert_eq!(cup.join(8, Pubkey::new_unique()), Err(CupError::Started));
    }

    #[test]
    fn scores_add_up_per_round_and_a_round_counts_once() {
        let mut cup = empty();
        let (a, b) = (Pubkey::new_unique(), Pubkey::new_unique());
        cup.join(7, a).unwrap();
        cup.join(9, b).unwrap();
        let keys = [a, Pubkey::default(), b];
        cup.record(10, &scores([30, 99, -10]), &owners(keys)).unwrap();
        cup.record(11, &scores([-5, 0, 40]), &owners(keys)).unwrap();
        assert_eq!(cup.record(11, &scores([1000, 0, 0]), &owners(keys)), Err(CupError::NothingToRecord));
        assert_eq!(cup.record(9, &scores([1000, 0, 0]), &owners(keys)), Err(CupError::NothingToRecord));
        assert_eq!((cup.entries[0].score, cup.entries[2].score), (25, 30));
        // the seat in between never joined, so its 99 is ignored
        assert!(!cup.entries[1].joined);
        assert_eq!(cup.rounds_recorded, 2);
    }

    #[test]
    fn a_seat_that_changed_hands_scores_nothing() {
        let mut cup = empty();
        let a = Pubkey::new_unique();
        cup.join(7, a).unwrap();
        let someone_else = [Pubkey::new_unique(), Pubkey::default(), Pubkey::default()];
        cup.record(1, &scores([500, 0, 0]), &owners(someone_else)).unwrap();
        assert_eq!(cup.entries[0].score, 0);
    }

    #[test]
    fn an_empty_cup_waits_for_players_instead_of_counting_rounds() {
        let mut cup = empty();
        cup.record(1, &scores([9, 9, 9]), &owners([Pubkey::default(); 3])).unwrap();
        assert_eq!(cup.rounds_recorded, 0);
        assert_eq!(cup.last_round, 1);
        assert!(cup.is_open());
    }

    #[test]
    fn settling_ranks_by_score_then_seat_and_pays_the_split() {
        let mut cup = empty();
        let keys = [Pubkey::new_unique(), Pubkey::new_unique(), Pubkey::new_unique()];
        for (i, key) in keys.iter().enumerate() {
            cup.join(7 + i as u8, *key).unwrap();
        }
        for round in 1..=CUP_ROUNDS {
            cup.record(u32::from(round), &scores([10, 25, 25]), &owners(keys)).unwrap();
        }
        assert!(cup.ready_to_settle());
        cup.settle();
        // seats 8 and 9 tie on 125; the lower seat wins the tie
        assert_eq!(cup.winners, [keys[1], keys[2], keys[0]]);
        assert_eq!(cup.winner_bps, [5_000, 3_000, 2_000]);
        assert_eq!(cup.entrants, 3);
        assert!(cup.settled);
        assert!(!cup.ready_to_settle());
        // a settled cup records nothing more
        assert_eq!(cup.record(99, &scores([1, 1, 1]), &owners(keys)), Err(CupError::NothingToRecord));
    }

    #[test]
    fn two_entrants_split_sixty_forty_and_one_takes_it_all() {
        let mut cup = empty();
        let (a, b) = (Pubkey::new_unique(), Pubkey::new_unique());
        cup.join(8, a).unwrap();
        cup.join(9, b).unwrap();
        let keys = [Pubkey::default(), a, b];
        for round in 1..=CUP_ROUNDS {
            cup.record(u32::from(round), &scores([0, -5, 5]), &owners(keys)).unwrap();
        }
        cup.settle();
        assert_eq!((cup.winners[0], cup.winners[1], cup.winners[2]), (b, a, Pubkey::default()));
        assert_eq!(cup.winner_bps, [6_000, 4_000, 0]);

        let mut solo = empty();
        solo.join(7, a).unwrap();
        for round in 1..=CUP_ROUNDS {
            solo.record(u32::from(round), &scores([-50, 0, 0]), &owners([a, Pubkey::default(), Pubkey::default()])).unwrap();
        }
        solo.settle();
        assert_eq!((solo.winners[0], solo.winner_bps), (a, [10_000, 0, 0]));
    }

    #[test]
    fn closing_starts_the_next_cup_clean() {
        let mut cup = empty();
        let a = Pubkey::new_unique();
        cup.join(7, a).unwrap();
        for round in 1..=CUP_ROUNDS {
            cup.record(u32::from(round), &scores([1, 0, 0]), &owners([a, Pubkey::default(), Pubkey::default()])).unwrap();
        }
        cup.settle();
        cup.start_next();
        assert_eq!((cup.cup_id, cup.rounds_recorded, cup.entrants, cup.settled), (2, 0, 0, false));
        assert!(cup.is_open());
        assert!(!cup.entries.iter().any(|e| e.joined));
        assert_eq!(cup.winners, [Pubkey::default(); 3]);
        // round ids keep counting: the same round is never scored into two cups
        assert_eq!(cup.last_round, u32::from(CUP_ROUNDS));
    }
}

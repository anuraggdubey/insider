use anchor_lang::prelude::*;

use crate::{LEADERBOARD_SIZE, SEAT_COUNT};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, Debug, InitSpace)]
pub struct ScoreEntry {
    pub owner: Pubkey,
    pub score: i64,
    pub rounds: u16,
}

/// Track record of one analyst seat, judged by the oracle (public, on chain).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, Debug, InitSpace)]
pub struct AnalystStats {
    pub calls: u32,
    pub hits: u32,
    pub streak: u16,
    pub best_streak: u16,
    pub profit: i64,
}

/// Epoch state, delegated and committed separately from the table accounts (spec section 6).
#[account]
#[derive(InitSpace)]
pub struct Season {
    pub epoch: u32,
    pub rounds_played: u32,
    /// Best scores of the epoch, highest first; empty slots have a default owner.
    pub leaderboard: [ScoreEntry; LEADERBOARD_SIZE],
    pub analysts: [AnalystStats; SEAT_COUNT],
    pub bump: u8,
}

impl Season {
    /// Records a round score. An owner keeps their best score and a round counter; a new owner
    /// replaces the last entry only if their score beats it. The list stays sorted high to low
    /// with empty slots at the end.
    pub fn record_score(&mut self, owner: Pubkey, score: i64) {
        let existing = self.leaderboard.iter().position(|entry| entry.owner == owner);
        if let Some(index) = existing {
            let entry = &mut self.leaderboard[index];
            entry.rounds = entry.rounds.saturating_add(1);
            if score > entry.score {
                entry.score = score;
            }
        } else {
            let last = LEADERBOARD_SIZE - 1;
            let last_entry = self.leaderboard[last];
            if last_entry.owner != Pubkey::default() && score <= last_entry.score {
                return;
            }
            self.leaderboard[last] = ScoreEntry {
                owner,
                score,
                rounds: 1,
            };
        }
        self.leaderboard.sort_by(|a, b| {
            let a_empty = a.owner == Pubkey::default();
            let b_empty = b.owner == Pubkey::default();
            a_empty.cmp(&b_empty).then(b.score.cmp(&a.score))
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty() -> Season {
        Season {
            epoch: 0,
            rounds_played: 0,
            leaderboard: [ScoreEntry::default(); LEADERBOARD_SIZE],
            analysts: [AnalystStats::default(); SEAT_COUNT],
            bump: 0,
        }
    }

    #[test]
    fn size_is_fixed_and_commit_friendly() {
        // score entry 32 + 8 + 2 = 42, analyst stats 4 + 4 + 2 + 2 + 8 = 20
        assert_eq!(ScoreEntry::INIT_SPACE, 42);
        assert_eq!(AnalystStats::INIT_SPACE, 20);
        assert_eq!(Season::INIT_SPACE, 4 + 4 + 20 * 42 + 10 * 20 + 1);
        // committed accounts stay below the validator's 10,240-byte limit
        assert!(8 + Season::INIT_SPACE < 10_240);
    }

    #[test]
    fn leaderboard_is_sorted_and_bounded() {
        let mut season = empty();
        for score in 0..30i64 {
            season.record_score(Pubkey::new_unique(), score * 10);
        }
        assert_eq!(season.leaderboard[0].score, 290);
        assert_eq!(season.leaderboard[LEADERBOARD_SIZE - 1].score, 100);
        for pair in season.leaderboard.windows(2) {
            assert!(pair[0].score >= pair[1].score);
        }
    }

    #[test]
    fn an_owner_keeps_their_best_score() {
        let mut season = empty();
        let owner = Pubkey::new_unique();
        season.record_score(owner, 50);
        season.record_score(owner, 20);
        season.record_score(owner, 80);
        assert_eq!(season.leaderboard[0].owner, owner);
        assert_eq!(season.leaderboard[0].score, 80);
        assert_eq!(season.leaderboard[0].rounds, 3);
        assert_eq!(season.leaderboard[1].owner, Pubkey::default());
    }
}

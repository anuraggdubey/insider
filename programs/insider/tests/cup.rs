//! Alpha Cup tests (LiteSVM): joining needs the operator, rounds are recorded once from the X-ray,
//! the cup settles after five rounds and the operator closes it to start the next one.

use std::path::PathBuf;

use anchor_lang::{
    solana_program::{instruction::Instruction, pubkey::Pubkey, system_program},
    AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas,
};
use insider::{
    accounts, error::InsiderError, instruction, Cup, Phase, Table, Xray, CUP_ROUNDS,
    CUP_SEED, SEAT_SEED, TABLE_SEED, XRAY_SEED,
};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &insider::ID).0
}

fn send(svm: &mut LiteSVM, signers: &[&Keypair], ix: Instruction) -> Result<(), String> {
    svm.expire_blockhash();
    let message = Message::new(&[ix], Some(&signers[0].pubkey()));
    let tx = Transaction::new(signers, message, svm.latest_blockhash());
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{e:?}"))
}

fn read<T: AccountDeserialize>(svm: &LiteSVM, key: &Pubkey) -> T {
    T::try_deserialize(&mut svm.get_account(key).unwrap().data.as_slice()).unwrap()
}

fn write<T: AccountSerialize>(svm: &mut LiteSVM, key: &Pubkey, value: &T) {
    let mut account = svm.get_account(key).unwrap();
    let mut data = Vec::new();
    value.try_serialize(&mut data).unwrap();
    account.data = data;
    svm.set_account(*key, account).unwrap();
}

fn expect_error(result: Result<(), String>, error: InsiderError) {
    let code = 6000 + error as u32;
    let message = result.expect_err("the instruction should fail");
    assert!(
        message.contains(&format!("Custom({code})")),
        "expected {error:?} (Custom({code})), got {message}"
    );
}

struct World {
    svm: LiteSVM,
    operator: Keypair,
    table: Pubkey,
    cup: Pubkey,
    xray: Pubkey,
}

fn world() -> World {
    let so = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy/insider.so");
    assert!(so.exists(), "missing {}: run `pnpm program:build` first", so.display());
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(insider::ID, &so).unwrap();
    let operator = Keypair::new();
    svm.airdrop(&operator.pubkey(), 100_000_000_000).unwrap();
    let a = operator.pubkey();
    let table = pda(&[TABLE_SEED, a.as_ref()]);
    let cup = pda(&[CUP_SEED, table.as_ref()]);
    let xray = pda(&[XRAY_SEED, table.as_ref()]);
    let mut ixs = vec![
        Instruction {
            program_id: insider::ID,
            accounts: accounts::InitTable { authority: a, table, system_program: system_program::ID }
                .to_account_metas(None),
            data: instruction::InitTable { params: None }.data(),
        },
        Instruction {
            program_id: insider::ID,
            accounts: accounts::InitXray { authority: a, table, xray, system_program: system_program::ID }
                .to_account_metas(None),
            data: instruction::InitXray {}.data(),
        },
        Instruction {
            program_id: insider::ID,
            accounts: accounts::InitCup { authority: a, table, cup, system_program: system_program::ID }
                .to_account_metas(None),
            data: instruction::InitCup {}.data(),
        },
    ];
    for index in 0..10u8 {
        ixs.push(Instruction {
            program_id: insider::ID,
            accounts: accounts::InitSeat {
                authority: a,
                table,
                seat: pda(&[SEAT_SEED, table.as_ref(), &[index]]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::InitSeat { index }.data(),
        });
    }
    for ix in ixs {
        send(&mut svm, &[&operator], ix).unwrap();
    }
    World { svm, operator, table, cup, xray }
}

impl World {
    fn seat(&self, index: u8) -> Pubkey {
        pda(&[SEAT_SEED, self.table.as_ref(), &[index]])
    }

    fn claim(&mut self, owner: &Keypair, index: u8) {
        self.svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();
        let ix = Instruction {
            program_id: insider::ID,
            accounts: accounts::ClaimSeat { owner: owner.pubkey(), table: self.table, seat: self.seat(index) }
                .to_account_metas(None),
            data: instruction::ClaimSeat { index }.data(),
        };
        send(&mut self.svm, &[owner], ix).unwrap();
    }

    fn join_ix(&self, owner: &Pubkey, operator: &Pubkey, index: u8) -> Instruction {
        Instruction {
            program_id: insider::ID,
            accounts: accounts::CupJoin {
                owner: *owner,
                operator: *operator,
                table: self.table,
                seat: self.seat(index),
                cup: self.cup,
            }
            .to_account_metas(None),
            data: instruction::CupJoin { index }.data(),
        }
    }

    fn join(&mut self, owner: &Keypair, index: u8) -> Result<(), String> {
        let ix = self.join_ix(&owner.pubkey(), &self.operator.pubkey(), index);
        let operator = Keypair::try_from(self.operator.to_bytes().as_slice()).unwrap();
        send(&mut self.svm, &[owner, &operator], ix)
    }

    /// Puts a scored round into the X-ray the way `finish_round` leaves it.
    fn finish(&mut self, round: u32, scores: [i32; 3], owners: [Pubkey; 3]) {
        let mut table: Table = read(&self.svm, &self.table);
        table.round_id = round;
        table.phase = Phase::Idle;
        write(&mut self.svm, &self.table, &table);
        let mut account = self.svm.get_account(&self.xray).unwrap();
        let body = &mut account.data[8..];
        let xray: &mut Xray = bytemuck::from_bytes_mut(body);
        xray.round_id = round;
        xray.finalized = 1;
        for i in 0..3 {
            xray.scores[7 + i] = scores[i];
            xray.seat_owners[7 + i] = owners[i];
        }
        self.svm.set_account(self.xray, account).unwrap();
    }

    fn record(&mut self) -> Result<(), String> {
        let payer = Keypair::new();
        self.svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();
        let ix = Instruction {
            program_id: insider::ID,
            accounts: accounts::CupRecord {
                payer: payer.pubkey(),
                table: self.table,
                xray: self.xray,
                cup: self.cup,
            }
            .to_account_metas(None),
            data: instruction::CupRecord {}.data(),
        };
        send(&mut self.svm, &[&payer], ix)
    }

    fn settle(&mut self) -> Result<(), String> {
        let payer = Keypair::new();
        self.svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();
        let ix = Instruction {
            program_id: insider::ID,
            accounts: accounts::CupSettle { payer: payer.pubkey(), table: self.table, cup: self.cup }
                .to_account_metas(None),
            data: instruction::CupSettle {}.data(),
        };
        send(&mut self.svm, &[&payer], ix)
    }

    fn close(&mut self, who: &Keypair) -> Result<(), String> {
        let ix = Instruction {
            program_id: insider::ID,
            accounts: accounts::CupClose { operator: who.pubkey(), table: self.table, cup: self.cup }
                .to_account_metas(None),
            data: instruction::CupClose {}.data(),
        };
        send(&mut self.svm, &[who], ix)
    }
}

#[test]
fn a_new_cup_is_created_open_and_empty() {
    let w = world();
    let cup: Cup = read(&w.svm, &w.cup);
    assert_eq!((cup.cup_id, cup.rounds_recorded, cup.settled), (1, 0, false));
    assert!(cup.is_open());
}

#[test]
fn joining_needs_the_operator_a_human_seat_and_the_seat_owner() {
    let mut w = world();
    let (bob, bot) = (Keypair::new(), Keypair::new());
    w.claim(&bob, 8);
    w.claim(&bot, 3);

    // the owner alone is not enough: the operator must co-sign
    let ix = w.join_ix(&bob.pubkey(), &bob.pubkey(), 8);
    expect_error(send(&mut w.svm, &[&bob], ix), InsiderError::NotAuthority);

    // bots and AI seats cannot win prizes
    expect_error(w.join(&bot, 3), InsiderError::NotHumanSeat);

    // somebody else's seat
    let mallory = Keypair::new();
    w.svm.airdrop(&mallory.pubkey(), 1_000_000_000).unwrap();
    assert!(w.join(&mallory, 8).is_err());

    w.join(&bob, 8).unwrap();
    expect_error(w.join(&bob, 8), InsiderError::CupAlreadyJoined);
    let cup: Cup = read(&w.svm, &w.cup);
    assert_eq!(cup.entries[1].owner, bob.pubkey());
    assert!(cup.entries[1].joined);
}

#[test]
fn rounds_are_recorded_once_from_the_scored_xray_and_a_cup_runs_five_rounds() {
    let mut w = world();
    let (alice, bob) = (Keypair::new(), Keypair::new());
    w.claim(&alice, 7);
    w.claim(&bob, 8);
    w.join(&alice, 7).unwrap();
    w.join(&bob, 8).unwrap();
    let none = Pubkey::default();
    let owners = [alice.pubkey(), bob.pubkey(), none];

    // nothing scored yet
    expect_error(w.record(), InsiderError::WrongPhase);
    expect_error(w.settle(), InsiderError::CupNotReady);

    for round in 1..=u32::from(CUP_ROUNDS) {
        w.finish(round, [10, 30, 0], owners);
        w.record().unwrap();
        // the same round cannot be counted twice
        expect_error(w.record(), InsiderError::CupNothingToRecord);
        if round < u32::from(CUP_ROUNDS) {
            expect_error(w.settle(), InsiderError::CupNotReady);
        }
    }
    let cup: Cup = read(&w.svm, &w.cup);
    assert_eq!((cup.entries[0].score, cup.entries[1].score), (50, 150));
    // a cup that is running takes no late entries
    let carol = Keypair::new();
    w.claim(&carol, 9);
    expect_error(w.join(&carol, 9), InsiderError::CupStarted);

    w.settle().unwrap();
    let cup: Cup = read(&w.svm, &w.cup);
    assert!(cup.settled);
    assert_eq!(cup.entrants, 2);
    assert_eq!((cup.winners[0], cup.winners[1]), (bob.pubkey(), alice.pubkey()));
    assert_eq!(cup.winner_bps, [6_000, 4_000, 0]);
    expect_error(w.settle(), InsiderError::CupNotReady);
    // nothing more is recorded while it waits for payment
    w.finish(6, [1, 1, 1], owners);
    expect_error(w.record(), InsiderError::CupNothingToRecord);

    // only the operator closes it, and then the next cup is open
    assert!(w.close(&alice).is_err());
    let operator = Keypair::try_from(w.operator.to_bytes().as_slice()).unwrap();
    w.close(&operator).unwrap();
    let cup: Cup = read(&w.svm, &w.cup);
    assert_eq!((cup.cup_id, cup.rounds_recorded, cup.settled), (2, 0, false));
    w.join(&carol, 9).unwrap();
    expect_error(w.close(&operator), InsiderError::CupNotReady);
}

#[test]
fn a_cup_without_entrants_does_not_count_rounds() {
    let mut w = world();
    w.finish(1, [5, 5, 5], [Pubkey::default(); 3]);
    w.record().unwrap();
    let cup: Cup = read(&w.svm, &w.cup);
    assert_eq!((cup.rounds_recorded, cup.last_round), (0, 1));
}

#[test]
fn the_cup_can_be_created_while_the_table_is_delegated() {
    let so = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy/insider.so");
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(insider::ID, &so).unwrap();
    let operator = Keypair::new();
    svm.airdrop(&operator.pubkey(), 10_000_000_000).unwrap();
    let a = operator.pubkey();
    let table = pda(&[TABLE_SEED, a.as_ref()]);
    let init = Instruction {
        program_id: insider::ID,
        accounts: accounts::InitTable { authority: a, table, system_program: system_program::ID }
            .to_account_metas(None),
        data: instruction::InitTable { params: None }.data(),
    };
    send(&mut svm, &[&operator], init).unwrap();
    let mut account = svm.get_account(&table).unwrap();
    account.owner = "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh".parse().unwrap();
    svm.set_account(table, account).unwrap();
    let cup = pda(&[CUP_SEED, table.as_ref()]);
    let ix = Instruction {
        program_id: insider::ID,
        accounts: accounts::InitCup { authority: a, table, cup, system_program: system_program::ID }
            .to_account_metas(None),
        data: instruction::InitCup {}.data(),
    };
    send(&mut svm, &[&operator], ix).unwrap();
}

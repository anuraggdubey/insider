//! Recovery tests (LiteSVM). The Magic and Delegation programs are not available here, so these
//! cover every guard that runs before the CPI: who may call, which accounts may be named, the group
//! size, the phase, and that an account that is not delegated needs no recovery.

use std::path::PathBuf;

use anchor_lang::{
    solana_program::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        system_program,
    },
    AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas,
};
use insider::{
    accounts, error::InsiderError, instruction, Phase, Table, KIND_CUP, KIND_SEAT, KIND_TABLE,
    KIND_XRAY, SEAT_SEED, TABLE_SEED,
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

fn code(error: InsiderError) -> String {
    format!("Custom({})", 6000 + error as u32)
}

fn expect_error(result: Result<(), String>, error: InsiderError) {
    let message = result.expect_err("the instruction should fail");
    assert!(message.contains(&code(error)), "expected {error:?}, got {message}");
}

/// Past every guard: it may still fail, but not with one of ours.
fn passes_the_guards(result: Result<(), String>) {
    let message = result.expect_err("the Magic program is not available here");
    for error in [
        InsiderError::NotAuthority,
        InsiderError::InvalidRecoveryTarget,
        InsiderError::WrongPhase,
        InsiderError::NotDelegated,
    ] {
        assert!(!message.contains(&code(error)), "stopped by a guard: {message}");
    }
}

struct World {
    svm: LiteSVM,
    authority: Keypair,
    table: Pubkey,
}

fn world() -> World {
    let so = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy/insider.so");
    assert!(so.exists(), "missing {}: run `pnpm program:build` first", so.display());
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(insider::ID, &so).unwrap();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();
    let a = authority.pubkey();
    let table = pda(&[TABLE_SEED, a.as_ref()]);
    let ix = Instruction {
        program_id: insider::ID,
        accounts: accounts::InitTable { authority: a, table, system_program: system_program::ID }
            .to_account_metas(None),
        data: instruction::InitTable { params: None }.data(),
    };
    send(&mut svm, &[&authority], ix).unwrap();
    // the Magic program must exist for Anchor to accept it; any valid program will do because every
    // test below stops at a guard or at the CPI
    svm.add_program_from_file(ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID, &so).unwrap();
    World { svm, authority, table }
}

fn clone_key(key: &Keypair) -> Keypair {
    Keypair::try_from(key.to_bytes().as_slice()).unwrap()
}

impl World {
    fn teardown(
        &mut self,
        payer: &Keypair,
        kinds: Vec<u8>,
        slots: Vec<u8>,
        force: bool,
        remaining: Vec<Pubkey>,
    ) -> Result<(), String> {
        let mut metas = accounts::Teardown {
            payer: payer.pubkey(),
            table: self.table,
            magic_program: ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID,
            magic_context: ephemeral_rollups_sdk::consts::MAGIC_CONTEXT_ID,
        }
        .to_account_metas(None);
        metas.extend(remaining.into_iter().map(|key| AccountMeta::new(key, false)));
        let ix = Instruction {
            program_id: insider::ID,
            accounts: metas,
            data: instruction::Teardown { kinds, slots, force }.data(),
        };
        send(&mut self.svm, &[payer], ix)
    }

    fn recover(&mut self, kind: u8, slot: u8, target: Pubkey, _unused: Option<Pubkey>) -> Result<(), String> {
        let a = self.authority.pubkey();
        let dlp = insider::dlp_accounts(&target);
        let ix = Instruction {
            program_id: insider::ID,
            accounts: accounts::Recover {
                authority: a,
                table: self.table,
                target,
                undelegation_request: dlp.request,
                delegation_record: dlp.record,
                delegation_metadata: dlp.metadata,
                commit_state: dlp.commit_state,
                commit_record: dlp.commit_record,
                delegation_program: insider::DELEGATION_PROGRAM_ID,
                owner_program: insider::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::RequestUndelegation { kind, slot }.data(),
        };
        let signer = clone_key(&self.authority);
        send(&mut self.svm, &[&signer], ix)
    }

    fn set_phase(&mut self, phase: Phase) {
        let mut account = self.svm.get_account(&self.table).unwrap();
        let mut table = Table::try_deserialize(&mut account.data.as_slice()).unwrap();
        table.phase = phase;
        let mut data = Vec::new();
        table.try_serialize(&mut data).unwrap();
        account.data = data;
        self.svm.set_account(self.table, account).unwrap();
    }

    fn address(&self, kind: u8, slot: u8) -> Pubkey {
        insider::address_for(kind, slot, &self.table, &self.authority.pubkey()).unwrap().0
    }
}

#[test]
fn only_the_authority_may_tear_down() {
    let mut w = world();
    let stranger = Keypair::new();
    w.svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    let xray = w.address(KIND_XRAY, 0);
    expect_error(w.teardown(&stranger, vec![KIND_XRAY], vec![0], false, vec![xray]), InsiderError::NotAuthority);
}

#[test]
fn a_group_must_be_one_to_eight_known_accounts_in_order() {
    let mut w = world();
    let authority = clone_key(&w.authority);
    let xray = w.address(KIND_XRAY, 0);
    let cup = w.address(KIND_CUP, 0);
    // nothing, mismatched lists, more than eight
    expect_error(w.teardown(&authority, vec![], vec![], false, vec![]), InsiderError::InvalidRecoveryTarget);
    expect_error(w.teardown(&authority, vec![KIND_XRAY], vec![], false, vec![xray]), InsiderError::InvalidRecoveryTarget);
    let nine: Vec<Pubkey> = (0..9).map(|_| Pubkey::new_unique()).collect();
    expect_error(w.teardown(&authority, vec![KIND_SEAT; 9], vec![0; 9], false, nine), InsiderError::InvalidRecoveryTarget);
    // a kind that does not exist, a slot out of range
    expect_error(w.teardown(&authority, vec![99], vec![0], false, vec![xray]), InsiderError::InvalidRecoveryTarget);
    expect_error(w.teardown(&authority, vec![KIND_SEAT], vec![10], false, vec![xray]), InsiderError::InvalidRecoveryTarget);
    // the wrong account for the kind named, or the right ones in the wrong order
    expect_error(w.teardown(&authority, vec![KIND_XRAY], vec![0], false, vec![Pubkey::new_unique()]), InsiderError::InvalidRecoveryTarget);
    expect_error(w.teardown(&authority, vec![KIND_XRAY, KIND_CUP], vec![0, 0], false, vec![cup, xray]), InsiderError::InvalidRecoveryTarget);
    // a missing or an extra account
    expect_error(w.teardown(&authority, vec![KIND_XRAY, KIND_CUP], vec![0, 0], false, vec![xray]), InsiderError::InvalidRecoveryTarget);
    expect_error(w.teardown(&authority, vec![KIND_XRAY], vec![0], false, vec![xray, cup]), InsiderError::InvalidRecoveryTarget);
}

#[test]
fn a_correct_group_gets_through_every_guard_including_the_table_itself() {
    let mut w = world();
    let authority = clone_key(&w.authority);
    let xray = w.address(KIND_XRAY, 0);
    let seat = w.address(KIND_SEAT, 4);
    passes_the_guards(w.teardown(&authority, vec![KIND_XRAY, KIND_SEAT], vec![0, 4], false, vec![xray, seat]));
    // the table is the named account, so it takes no remaining account
    passes_the_guards(w.teardown(&authority, vec![KIND_SEAT, KIND_TABLE], vec![4, 0], false, vec![seat]));
    let eight: Vec<Pubkey> = (0..8).map(|i| w.address(KIND_SEAT, i)).collect();
    passes_the_guards(w.teardown(&authority, vec![KIND_SEAT; 8], (0..8).collect(), false, eight));
}

#[test]
fn a_round_in_progress_is_not_cut_in_half_unless_forced() {
    let mut w = world();
    let authority = clone_key(&w.authority);
    let xray = w.address(KIND_XRAY, 0);
    for phase in [Phase::Live, Phase::Closing, Phase::Seeding] {
        w.set_phase(phase);
        expect_error(w.teardown(&authority, vec![KIND_XRAY], vec![0], false, vec![xray]), InsiderError::WrongPhase);
        passes_the_guards(w.teardown(&authority, vec![KIND_XRAY], vec![0], true, vec![xray]));
    }
    w.set_phase(Phase::Xray);
    expect_error(w.teardown(&authority, vec![KIND_XRAY], vec![0], false, vec![xray]), InsiderError::WrongPhase);
}

#[test]
fn recovery_requests_name_only_this_tables_delegated_accounts() {
    let mut w = world();
    // the table exists but belongs to this program: nothing to recover
    let table = w.table;
    expect_error(w.recover(KIND_TABLE, 0, table, None), InsiderError::NotDelegated);
    // an unknown account, a kind that does not exist, a slot out of range
    expect_error(w.recover(KIND_XRAY, 0, Pubkey::new_unique(), None), InsiderError::InvalidRecoveryTarget);
    let xray = w.address(KIND_XRAY, 0);
    expect_error(w.recover(77, 0, xray, None), InsiderError::InvalidRecoveryTarget);
    let seat = pda(&[SEAT_SEED, w.table.as_ref(), &[3]]);
    expect_error(w.recover(KIND_SEAT, 12, seat, None), InsiderError::InvalidRecoveryTarget);
    // the right account but a kind that names another one
    expect_error(w.recover(KIND_CUP, 0, seat, None), InsiderError::InvalidRecoveryTarget);
}

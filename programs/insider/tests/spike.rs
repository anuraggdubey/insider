use std::path::PathBuf;

use anchor_lang::{
    solana_program::{instruction::Instruction, pubkey::Pubkey, system_program},
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use insider::{accounts, instruction, Spike, SPIKE_SEED};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

fn setup() -> (LiteSVM, Keypair) {
    let so = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/deploy/insider.so");
    assert!(
        so.exists(),
        "missing {}: run `pnpm program:build` first",
        so.display()
    );
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(insider::ID, &so).unwrap();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();
    (svm, authority)
}

fn spike_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[SPIKE_SEED, authority.as_ref()], &insider::ID).0
}

fn send(svm: &mut LiteSVM, signer: &Keypair, ix: Instruction) -> Result<(), String> {
    let message = Message::new(&[ix], Some(&signer.pubkey()));
    let tx = Transaction::new(&[signer], message, svm.latest_blockhash());
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{e:?}"))
}

fn init_ix(authority: &Pubkey) -> Instruction {
    Instruction {
        program_id: insider::ID,
        accounts: accounts::SpikeInit {
            authority: *authority,
            spike: spike_pda(authority),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::SpikeInit {}.data(),
    }
}

fn increment_ix(authority: &Pubkey, spike: Pubkey) -> Instruction {
    Instruction {
        program_id: insider::ID,
        accounts: accounts::SpikeIncrement {
            authority: *authority,
            spike,
        }
        .to_account_metas(None),
        data: instruction::SpikeIncrement {}.data(),
    }
}

fn read_spike(svm: &LiteSVM, pda: &Pubkey) -> Spike {
    let account = svm.get_account(pda).expect("spike account exists");
    Spike::try_deserialize(&mut account.data.as_slice()).unwrap()
}

#[test]
fn init_creates_a_zeroed_spike_owned_by_the_authority() {
    let (mut svm, authority) = setup();
    send(&mut svm, &authority, init_ix(&authority.pubkey())).unwrap();

    let spike = read_spike(&svm, &spike_pda(&authority.pubkey()));
    assert_eq!(spike.authority, authority.pubkey());
    assert_eq!(spike.count, 0);
}

#[test]
fn increment_adds_one_each_call() {
    let (mut svm, authority) = setup();
    let pda = spike_pda(&authority.pubkey());
    send(&mut svm, &authority, init_ix(&authority.pubkey())).unwrap();

    for _ in 0..3 {
        send(&mut svm, &authority, increment_ix(&authority.pubkey(), pda)).unwrap();
        svm.expire_blockhash();
    }

    assert_eq!(read_spike(&svm, &pda).count, 3);
}

#[test]
fn increment_rejects_a_different_signer() {
    let (mut svm, authority) = setup();
    let pda = spike_pda(&authority.pubkey());
    send(&mut svm, &authority, init_ix(&authority.pubkey())).unwrap();

    let intruder = Keypair::new();
    svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let result = send(&mut svm, &intruder, increment_ix(&intruder.pubkey(), pda));

    assert!(result.is_err());
    assert_eq!(read_spike(&svm, &pda).count, 0);
}

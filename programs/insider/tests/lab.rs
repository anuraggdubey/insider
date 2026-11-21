use std::path::PathBuf;

use anchor_lang::{
    solana_program::{instruction::Instruction, pubkey::Pubkey, system_program},
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use ephemeral_rollups_sdk::{access_control::structs::EphemeralPermission, ephemeral_accounts};
use insider::{accounts, instruction, Lab, Slot, LAB_SEED, SLOT_SEED};
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

fn send(svm: &mut LiteSVM, signers: &[&Keypair], ix: Instruction) -> Result<(), String> {
    let message = Message::new(&[ix], Some(&signers[0].pubkey()));
    let tx = Transaction::new(signers, message, svm.latest_blockhash());
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{e:?}"))
}

fn lab_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[LAB_SEED, authority.as_ref()], &insider::ID).0
}

fn lab_init_ix(authority: &Pubkey, candidates: [Pubkey; 4]) -> Instruction {
    Instruction {
        program_id: insider::ID,
        accounts: accounts::LabInit {
            authority: *authority,
            lab: lab_pda(authority),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::LabInit {
            secret: 424242,
            candidates,
        }
        .data(),
    }
}

fn read_lab(svm: &LiteSVM, pda: &Pubkey) -> Lab {
    let account = svm.get_account(pda).expect("lab exists");
    Lab::try_deserialize(&mut account.data.as_slice()).unwrap()
}

#[test]
fn lab_init_stores_candidates_and_prefunds_permission_rent() {
    let (mut svm, authority) = setup();
    let candidates = [
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    ];
    send(
        &mut svm,
        &[&authority],
        lab_init_ix(&authority.pubkey(), candidates),
    )
    .unwrap();

    let pda = lab_pda(&authority.pubkey());
    let lab = read_lab(&svm, &pda);
    assert_eq!(lab.authority, authority.pubkey());
    assert_eq!(lab.secret, 424242);
    assert_eq!(lab.candidates, candidates);
    assert_eq!(lab.reader, authority.pubkey());
    assert!(!lab.pending);

    // the account holds its own rent plus exactly the rent its ephemeral permission will need
    let account = svm.get_account(&pda).unwrap();
    let rent_exempt = svm.minimum_balance_for_rent_exemption(account.data.len());
    let permission_rent = ephemeral_accounts::rent(EphemeralPermission::size_of(
        insider::LAB_MAX_PERMISSION_MEMBERS,
    ) as u32);
    assert_eq!(account.lamports, rent_exempt + permission_rent);
}

#[test]
fn lab_cancel_roll_only_works_for_the_lab_authority() {
    let (mut svm, authority) = setup();
    send(
        &mut svm,
        &[&authority],
        lab_init_ix(&authority.pubkey(), [Pubkey::new_unique(); 4]),
    )
    .unwrap();

    let intruder = Keypair::new();
    svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let cancel = |signer: &Pubkey| Instruction {
        program_id: insider::ID,
        accounts: accounts::LabCancelRoll {
            authority: *signer,
            lab: lab_pda(&authority.pubkey()),
        }
        .to_account_metas(None),
        data: instruction::LabCancelRoll {}.data(),
    };

    assert!(send(&mut svm, &[&intruder], cancel(&intruder.pubkey())).is_err());
    svm.expire_blockhash();
    send(&mut svm, &[&authority], cancel(&authority.pubkey())).unwrap();
}

#[test]
fn lab_tick_rejects_anyone_but_the_crank_signer() {
    let (mut svm, authority) = setup();
    send(
        &mut svm,
        &[&authority],
        lab_init_ix(&authority.pubkey(), [Pubkey::new_unique(); 4]),
    )
    .unwrap();
    svm.expire_blockhash();

    let impostor = Keypair::new();
    let tick = Instruction {
        program_id: insider::ID,
        accounts: accounts::LabTick {
            lab: lab_pda(&authority.pubkey()),
            crank_signer: impostor.pubkey(),
        }
        .to_account_metas(None),
        data: instruction::LabTick {}.data(),
    };

    assert!(send(&mut svm, &[&authority, &impostor], tick).is_err());
    assert_eq!(read_lab(&svm, &lab_pda(&authority.pubkey())).ticks, 0);
}

#[test]
fn slot_init_records_authority_and_index() {
    let (mut svm, authority) = setup();
    for index in [0u8, 7] {
        let pda = Pubkey::find_program_address(
            &[SLOT_SEED, authority.pubkey().as_ref(), &[index]],
            &insider::ID,
        )
        .0;
        let ix = Instruction {
            program_id: insider::ID,
            accounts: accounts::SlotInit {
                authority: authority.pubkey(),
                slot: pda,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::SlotInit { index }.data(),
        };
        send(&mut svm, &[&authority], ix).unwrap();
        svm.expire_blockhash();

        let account = svm.get_account(&pda).unwrap();
        let slot = Slot::try_deserialize(&mut account.data.as_slice()).unwrap();
        assert_eq!(slot.authority, authority.pubkey());
        assert_eq!(slot.index, index);
        assert_eq!(slot.count, 0);
    }
}

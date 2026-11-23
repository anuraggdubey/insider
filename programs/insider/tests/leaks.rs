use std::path::PathBuf;

use anchor_lang::{
    prelude::Pubkey,
    solana_program::{instruction::Instruction, system_program},
    AccountDeserialize, AccountSerialize, Discriminator, InstructionData, ToAccountMetas,
};
use bytemuck::Zeroable;
use insider::{
    accounts, instruction, Fill, Market, Mempool, Params, Phase, Seat, SeatKind, SendEvent, Table,
    Tape, MARKET_FLOOR, MARKET_SEED, MEMPOOL_SEED, SEAT_SEED, TAPE_RING, TAPE_SEED,
};
use litesvm::{
    types::{FailedTransactionMetadata, TransactionMetadata},
    LiteSVM,
};
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

struct Fixture {
    svm: LiteSVM,
    owner: Keypair,
    table: Pubkey,
    seat: Pubkey,
    market: Pubkey,
    mempool: Pubkey,
    tape: Pubkey,
}

impl Fixture {
    fn new() -> Self {
        let so = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy/insider.so");
        assert!(
            so.exists(),
            "missing {}: run `pnpm program:build` first",
            so.display()
        );
        let mut svm = LiteSVM::new();
        svm.add_program_from_file(insider::ID, &so).unwrap();
        let owner = Keypair::new();
        svm.airdrop(&owner.pubkey(), 10_000_000_000).unwrap();
        let table = Pubkey::new_unique();
        let (seat, seat_bump) =
            Pubkey::find_program_address(&[SEAT_SEED, table.as_ref(), &[0]], &insider::ID);
        let (market, market_bump) = Pubkey::find_program_address(
            &[MARKET_SEED, table.as_ref(), &[MARKET_FLOOR]],
            &insider::ID,
        );
        let (mempool, mempool_bump) =
            Pubkey::find_program_address(&[MEMPOOL_SEED, table.as_ref()], &insider::ID);
        let (tape, tape_bump) =
            Pubkey::find_program_address(&[TAPE_SEED, table.as_ref()], &insider::ID);
        let mut f = Self {
            svm,
            owner,
            table,
            seat,
            market,
            mempool,
            tape,
        };
        let table_data = Table {
            authority: f.owner.pubkey(),
            epoch: 0,
            round_id: 1,
            phase: Phase::Live,
            round_start_slot: 0,
            tick: 42,
            armed_until_slot: 0,
            vrf_nonce: 0,
            vrf_pending: false,
            vrf_requested_tick: 0,
            rounds_this_epoch: 0,
            params: Params::default(),
            bump: 0,
        };
        let seat_data = Seat {
            index: 0,
            owner: f.owner.pubkey(),
            name_idx: 0,
            kind: SeatKind::Bot,
            chips: 1000,
            position: 0,
            entry: 0,
            fees_paid: 0,
            leak_spend: 0,
            pending_count: 0,
            desk_chips: 0,
            desk_position: 0,
            last_seen_tick: 0,
            claims: 0,
            bump: seat_bump,
        };
        let tape_data = Tape {
            sends: [SendEvent::default(); TAPE_RING],
            sends_head: 0,
            fills: [Fill::default(); TAPE_RING],
            fills_head: 0,
            bump: tape_bump,
        };
        let mut market_data = Market::zeroed();
        market_data.bump = market_bump;
        let mut mempool_data = Mempool::zeroed();
        mempool_data.bump = mempool_bump;
        f.put_serialized(table, &table_data);
        f.put_serialized(seat, &seat_data);
        f.put_serialized(tape, &tape_data);
        f.put_zero_copy(market, &market_data);
        f.put_zero_copy(mempool, &mempool_data);
        f
    }

    fn put_bytes(&mut self, key: Pubkey, data: Vec<u8>) {
        let mut account = self.svm.get_account(&system_program::ID).unwrap();
        account.lamports = 1_000_000_000;
        account.owner = insider::ID;
        account.executable = false;
        account.data = data;
        self.svm.set_account(key, account).unwrap();
    }

    fn put_serialized<T: AccountSerialize>(&mut self, key: Pubkey, value: &T) {
        let mut data = Vec::new();
        value.try_serialize(&mut data).unwrap();
        self.put_bytes(key, data);
    }

    fn put_zero_copy<T: Discriminator + bytemuck::Pod>(&mut self, key: Pubkey, value: &T) {
        let mut data = T::DISCRIMINATOR.to_vec();
        data.extend_from_slice(bytemuck::bytes_of(value));
        self.put_bytes(key, data);
    }

    fn read<T: AccountDeserialize>(&self, key: Pubkey) -> T {
        let account = self.svm.get_account(&key).unwrap();
        T::try_deserialize(&mut account.data.as_slice()).unwrap()
    }

    fn ix(&self, owner: Pubkey, size: i16) -> Instruction {
        Instruction {
            program_id: insider::ID,
            accounts: accounts::SendOrder {
                owner,
                table: self.table,
                seat: self.seat,
                market: self.market,
                mempool: self.mempool,
                tape: self.tape,
            }
            .to_account_metas(None),
            data: instruction::SendOrder {
                index: 0,
                side_size: size,
                lane: 1,
            }
            .data(),
        }
    }

    fn send(
        &mut self,
        signer: &Keypair,
        size: i16,
    ) -> Result<TransactionMetadata, Box<FailedTransactionMetadata>> {
        let message = Message::new(&[self.ix(signer.pubkey(), size)], Some(&signer.pubkey()));
        self.svm
            .send_transaction(Transaction::new(
                &[signer],
                message,
                self.svm.latest_blockhash(),
            ))
            .map_err(Box::new)
    }

    fn send_owner(
        &mut self,
        size: i16,
    ) -> Result<TransactionMetadata, Box<FailedTransactionMetadata>> {
        let message = Message::new(
            &[self.ix(self.owner.pubkey(), size)],
            Some(&self.owner.pubkey()),
        );
        self.svm
            .send_transaction(Transaction::new(
                &[&self.owner],
                message,
                self.svm.latest_blockhash(),
            ))
            .map_err(Box::new)
    }
}

#[test]
fn send_writes_private_order_and_public_event_without_order_fields_in_logs() {
    let mut f = Fixture::new();
    let meta = f.send_owner(1337).unwrap();
    let tape: Tape = f.read(f.tape);
    let seat: Seat = f.read(f.seat);
    let raw = f.svm.get_account(&f.mempool).unwrap();
    let mempool: &Mempool = bytemuck::from_bytes(&raw.data[8..]);
    assert_eq!(tape.sends_head, 1);
    assert_eq!(
        (
            tape.sends[0].seat,
            tape.sends[0].lane,
            tape.sends[0].sent_tick
        ),
        (0, 1, 42)
    );
    assert_eq!(
        (
            mempool.count,
            mempool.orders[0].side_size,
            mempool.orders[0].land_tick
        ),
        (1, 1337, 46)
    );
    assert_eq!(
        (seat.pending_count, seat.last_seen_tick, seat.chips),
        (1, 42, 990)
    );
    assert!(!meta.logs.iter().any(|line| line.contains("1337")));
    let program_logs: Vec<_> = meta
        .logs
        .iter()
        .filter(|line| line.starts_with("Program log:"))
        .collect();
    assert_eq!(program_logs, vec!["Program log: Instruction: SendOrder"]);
}

#[test]
fn wrong_signer_is_rejected() {
    let mut f = Fixture::new();
    let stranger = Keypair::new();
    f.svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    let error = f.send(&stranger, 1337).unwrap_err();
    assert!(format!("{error:?}").contains("NotSeatOwner"));
}

#[test]
fn wrong_phase_is_rejected() {
    let mut f = Fixture::new();
    let mut table: Table = f.read(f.table);
    table.phase = Phase::Closing;
    f.put_serialized(f.table, &table);
    let error = f.send_owner(1337).unwrap_err();
    assert!(format!("{error:?}").contains("WrongPhase"));
}

#[test]
fn oversize_is_rejected() {
    let mut f = Fixture::new();
    let error = f.send_owner(2001).unwrap_err();
    assert!(format!("{error:?}").contains("OrderTooLarge"));
}

#[test]
fn liquidated_seat_is_rejected() {
    let mut f = Fixture::new();
    let mut raw = f.svm.get_account(&f.market).unwrap();
    let market: &mut Market = bytemuck::from_bytes_mut(&mut raw.data[8..]);
    market.liquidated_mask = 1;
    f.svm.set_account(f.market, raw).unwrap();
    let error = f.send_owner(1337).unwrap_err();
    assert!(format!("{error:?}").contains("Liquidated"));
}

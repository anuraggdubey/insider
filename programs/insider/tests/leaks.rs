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

struct LeakFixture {
    base: Fixture,
    board: Pubkey,
    vault: Pubkey,
    permission: Pubkey,
    seller: Pubkey,
}

impl LeakFixture {
    fn new() -> Self {
        use ::insider::{Board, LeakHeader, LeakState, LeakVault, BOARD_SEED, LEAK_SEED, NO_SEAT};
        use ephemeral_rollups_sdk::{
            access_control::structs::PERMISSION_SEED,
            consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
        };
        let mut base = Fixture::new();
        let table = base.table;
        let (board, board_bump) =
            Pubkey::find_program_address(&[BOARD_SEED, table.as_ref()], &insider::ID);
        let (vault, vault_bump) =
            Pubkey::find_program_address(&[LEAK_SEED, table.as_ref(), &[0]], &insider::ID);
        let (permission, _) = Pubkey::find_program_address(
            &[PERMISSION_SEED, vault.as_ref()],
            &PERMISSION_PROGRAM_ID,
        );
        let (seller, seller_bump) =
            Pubkey::find_program_address(&[SEAT_SEED, table.as_ref(), &[1]], &insider::ID);
        let mut seller_data: Seat = base.read(base.seat);
        seller_data.index = 1;
        seller_data.owner = Pubkey::new_unique();
        seller_data.bump = seller_bump;
        base.put_serialized(seller, &seller_data);
        let mut board_data = Board::zeroed();
        board_data.round_id = 1;
        board_data.bump = board_bump;
        board_data.headers[0] = LeakHeader {
            leak_id: 77,
            state: LeakState::Auction as u8,
            owner_seat: NO_SEAT,
            window_end: 100,
            auction_start: 40,
            start_price: 60,
            floor_price: 5,
            ..LeakHeader::default()
        };
        let mut vault_data = LeakVault::zeroed();
        vault_data.leak_id = 77;
        vault_data.round_id = 1;
        vault_data.bump = vault_bump;
        base.put_zero_copy(board, &board_data);
        base.put_zero_copy(vault, &vault_data);
        for key in [
            permission,
            PERMISSION_PROGRAM_ID,
            EPHEMERAL_VAULT_ID,
            MAGIC_PROGRAM_ID,
        ] {
            base.put_bytes(key, vec![]);
        }
        Self {
            base,
            board,
            vault,
            permission,
            seller,
        }
    }

    fn with_board(&mut self, edit: impl FnOnce(&mut ::insider::Board)) {
        let mut account = self.base.svm.get_account(&self.board).unwrap();
        let board = bytemuck::from_bytes_mut(&mut account.data[8..]);
        edit(board);
        self.base.svm.set_account(self.board, account).unwrap();
    }

    fn read_board(&self) -> ::insider::Board {
        let account = self.base.svm.get_account(&self.board).unwrap();
        *bytemuck::from_bytes(&account.data[8..])
    }

    fn execute(
        &mut self,
        metas: Vec<anchor_lang::solana_program::instruction::AccountMeta>,
        data: Vec<u8>,
    ) -> Result<TransactionMetadata, Box<FailedTransactionMetadata>> {
        let ix = Instruction {
            program_id: insider::ID,
            accounts: metas,
            data,
        };
        let message = Message::new(&[ix], Some(&self.base.owner.pubkey()));
        self.base
            .svm
            .send_transaction(Transaction::new(
                &[&self.base.owner],
                message,
                self.base.svm.latest_blockhash(),
            ))
            .map_err(Box::new)
    }

    fn action(&self) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        accounts::LeakAction {
            owner: self.base.owner.pubkey(),
            table: self.base.table,
            seat: self.base.seat,
            board: self.board,
        }
        .to_account_metas(None)
    }

    fn open_accounts(&self) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        use ephemeral_rollups_sdk::consts::{
            EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID,
        };
        accounts::OpenLeak {
            owner: self.base.owner.pubkey(),
            table: self.base.table,
            seat: self.base.seat,
            board: self.board,
            vault: self.vault,
            permission: self.permission,
            permission_program: PERMISSION_PROGRAM_ID,
            ephemeral_vault: EPHEMERAL_VAULT_ID,
            magic_program: MAGIC_PROGRAM_ID,
        }
        .to_account_metas(None)
    }

    fn license_accounts(&self) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        use ephemeral_rollups_sdk::consts::{
            EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID,
        };
        accounts::BuyLicense {
            owner: self.base.owner.pubkey(),
            table: self.base.table,
            seat: self.base.seat,
            board: self.board,
            license_owner: self.seller,
            vault: self.vault,
            permission: self.permission,
            permission_program: PERMISSION_PROGRAM_ID,
            ephemeral_vault: EPHEMERAL_VAULT_ID,
            magic_program: MAGIC_PROGRAM_ID,
        }
        .to_account_metas(None)
    }
}

#[test]
fn bid_accepts_floor_on_last_tick_but_rejects_next_tick() {
    let mut f = LeakFixture::new();
    let mut table: Table = f.base.read(f.base.table);
    table.tick = 51;
    f.base.put_serialized(f.base.table, &table);
    f.execute(f.action(), instruction::Bid { index: 0, slot: 0 }.data())
        .unwrap();
    let seat: Seat = f.base.read(f.base.seat);
    assert_eq!((seat.chips, seat.leak_spend), (995, 5));
    assert_eq!(f.read_board().headers[0].paid, 5);

    let mut expired = LeakFixture::new();
    let mut table: Table = expired.base.read(expired.base.table);
    table.tick = 52;
    expired.base.put_serialized(expired.base.table, &table);
    let err = expired
        .execute(
            expired.action(),
            instruction::Bid { index: 0, slot: 0 }.data(),
        )
        .unwrap_err();
    assert!(format!("{err:?}").contains("AuctionOver"));
}

#[test]
fn leak_non_cpi_instructions_update_accounts() {
    use ::insider::LeakState;
    let mut f = LeakFixture::new();
    f.execute(f.action(), instruction::Bid { index: 0, slot: 0 }.data())
        .unwrap();
    let seat: Seat = f.base.read(f.base.seat);
    assert_eq!((seat.chips, seat.leak_spend), (950, 50));
    assert_eq!(f.read_board().headers[0].state, LeakState::Owned as u8);
    f.execute(
        f.action(),
        instruction::ListLeak {
            index: 0,
            slot: 0,
            ask: 30,
        }
        .data(),
    )
    .unwrap();
    assert_eq!(f.read_board().headers[0].state, LeakState::Listed as u8);
    f.execute(
        f.action(),
        instruction::ListLeak {
            index: 0,
            slot: 0,
            ask: 0,
        }
        .data(),
    )
    .unwrap();
    assert_eq!(f.read_board().headers[0].state, LeakState::Owned as u8);
    f.with_board(|board| {
        board.headers[0].owner_seat = 1;
        board.headers[0].state = LeakState::Listed as u8;
        board.headers[0].ask = 40;
    });
    let buy = accounts::BuyListed {
        owner: f.base.owner.pubkey(),
        table: f.base.table,
        seat: f.base.seat,
        board: f.board,
        seller_seat: f.seller,
    }
    .to_account_metas(None);
    f.execute(
        buy,
        instruction::BuyListed {
            index: 0,
            slot: 0,
            seller_index: 1,
        }
        .data(),
    )
    .unwrap();
    let buyer: Seat = f.base.read(f.base.seat);
    let seller: Seat = f.base.read(f.seller);
    assert_eq!(
        (buyer.chips, buyer.leak_spend, seller.chips),
        (910, 90, 1_040)
    );
    assert_eq!(
        (
            f.read_board().headers[0].owner_seat,
            f.read_board().headers[0].flips
        ),
        (0, 1)
    );
    let owner = f.base.owner.pubkey();
    f.with_board(|board| {
        board.headers[0].state = LeakState::Opened as u8;
        board.headers[0].reader_count = 1;
        board.headers[0].readers[0] = owner;
    });
    f.execute(
        f.action(),
        instruction::OfferLicense {
            index: 0,
            slot: 0,
            ask: 25,
        }
        .data(),
    )
    .unwrap();
    assert_eq!(f.read_board().headers[0].license_ask, 25);
}

#[test]
fn leak_cpi_instructions_reject_invalid_state_before_permission_call() {
    use ::insider::LeakState;
    let mut f = LeakFixture::new();
    f.with_board(|board| {
        board.headers[0].state = LeakState::Owned as u8;
        board.headers[0].owner_seat = 1;
    });
    let err = f
        .execute(
            f.open_accounts(),
            instruction::OpenLeak { index: 0, slot: 0 }.data(),
        )
        .unwrap_err();
    assert!(format!("{err:?}").contains("NotLeakOwner"));
    f.with_board(|board| {
        board.headers[0].state = LeakState::Opened as u8;
        board.headers[0].license_ask = 0;
    });
    let err = f
        .execute(
            f.license_accounts(),
            instruction::BuyLicense {
                index: 0,
                slot: 0,
                owner_index: 1,
            }
            .data(),
        )
        .unwrap_err();
    assert!(format!("{err:?}").contains("NotForSale"));
}

struct FinishFixture {
    leak: LeakFixture,
    xray: Pubkey,
    season: Pubkey,
    seats: [Pubkey; ::insider::SEAT_COUNT],
    vaults: [Pubkey; ::insider::LEAK_SLOTS],
    permissions: [Pubkey; ::insider::LEAK_SLOTS],
}

impl FinishFixture {
    fn new() -> Self {
        use ::insider::{
            AnalystStats, LeakVault, ScoreEntry, Season, Xray, LEADERBOARD_SIZE, LEAK_SEED,
            LEAK_SLOTS, SEASON_SEED, SEAT_COUNT, XRAY_SEED,
        };
        use ephemeral_rollups_sdk::{
            access_control::structs::PERMISSION_SEED, consts::PERMISSION_PROGRAM_ID,
        };
        let mut leak = LeakFixture::new();
        let table_key = leak.base.table;
        let mut table: Table = leak.base.read(table_key);
        table.phase = Phase::Xray;
        table.tick = 180;
        leak.base.put_serialized(table_key, &table);
        let (xray, xray_bump) =
            Pubkey::find_program_address(&[XRAY_SEED, table_key.as_ref()], &insider::ID);
        let (season, season_bump) =
            Pubkey::find_program_address(&[SEASON_SEED, table_key.as_ref()], &insider::ID);
        let mut xray_data = Xray::zeroed();
        xray_data.round_id = 1;
        xray_data.bump = xray_bump;
        leak.base.put_zero_copy(xray, &xray_data);
        let season_data = Season {
            epoch: 0,
            rounds_played: 0,
            leaderboard: [ScoreEntry::default(); LEADERBOARD_SIZE],
            analysts: [AnalystStats::default(); SEAT_COUNT],
            bump: season_bump,
        };
        leak.base.put_serialized(season, &season_data);
        let mut seats = [Pubkey::default(); SEAT_COUNT];
        seats[0] = leak.base.seat;
        seats[1] = leak.seller;
        for (index, address) in seats.iter_mut().enumerate().skip(2) {
            let (key, bump) = Pubkey::find_program_address(
                &[SEAT_SEED, table_key.as_ref(), &[index as u8]],
                &insider::ID,
            );
            let mut data: Seat = leak.base.read(leak.base.seat);
            data.index = index as u8;
            data.owner = Pubkey::default();
            data.bump = bump;
            leak.base.put_serialized(key, &data);
            *address = key;
        }
        let mut vaults = [Pubkey::default(); LEAK_SLOTS];
        let mut permissions = [Pubkey::default(); LEAK_SLOTS];
        for (index, (vault, permission)) in
            vaults.iter_mut().zip(permissions.iter_mut()).enumerate()
        {
            let (key, bump) = Pubkey::find_program_address(
                &[LEAK_SEED, table_key.as_ref(), &[index as u8]],
                &insider::ID,
            );
            let (perm, _) = Pubkey::find_program_address(
                &[PERMISSION_SEED, key.as_ref()],
                &PERMISSION_PROGRAM_ID,
            );
            if index != 0 {
                let mut data = LeakVault::zeroed();
                data.bump = bump;
                leak.base.put_zero_copy(key, &data);
                leak.base.put_bytes(perm, vec![]);
            }
            *vault = key;
            *permission = perm;
        }
        Self {
            leak,
            xray,
            season,
            seats,
            vaults,
            permissions,
        }
    }

    fn ix(&self) -> Instruction {
        let s = self.seats;
        let v = self.vaults;
        Instruction {
            program_id: insider::ID,
            accounts: accounts::FinishRound {
                payer: self.leak.base.owner.pubkey(),
                table: self.leak.base.table,
                board: self.leak.board,
                xray: self.xray,
                seat_0: s[0],
                seat_1: s[1],
                seat_2: s[2],
                seat_3: s[3],
                seat_4: s[4],
                seat_5: s[5],
                seat_6: s[6],
                seat_7: s[7],
                seat_8: s[8],
                seat_9: s[9],
                season: self.season,
                vault_0: v[0],
                vault_1: v[1],
                vault_2: v[2],
                vault_3: v[3],
                vault_4: v[4],
                vault_5: v[5],
            }
            .to_account_metas(None),
            data: instruction::FinishRound {}.data(),
        }
    }

    fn run(&mut self) -> Result<TransactionMetadata, Box<FailedTransactionMetadata>> {
        let ix = self.ix();
        let message = Message::new(&[ix], Some(&self.leak.base.owner.pubkey()));
        let wire_size = 1 + 64 + message.serialize().len();
        assert!(
            wire_size <= 1_232,
            "finish transaction is {wire_size} bytes"
        );
        println!("finish_round transaction size: {wire_size} bytes");
        let transaction = Transaction::new(
            &[&self.leak.base.owner],
            message,
            self.leak.base.svm.latest_blockhash(),
        );
        self.leak
            .base
            .svm
            .send_transaction(transaction)
            .map_err(Box::new)
    }

    fn reseal_ix(&self, from: u8, to: u8) -> Instruction {
        use anchor_lang::solana_program::instruction::AccountMeta;
        use ephemeral_rollups_sdk::consts::{
            EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID,
        };
        let mut accounts = accounts::ResealLeaks {
            payer: self.leak.base.owner.pubkey(),
            table: self.leak.base.table,
            board: self.leak.board,
            xray: self.xray,
            permission_program: PERMISSION_PROGRAM_ID,
            ephemeral_vault: EPHEMERAL_VAULT_ID,
            magic_program: MAGIC_PROGRAM_ID,
        }
        .to_account_metas(None);
        for slot in from..to {
            accounts.push(AccountMeta::new(self.vaults[usize::from(slot)], false));
            accounts.push(AccountMeta::new(self.permissions[usize::from(slot)], false));
        }
        Instruction {
            program_id: insider::ID,
            accounts,
            data: instruction::ResealLeaks {
                slot_from: from,
                slot_to: to,
            }
            .data(),
        }
    }

    fn reseal(
        &mut self,
        from: u8,
        to: u8,
    ) -> Result<TransactionMetadata, Box<FailedTransactionMetadata>> {
        let ix = self.reseal_ix(from, to);
        let message = Message::new(&[ix], Some(&self.leak.base.owner.pubkey()));
        let transaction = Transaction::new(
            &[&self.leak.base.owner],
            message,
            self.leak.base.svm.latest_blockhash(),
        );
        self.leak
            .base
            .svm
            .send_transaction(transaction)
            .map_err(Box::new)
    }
}

#[test]
fn finish_round_fits_transaction_and_finalizes_without_active_permissions() {
    use ::insider::{Season, Xray};
    let mut f = FinishFixture::new();
    for (index, address) in f.seats.iter().enumerate() {
        let mut seat: Seat = f.leak.base.read(*address);
        seat.chips = match index {
            0 => 1_250,
            1 => 750,
            _ => -4_000,
        };
        seat.name_idx = (10 + index) as u8;
        seat.kind = match index % 3 {
            0 => ::insider::SeatKind::Bot,
            1 => ::insider::SeatKind::Ai,
            _ => ::insider::SeatKind::Human,
        };
        f.leak.base.put_serialized(*address, &seat);
    }
    let before: Vec<Seat> = f
        .seats
        .iter()
        .map(|address| f.leak.base.read(*address))
        .collect();
    let meta = f.run().unwrap();
    println!(
        "finish_round without permission updates: {} CU",
        meta.compute_units_consumed
    );
    let xray_account = f.leak.base.svm.get_account(&f.xray).unwrap();
    let xray: &Xray = bytemuck::from_bytes(&xray_account.data[8..]);
    assert_eq!((xray.finalized, xray.leak_count), (1, 1));
    for (index, seat) in before.iter().enumerate() {
        assert_eq!(xray.seat_owners[index], seat.owner);
        assert_eq!(xray.seat_kinds[index], seat.kind as u8);
        assert_eq!(xray.name_idx[index], seat.name_idx);
        assert_eq!(
            xray.scores[index],
            if seat.is_free() {
                0
            } else {
                i32::try_from(seat.chips - 1_000).unwrap()
            }
        );
        let reset: Seat = f.leak.base.read(f.seats[index]);
        assert_eq!(reset.chips, 1_000);
    }
    let season: Season = f.leak.base.read(f.season);
    assert_eq!(season.leaderboard[0].owner, f.leak.base.owner.pubkey());
    f.leak.base.svm.expire_blockhash();
    f.run().unwrap();
    let season: Season = f.leak.base.read(f.season);
    assert_eq!(season.leaderboard[0].rounds, 1);
}

#[test]
fn finish_round_rejects_wrong_phase_before_resealing() {
    let mut f = FinishFixture::new();
    let key = f.leak.base.table;
    let mut table: Table = f.leak.base.read(key);
    table.phase = Phase::Live;
    f.leak.base.put_serialized(key, &table);
    let error = f.run().unwrap_err();
    assert!(format!("{error:?}").contains("WrongPhase"));
}

#[test]
fn reseal_requires_finalization_valid_pdas_and_preserves_readers_on_cpi_failure() {
    let mut f = FinishFixture::new();
    let error = f.reseal(0, 1).unwrap_err();
    assert!(format!("{error:?}").contains("WrongPhase"));
    f.run().unwrap();
    f.leak.base.svm.expire_blockhash();
    f.reseal(0, 1).unwrap();
    let reader = f.leak.base.owner.pubkey();
    f.leak.with_board(|board| {
        board.headers[0].reader_count = 1;
        board.headers[0].readers[0] = reader;
    });
    f.leak.base.svm.expire_blockhash();
    assert!(f.reseal(0, 1).is_err());
    assert_eq!(f.leak.read_board().headers[0].reader_count, 1);
    assert_eq!(f.leak.read_board().headers[0].readers[0], reader);
}

#[test]
fn finish_round_handles_a_full_trace_within_the_compute_budget() {
    use ::insider::{
        LeakKind, LeakState, Xray, XrayOrder, LANE_PRIORITY, LANE_STANDARD, XRAY_ORDERS,
    };
    let mut f = FinishFixture::new();
    let owner = f.leak.base.owner.pubkey();
    f.leak.with_board(|board| {
        board.headers[0].state = LeakState::Opened as u8;
        board.headers[0].kind = LeakKind::Flow as u8;
        board.headers[0].reader_count = 1;
        board.headers[0].readers[0] = owner;
    });
    let mut vault_account = f.leak.base.svm.get_account(&f.leak.vault).unwrap();
    let vault: &mut ::insider::LeakVault = bytemuck::from_bytes_mut(&mut vault_account.data[8..]);
    vault.fields[2] = 0;
    vault.fields[3] = 180;
    f.leak
        .base
        .svm
        .set_account(f.leak.vault, vault_account)
        .unwrap();
    let mut account = f.leak.base.svm.get_account(&f.xray).unwrap();
    let xray: &mut Xray = bytemuck::from_bytes_mut(&mut account.data[8..]);
    xray.order_count = XRAY_ORDERS as u16;
    for (i, order) in xray.orders.iter_mut().enumerate() {
        *order = XrayOrder {
            seat: 1,
            lane: LANE_STANDARD,
            side_size: 1,
            sent_tick: 0,
            land_tick: (i % 180) as u16,
            fill_price: 1_000_000,
        };
    }
    f.leak.base.svm.set_account(f.xray, account).unwrap();
    let meta = f.run().unwrap();
    println!(
        "full trace finish_round: {} CU",
        meta.compute_units_consumed
    );
    assert!(meta.compute_units_consumed < 200_000);
    let mut account = f.leak.base.svm.get_account(&f.xray).unwrap();
    let xray: &mut Xray = bytemuck::from_bytes_mut(&mut account.data[8..]);
    xray.finalized = 0;
    xray.orders[0] = XrayOrder {
        seat: 0,
        lane: LANE_PRIORITY,
        side_size: 1,
        sent_tick: 175,
        land_tick: 180,
        fill_price: 1_000_000,
    };
    xray.orders[1] = XrayOrder {
        seat: 0,
        lane: LANE_STANDARD,
        side_size: -1,
        sent_tick: 160,
        land_tick: 180,
        fill_price: 1_100_000,
    };
    f.leak.base.svm.set_account(f.xray, account).unwrap();
    f.leak.base.svm.expire_blockhash();
    let meta = f.run().unwrap();
    println!(
        "full trace with late candidate: {} CU",
        meta.compute_units_consumed
    );
    assert!(meta.compute_units_consumed < 200_000);
}

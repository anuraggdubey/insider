//! Lifecycle tests (LiteSVM): setup, seats and the crank guard. Rollup-only behaviour (delegation,
//! the scheduler, VRF) is covered by the devnet scripts; the pure tick logic is unit-tested in
//! `src/instructions/tick.rs`.

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
    accounts, instruction, CallBook, Phase, Season, Seat, SeatKind, Table, Tape, BANKROLL_CHIPS,
    Board, Future, LeakVault, Market, Mempool, Xray, BOARD_SEED, CALLBOOK_SEED, FUTURE_SEED,
    LEAK_SEED, MARKET_FLOOR, MARKET_SEED, MEMPOOL_SEED, SEASON_SEED, SEAT_IDLE_TICKS, SEAT_SEED,
    TABLE_SEED, TAPE_SEED, VRF_TIMEOUT_TICKS, XRAY_SEED,
};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

fn setup() -> (LiteSVM, Keypair) {
    let so = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy/insider.so");
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

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &insider::ID).0
}

fn table_pda(authority: &Pubkey) -> Pubkey {
    pda(&[TABLE_SEED, authority.as_ref()])
}

fn seat_pda(table: &Pubkey, index: u8) -> Pubkey {
    pda(&[SEAT_SEED, table.as_ref(), &[index]])
}

fn init_table_ix(authority: &Pubkey) -> Instruction {
    Instruction {
        program_id: insider::ID,
        accounts: accounts::InitTable {
            authority: *authority,
            table: table_pda(authority),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitTable { params: None }.data(),
    }
}

/// tape, call book and season each have their own instruction (stack frames).
fn init_big_ixs(authority: &Pubkey) -> Vec<Instruction> {
    let table = table_pda(authority);
    vec![
        Instruction {
            program_id: insider::ID,
            accounts: accounts::InitTape {
                authority: *authority,
                table,
                tape: pda(&[TAPE_SEED, table.as_ref()]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::InitTape {}.data(),
        },
        Instruction {
            program_id: insider::ID,
            accounts: accounts::InitCallBook {
                authority: *authority,
                table,
                call_book: pda(&[CALLBOOK_SEED, table.as_ref()]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::InitCallBook {}.data(),
        },
        Instruction {
            program_id: insider::ID,
            accounts: accounts::InitSeason {
                authority: *authority,
                table,
                season: pda(&[SEASON_SEED, table.as_ref()]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::InitSeason {}.data(),
        },
    ]
}

/// The engine accounts: Floor market, mempool, future, board, X-ray and the six leak vaults.
fn init_engine_ixs(authority: &Pubkey) -> Vec<Instruction> {
    let table = table_pda(authority);
    let base = |data: Vec<u8>, metas: Vec<anchor_lang::solana_program::instruction::AccountMeta>| {
        Instruction {
            program_id: insider::ID,
            accounts: metas,
            data,
        }
    };
    let mut ixs = vec![
        base(
            instruction::InitMarket { kind: MARKET_FLOOR }.data(),
            accounts::InitMarket {
                authority: *authority,
                table,
                market: pda(&[MARKET_SEED, table.as_ref(), &[MARKET_FLOOR]]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        ),
        base(
            instruction::InitMempool {}.data(),
            accounts::InitMempool {
                authority: *authority,
                table,
                mempool: pda(&[MEMPOOL_SEED, table.as_ref()]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        ),
        base(
            instruction::InitFuture {}.data(),
            accounts::InitFuture {
                authority: *authority,
                table,
                future: pda(&[FUTURE_SEED, table.as_ref()]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        ),
        base(
            instruction::InitBoard {}.data(),
            accounts::InitBoard {
                authority: *authority,
                table,
                board: pda(&[BOARD_SEED, table.as_ref()]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        ),
        base(
            instruction::InitXray {}.data(),
            accounts::InitXray {
                authority: *authority,
                table,
                xray: pda(&[XRAY_SEED, table.as_ref()]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        ),
    ];
    for slot in 0..6u8 {
        ixs.push(base(
            instruction::InitLeakVault { slot }.data(),
            accounts::InitLeakVault {
                authority: *authority,
                table,
                vault: pda(&[LEAK_SEED, table.as_ref(), &[slot]]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        ));
    }
    ixs
}

fn init_everything(svm: &mut LiteSVM, authority: &Keypair) {
    send(svm, &[authority], init_table_ix(&authority.pubkey())).unwrap();
    for ix in init_big_ixs(&authority.pubkey()) {
        svm.expire_blockhash();
        send(svm, &[authority], ix).unwrap();
    }
    for ix in init_engine_ixs(&authority.pubkey()) {
        svm.expire_blockhash();
        send(svm, &[authority], ix).unwrap();
    }
}

fn init_seat_ix(authority: &Pubkey, index: u8) -> Instruction {
    let table = table_pda(authority);
    Instruction {
        program_id: insider::ID,
        accounts: accounts::InitSeat {
            authority: *authority,
            table,
            seat: seat_pda(&table, index),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitSeat { index }.data(),
    }
}

fn claim_ix(owner: &Pubkey, authority: &Pubkey, index: u8) -> Instruction {
    let table = table_pda(authority);
    Instruction {
        program_id: insider::ID,
        accounts: accounts::ClaimSeat {
            owner: *owner,
            table,
            seat: seat_pda(&table, index),
        }
        .to_account_metas(None),
        data: instruction::ClaimSeat { index }.data(),
    }
}

fn ping_ix(owner: &Pubkey, authority: &Pubkey, index: u8) -> Instruction {
    let table = table_pda(authority);
    Instruction {
        program_id: insider::ID,
        accounts: accounts::Ping {
            owner: *owner,
            table,
            seat: seat_pda(&table, index),
            session_token: None,
        }
        .to_account_metas(None),
        data: instruction::Ping { index }.data(),
    }
}

fn read<T: AccountDeserialize>(svm: &LiteSVM, key: &Pubkey) -> T {
    let account = svm.get_account(key).expect("account exists");
    T::try_deserialize(&mut account.data.as_slice()).unwrap()
}

fn write<T: AccountSerialize>(svm: &mut LiteSVM, key: &Pubkey, value: &T) {
    let mut account = svm.get_account(key).expect("account exists");
    let mut data = Vec::new();
    value.try_serialize(&mut data).unwrap();
    account.data = data;
    svm.set_account(*key, account).unwrap();
}

fn set_tick(svm: &mut LiteSVM, authority: &Pubkey, tick: u16) {
    let key = table_pda(authority);
    let mut table: Table = read(svm, &key);
    table.tick = tick;
    write(svm, &key, &table);
}

/// A table with seats 0-9 created, ready for claims.
fn table_with_seats() -> (LiteSVM, Keypair) {
    let (mut svm, authority) = setup();
    init_everything(&mut svm, &authority);
    for index in 0..10u8 {
        send(
            &mut svm,
            &[&authority],
            init_seat_ix(&authority.pubkey(), index),
        )
        .unwrap();
    }
    (svm, authority)
}

#[test]
fn init_table_creates_the_public_accounts() {
    let (mut svm, authority) = setup();
    init_everything(&mut svm, &authority);

    let table_key = table_pda(&authority.pubkey());
    let table: Table = read(&svm, &table_key);
    assert_eq!(table.authority, authority.pubkey());
    assert_eq!(table.phase, Phase::Idle);
    assert_eq!(table.round_id, 0);
    assert_eq!(table.params.max_order_units, 2_000);

    let tape: Tape = read(&svm, &pda(&[TAPE_SEED, table_key.as_ref()]));
    assert_eq!(tape.sends_head, 0);
    let book = svm
        .get_account(&pda(&[CALLBOOK_SEED, table_key.as_ref()]))
        .expect("call book exists");
    assert_eq!(book.owner, insider::ID);
    assert_eq!(book.data.len(), CallBook::SPACE);
    let season: Season = read(&svm, &pda(&[SEASON_SEED, table_key.as_ref()]));
    assert_eq!(season.rounds_played, 0);
}

#[test]
fn a_table_cannot_be_created_twice() {
    let (mut svm, authority) = setup();
    send(&mut svm, &[&authority], init_table_ix(&authority.pubkey())).unwrap();
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&authority], init_table_ix(&authority.pubkey())).is_err());
}

#[test]
fn seats_get_their_class_from_the_index() {
    let (svm, authority) = table_with_seats();
    let table = table_pda(&authority.pubkey());
    for (index, expected) in [
        (0u8, SeatKind::Bot),
        (4, SeatKind::Bot),
        (5, SeatKind::Ai),
        (6, SeatKind::Ai),
        (7, SeatKind::Human),
        (9, SeatKind::Human),
    ] {
        let seat: Seat = read(&svm, &seat_pda(&table, index));
        assert_eq!(seat.index, index);
        assert_eq!(seat.kind, expected);
        assert!(seat.is_free());
    }
}

#[test]
fn only_the_authority_can_create_seats_and_the_index_is_bounded() {
    let (mut svm, authority) = setup();
    init_everything(&mut svm, &authority);

    let stranger = Keypair::new();
    svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    // the stranger's table does not exist, so the seat accounts cannot be derived under it
    let table = table_pda(&authority.pubkey());
    let mut ix = init_seat_ix(&authority.pubkey(), 0);
    ix.accounts[0].pubkey = stranger.pubkey();
    ix.accounts[0].is_signer = true;
    ix.accounts[1].pubkey = table;
    assert!(send(&mut svm, &[&stranger], ix).is_err());

    assert!(send(
        &mut svm,
        &[&authority],
        init_seat_ix(&authority.pubkey(), 10)
    )
    .is_err());
}

#[test]
fn claiming_a_free_seat_resets_the_bankroll() {
    let (mut svm, authority) = table_with_seats();
    set_tick(&mut svm, &authority.pubkey(), 33);
    let player = Keypair::new();
    svm.airdrop(&player.pubkey(), 1_000_000_000).unwrap();

    send(&mut svm, &[&player], claim_ix(&player.pubkey(), &authority.pubkey(), 7)).unwrap();

    let table = table_pda(&authority.pubkey());
    let seat: Seat = read(&svm, &seat_pda(&table, 7));
    assert_eq!(seat.owner, player.pubkey());
    assert_eq!(seat.chips, BANKROLL_CHIPS);
    assert_eq!(seat.position, 0);
    assert_eq!(seat.claims, 1);
    assert_eq!(seat.last_seen_tick, 33);
    assert!(seat.name_idx < 32);
}

#[test]
fn an_occupied_seat_is_protected_until_a_bot_goes_idle() {
    let (mut svm, authority) = table_with_seats();
    let bot = Keypair::new();
    let human = Keypair::new();
    for key in [&bot, &human] {
        svm.airdrop(&key.pubkey(), 1_000_000_000).unwrap();
    }
    set_tick(&mut svm, &authority.pubkey(), 10);
    send(&mut svm, &[&bot], claim_ix(&bot.pubkey(), &authority.pubkey(), 0)).unwrap();

    // 10 ticks later the bot is still active: the claim is refused
    set_tick(&mut svm, &authority.pubkey(), 20);
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&human], claim_ix(&human.pubkey(), &authority.pubkey(), 0)).is_err());

    // after SEAT_IDLE_TICKS without a ping the bot seat can be displaced
    set_tick(&mut svm, &authority.pubkey(), 10 + SEAT_IDLE_TICKS);
    svm.expire_blockhash();
    send(&mut svm, &[&human], claim_ix(&human.pubkey(), &authority.pubkey(), 0)).unwrap();
    let table = table_pda(&authority.pubkey());
    let seat: Seat = read(&svm, &seat_pda(&table, 0));
    assert_eq!(seat.owner, human.pubkey());
    assert_eq!(seat.claims, 2);
}

#[test]
fn an_idle_bot_with_a_position_or_pending_orders_cannot_be_displaced() {
    let (mut svm, authority) = table_with_seats();
    let bot = Keypair::new();
    let human = Keypair::new();
    for key in [&bot, &human] {
        svm.airdrop(&key.pubkey(), 1_000_000_000).unwrap();
    }
    let table = table_pda(&authority.pubkey());
    let seat_key = seat_pda(&table, 1);
    send(&mut svm, &[&bot], claim_ix(&bot.pubkey(), &authority.pubkey(), 1)).unwrap();
    set_tick(&mut svm, &authority.pubkey(), SEAT_IDLE_TICKS + 5);

    for (position, pending) in [(300i32, 0u8), (0, 2), (-50, 1)] {
        let mut seat: Seat = read(&svm, &seat_key);
        seat.position = position;
        seat.pending_count = pending;
        write(&mut svm, &seat_key, &seat);
        svm.expire_blockhash();
        assert!(
            send(&mut svm, &[&human], claim_ix(&human.pubkey(), &authority.pubkey(), 1)).is_err(),
            "position {position}, pending {pending}"
        );
    }

    // flat and with nothing queued, the idle bot can be displaced again
    let mut seat: Seat = read(&svm, &seat_key);
    seat.position = 0;
    seat.pending_count = 0;
    write(&mut svm, &seat_key, &seat);
    svm.expire_blockhash();
    send(&mut svm, &[&human], claim_ix(&human.pubkey(), &authority.pubkey(), 1)).unwrap();
}

#[test]
fn a_human_seat_left_in_an_earlier_round_can_be_claimed() {
    let (mut svm, authority) = table_with_seats();
    let first = Keypair::new();
    let second = Keypair::new();
    for key in [&first, &second] {
        svm.airdrop(&key.pubkey(), 1_000_000_000).unwrap();
    }
    let table = table_pda(&authority.pubkey());

    // seen late in a round
    set_tick(&mut svm, &authority.pubkey(), 150);
    send(&mut svm, &[&first], claim_ix(&first.pubkey(), &authority.pubkey(), 8)).unwrap();

    // a new round starts (the tick restarts): the holder has not been seen in it, so the seat is free
    set_tick(&mut svm, &authority.pubkey(), 4);
    svm.expire_blockhash();
    send(&mut svm, &[&second], claim_ix(&second.pubkey(), &authority.pubkey(), 8)).unwrap();
    let seat: Seat = read(&svm, &seat_pda(&table, 8));
    assert_eq!(seat.owner, second.pubkey());
    assert_eq!(seat.chips, BANKROLL_CHIPS);
    assert_eq!(seat.claims, 2);
}

#[test]
fn an_active_or_invested_human_seat_is_protected() {
    let (mut svm, authority) = table_with_seats();
    let holder = Keypair::new();
    let newcomer = Keypair::new();
    for key in [&holder, &newcomer] {
        svm.airdrop(&key.pubkey(), 1_000_000_000).unwrap();
    }
    let table = table_pda(&authority.pubkey());
    let seat_key = seat_pda(&table, 9);
    set_tick(&mut svm, &authority.pubkey(), 20);
    send(&mut svm, &[&holder], claim_ix(&holder.pubkey(), &authority.pubkey(), 9)).unwrap();

    // seen this round, less than SEAT_IDLE_TICKS ago: refused
    set_tick(&mut svm, &authority.pubkey(), 20 + SEAT_IDLE_TICKS - 1);
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&newcomer], claim_ix(&newcomer.pubkey(), &authority.pubkey(), 9)).is_err());

    // idle, but holding a position or queued orders: refused
    set_tick(&mut svm, &authority.pubkey(), 20 + SEAT_IDLE_TICKS);
    for (position, pending) in [(100i32, 0u8), (0, 1)] {
        let mut seat: Seat = read(&svm, &seat_key);
        seat.position = position;
        seat.pending_count = pending;
        write(&mut svm, &seat_key, &seat);
        svm.expire_blockhash();
        assert!(
            send(&mut svm, &[&newcomer], claim_ix(&newcomer.pubkey(), &authority.pubkey(), 9)).is_err(),
            "position {position}, pending {pending}"
        );
    }

    // idle and flat: the newcomer gets the seat
    let mut seat: Seat = read(&svm, &seat_key);
    seat.position = 0;
    seat.pending_count = 0;
    write(&mut svm, &seat_key, &seat);
    svm.expire_blockhash();
    send(&mut svm, &[&newcomer], claim_ix(&newcomer.pubkey(), &authority.pubkey(), 9)).unwrap();
}

#[test]
fn a_bot_seat_last_seen_in_an_earlier_round_is_still_protected() {
    let (mut svm, authority) = table_with_seats();
    let bot = Keypair::new();
    let human = Keypair::new();
    for key in [&bot, &human] {
        svm.airdrop(&key.pubkey(), 1_000_000_000).unwrap();
    }
    set_tick(&mut svm, &authority.pubkey(), 150);
    send(&mut svm, &[&bot], claim_ix(&bot.pubkey(), &authority.pubkey(), 2)).unwrap();
    set_tick(&mut svm, &authority.pubkey(), 4);
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&human], claim_ix(&human.pubkey(), &authority.pubkey(), 2)).is_err());
}

#[test]
fn the_default_priority_fee_is_three_chips() {
    let (mut svm, authority) = setup();
    init_everything(&mut svm, &authority);
    let table: Table = read(&svm, &table_pda(&authority.pubkey()));
    assert_eq!(table.params.priority_fee, 3);
}

#[test]
fn ai_seats_are_protected_even_when_idle() {
    let (mut svm, authority) = table_with_seats();
    let analyst = Keypair::new();
    let intruder = Keypair::new();
    for key in [&analyst, &intruder] {
        svm.airdrop(&key.pubkey(), 1_000_000_000).unwrap();
    }
    send(&mut svm, &[&analyst], claim_ix(&analyst.pubkey(), &authority.pubkey(), 5)).unwrap();
    set_tick(&mut svm, &authority.pubkey(), 190);
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&intruder], claim_ix(&intruder.pubkey(), &authority.pubkey(), 5)).is_err());
}

#[test]
fn ping_keeps_a_seat_active_and_only_the_owner_can_ping() {
    let (mut svm, authority) = table_with_seats();
    let owner = Keypair::new();
    let other = Keypair::new();
    for key in [&owner, &other] {
        svm.airdrop(&key.pubkey(), 1_000_000_000).unwrap();
    }
    send(&mut svm, &[&owner], claim_ix(&owner.pubkey(), &authority.pubkey(), 1)).unwrap();

    set_tick(&mut svm, &authority.pubkey(), 50);
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&other], ping_ix(&other.pubkey(), &authority.pubkey(), 1)).is_err());
    send(&mut svm, &[&owner], ping_ix(&owner.pubkey(), &authority.pubkey(), 1)).unwrap();

    let table = table_pda(&authority.pubkey());
    let seat: Seat = read(&svm, &seat_pda(&table, 1));
    assert_eq!(seat.last_seen_tick, 50);

    // 59 ticks after the ping the bot is not yet idle, so a claim is still refused
    set_tick(&mut svm, &authority.pubkey(), 50 + SEAT_IDLE_TICKS - 1);
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&other], claim_ix(&other.pubkey(), &authority.pubkey(), 1)).is_err());
}

fn tick_ix(table: Pubkey, scheduler: Pubkey, crank_signer: Pubkey) -> Instruction {
    let mut accounts = accounts::TickAccounts {
        table,
        scheduler,
        crank_signer,
        market: pda(&[MARKET_SEED, table.as_ref(), &[MARKET_FLOOR]]),
        mempool: pda(&[MEMPOOL_SEED, table.as_ref()]),
        future: pda(&[FUTURE_SEED, table.as_ref()]),
        board: pda(&[BOARD_SEED, table.as_ref()]),
        xray: pda(&[XRAY_SEED, table.as_ref()]),
        tape: pda(&[TAPE_SEED, table.as_ref()]),
    }
    .to_account_metas(None);
    // the six vaults, then the ten seats, as remaining accounts
    for slot in 0..6u8 {
        accounts.push(AccountMeta::new(pda(&[LEAK_SEED, table.as_ref(), &[slot]]), false));
    }
    for index in 0..10u8 {
        accounts.push(AccountMeta::new(seat_pda(&table, index), false));
    }
    Instruction {
        program_id: insider::ID,
        accounts,
        data: instruction::Tick {}.data(),
    }
}

#[test]
fn tick_is_permissionless_and_idempotent() {
    let (mut svm, authority) = table_with_seats();
    let table = table_pda(&authority.pubkey());
    let caller = Keypair::new();
    svm.airdrop(&caller.pubkey(), 1_000_000_000).unwrap();
    let ix = tick_ix(table, caller.pubkey(), caller.pubkey());
    send(&mut svm, &[&caller], ix.clone()).unwrap();
    let first: Table = read(&svm, &table);
    svm.expire_blockhash();
    send(&mut svm, &[&caller], ix).unwrap();
    let second: Table = read(&svm, &table);
    assert_eq!(first.tick, second.tick);
    assert_eq!(first.round_id, second.round_id);
}

#[test]
fn engine_accounts_are_created_with_their_size_and_permission_rent() {
    let (svm, authority) = table_with_seats();
    let table = table_pda(&authority.pubkey());
    let rent = insider::engine_setup::permission_rent();
    assert!(rent > 0);

    let check = |key: Pubkey, space: usize, private: bool| {
        let account = svm.get_account(&key).expect("account exists");
        assert_eq!(account.owner, insider::ID);
        assert_eq!(account.data.len(), space);
        if private {
            // the permission is created later inside the rollup out of these lamports
            assert!(account.lamports >= rent, "{key} holds {}", account.lamports);
        }
    };
    check(pda(&[MEMPOOL_SEED, table.as_ref()]), Mempool::SPACE, true);
    check(pda(&[FUTURE_SEED, table.as_ref()]), Future::SPACE, true);
    check(pda(&[BOARD_SEED, table.as_ref()]), Board::SPACE, false);
    check(pda(&[XRAY_SEED, table.as_ref()]), Xray::SPACE, false);
    check(
        pda(&[MARKET_SEED, table.as_ref(), &[MARKET_FLOOR]]),
        Market::SPACE,
        false,
    );
    for slot in 0..6u8 {
        let key = pda(&[LEAK_SEED, table.as_ref(), &[slot]]);
        check(key, LeakVault::SPACE, true);
        let vault: LeakVault = read(&svm, &key);
        assert_eq!(vault.slot, slot);
        assert_ne!(vault.bump, 0);
    }
    let market: Market = read(&svm, &pda(&[MARKET_SEED, table.as_ref(), &[MARKET_FLOOR]]));
    assert_eq!(market.kind, MARKET_FLOOR);
}

#[test]
fn engine_accounts_have_one_authority_and_a_bounded_index() {
    let (mut svm, authority) = table_with_seats();
    let table = table_pda(&authority.pubkey());
    let stranger = Keypair::new();
    svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();

    // a second Floor market, a Desk-less kind 2 and a seventh vault are all refused
    let market_ix = |authority: Pubkey, kind: u8| Instruction {
        program_id: insider::ID,
        accounts: accounts::InitMarket {
            authority,
            table,
            market: pda(&[MARKET_SEED, table.as_ref(), &[kind]]),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitMarket { kind }.data(),
    };
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&authority], market_ix(authority.pubkey(), MARKET_FLOOR)).is_err());
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&authority], market_ix(authority.pubkey(), 2)).is_err());
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&stranger], market_ix(stranger.pubkey(), 1)).is_err());
    svm.expire_blockhash();
    // the Desk market is a legal kind for the authority
    send(&mut svm, &[&authority], market_ix(authority.pubkey(), 1)).unwrap();

    let vault_ix = Instruction {
        program_id: insider::ID,
        accounts: accounts::InitLeakVault {
            authority: authority.pubkey(),
            table,
            vault: pda(&[LEAK_SEED, table.as_ref(), &[6]]),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitLeakVault { slot: 6 }.data(),
    };
    svm.expire_blockhash();
    assert!(send(&mut svm, &[&authority], vault_ix).is_err());
}

fn cancel_vrf_ix(payer: &Pubkey, authority: &Pubkey) -> Instruction {
    Instruction {
        program_id: insider::ID,
        accounts: accounts::CancelVrf {
            payer: *payer,
            table: table_pda(authority),
        }
        .to_account_metas(None),
        data: instruction::CancelVrf {}.data(),
    }
}

#[test]
fn a_stuck_seed_request_can_be_cancelled_only_after_the_timeout() {
    let (mut svm, authority) = table_with_seats();
    let key = table_pda(&authority.pubkey());
    let anyone = Keypair::new();
    svm.airdrop(&anyone.pubkey(), 1_000_000_000).unwrap();

    // nothing pending: nothing to cancel
    assert!(send(&mut svm, &[&anyone], cancel_vrf_ix(&anyone.pubkey(), &authority.pubkey())).is_err());

    svm.warp_to_slot(1_000);
    let mut table: Table = read(&svm, &key);
    table.phase = Phase::Seeding;
    table.vrf_pending = true;
    table.vrf_requested_tick = (1_000 / insider::SLOTS_PER_TICK) as u16;
    write(&mut svm, &key, &table);

    svm.expire_blockhash();
    assert!(send(&mut svm, &[&anyone], cancel_vrf_ix(&anyone.pubkey(), &authority.pubkey())).is_err());

    svm.warp_to_slot(1_000 + u64::from(VRF_TIMEOUT_TICKS) * insider::SLOTS_PER_TICK);
    svm.expire_blockhash();
    send(&mut svm, &[&anyone], cancel_vrf_ix(&anyone.pubkey(), &authority.pubkey())).unwrap();
    let table: Table = read(&svm, &key);
    assert_eq!(table.phase, Phase::Idle);
    assert!(!table.vrf_pending);
}

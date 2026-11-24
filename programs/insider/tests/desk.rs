//! Desk tests (LiteSVM). `mint_call` and `buy_call_license` end in a permission CPI that needs the
//! rollup, so here they are tested up to their checks; `settle_call` and `desk_trade` run in full
//! with a hand-made oracle feed and call book.

use std::path::PathBuf;

use anchor_lang::{
    solana_program::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        system_program,
    },
    AccountDeserialize, AccountSerialize, Discriminator, InstructionData, ToAccountMetas,
};
use insider::{
    accounts, error::InsiderError, instruction, CallBook, CallState, CallVault, Market, Seat,
    Season, CALLBOOK_SEED, CALLVAULT_SEED, DESK_BANKROLL, MARKET_DESK, MARKET_FLOOR,
    MARKET_SEED, ORACLE_FEED, ORACLE_PROGRAM_ID, SEASON_SEED, SEAT_SEED, TABLE_SEED, TAPE_SEED,
};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &insider::ID).0
}

struct World {
    svm: LiteSVM,
    authority: Keypair,
    table: Pubkey,
}

fn send(svm: &mut LiteSVM, signers: &[&Keypair], ix: Instruction) -> Result<(), String> {
    svm.expire_blockhash();
    let message = Message::new(&[ix], Some(&signers[0].pubkey()));
    let tx = Transaction::new(signers, message, svm.latest_blockhash());
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{e:?}"))
}

fn read<T: AccountDeserialize>(svm: &LiteSVM, key: &Pubkey) -> T {
    T::try_deserialize(&mut svm.get_account(key).unwrap().data.as_slice()).unwrap()
}

fn write_raw(svm: &mut LiteSVM, key: &Pubkey, data: Vec<u8>) {
    let mut account = svm.get_account(key).unwrap();
    account.data = data;
    svm.set_account(*key, account).unwrap();
}

fn write<T: AccountSerialize>(svm: &mut LiteSVM, key: &Pubkey, value: &T) {
    let mut data = Vec::new();
    value.try_serialize(&mut data).unwrap();
    write_raw(svm, key, data);
}

fn expect_error(result: Result<(), String>, error: InsiderError) {
    let code = 6000 + error as u32;
    let message = result.expect_err("the instruction should fail");
    assert!(
        message.contains(&format!("Custom({code})")),
        "expected {error:?} (Custom({code})), got {message}"
    );
}

fn world() -> World {
    let so = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy/insider.so");
    assert!(so.exists(), "missing {}: run `pnpm program:build` first", so.display());
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(insider::ID, &so).unwrap();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), 100_000_000_000).unwrap();
    let a = authority.pubkey();
    let table = pda(&[TABLE_SEED, a.as_ref()]);
    let mut ixs: Vec<Instruction> = vec![Instruction {
        program_id: insider::ID,
        accounts: accounts::InitTable { authority: a, table, system_program: system_program::ID }
            .to_account_metas(None),
        data: instruction::InitTable { params: None }.data(),
    }];
    ixs.push(Instruction {
        program_id: insider::ID,
        accounts: accounts::InitTape {
            authority: a,
            table,
            tape: pda(&[TAPE_SEED, table.as_ref()]),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitTape {}.data(),
    });
    ixs.push(Instruction {
        program_id: insider::ID,
        accounts: accounts::InitCallBook {
            authority: a,
            table,
            call_book: pda(&[CALLBOOK_SEED, table.as_ref()]),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitCallBook {}.data(),
    });
    ixs.push(Instruction {
        program_id: insider::ID,
        accounts: accounts::InitSeason {
            authority: a,
            table,
            season: pda(&[SEASON_SEED, table.as_ref()]),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitSeason {}.data(),
    });
    for kind in [MARKET_FLOOR, MARKET_DESK] {
        ixs.push(Instruction {
            program_id: insider::ID,
            accounts: accounts::InitMarket {
                authority: a,
                table,
                market: pda(&[MARKET_SEED, table.as_ref(), &[kind]]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::InitMarket { kind }.data(),
        });
    }
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
        ixs.push(init_vault_ix(&a, &table, index));
    }
    for ix in ixs {
        send(&mut svm, &[&authority], ix).unwrap();
    }
    World { svm, authority, table }
}

fn init_vault_ix(authority: &Pubkey, table: &Pubkey, slot: u8) -> Instruction {
    Instruction {
        program_id: insider::ID,
        accounts: accounts::InitCallVault {
            authority: *authority,
            table: *table,
            vault: pda(&[CALLVAULT_SEED, table.as_ref(), &[slot]]),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitCallVault { slot }.data(),
    }
}

/// A SOL/USD feed account with the layout the program decodes (`raw` has exponent -8).
fn set_oracle(svm: &mut LiteSVM, raw: i64, publish_time: i64) {
    let mut data = vec![0u8; 8 + 32];
    data.push(1);
    data.extend_from_slice(&[9u8; 32]);
    data.extend_from_slice(&raw.to_le_bytes());
    data.extend_from_slice(&0u64.to_le_bytes());
    data.extend_from_slice(&(-8i32).to_le_bytes());
    data.extend_from_slice(&publish_time.to_le_bytes());
    data.extend_from_slice(&[0u8; 40]);
    let mut account = svm.get_account(&Pubkey::new_unique()).unwrap_or_default();
    account.lamports = 1_000_000_000;
    account.data = data;
    account.owner = ORACLE_PROGRAM_ID;
    svm.set_account(ORACLE_FEED, account).unwrap();
}

fn set_clock(svm: &mut LiteSVM, unix_timestamp: i64) {
    let mut clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp = unix_timestamp;
    svm.set_sysvar(&clock);
}

fn claim(w: &mut World, owner: &Keypair, index: u8) {
    w.svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();
    let ix = Instruction {
        program_id: insider::ID,
        accounts: accounts::ClaimSeat {
            owner: owner.pubkey(),
            table: w.table,
            seat: pda(&[SEAT_SEED, w.table.as_ref(), &[index]]),
        }
        .to_account_metas(None),
        data: instruction::ClaimSeat { index }.data(),
    };
    w.send(&[owner], ix).unwrap();
}

fn seat_key(w: &World, index: u8) -> Pubkey {
    pda(&[SEAT_SEED, w.table.as_ref(), &[index]])
}

fn book_key(w: &World) -> Pubkey {
    pda(&[CALLBOOK_SEED, w.table.as_ref()])
}

fn vault_key(w: &World, index: u8) -> Pubkey {
    pda(&[CALLVAULT_SEED, w.table.as_ref(), &[index]])
}

/// Puts an open Call for `author` into the call book and its direction into the vault.
fn open_call(w: &mut World, author: u8, direction: i8, minted_price: u64, stake: u64, expiry: i64) {
    let key = book_key(w);
    let mut book: CallBook = read(&w.svm, &key);
    let header = &mut book.headers[usize::from(author)];
    header.call_id = 5;
    header.author_seat = author;
    header.state = CallState::Open as u8;
    header.minted_price = minted_price;
    header.stake = stake;
    header.expiry_ts = expiry;
    let mut data = CallBook::DISCRIMINATOR.to_vec();
    data.extend_from_slice(bytemuck::bytes_of(&book));
    write_raw(&mut w.svm, &key, data);

    let vkey = vault_key(w, author);
    let mut vault: CallVault = read(&w.svm, &vkey);
    vault.call_id = 5;
    vault.direction = direction;
    let mut data = CallVault::DISCRIMINATOR.to_vec();
    data.extend_from_slice(bytemuck::bytes_of(&vault));
    write_raw(&mut w.svm, &vkey, data);
}

fn settle_ix(w: &World, payer: &Pubkey, author: u8) -> Instruction {
    Instruction {
        program_id: insider::ID,
        accounts: accounts::SettleCall {
            payer: *payer,
            table: w.table,
            author_seat: seat_key(w, author),
            call_book: book_key(w),
            vault: vault_key(w, author),
            season: pda(&[SEASON_SEED, w.table.as_ref()]),
            oracle: ORACLE_FEED,
        }
        .to_account_metas(None),
        data: instruction::SettleCall { author_index: author }.data(),
    }
}

fn trade_ix(w: &World, owner: &Pubkey, index: u8, size: i16) -> Instruction {
    Instruction {
        program_id: insider::ID,
        accounts: accounts::DeskTrade {
            owner: *owner,
            table: w.table,
            seat: seat_key(w, index),
            market: pda(&[MARKET_SEED, w.table.as_ref(), &[MARKET_DESK]]),
            oracle: ORACLE_FEED,
            session_token: None,
        }
        .to_account_metas(None),
        data: instruction::DeskTrade { index, size }.data(),
    }
}

fn mint_ix(w: &World, owner: &Pubkey, index: u8, direction: i8, horizon: u16, stake: u64) -> Instruction {
    let vault = vault_key(w, index);
    let mut metas = accounts::MintCall {
        owner: *owner,
        table: w.table,
        seat: seat_key(w, index),
        call_book: book_key(w),
        vault,
        permission: Pubkey::new_unique(),
        permission_program: Pubkey::new_unique(),
        ephemeral_vault: Pubkey::new_unique(),
        magic_program: Pubkey::new_unique(),
        oracle: ORACLE_FEED,
        session_token: None,
    }
    .to_account_metas(None);
    // the fixed program addresses and the permission PDA are checked by the program
    use ephemeral_rollups_sdk::{
        access_control::structs::PERMISSION_SEED,
        consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    };
    let permission = Pubkey::find_program_address(
        &[PERMISSION_SEED, vault.as_ref()],
        &PERMISSION_PROGRAM_ID,
    )
    .0;
    metas[5] = AccountMeta::new(permission, false);
    metas[6] = AccountMeta::new_readonly(PERMISSION_PROGRAM_ID, false);
    metas[7] = AccountMeta::new(EPHEMERAL_VAULT_ID, false);
    metas[8] = AccountMeta::new_readonly(MAGIC_PROGRAM_ID, false);
    Instruction {
        program_id: insider::ID,
        accounts: metas,
        data: instruction::MintCall {
            index,
            direction,
            horizon,
            stake,
            license_ask: 20,
            confidence: 70,
        }
        .data(),
    }
}

#[test]
fn every_seat_gets_a_private_call_vault_and_slot_ten_is_refused() {
    let mut w = world();
    let rent = insider::engine_setup::permission_rent();
    for index in 0..10u8 {
        let account = w.svm.get_account(&vault_key(&w, index)).expect("vault exists");
        assert_eq!(account.data.len(), CallVault::SPACE);
        assert!(account.lamports >= rent, "vault {index} holds {}", account.lamports);
        let vault: CallVault = read(&w.svm, &vault_key(&w, index));
        assert_ne!(vault.bump, 0);
    }
    let ix = init_vault_ix(&w.authority.pubkey(), &w.table, 10);
    let authority = Keypair::try_from(w.authority.to_bytes().as_slice()).unwrap();
    expect_error(w.send(&[&authority], ix), InsiderError::InvalidSeat);
}

#[test]
fn a_seat_starts_with_desk_chips() {
    let mut w = world();
    let bob = Keypair::new();
    claim(&mut w, &bob, 8);
    let seat: Seat = read(&w.svm, &seat_key(&w, 8));
    assert_eq!(seat.desk_chips, DESK_BANKROLL);
    assert_eq!(seat.desk_position, 0);
}

#[test]
fn minting_rejects_bad_calls_before_touching_anything() {
    let mut w = world();
    let bob = Keypair::new();
    claim(&mut w, &bob, 8);
    set_clock(&mut w.svm, 1_000);
    set_oracle(&mut w.svm, 6_991_000_000, 1_000);
    let owner = bob.pubkey();
    for (direction, horizon, stake) in [(0i8, 60u16, 50u64), (2, 60, 50), (1, 90, 50), (1, 60, 9), (1, 60, 201)] {
        let ix = mint_ix(&w, &owner, 8, direction, horizon, stake);
        expect_error(w.send(&[&bob], ix), InsiderError::InvalidCall);
    }
    // more stake than Desk chips
    let mut seat: Seat = read(&w.svm, &seat_key(&w, 8));
    seat.desk_chips = 40;
    w.write(&seat_key(&w, 8), &seat);
    let ix = mint_ix(&w, &owner, 8, 1, 60, 50);
    expect_error(w.send(&[&bob], ix), InsiderError::InsufficientChips);
    // a stale feed
    set_oracle(&mut w.svm, 6_991_000_000, 900);
    let ix = mint_ix(&w, &owner, 8, 1, 60, 10);
    expect_error(w.send(&[&bob], ix), InsiderError::OracleStale);
    // someone else's seat
    let mallory = Keypair::new();
    w.svm.airdrop(&mallory.pubkey(), 1_000_000_000).unwrap();
    let ix = mint_ix(&w, &mallory.pubkey(), 8, 1, 60, 10);
    assert!(w.send(&[&mallory], ix).is_err());
}

#[test]
fn a_right_call_pays_the_stake_and_a_bonus_and_updates_the_track_record() {
    let mut w = world();
    let carol = Keypair::new();
    claim(&mut w, &carol, 5);
    open_call(&mut w, 5, 1, 69_000_000, 100, 1_000);
    set_clock(&mut w.svm, 1_000);
    set_oracle(&mut w.svm, 7_000_000_000, 1_000);
    let anyone = Keypair::new();
    w.svm.airdrop(&anyone.pubkey(), 1_000_000_000).unwrap();
    let ix = settle_ix(&w, &anyone.pubkey(), 5);
    w.send(&[&anyone], ix).unwrap();

    let seat: Seat = read(&w.svm, &seat_key(&w, 5));
    assert_eq!(seat.desk_chips, DESK_BANKROLL + 150);
    let book: CallBook = read(&w.svm, &book_key(&w));
    let header = &book.headers[5];
    assert_eq!(header.call_state(), CallState::Right);
    assert_eq!(header.revealed_dir, 1);
    let season: Season = read(&w.svm, &pda(&[SEASON_SEED, w.table.as_ref()]));
    let stats = season.analysts[5];
    assert_eq!((stats.calls, stats.hits, stats.streak, stats.profit), (1, 1, 1, 50));

    // judged once only
    let ix = settle_ix(&w, &anyone.pubkey(), 5);
    expect_error(w.send(&[&anyone], ix), InsiderError::NoOpenCall);
}

#[test]
fn a_wrong_call_burns_the_stake_and_breaks_the_streak() {
    let mut w = world();
    let carol = Keypair::new();
    claim(&mut w, &carol, 5);
    // she called down; the price went up
    open_call(&mut w, 5, -1, 69_000_000, 100, 1_000);
    set_clock(&mut w.svm, 1_005);
    set_oracle(&mut w.svm, 7_000_000_000, 1_005);
    let ix = settle_ix(&w, &carol.pubkey(), 5);
    w.send(&[&carol], ix).unwrap();
    let seat: Seat = read(&w.svm, &seat_key(&w, 5));
    assert_eq!(seat.desk_chips, DESK_BANKROLL);
    let book: CallBook = read(&w.svm, &book_key(&w));
    assert_eq!(book.headers[5].call_state(), CallState::Wrong);
    assert_eq!(book.headers[5].revealed_dir, -1);
    let season: Season = read(&w.svm, &pda(&[SEASON_SEED, w.table.as_ref()]));
    assert_eq!((season.analysts[5].hits, season.analysts[5].profit), (0, -100));
}

#[test]
fn a_call_is_not_judged_early_stale_or_with_a_late_favourable_price() {
    let mut w = world();
    let carol = Keypair::new();
    claim(&mut w, &carol, 5);
    open_call(&mut w, 5, 1, 69_000_000, 100, 1_000);
    set_oracle(&mut w.svm, 7_000_000_000, 990);
    set_clock(&mut w.svm, 990);
    let ix = settle_ix(&w, &carol.pubkey(), 5);
    expect_error(w.send(&[&carol], ix), InsiderError::CallNotDue);

    // due, but the feed is 31 seconds old
    set_clock(&mut w.svm, 1_031);
    set_oracle(&mut w.svm, 7_000_000_000, 1_000);
    let ix = settle_ix(&w, &carol.pubkey(), 5);
    expect_error(w.send(&[&carol], ix), InsiderError::OracleStale);

    // judged after the grace period: Wrong even though the price moved her way
    set_clock(&mut w.svm, 1_020);
    set_oracle(&mut w.svm, 7_000_000_000, 1_020);
    let ix = settle_ix(&w, &carol.pubkey(), 5);
    w.send(&[&carol], ix).unwrap();
    let book: CallBook = read(&w.svm, &book_key(&w));
    assert_eq!(book.headers[5].call_state(), CallState::Wrong);
}

#[test]
fn desk_trades_fill_at_the_oracle_price_with_a_fee_and_respect_the_limits() {
    let mut w = world();
    let bob = Keypair::new();
    claim(&mut w, &bob, 8);
    set_clock(&mut w.svm, 2_000);
    set_oracle(&mut w.svm, 6_991_000_000, 2_000);
    let owner = bob.pubkey();

    // 500 units are 5 SOL: 349.55 chips rounded up to 350, plus a 1-chip fee
    w.send(&[&bob], trade_ix(&w, &owner, 8, 500)).unwrap();
    let seat: Seat = read(&w.svm, &seat_key(&w, 8));
    assert_eq!((seat.desk_position, seat.desk_chips), (500, DESK_BANKROLL - 351));
    let market: Market = read(&w.svm, &pda(&[MARKET_SEED, w.table.as_ref(), &[MARKET_DESK]]));
    assert_eq!((market.mark_price, market.oracle_ts, market.volume), (69_910_000, 2_000, 500));

    // selling it back pays the notional rounded toward zero, minus the fee
    w.send(&[&bob], trade_ix(&w, &owner, 8, -500)).unwrap();
    let seat: Seat = read(&w.svm, &seat_key(&w, 8));
    assert_eq!(seat.desk_position, 0);
    assert_eq!(seat.desk_chips, DESK_BANKROLL - 351 + 349 - 1);

    // limits: size, position and chips
    expect_error(w.send(&[&bob], trade_ix(&w, &owner, 8, 0)), InsiderError::DeskLimit);
    expect_error(w.send(&[&bob], trade_ix(&w, &owner, 8, 501)), InsiderError::DeskLimit);
    for _ in 0..4 {
        let mut seat: Seat = read(&w.svm, &seat_key(&w, 8));
        seat.desk_chips = 100_000;
        w.write(&seat_key(&w, 8), &seat);
        w.send(&[&bob], trade_ix(&w, &owner, 8, 500)).unwrap();
    }
    expect_error(w.send(&[&bob], trade_ix(&w, &owner, 8, 1)), InsiderError::DeskLimit);
    let mut seat: Seat = read(&w.svm, &seat_key(&w, 8));
    seat.desk_position = 0;
    seat.desk_chips = 10;
    w.write(&seat_key(&w, 8), &seat);
    expect_error(w.send(&[&bob], trade_ix(&w, &owner, 8, 100)), InsiderError::InsufficientChips);
    // selling needs no chips
    w.send(&[&bob], trade_ix(&w, &owner, 8, -100)).unwrap();
}

#[test]
fn only_the_seat_owner_can_trade_and_the_oracle_must_be_the_real_feed() {
    let mut w = world();
    let bob = Keypair::new();
    claim(&mut w, &bob, 8);
    set_clock(&mut w.svm, 2_000);
    set_oracle(&mut w.svm, 6_991_000_000, 2_000);
    let mallory = Keypair::new();
    w.svm.airdrop(&mallory.pubkey(), 1_000_000_000).unwrap();
    assert!(w.send(&[&mallory], trade_ix(&w, &mallory.pubkey(), 8, 10)).is_err());

    // a feed owned by someone else is refused
    let mut feed = w.svm.get_account(&ORACLE_FEED).unwrap();
    feed.owner = system_program::ID;
    w.svm.set_account(ORACLE_FEED, feed).unwrap();
    expect_error(
        w.send(&[&bob], trade_ix(&w, &bob.pubkey(), 8, 10)),
        InsiderError::OracleInvalid,
    );
}

impl World {
    fn send(&mut self, signers: &[&Keypair], ix: Instruction) -> Result<(), String> {
        send(&mut self.svm, signers, ix)
    }

    fn write<T: AccountSerialize>(&mut self, key: &Pubkey, value: &T) {
        write(&mut self.svm, key, value)
    }
}

#[test]
fn new_accounts_can_be_created_while_the_table_is_delegated() {
    // after setup the table is owned by the delegation program; init_market and init_call_vault
    // must not need to deserialise it (this broke the first live upgrade)
    let so = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy/insider.so");
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(insider::ID, &so).unwrap();
    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();
    let a = authority.pubkey();
    let table = pda(&[TABLE_SEED, a.as_ref()]);
    let init = Instruction {
        program_id: insider::ID,
        accounts: accounts::InitTable { authority: a, table, system_program: system_program::ID }
            .to_account_metas(None),
        data: instruction::InitTable { params: None }.data(),
    };
    send(&mut svm, &[&authority], init).unwrap();
    let mut account = svm.get_account(&table).unwrap();
    account.owner = "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh".parse().unwrap();
    svm.set_account(table, account).unwrap();

    send(&mut svm, &[&authority], init_vault_ix(&a, &table, 3)).unwrap();
    let market = Instruction {
        program_id: insider::ID,
        accounts: accounts::InitMarket {
            authority: a,
            table,
            market: pda(&[MARKET_SEED, table.as_ref(), &[MARKET_DESK]]),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitMarket { kind: MARKET_DESK }.data(),
    };
    send(&mut svm, &[&authority], market).unwrap();

    // someone else's authority key cannot create accounts under this table
    let stranger = Keypair::new();
    svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    let mut ix = init_vault_ix(&stranger.pubkey(), &table, 4);
    ix.accounts[1].pubkey = table;
    assert!(send(&mut svm, &[&stranger], ix).is_err());
}

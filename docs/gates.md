# Gates (Block 0 results)

Every gate is a script in `scripts/src/gates/` run against Solana devnet and the MagicBlock
TEE. `pnpm gates` reruns them (a few minutes each); `pnpm gates --report` prints the last saved
result. The raw transaction lists are in `docs/proofs/gates/gN.json`. The probe program the
gates use is throwaway (`programs/gates`), deployed at
`3h7wNZEN4hqcwwCh5KfmrXaq74PXuKKCJ8xgdGDA4wa8`; it is not part of the game.

## Summary

| Gate                   | Result   | Decision                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G0 Darkcheck           | **PASS** | Non-members and anonymous callers recovered nothing from any path; the member control could read. The dark mempool, lanes and Flow family stay in.                                                                                                                                                                                                                                                           |
| G1 Clock and tick rate | **PASS** | SLOTS_PER_TICK = 50 (jitter 1.5%). Tick is derived from the rollup slot.                                                                                                                                                                                                                                                                                                                                     |
| G2 Keyless reader      | **PASS** | Both a keyless-PDA member list and an empty list make the account unreadable to everyone, including the authority, while program code keeps writing. Use [nobody] for Mempool, Future and sealed vaults.                                                                                                                                                                                                     |
| G3 Zero-balance key    | **PASS** | A key with 0 SOL signs and pays its own transactions on the TEE. Guest onboarding needs no funding.                                                                                                                                                                                                                                                                                                          |
| G4 Oracle in the TEE   | **PASS** | A program inside the TEE reads SOL/USD (about $69.91, age under 10s). The Desk is in. Decode as PriceUpdateV3 by layout, exponent -8 from the feed list.                                                                                                                                                                                                                                                     |
| G5 Private Payments    | **PASS** | Deposit, private transfer, withdraw and the platform fee all work on devnet-private, and another wallet cannot read a private balance. Alpha Cup is in. Caveat: a queued private base-to-base buy-in did not deliver to the operator within 150 s (the fee was skimmed at once), so buy-ins and payouts should run as deposit, private transfer inside the rollup and withdraw, which are fast and verified. |
| G6 Magic Action        | **INFO** | Magic Action works: a post-commit action ran our base-layer instruction, authenticated by the escrow signer, and wrote the committed value. The SOAR leaderboard call is not yet tested, so achievements stay undecided until task A-4.2.                                                                                                                                                                    |
| G7 Session keys        | **PASS** | A zero-SOL session key signs gameplay on the TEE for the wallet; wrong signers and missing tokens are rejected, the wallet still works directly, and revocation stops the session. Wallet identity is in.                                                                                                                                                                                                    |
| G8 Epoch cycle         | **PASS** | Committed, undelegated and re-delegated 3 times in a row with the right value on base each time. The epoch design stands.                                                                                                                                                                                                                                                                                    |
| G9 Duplicate cranks    | **PASS** | Duplicate tasks made 20 calls but only 10 effective ticks (single task: 10). A tick gated on elapsed slots is idempotent.                                                                                                                                                                                                                                                                                    |
| G10 Crank-invoked VRF  | **INFO** | A crank-scheduled VRF request produced no callback. Nothing changes: drops stay derived from the one round seed that a signing seat requests.                                                                                                                                                                                                                                                                |

## Addresses

| What                                | Address                                        |
| ----------------------------------- | ---------------------------------------------- |
| Game program (new ID)               | `7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW` |
| Gates probe program (throwaway)     | `3h7wNZEN4hqcwwCh5KfmrXaq74PXuKKCJ8xgdGDA4wa8` |
| Deployer                            | `23k9UnCKBkFyci6Sv1RhuFXUXFgTnjV6oeTZyMaxopWm` |
| Operator wallet                     | `GjuNmqtjs9qHE5M8XiZ516oZmsiQyvRz6JCpFbnT4bcL` |
| Platform fee account (G5 test mint) | `7gfzeaau9hL6uTPcHAkp9fH2xuDzknwjrsA7GYZ8ctqA` |
| Keyless reader PDA (nobody)         | `J7TUac6xWjSH5sPbdcWt9j7iFVcc9eA1pPqJhhSrPwWF` |

## Evidence

### G0 Darkcheck: PASS

_Question:_ Can a non-member recover an order from the private mempool through any read path?

_Decision:_ Non-members and anonymous callers recovered nothing from any path; the member control could read. The dark mempool, lanes and Flow family stay in.

| Step                                           | Layer | Transaction                                                                                                                                                                                                 |
| ---------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| probe_delegate                                 | base  | [51QjAMAFAMMy...](https://explorer.solana.com/tx/51QjAMAFAMMyykKL2kEzye4eW67HQReCdDEjg4Jydex2czeQt6RggTXH8mSNNbVs332ZEwXiYGP881BruPYGzwSM?cluster=devnet)                                                   |
| probe_permission_create (phase1)               | TEE   | [51xBLeGo97Xo...](https://explorer.solana.com/tx/51xBLeGo97XosBZNrudfzaGsrdAGiMDhoH2QFPUJRgSBJTxYg9w447c3XS4KY1Lzei5RPCsodSKHttKXe5iUUZC1?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_send_secret 1234 (phase1)                | TEE   | [578sCgKULsTU...](https://explorer.solana.com/tx/578sCgKULsTUh98zvB38xhCwCynHw3ES1kpLUuot9Q49GkYiBmMfUZ6JwjWYXmaQAX3bo6YqeUFjrCMrTYBwSgYy?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_send_secret 4321 (stream, payer(member)) | TEE   | [WM68MQbAbP4L...](https://explorer.solana.com/tx/WM68MQbAbP4L9ra8jJQJG96Rai19whXMeZBM9DKv9YgqGDzsaoYWDx3KF8cK5xjgEz42CJGMErdfQMy64fw9VeL?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app)  |
| probe_send_secret 4321 (stream, B(other key))  | TEE   | [5FfwRSXhH9Pw...](https://explorer.solana.com/tx/5FfwRSXhH9PwufsHWBfFjKZ8oLZ4nKugN135VsY6M6QRGCozbUxkDy5fMb2j4oUexUE9EgnxcSdbA9XCxUgJHfVp?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_send_secret 4321 (stream, anonymous)     | TEE   | [4GZaK4qPDtMi...](https://explorer.solana.com/tx/4GZaK4qPDtMis6Tuy9MvMcwGrHgoSBhLe6y8MPyE4eQiM1rE8HY8otshFuEKnUTvnDuGvdp7AjKBZjDahnsGo4Xs?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_permission_update (phase2)               | TEE   | [2AtgaN42RSjF...](https://explorer.solana.com/tx/2AtgaN42RSjFA6ywUz5QjAuQKJYs1kGJmjgLEbbBNy2qVkgucftbG2gHRksSP6rKJmKZA1AzPAWiUEGfTnF4gr4r?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_send_secret 1234 (phase2)                | TEE   | [3i4gpPJj7wdL...](https://explorer.solana.com/tx/3i4gpPJj7wdLJT1bCaeL1fB862CaLAczDhibgPuPCvWETLkd3h2uJP32fiA9oXmLwW7uYQYk3osHZKS21j4gwZnS?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_send_secret 4321 (stream, payer(member)) | TEE   | [iDrm6CU5jxHY...](https://explorer.solana.com/tx/iDrm6CU5jxHYpCRcEGVueeYwfrmvdPFrsiKjTAyRTBzSLaBX2kuvZLsQ5A9qrvoHWZuVvzM8jFd4So7F5VFgwuv?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app)  |
| probe_send_secret 4321 (stream, B(other key))  | TEE   | [qMvvvm7qFC23...](https://explorer.solana.com/tx/qMvvvm7qFC23wuwM2EFTrbVPMTFkChoFnVUNsbDB9jBysctxfytNyvgF3WodusW1VSDL7iWYjfWw1472PNo9rz2?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app)  |
| probe_send_secret 4321 (stream, anonymous)     | TEE   | [4aJKUvHdBdKz...](https://explorer.solana.com/tx/4aJKUvHdBdKzwFGPrNqySj3qKCW2ALjjouKrhmAtTK1NDSGcEwPaQFwhtzg3zTk2ybLnz9QfWQmeGNg3pxQ9DMYy?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_permission_close                         | TEE   | [5zLueS2cxWM9...](https://explorer.solana.com/tx/5zLueS2cxWM9SibFhCkd9qBPeFpbVjUhH4BybDUg8KJFvNDex6QkuBn6GkgrNPs8U9BAGq5sdMtU7qJ3yarqbp6V?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |

1 more transactions in `docs/proofs/gates/g0.json`.

### G1 Clock and tick rate: PASS

_Question:_ How many slots does the TEE advance per 500 ms tick, and how steady is it?

_Decision:_ SLOTS_PER_TICK = 50 (jitter 1.5%). Tick is derived from the rollup slot.

| Step                         | Layer | Transaction                                                                                                                                                                                                 |
| ---------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| probe_delegate               | base  | [3GcwMbGfGoZU...](https://explorer.solana.com/tx/3GcwMbGfGoZUntMYbNcvECossdxSMaZ4F76Ea8R4pbjBUEQN2gyuS4AfuEAFqdb2GDJreU9WqMz5vYvo6bbfycWf?cluster=devnet)                                                   |
| probe_schedule (16 x 500 ms) | TEE   | [2EkJS5acUYen...](https://explorer.solana.com/tx/2EkJS5acUYenYfHHRAaDPTq1Y1QucTxBPSchN7H4AgRFpjj5b5yxqwMK9rRhHTQoArUnjohawUbfS983LZe1TZNN?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_undelegate             | TEE   | [2owHmUoeQomd...](https://explorer.solana.com/tx/2owHmUoeQomd87GCnnvLqvYvmcDhxtx3U6KB3NV24AmxcyZqYqSwDhQaAJqabfafHr63L1xFf6DFLhHaZ5QFfsyf?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |

### G2 Keyless reader: PASS

_Question:_ Is an account private when its only member is a keyless PDA (or the list is empty)?

_Decision:_ Both a keyless-PDA member list and an empty list make the account unreadable to everyone, including the authority, while program code keeps writing. Use [nobody] for Mempool, Future and sealed vaults.

| Step                                             | Layer | Transaction                                                                                                                                                                                                 |
| ------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| probe_delegate                                   | base  | [3DeJjyX6zvWg...](https://explorer.solana.com/tx/3DeJjyX6zvWgTaVHB9sNoYJUaiVq4bR2SH3CAf29maRBLbN5CfCaqCTxEAiBtRyfQHSDbhoeHj9ezcuULDvkjPPE?cluster=devnet)                                                   |
| probe_permission_create (members = [nobody PDA]) | TEE   | [2MyiWa5Wxjod...](https://explorer.solana.com/tx/2MyiWa5Wxjod5ECVS2CP2qjzPVocLfZSMhWqN9C3K3Bm1CQoYxsu31V7fFP9guwb7bnLP5DDVH42g6RQhQjEunfd?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_send_secret 101 (members = [nobody PDA])   | TEE   | [4DSa1puaTGso...](https://explorer.solana.com/tx/4DSa1puaTGsocufbCUDksQp3ewviKZ4oFotV2dk4uYZnVyU1zJrwLJ6ioixv8C7zb1KvMHnCqLQ4JxApEvEYYj7c?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_permission_update (members = [])           | TEE   | [57q184zqPevD...](https://explorer.solana.com/tx/57q184zqPevDWhysqwFGudM9T6ZUkw1LmfmUNAffzftynFRnGLThx8kqqQQNwhiDkporrrcKW1bYj4owC32dsSpu?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_send_secret 102 (members = [])             | TEE   | [2WU2zaagAgpc...](https://explorer.solana.com/tx/2WU2zaagAgpcevk7yBRsK7X9D35Azt93mXjMJmU4q3zy5RpYyFYQ2fVhGvRqpEX6f7CuZVQfQDK9k9pRG86657XD?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_permission_update (public)                 | TEE   | [2m6j1nkXBWQZ...](https://explorer.solana.com/tx/2m6j1nkXBWQZsS74bWdzk3F8n5pNfGz3uEMCCgRHhmE872TL4w3G5549MJSFt9s18sHM6UEDanVMe4Ti7s9xkoNZ?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_permission_close                           | TEE   | [KK5abrj6UooE...](https://explorer.solana.com/tx/KK5abrj6UooEeL6t9Umw98QSqDsDTKkDQQPF4A4UdfoLtLtikwC29GHFZyEfu3C5VmNhLYb1iuHz8SDEjSdp9at?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app)  |
| probe_undelegate                                 | TEE   | [4m13iiMrtmAt...](https://explorer.solana.com/tx/4m13iiMrtmAtAehyG2y25DKpeqYdsSkDLH1F1du8E35EU7qWjzvFiCsjRHt4YpfJ7hTE5qdYx6jVZ7VigthKcUiP?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |

### G3 Zero-balance key: PASS

_Question:_ Can a key with 0 SOL sign and pay on the TEE?

_Decision:_ A key with 0 SOL signs and pays its own transactions on the TEE. Guest onboarding needs no funding.

| Step                                             | Layer | Transaction                                                                                                                                                                                                 |
| ------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| probe_delegate                                   | base  | [LZ4eYk7szTEF...](https://explorer.solana.com/tx/LZ4eYk7szTEF6iSxjfuxNSKeApvstrBUpfENx4rnx7UuPE4GrcpU1wUDCD34N9kuXKUr3WtT3sfayRxCWPAVCvE?cluster=devnet)                                                    |
| guest is fee payer: probe_ping                   | TEE   | [5zq78XHY6CJc...](https://explorer.solana.com/tx/5zq78XHY6CJcbGQcZVYarECbJ6WR89mWEC7FV2AiHRwFuqiZAcPenLrgzNPk3tFPyuruR6DVmUKkkUwSMCg4CXpb?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| guest is fee payer: probe_send_secret            | TEE   | [MexRXiPKmi6i...](https://explorer.solana.com/tx/MexRXiPKmi6iCMM9fiDXEnooaZFf6vnpt9M2hoEXqjof1dkT9aGQjQfr6p2ns5kNF54PtRmLByN9XUYKDyog4ak?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app)  |
| funded fee payer, guest signs: probe_send_secret | TEE   | [5ryxCS1szuBJ...](https://explorer.solana.com/tx/5ryxCS1szuBJoXsbfxNYnXfzJyRbihFkD4HQsJGKa1GcTnssSzCFXg4whzwR996J4z7NkdJzjhw9BwkRdj67Jioj?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_undelegate                                 | TEE   | [2t5aef82yi5E...](https://explorer.solana.com/tx/2t5aef82yi5E8UisVA9Ph9UjJB9pHhghtiDBJxhiMik8beuJ6E1hZzfiauBjWT6tr2iqA6XVGZPbmtVZkAJqgQwU?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |

### G4 Oracle in the TEE: PASS

_Question:_ Can a program read a fresh SOL/USD feed inside the TEE?

_Decision:_ A program inside the TEE reads SOL/USD (about $69.91, age under 10s). The Desk is in. Decode as PriceUpdateV3 by layout, exponent -8 from the feed list.

| Step                 | Layer | Transaction                                                                                                                                                                                                 |
| -------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| probe_delegate       | base  | [2FndFZWqsfyc...](https://explorer.solana.com/tx/2FndFZWqsfyct3jgBuyJxWKxjDJ3FYvXjjEwh76pjg686qeUPNgEDkD2Unc9zT4SXRGw1aEMhdURLDju2hW1gyeD?cluster=devnet)                                                   |
| probe_read_oracle #1 | TEE   | [4feGfVkGDkeu...](https://explorer.solana.com/tx/4feGfVkGDkeuMgChwwnKM6NRcEAnY7U4GckneTTfLqiCbTEKjAMdjKSGJXtBdX9UZrjqHLKAtTR3dbqdxmuwPDj2?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_read_oracle #2 | TEE   | [2vscSosshkAK...](https://explorer.solana.com/tx/2vscSosshkAKPtKHXKK6F5RRXyzCSCYH2aNCEuXEPe46BYi9gUUFXgYe5NqpmW3Hxt4ZXbtFmwbQ3DkyeRiLHnbq?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_read_oracle #3 | TEE   | [FLEHsJUvKLm5...](https://explorer.solana.com/tx/FLEHsJUvKLm5VzC5D89FsPiaCzp7mCYgvxSghpj2CoFCUCMyZwKn8oYWjM3P1kQdKwuzaCsD6bGB2HE1s9zSVh9?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app)  |
| probe_undelegate     | TEE   | [2nSsp1h8EYZr...](https://explorer.solana.com/tx/2nSsp1h8EYZrN332C5MQZybrc7gjK856G6U1XLuCtyQGLWEVvsCB92CoUvQt6psunQeUKnhokzQ5UfrvdwfJBG5Y?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |

### G5 Private Payments: PASS

_Question:_ Do deposit, private transfer and withdraw work on devnet-private with a platform fee account?

_Decision:_ Deposit, private transfer, withdraw and the platform fee all work on devnet-private, and another wallet cannot read a private balance. Alpha Cup is in. Caveat: a queued private base-to-base buy-in did not deliver to the operator within 150 s (the fee was skimmed at once), so buy-ins and payouts should run as deposit, private transfer inside the rollup and withdraw, which are fast and verified.

| Step                                     | Layer | Transaction                                                                                                                                               |
| ---------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| deposit 20 (base -> TEE)                 | base  | [4D1qtyA3z9kE...](https://explorer.solana.com/tx/4D1qtyA3z9kEWm8ZCra3mpDJ8ePExRCYyb6HNmuPrgEPvLGZu23bchn4gyGzU9Qmvcw7LAVs32qYw9pvs5oPZaB1?cluster=devnet) |
| private transfer 5 (TEE)                 | TEE   | [38nidqE8k8NR...](https://explorer.solana.com/tx/38nidqE8k8NRCr4o7aoRpyAfgg8MzjYScwkVrwVMawKP9iLxNjVMXWuaqjJ1WwV5DSSkHyyP7dFnhQwaTpKbYUKu?cluster=devnet) |
| withdraw 5 (TEE -> base)                 | base  | [4DvmRjS9aQk5...](https://explorer.solana.com/tx/4DvmRjS9aQk5rpe11y5d6JijboNgdPYzGiouvkWLMrtGkafRZ1PqEjraTv9jHGCaoLnnuAssWGEwxhimc7rCN9rz?cluster=devnet) |
| buy-in 10 (private base -> base, fee 5%) | base  | [3y3nvufgcoBB...](https://explorer.solana.com/tx/3y3nvufgcoBBUHL5E2WCoUpdZv1ApuCzbmEiWfSebhMfs9zkAXWhvX1vpGeCkfgM5ZTSjRv7tCsNMrZAPeaG2nHZ?cluster=devnet) |

### G6 Magic Action: INFO

_Question:_ Can a post-commit Magic Action run our base-layer instruction (and update SOAR)?

_Decision:_ Magic Action works: a post-commit action ran our base-layer instruction, authenticated by the escrow signer, and wrote the committed value. The SOAR leaderboard call is not yet tested, so achievements stay undecided until task A-4.2.

| Step                            | Layer | Transaction                                                                                                                                                                                                 |
| ------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| top up action escrow (0.02 SOL) | base  | [4PnNNZEhJds2...](https://explorer.solana.com/tx/4PnNNZEhJds2zvPurnMZ5nzcqAxPdWoLBDTeyLKBV3Sge7qikefR9hiSSkdzDomFNPNPFDopdPKEDLmw5m1qbQir?cluster=devnet)                                                   |
| probe_delegate                  | base  | [38Vw2WWrYJuV...](https://explorer.solana.com/tx/38Vw2WWrYJuVFVBW6piKEoASoRKmGDpa4dSmZXcGok1vSp1pUtKVwrQm5kPxsHi5fUvspA6iMoq3zQ8MLq95qdSN?cluster=devnet)                                                   |
| probe_send_secret 4242          | TEE   | [4pU22CfQW2wb...](https://explorer.solana.com/tx/4pU22CfQW2wbiyriYAiT13x7hvpBKdJie93AbuQkNpmfvXnywo4yWfdUX659UCnHMfdk2RAYqJaxYrewRAuqwqTo?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_commit_with_action        | TEE   | [4xWYwignkMrU...](https://explorer.solana.com/tx/4xWYwignkMrUUzBrwxuK9LtYMxm6cP6BF29WZvikfX6BxNNk5tz6B2t71k8sax8fRYkAXhmeiCJ9dqSG4iuQsT9D?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_undelegate                | TEE   | [635e2pPUvezA...](https://explorer.solana.com/tx/635e2pPUvezACVn1Lbsb6YsgTprQe3dXZ6GaHx3dkWKjv58qcNMrxRobFFme6bcvrvM7gMEFSpQvkjQJDNhwyiym?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |

### G7 Session keys: PASS

_Question:_ Do session keys work with our program on the TEE?

_Decision:_ A zero-SOL session key signs gameplay on the TEE for the wallet; wrong signers and missing tokens are rejected, the wallet still works directly, and revocation stops the session. Wallet identity is in.

| Step                             | Layer | Transaction                                                                                                                                                                                                 |
| -------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| probe_delegate                   | base  | [3YgtYmydypYY...](https://explorer.solana.com/tx/3YgtYmydypYYLmuFfarqZFjKQmsWEcqSo9QUJcq5d3iRZVJ8TVgqfXiBu8NvbnXF8giNtr6N83KzghSDPJ5S8vUK?cluster=devnet)                                                   |
| createSessionV2 (base)           | base  | [4rnpuCoqkKcE...](https://explorer.solana.com/tx/4rnpuCoqkKcEX8wj6JsRz2qrAU9kaxqCjGdxGG8shBMKnVLoEfED5cQ7vLL3z8iMki5TECoA2cMF7ecFvR929R95?cluster=devnet)                                                   |
| session key signs with its token | TEE   | [2TTKd1kWZsDT...](https://explorer.solana.com/tx/2TTKd1kWZsDTiaMXEQLzmTFfpQZ5bcEsqXP1QduhXF5HPXLPsCpftApxitDWRiiQApB7BR7pKBKxWP5N3pCw1FYJ?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| wallet signs directly (fallback) | TEE   | [3f1FY1FYeV2v...](https://explorer.solana.com/tx/3f1FY1FYeV2vo9f171UpF6LRC8F1j4f7qnowYDS9hufVaPjTXLC3Y6oaqjM1rX2Bcc1DURyqbTsjXyP5tBEqwBgw?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| revokeSessionV2 (base)           | base  | [3vmBE5J5fqmQ...](https://explorer.solana.com/tx/3vmBE5J5fqmQpUnMLq4rzUFiCJzfDpBceQi5WgQ5hb6VGs4MYTionQGdWFuBtKaCkCUeFDL9LMBdWCzpAB9TkNpT?cluster=devnet)                                                   |
| probe_undelegate                 | TEE   | [3XMYbCSWvyQj...](https://explorer.solana.com/tx/3XMYbCSWvyQjUDvkw4G4FxsbEoYX1Fix94BLNMahboomTzE9EZp34u1TLK85cY6jRZpSeZGsCLZmstYKxo3Aw1X1?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |

### G8 Epoch cycle: PASS

_Question:_ Can an account be committed, undelegated and re-delegated repeatedly (the epoch cycle)?

_Decision:_ Committed, undelegated and re-delegated 3 times in a row with the right value on base each time. The epoch design stands.

| Step                          | Layer | Transaction                                                                                                                                                                                                 |
| ----------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| probe_undelegate (cleanup)    | TEE   | [57kgrTSpegEG...](https://explorer.solana.com/tx/57kgrTSpegEGaZ8KubU8xY1JtgxCKjVWMAQPrMYe9as56iN8CRxnprHykssE5Mq9X8nbWqeFnw4pUeBM9xfwx5m1?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_delegate                | base  | [2Dg97hhatkwp...](https://explorer.solana.com/tx/2Dg97hhatkwp24WwEG6FcpgKUSK7Qz9k3zH1X4VKaPQv21gevL3LiSpr4irLuG63s9jU2SVQbs2PtxrQ49GNooms?cluster=devnet)                                                   |
| probe_send_secret 101         | TEE   | [V7HYHJJb6yFX...](https://explorer.solana.com/tx/V7HYHJJb6yFXQjTiLKY8gXs35wVYEr2oJDpv6HzmJYsdQSGm3e4sGcEfNVWdzWHPtqw9rrsgo5euhcSoiNaYLmc?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app)  |
| probe_commit (stay delegated) | TEE   | [4PDQ9zWa5h21...](https://explorer.solana.com/tx/4PDQ9zWa5h21TP2BXh3NTpajAYiv1K6yJD1qQeuTNJtpZX2THWSVePgHUcKKfsWsE5b7KA3nYrKzMpmbCqP1reui?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_send_secret 102         | TEE   | [2DBVj9TCDHVb...](https://explorer.solana.com/tx/2DBVj9TCDHVbRJoKatdHvWixspE3zXh9EuKJqychXL4ZyirxQ9GedNvqTU8mefSbvnbwELF4HtJiGojhheZ9wSdn?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_undelegate              | TEE   | [37zMW4rKPHUk...](https://explorer.solana.com/tx/37zMW4rKPHUkUZr9xxdsbDp5jpm1QraAZPrAcBYdDZTbKJTZavjmhWzTCKQtxe7Cs4exxKCAcdfchqZyhSkDQ8CV?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_delegate                | base  | [31cUhQvABMPW...](https://explorer.solana.com/tx/31cUhQvABMPWBJbEfjS6X1sr5WUbo4A3bz8zaqt97rWHhAACCgYqnyP9HYPTMFHWyKTRdzpDcTKESo8BN17Gg85?cluster=devnet)                                                    |
| probe_send_secret 201         | TEE   | [51vkaTJ56DfK...](https://explorer.solana.com/tx/51vkaTJ56DfKpdvmgcX43Pp9vWAp6bxTjEdWXgxA1Vr9TZ2kN9EU5idrhQP3bEanPVukFhes3X4ErtfbKTprJNoJ?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_commit (stay delegated) | TEE   | [xVydHdC1ooqN...](https://explorer.solana.com/tx/xVydHdC1ooqNcnvxXzk51nC5akxz5sZapzPBxEk6NZAuVWeyH4kERTktWWxf6MFgz2yKUdnuB85HsfbfXvPt5oM?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app)  |
| probe_send_secret 202         | TEE   | [24FjhcYhynH9...](https://explorer.solana.com/tx/24FjhcYhynH9SvF7nji5UGxE8LhwmXDTVcP9kGKgRGkpG3zr25qhQY45CL6mMqVDEraVZVE7xQuZPKKH2jjfUsd1?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_undelegate              | TEE   | [cLykzpskDtG2...](https://explorer.solana.com/tx/cLykzpskDtG2H1DgUTW7z9zh5LSQMmFM5Th78RHdd8sHf1V1oNLoUmuoVRd6B8HNLiNCczeu2MWNRc2EjftuQSP?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app)  |
| probe_delegate                | base  | [J6TgkZMJcdub...](https://explorer.solana.com/tx/J6TgkZMJcdubD7sSQW2f2z9hTAFEdygFg4GGXGjoeA2m3uVqy8YDut4eGh6RJnHAWJ825NZgQdgPf5hQPu1hysL?cluster=devnet)                                                    |

4 more transactions in `docs/proofs/gates/g8.json`.

### G9 Duplicate cranks: PASS

_Question:_ If two crank tasks run the same tick, is state still correct?

_Decision:_ Duplicate tasks made 20 calls but only 10 effective ticks (single task: 10). A tick gated on elapsed slots is idempotent.

| Step                              | Layer | Transaction                                                                                                                                                                                                 |
| --------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| probe_delegate                    | base  | [5yDDH4gQ1xPg...](https://explorer.solana.com/tx/5yDDH4gQ1xPgDQDECjG9m5VLmeAv6VxSWwUPLjWbhg87yMjYW91fsvJAHp4w34g19DgH9rp8gnSEkHyBGdg6ENJ1?cluster=devnet)                                                   |
| probe_schedule (single task)      | TEE   | [46EJfjFUMrCP...](https://explorer.solana.com/tx/46EJfjFUMrCP9CSszMu9komepa7ESWRkdAas9wr8rUqE19DG32gFv49awMHwZBzMCovfAnHBz3bPdMoY77ifsx5R?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_schedule (duplicate task A) | TEE   | [5HQfnX988WpW...](https://explorer.solana.com/tx/5HQfnX988WpW6vMdibsSVfgikAenzU7HtZEwp1A3iEvVY1rbfmnPtJ5uwCrtiBpzYFMbveinQ8vrAJWDdK9Cy9E6?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_schedule (duplicate task B) | TEE   | [5ATyPhYD9AK2...](https://explorer.solana.com/tx/5ATyPhYD9AK2u7N4i5ymCAyySBE4PbEDGGFzTsMAy68cRjr4QHas2qUTdtUMivEbfB8dtyFppaEwstEQdv7Y5roi?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_undelegate                  | TEE   | [2ndx88mNZw4k...](https://explorer.solana.com/tx/2ndx88mNZw4kz5Z4LGHQ394PEqzLej45JVFNECHroMtzmgqV6n48btwVtQz8Xf1a4VdoXJT1AKKhDERAohHWEsmr?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |

### G10 Crank-invoked VRF: INFO

_Question:_ Can a crank-scheduled instruction request VRF?

_Decision:_ A crank-scheduled VRF request produced no callback. Nothing changes: drops stay derived from the one round seed that a signing seat requests.

| Step                       | Layer | Transaction                                                                                                                                                                                                 |
| -------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| probe_delegate             | base  | [657iymc2N4L6...](https://explorer.solana.com/tx/657iymc2N4L6gL6xD3aALYax5SeZZK5bkfA8bRcWnJ6pd19pEHoZpxyhswewbEnRLTzoh6xe3k71XpqcrpBrNnfz?cluster=devnet)                                                   |
| probe_request_vrf (wallet) | TEE   | [3dimRs4dgZ6g...](https://explorer.solana.com/tx/3dimRs4dgZ6gvk6pLCySTPdwhZr89DXuWb6YDeSG36qR3NNkFWDQz7EhqnD2RpJ74B1HPL2MRXCiXyGXfZZ1hTU8?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |
| probe_undelegate           | TEE   | [4joEbBjT3YVW...](https://explorer.solana.com/tx/4joEbBjT3YVWGKTp3LNPANgQ52jhZ6HgmqoCLgjVLvbTLrPVR5cT3ifW1norzaZEU13Y52YcBs2cf9Ym3LzNy46D?cluster=custom&customUrl=https%3A%2F%2Fdevnet-tee.magicblock.app) |

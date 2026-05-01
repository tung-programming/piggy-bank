# 🐷 Solana Piggy Bank — Anchor Program on Devnet

> A fully-functional on-chain piggy bank built with the **Anchor framework** on **Solana Devnet**.
> Any wallet can create its own piggy bank PDA, deposit SOL into it, and withdraw SOL back —
> all rules enforced by an immutable smart contract deployed on Solana.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Real-World Analogy](#-real-world-analogy)
3. [Key Solana Concepts Used](#-key-solana-concepts-used)
4. [Architecture & How It Works](#-architecture--how-it-works)
5. [Folder Structure](#-folder-structure)
6. [Program Instructions](#-program-instructions)
7. [Account Layout](#-account-layout)
8. [Security & Ownership Enforcement (Bonus)](#-security--ownership-enforcement-bonus)
9. [Custom Errors](#-custom-errors)
10. [Prerequisites & Installation](#-prerequisites--installation)
11. [Step-by-Step Setup](#-step-by-step-setup)
12. [Running the Tests](#-running-the-tests)
13. [Test Suite Explained](#-test-suite-explained)
14. [Expected Test Output](#-expected-test-output)
15. [Deployment Details](#-deployment-details)
16. [Technical Deep-Dive](#-technical-deep-dive)
17. [Debugging Tips](#-debugging-tips)
18. [Resources](#-resources)
19. [Submission Checklist](#-submission-checklist)

---

## 🎯 Project Overview

This project implements a **Piggy Bank smart contract** on the Solana blockchain using the **Anchor framework**. It demonstrates core Solana programming model concepts: accounts, programs, instructions, PDAs (Program Derived Addresses), transactions, `invoke`, and `invoke_signed`.

| Item                    | Value                                          |
| ----------------------- | ---------------------------------------------- |
| **Network**             | Solana Devnet                                  |
| **Program ID**          | `9tFk4icS7KMjXKPEBdhDtTqZPXzWNg1mzbZbHwHQewTH` |
| **Framework**           | Anchor 0.31.1                                  |
| **Language (on-chain)** | Rust                                           |
| **Language (tests)**    | TypeScript                                     |
| **Test runner**         | Mocha + Chai                                   |

---

## 🏦 Real-World Analogy

| Physical World           | Solana Blockchain                                                          |
| ------------------------ | -------------------------------------------------------------------------- |
| A physical piggy bank    | A **PDA account** owned by the program                                     |
| Who owns the bank        | Seeds `["piggy-bank", wallet_pubkey]` — only your wallet derives your bank |
| Dropping coins in        | `deposit` instruction — SOL moves from your wallet → PDA                   |
| The coins inside         | **Lamports** stored inside the PDA                                         |
| Proof it's your bank     | PDA is deterministically derived from your public key                      |
| The bank's rules         | This on-chain Anchor program (immutable once deployed)                     |
| Walking up to the bank   | TypeScript client building and sending a transaction                       |
| The teller processing it | Solana validators executing the instruction                                |
| Breaking the piggy bank  | `withdraw` instruction — SOL moves from PDA → your wallet                  |

---

## 🔑 Key Solana Concepts Used

### Accounts

Every piece of data on Solana lives in an **account**. Accounts hold lamports (SOL), data, and have an owner program. In this project:

- The **user wallet** is an account owned by the System Program
- The **PDA** (`PiggyBank`) is an account owned by our program
- The **System Program** is a special built-in account that handles SOL transfers

### Programs

Programs are Solana's equivalent of smart contracts — stateless executable code stored on-chain. Our Anchor program contains the three instructions (`initialize`, `deposit`, `withdraw`) and enforces all the rules.

### Instructions

Instructions are the actions a program can perform. Each instruction specifies which accounts are involved and what data is passed. A **transaction** bundles one or more instructions and is submitted atomically.

### PDAs (Program Derived Addresses)

A PDA is an account address derived from:

- A set of **seeds** (byte strings)
- The **program ID**
- A **bump** (a nonce that ensures the address doesn't fall on the ed25519 curve — i.e., has no private key)

In our program:

```
PDA = findProgramAddress(["piggy-bank", user_pubkey], program_id)
```

Since a PDA has no private key, **only the program itself can sign for it** — which is why `invoke_signed` is used for withdrawals.

### invoke vs invoke_signed

|                 | `invoke`                                                 | `invoke_signed`                                                                  |
| --------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Used for**    | Calling System Program when a real keypair is the signer | Calling System Program when a PDA needs to "sign"                                |
| **In our code** | `deposit` — user wallet signs                            | Not used for withdraw (we use direct lamport manipulation instead)               |
| **Why**         | User wallet is System Program-owned                      | Our PDA is program-owned, so direct lamport manipulation is the correct approach |

### Bump Seed

The bump is stored in the `PiggyBank` account so it doesn't need to be re-computed every time. This is a **gas optimization** — re-deriving the bump on-chain costs compute units.

---

## 🏗 Architecture & How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (TypeScript)                       │
│  anchor.methods.initialize() / deposit() / withdraw()            │
└────────────────────────────┬────────────────────────────────────┘
                             │ Transaction
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SOLANA DEVNET VALIDATOR                      │
│  Validates signatures, checks account ownership, runs program   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               OUR ANCHOR PROGRAM (lib.rs)                        │
│  Program ID: 9tFk4icS7KMjXKPEBdhDtTqZPXzWNg1mzbZbHwHQewTH       │
│                                                                  │
│  initialize ──► Creates PDA, stores owner + bump                 │
│  deposit    ──► invoke(System::transfer, user→PDA)               │
│  withdraw   ──► Direct lamport manipulation (PDA→user)           │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│  PiggyBank PDA Account        │
│  Seeds: ["piggy-bank", user]  │
│  Data:  { owner, bump }       │
│  Lamports: deposited SOL      │
└──────────────────────────────┘
```

### Transaction Flow — Deposit

```
User Wallet  ──[sign]──►  Transaction
                              │
                              ▼
                    System Program::transfer
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       user_lamports -= amount        pda_lamports += amount
```

### Transaction Flow — Withdraw

```
Program signs for PDA via seeds  ──►  Transaction
                                           │
                                           ▼
                             Direct lamport manipulation
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
            pda_lamports -= amount                  user_lamports += amount
```

---

## 🗂 Folder Structure

```
piggy-bank/
│
├── Anchor.toml                  # Cluster config (devnet), program ID, test script
├── Cargo.toml                   # Rust workspace config with overflow-checks = true
├── package.json                 # JS/TS dependencies (@coral-xyz/anchor, mocha, chai)
├── tsconfig.json                # TypeScript compiler config
├── README.md                    # This file
├── .gitignore                   # Excludes target/, node_modules/, keypairs
│
├── programs/
│   └── piggy-bank/
│       ├── Cargo.toml           # Program Rust deps (anchor-lang = "0.31.1")
│       └── src/
│           └── lib.rs           # ◄── ALL on-chain Rust program logic lives here
│
├── tests/
│   └── piggy-bank.ts            # ◄── All 4 TypeScript tests (Mocha + Chai)
│
└── target/                      # Auto-generated by `anchor build` — NOT committed
    ├── deploy/piggy_bank.so     # Compiled BPF bytecode deployed to devnet
    ├── idl/piggy_bank.json      # Auto-generated Interface Definition Language
    └── types/piggy_bank.ts      # Auto-generated TypeScript types for the program
```

---

## 📋 Program Instructions

### 1. `initialize`

**Purpose:** Creates a new PDA piggy bank account for the calling user.

**How it works:**

- Derives a PDA using seeds `["piggy-bank", user_pubkey]`
- Allocates 41 bytes of on-chain space
- Stores the caller's public key as `owner`
- Stores the canonical `bump` seed for future verification
- The user pays the rent-exempt deposit (a one-time SOL cost to keep the account alive)

**Accounts required:**

```
piggy_bank  — the PDA to be created (init)
user        — signer and payer
system_program — required for account creation
```

**Can only be called once per wallet** — Anchor's `init` constraint will reject any attempt to re-initialize an existing account.

---

### 2. `deposit(amount: u64)`

**Purpose:** Transfers `amount` lamports from the user's wallet into their piggy bank PDA.

**How it works:**

- Validates `amount > 0`
- Calls `system_instruction::transfer` via `invoke()` — this is a **Cross-Program Invocation (CPI)**
- The user wallet (owned by System Program) is the sender, so `invoke` (not `invoke_signed`) is used
- The System Program verifies the user's signature and moves the lamports

**Why `invoke` works here:** The user's wallet is owned by the **System Program**, which only moves lamports when the account's private key signs the transaction. The user signs → System Program approves → SOL moves.

---

### 3. `withdraw(amount: u64)`

**Purpose:** Moves `amount` lamports from the PDA back to the user's wallet.

**How it works:**

- Validates `amount > 0`
- Checks there are enough withdrawable lamports (balance minus rent-exempt minimum)
- Uses **direct lamport manipulation** (not invoke_signed) because the PDA is owned by our program

**Why direct lamport manipulation instead of `invoke_signed`:**

`system_instruction::transfer` only works when the sender is owned by the **System Program**. Our PDA is owned by **our Anchor program**, so the System Program has no authority over it. Instead, we directly modify the lamport fields — which Anchor/Solana permits because our program owns the PDA:

```rust
**ctx.accounts.piggy_bank.to_account_info().try_borrow_mut_lamports()? -= amount;
**ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;
```

The runtime ensures the total lamports before and after the instruction are equal (conservation of lamports).

**Rent-exemption guard:** The program ensures the PDA always keeps enough lamports to stay rent-exempt. Solana purges accounts with insufficient lamports, which would destroy the piggy bank.

---

## 📦 Account Layout

### `PiggyBank` struct

```
Offset  Size   Field
──────────────────────────────────────────
0       8      Anchor account discriminator (auto-added)
8       32     owner: Pubkey  — wallet that created this bank
40      1      bump: u8       — canonical bump seed
──────────────────────────────────────────
Total   41 bytes  (= PiggyBank::LEN)
```

The discriminator is a unique 8-byte hash of the account type name. Anchor uses it to verify you're reading the right type of account — prevents type confusion attacks.

---

## 🛡 Security & Ownership Enforcement (Bonus)

The `Withdraw` instruction context includes an **explicit ownership constraint**:

```rust
#[account(
    mut,
    seeds = [b"piggy-bank", user.key().as_ref()],
    bump = piggy_bank.bump,
    constraint = piggy_bank.owner == user.key() @ PiggyBankError::Unauthorized
)]
pub piggy_bank: Account<'info, PiggyBank>,
```

This creates **two independent layers of protection**:

**Layer 1 — Seeds constraint (automatic):**
Anchor re-derives the PDA from `["piggy-bank", user.key()]` and checks it matches the provided `piggy_bank` address. If an attacker passes their own public key as `user`, the derived PDA won't match the victim's PDA → transaction rejected with `ConstraintSeeds`.

**Layer 2 — Explicit owner constraint:**
Even if seeds somehow matched, the stored `owner` field inside the account data is checked against `user.key()`. If they don't match → transaction rejected with `PiggyBankError::Unauthorized`.

**The 4th test proves this works:**

```
Attacker generates a fresh keypair
Attacker receives 0.05 SOL via transfer from our wallet
Attacker tries to withdraw from our PDA
→ REJECTED: seeds constraint was violated
```

This is **defence in depth** — two separate, independent checks.

---

## ❌ Custom Errors

| Error Code          | Number | Message                                                        |
| ------------------- | ------ | -------------------------------------------------------------- |
| `Unauthorized`      | 6000   | "You are not the owner of this piggy bank."                    |
| `ZeroAmount`        | 6001   | "Amount must be greater than zero."                            |
| `InsufficientFunds` | 6002   | "Insufficient funds: withdrawal would violate rent-exemption." |

---

## ⚙️ Prerequisites & Installation

| Tool               | Version Used  | Check Command      |
| ------------------ | ------------- | ------------------ |
| WSL2 + Ubuntu      | Ubuntu 22.04+ | `wsl --version`    |
| Rust (stable)      | 1.95.0        | `cargo --version`  |
| Solana CLI (Agave) | 3.1.14        | `solana --version` |
| Anchor CLI         | 0.31.1        | `anchor --version` |
| Node.js            | v24.x         | `node --version`   |
| npm/yarn           | npm 11.x      | `npm --version`    |

> **Important:** All commands must be run inside **WSL2 (Ubuntu)**, not Windows Git Bash or PowerShell.

---

## 🚀 Step-by-Step Setup

### 1. Clone and enter the project

```bash
cd /mnt/d/4th\ sem/piggy-bank
```

### 2. Install JavaScript dependencies

```bash
npm install
# or
yarn install
```

### 3. Configure Solana for Devnet

```bash
solana config set --url devnet
solana address          # shows your wallet public key
solana balance          # check your devnet SOL balance
```

### 4. Get devnet SOL (if balance is 0)

Use one of these web faucets — paste your wallet address:

- https://faucet.solana.com
- https://faucet.quicknode.com/solana/devnet

### 5. Build the program

```bash
anchor build
# Compiles Rust → target/deploy/piggy_bank.so (~2-3 min first time)
```

### 6. Deploy to Devnet

```bash
anchor deploy
# Outputs: Program Id: 9tFk4icS7KMjXKPEBdhDtTqZPXzWNg1mzbZbHwHQewTH
```

### 7. Update Program ID (if redeploying fresh)

If you get a new Program ID, update it in two places:

**`programs/piggy-bank/src/lib.rs`:**

```rust
declare_id!("YOUR_NEW_PROGRAM_ID");
```

**`Anchor.toml`:**

```toml
[programs.devnet]
piggy_bank = "YOUR_NEW_PROGRAM_ID"
```

Then rebuild:

```bash
anchor build
```

### 8. Run tests

```bash
anchor test --skip-local-validator
```

---

## 🧪 Running the Tests

```bash
anchor test --skip-local-validator
```

The `--skip-local-validator` flag tells Anchor to use the already-configured devnet RPC instead of spinning up a local test validator. This is appropriate since we've already deployed our program to devnet.

---

## 📝 Test Suite Explained

### Test 1 — Initializes the piggy bank

```typescript
it("Initializes the piggy bank", async () => { ... })
```

- Derives the PDA deterministically from `["piggy-bank", user_pubkey]`
- Sends an `initialize` instruction
- Fetches the on-chain account and **asserts** `account.owner === user.publicKey`
- If the PDA already exists from a previous run, skips init and verifies the owner

### Test 2 — Deposits SOL

```typescript
it("Deposits SOL", async () => { ... })
```

- Records PDA balance before the deposit
- Sends a `deposit` instruction with `0.1 SOL`
- Waits for confirmation
- Fetches PDA balance after and **asserts** it increased

### Test 3 — Withdraws SOL

```typescript
it("Withdraws SOL", async () => { ... })
```

- Records user wallet balance before withdrawal
- Sends a `withdraw` instruction with `0.05 SOL`
- Waits for confirmation
- Fetches user balance after and **asserts** it increased (minus a small tx fee tolerance)

### Test 4 — (Bonus) Rejects unauthorised withdrawal attempt

```typescript
it("(Bonus) Rejects unauthorised withdrawal attempt", async () => { ... })
```

- Generates a fresh random keypair (the attacker)
- Funds the attacker via a direct SOL transfer from our wallet (avoids devnet airdrop rate limits)
- The attacker tries to call `withdraw` on **our PDA** with their key as `user`
- **Asserts that the transaction throws** an error containing `ConstraintSeeds` or `Unauthorized`
- Proves the on-chain ownership enforcement works correctly

### Why we use `.transaction()` instead of `.rpc()`

Anchor 0.31.x has a known bug in its internal `provider.sendAndConfirm()` that throws `Unknown action 'undefined'` with the Node.js wallet adapter. Our tests bypass this by:

1. Building the transaction with `.transaction()`
2. Signing it manually with `wallet.signTransaction()`
3. Sending the raw bytes via `connection.sendRawTransaction()`

This is functionally identical — same on-chain effect — just bypassing the broken internal Anchor helper.

---

## ✅ Expected Test Output

```
piggy-bank

════════════════════════════════════════════
  Program ID : 9tFk4icS7KMjXKPEBdhDtTqZPXzWNg1mzbZbHwHQewTH
  User wallet: aA2J2LQ9b1fmSmTTFUhTHKbR2FbUhQ84h2UeWuxK67V
  PDA address: 5RvU2pbFTodzWxcTMi9UgjhL4qKdCwJbnvY6sTtM53bA
════════════════════════════════════════════

  PDA already exists — verifying owner...
  Owner verified. PDA: 5RvU2pbFTodzWxcTMi9UgjhL4qKdCwJbnvY6sTtM53bA
    ✔ Initializes the piggy bank (444ms)
  Deposited 0.1 SOL. New PDA balance: 0.45117624 SOL
  Transaction signature : 4YhtRa...
    ✔ Deposits SOL (1025ms)
  Withdrew 0.05 SOL. User balance: 2.83884652 SOL
  Transaction signature : 54hWae...
    ✔ Withdraws SOL (1008ms)
  Attacker funded: 4b83ku...
  Attack blocked: Simulation failed. Error processing Instruction 0: custom p...
    ✔ (Bonus) Rejects unauthorised withdrawal attempt (1090ms)


  4 passing (4s)

Done in 25.01s.
```

---

## 🌐 Deployment Details

| Field                 | Value                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Network**           | Solana Devnet                                                                                                              |
| **Program ID**        | `9tFk4icS7KMjXKPEBdhDtTqZPXzWNg1mzbZbHwHQewTH`                                                                             |
| **Upgrade Authority** | `aA2J2LQ9b1fmSmTTFUhTHKbR2FbUhQ84h2UeWuxK67V`                                                                              |
| **User Wallet**       | `aA2J2LQ9b1fmSmTTFUhTHKbR2FbUhQ84h2UeWuxK67V`                                                                              |
| **PDA Address**       | `5RvU2pbFTodzWxcTMi9UgjhL4qKdCwJbnvY6sTtM53bA`                                                                             |
| **Explorer Link**     | [View on Solana Explorer](https://explorer.solana.com/address/9tFk4icS7KMjXKPEBdhDtTqZPXzWNg1mzbZbHwHQewTH?cluster=devnet) |

---

## 🔬 Technical Deep-Dive

### Why PDAs have no private key

PDAs are derived by hashing the seeds + program ID. The hash is intentionally made to land **off** the ed25519 elliptic curve (by trying bump values from 255 down until it finds one that does). Since it's off the curve, it has no corresponding private key — only the program can authorize actions on it.

### Conservation of Lamports

Solana's runtime enforces that the **total lamports across all accounts in a transaction cannot change** (except for fees paid to validators). This is why direct lamport manipulation works safely — if we subtract from PDA and add to user, the total stays the same. The runtime will reject any transaction where lamports appear or disappear.

### Rent Exemption

Accounts on Solana pay **rent** for the storage they consume unless they hold enough lamports to be "rent-exempt" (typically ~0.0014 SOL for small accounts). Rent-exempt accounts persist forever. Our withdraw guard prevents the PDA from dropping below this threshold, which would cause it to be garbage-collected by the runtime.

### Anchor's Account Discriminator

When Anchor creates an account with `#[account]`, it prepends 8 bytes — a SHA256 hash of `"account:{TypeName}"`. On every instruction, Anchor verifies this discriminator matches the expected account type, preventing one account type from being substituted for another.

### Version Stack Used

```
Solana CLI:  3.1.14 (Agave client)
Anchor CLI:  0.31.1
anchor-lang: 0.31.1 (Rust crate)
@coral-xyz/anchor: 0.31.1 (JS package)
Rust toolchain: 1.95.0 (stable)
Node.js: 24.x
```

---

## 🔍 Debugging Tips

```bash
# Watch real-time program logs while running tests
solana logs

# Check a specific transaction on Solana Explorer
# https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet

# Check your wallet balance
solana balance


# Get more devnet SOL from faucet.solana.com if tests fail due to low balance
```

**Common issues:**

- `Blockhash not found` → Fixed by `skipPreflight: true` in test RPC options
- `Custom: 0` on initialize → PDA already exists, tests handle this automatically
- `airdrop failed: Internal error` → Devnet rate limit; tests fund attacker via transfer instead
- `Unknown action 'undefined'` → Anchor 0.31 bug; fixed by using `.transaction()` + raw send

---

## 📚 Resources

- [Anchor Documentation](https://www.anchor-lang.com)
- [Anchor PDA Reference](https://www.anchor-lang.com/docs/pdas)
- [Solana Docs — Programming Model](https://docs.solana.com/developing/programming-model/overview)
- [Solana Docs — Accounts](https://docs.solana.com/developing/programming-model/accounts)
- [Solana Docs — Calling Between Programs (CPI)](https://docs.solana.com/developing/programming-model/calling-between-programs)
- [Solana Cookbook — PDAs](https://solanacookbook.com/core-concepts/pdas.html)
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)

---

## 📋 Submission Checklist

- [x] GitHub repository containing `programs/`, `tests/`, config files
- [x] Program deployed on Solana Devnet
- [x] Program ID correctly set in `declare_id!()` in `lib.rs`
- [x] Program ID correctly set in `Anchor.toml` under `[programs.devnet]`
- [x] **Test 1** — `initialize` passes ✔
- [x] **Test 2** — `deposit` passes ✔
- [x] **Test 3** — `withdraw` passes ✔
- [x] **Test 4 (Bonus)** — unauthorized withdrawal rejected ✔
- [x] All 4 tests passing: `4 passing` with no failures
- [x] Screen recording of `anchor test --skip-local-validator` showing 4 green checkmarks
- [x] `target/` excluded from git via `.gitignore`
- [x] Keypair files excluded from git via `.gitignore`

# 🐷 Solana Piggy Bank — Anchor Program on Devnet

A fully-functional on-chain piggy bank built with the **Anchor framework** on **Solana Devnet**.  
Any user can create their own piggy bank, deposit SOL into it, and withdraw SOL back — all enforced by an immutable on-chain program.

---

## 📐 Architecture Overview

```
Real World                   Solana
─────────────────────────────────────────────────────────
Physical piggy bank       →  PDA account  (program-owned)
Who owns it               →  Seeds: ["piggy-bank", wallet_pubkey]
Depositing coins          →  deposit instruction  (invoke)
The balance inside        →  Lamports stored in PDA
Proof it's your bank      →  PDA derived deterministically from your key
The bank's rules          →  This Anchor program (immutable on-chain)
Walking up to the bank    →  TypeScript client sending a transaction
Teller processing it      →  Solana validator executing the instruction
```

---

## 🗂 Folder Structure

```
piggy-bank/
├── Anchor.toml                        # Cluster config (devnet), program addresses
├── Cargo.toml                         # Rust workspace
├── package.json                       # JS/TS dependencies
├── tsconfig.json                      # TypeScript config
├── README.md                          # This file
│
├── programs/
│   └── piggy-bank/
│       ├── Cargo.toml                 # Program-level Rust dependencies
│       └── src/
│           └── lib.rs                 # ← All on-chain program logic lives here
│
└── tests/
    └── piggy-bank.ts                  # ← TypeScript tests (Mocha + Chai + Anchor)
```

---

## 🔑 Key Concepts Demonstrated

| Concept                  | Where it appears                                                |
| ------------------------ | --------------------------------------------------------------- |
| **Accounts**             | `PiggyBank` struct, user wallet, System Program                 |
| **Programs**             | The deployed Anchor program — the "rules of the bank"           |
| **Instructions**         | `initialize`, `deposit`, `withdraw`                             |
| **PDAs**                 | `PiggyBank` is a PDA derived from `["piggy-bank", user_pubkey]` |
| **Transactions**         | Every client call bundles instructions into a tx                |
| **invoke**               | Used in `deposit` — user (real keypair) signs                   |
| **invoke_signed**        | Used in `withdraw` — PDA signs via program seeds                |
| **Bump seed**            | Stored in `PiggyBank.bump` for gas-efficient re-verification    |
| **Ownership constraint** | BONUS — `constraint = piggy_bank.owner == user.key()`           |

---

## ⚙️ Prerequisites

| Tool          | Check              |
| ------------- | ------------------ |
| Rust (stable) | `cargo --version`  |
| Solana CLI    | `solana --version` |
| Anchor CLI    | `anchor --version` |
| Node.js v18+  | `node --version`   |
| yarn          | `yarn --version`   |

```bash
# Point CLI at devnet
solana config set --url devnet

# Fund your wallet (free devnet SOL)
solana airdrop 2
```

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
yarn install
```

### 2. Build the program

```bash
anchor build
```

### 3. Deploy to Devnet

```bash
anchor deploy
```

Anchor will print your **Program ID** — a base58 address like `7xKX...`

### 4. Update the Program ID (IMPORTANT)

After deploy, paste the Program ID in **two places**:

**`programs/piggy-bank/src/lib.rs`** — top of file:

```rust
declare_id!("YOUR_PROGRAM_ID_HERE");
```

**`Anchor.toml`** — under `[programs.devnet]`:

```toml
piggy_bank = "YOUR_PROGRAM_ID_HERE"
```

Then rebuild to bake in the new ID:

```bash
anchor build
```

### 5. Run the test suite

```bash
anchor test --skip-local-validator
```

---

## ✅ Expected Test Output

```
piggy-bank

  ════════════════════════════════════════════
    Program ID : <your-program-id>
    User wallet: <your-wallet>
    PDA address: <your-pda>
  ════════════════════════════════════════════

  ✓ Initializes the piggy bank
      Piggy bank created at : <pda-address>

  ✓ Deposits SOL
      Deposited 0.1 SOL.  New PDA balance: 0.1... SOL

  ✓ Withdraws SOL
      Withdrew 0.05 SOL.  User balance: 1.94... SOL

  ✓ (Bonus) Rejects unauthorised withdrawal attempt
      ✅  Attack blocked — Error caught: seeds constraint was violated

  4 passing (8s)
```

---

## 🔐 Program Instructions

### `initialize`

Creates a PDA piggy bank account for the caller.

```
Seeds:  ["piggy-bank", user_pubkey]
Space:  41 bytes  (8 discriminator + 32 Pubkey + 1 bump)
Payer:  user
```

### `deposit(amount: u64)`

Transfers `amount` lamports from `user` → `piggy_bank` via `invoke()`.

### `withdraw(amount: u64)`

Transfers `amount` lamports from `piggy_bank` → `user` via `invoke_signed()`.  
Enforces rent-exemption floor so the account stays alive.

---

## 🛡 Security: Ownership Enforcement (Bonus)

The `Withdraw` context includes an explicit ownership constraint:

```rust
constraint = piggy_bank.owner == user.key() @ PiggyBankError::Unauthorized
```

This means even if an attacker somehow knew the PDA address, they cannot withdraw because:

1. **Seeds mismatch**: their public key would derive a _different_ PDA, rejected by `ConstraintSeeds`.
2. **Owner mismatch**: even if they spoofed the PDA, the stored `owner` field won't match their key.

Defence in depth — two independent checks block any unauthorised withdrawal.

---

## 🔍 Debugging Tips

```bash
# Stream real-time program logs
solana logs

# Check a transaction on Solana Explorer (devnet)
# https://explorer.solana.com/tx/<signature>?cluster=devnet

# Airdrop more devnet SOL if needed
solana airdrop 2
```

---

## 📚 Resources

- [Anchor Documentation](https://www.anchor-lang.com)
- [Anchor PDA Reference](https://www.anchor-lang.com/docs/pdas)
- [Solana Cookbook](https://solanacookbook.com)
- [Solana Docs — Accounts Model](https://docs.solana.com/developing/programming-model/accounts)
- [invoke_signed Reference](https://docs.rs/solana-program/latest/solana_program/program/fn.invoke_signed.html)
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)

---

## 📋 Submission Checklist

- [x] GitHub repository with `programs/` and `tests/` included
- [x] Program deployed on devnet — Program ID in `Anchor.toml` and `declare_id!`
- [x] All three tests passing
- [x] Screen recording of `anchor test --skip-local-validator`
- [x] **Bonus**: Ownership check implemented + fourth test that proves the attack fails

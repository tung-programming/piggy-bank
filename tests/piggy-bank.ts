import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PiggyBank } from "../target/types/piggy_bank";
import { assert } from "chai";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";

describe("piggy-bank", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PiggyBank as Program<PiggyBank>;
  const user = provider.wallet.publicKey;
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  let piggyBankPda: PublicKey;

  // Helper: sign and send any transaction using the provider wallet
  async function signAndSend(tx: Transaction, extraSigners: Keypair[] = []): Promise<string> {
    tx.feePayer = user;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    if (extraSigners.length > 0) {
      tx.partialSign(...extraSigners);
    }
    const signed = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }

  // Helper: sign and send with ONLY a keypair (no wallet, for attacker)
  async function signAndSendKeypair(tx: Transaction, signer: Keypair): Promise<string> {
    tx.feePayer = signer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    tx.sign(signer);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }

  before(async () => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("piggy-bank"), user.toBuffer()],
      program.programId
    );
    piggyBankPda = pda;

    console.log("\n════════════════════════════════════════════");
    console.log("  Program ID :", program.programId.toBase58());
    console.log("  User wallet:", user.toBase58());
    console.log("  PDA address:", piggyBankPda.toBase58());
    console.log("════════════════════════════════════════════\n");
  });

  // ── Test 1: Initialize ─────────────────────────────────────
  it("Initializes the piggy bank", async () => {
    const existing = await connection.getAccountInfo(piggyBankPda);

    if (existing) {
      console.log("  PDA already exists — verifying owner...");
      const account = await program.account.piggyBank.fetch(piggyBankPda);
      assert.equal(account.owner.toBase58(), user.toBase58());
      console.log("  Owner verified. PDA:", piggyBankPda.toBase58());
      return;
    }

    const tx = await program.methods
      .initialize()
      .accounts({
        piggy_bank: piggyBankPda,
        user,
        system_program: SystemProgram.programId,
      })
      .transaction();

    const sig = await signAndSend(tx);
    const account = await program.account.piggyBank.fetch(piggyBankPda);
    assert.equal(account.owner.toBase58(), user.toBase58());

    console.log("  Piggy bank created at :", piggyBankPda.toBase58());
    console.log("  Transaction signature :", sig);
  });

  // ── Test 2: Deposit ────────────────────────────────────────
  it("Deposits SOL", async () => {
    const depositAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
    const balanceBefore = await connection.getBalance(piggyBankPda, "confirmed");

    const tx = await program.methods
      .deposit(depositAmount)
      .accounts({
        piggy_bank: piggyBankPda,
        user,
        system_program: SystemProgram.programId,
      })
      .transaction();

    const sig = await signAndSend(tx);
    const balanceAfter = await connection.getBalance(piggyBankPda, "confirmed");
    assert.isAbove(balanceAfter, balanceBefore);

    console.log("  Deposited 0.1 SOL. New PDA balance:", balanceAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("  Transaction signature :", sig);
  });

  // ── Test 3: Withdraw ───────────────────────────────────────
  it("Withdraws SOL", async () => {
    const withdrawAmount = new anchor.BN(0.05 * LAMPORTS_PER_SOL);
    const userBefore = await connection.getBalance(user, "confirmed");

    const tx = await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        piggy_bank: piggyBankPda,
        user,
        system_program: SystemProgram.programId,
      })
      .transaction();

    const sig = await signAndSend(tx);
    const userAfter = await connection.getBalance(user, "confirmed");
    assert.isAbove(userAfter, userBefore - 5_000);

    console.log("  Withdrew 0.05 SOL. User balance:", userAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("  Transaction signature :", sig);
  });

  // ── Test 4: Bonus — Ownership Enforcement ─────────────────
  it("(Bonus) Rejects unauthorised withdrawal attempt", async () => {
    const attacker = Keypair.generate();

    // Fund attacker from our wallet
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: attacker.publicKey,
        lamports: 0.05 * LAMPORTS_PER_SOL,
      })
    );
    const fundSig = await signAndSend(fundTx);
    console.log("  Attacker funded:", fundSig);

    // Try to withdraw from OUR piggyBankPda using attacker as signer
    // Seeds: ["piggy-bank", attacker.key] -> derives a DIFFERENT PDA
    // So Anchor will reject with ConstraintSeeds
    let threw = false;

    try {
      const attackTx = await program.methods
        .withdraw(new anchor.BN(0.01 * LAMPORTS_PER_SOL))
        .accounts({
          piggy_bank: piggyBankPda,
          user: attacker.publicKey,
          system_program: SystemProgram.programId,
        })
        .transaction();

      await signAndSendKeypair(attackTx, attacker);

    } catch (err: any) {
      threw = true;
      const msg: string = err?.message ?? "";
      const logs: string = JSON.stringify(err?.logs ?? "");

      const isExpected =
        msg.includes("ConstraintSeeds") ||
        msg.includes("Unauthorized") ||
        msg.includes("seeds constraint") ||
        msg.includes("custom program error") ||
        msg.includes("0x7d6") ||   // ConstraintSeeds error code
        msg.includes("0x1771") ||  // Unauthorized error code
        logs.includes("ConstraintSeeds") ||
        logs.includes("Unauthorized");

      assert.isTrue(isExpected,
        `Expected seeds/ownership error but got: ${msg.slice(0, 200)}`
      );
      console.log("  Attack blocked:", msg.slice(0, 100));
    }

    assert.isTrue(threw, "Expected transaction to throw but it succeeded!");
  });
});

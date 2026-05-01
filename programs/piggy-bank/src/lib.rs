use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("9tFk4icS7KMjXKPEBdhDtTqZPXzWNg1mzbZbHwHQewTH");

#[program]
pub mod piggy_bank {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let piggy_bank = &mut ctx.accounts.piggy_bank;
        piggy_bank.owner = ctx.accounts.user.key();
        piggy_bank.bump = ctx.bumps.piggy_bank;
        msg!("Piggy bank opened for owner: {}", piggy_bank.owner);
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, PiggyBankError::ZeroAmount);

        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.piggy_bank.key(),
            amount,
        );

        invoke(
            &transfer_ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.piggy_bank.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!(
            "Deposited {} lamports. PDA balance: {} lamports",
            amount,
            ctx.accounts.piggy_bank.to_account_info().lamports()
        );
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, PiggyBankError::ZeroAmount);

        let pda_lamports = ctx.accounts.piggy_bank.to_account_info().lamports();
        let rent_exempt_min = Rent::get()?.minimum_balance(PiggyBank::LEN);

        require!(
            pda_lamports.saturating_sub(rent_exempt_min) >= amount,
            PiggyBankError::InsufficientFunds
        );

        // ── CORRECT WAY to move lamports out of a program-owned PDA ──
        // System Program transfer (invoke_signed) only works if the
        // sender is owned by the System Program. Our PDA is owned by
        // THIS program, so we manipulate lamports directly instead.
        **ctx.accounts.piggy_bank.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;

        msg!(
            "Withdrew {} lamports. Remaining PDA balance: {} lamports",
            amount,
            ctx.accounts.piggy_bank.to_account_info().lamports()
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = PiggyBank::LEN,
        seeds = [b"piggy-bank", user.key().as_ref()],
        bump
    )]
    pub piggy_bank: Account<'info, PiggyBank>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"piggy-bank", user.key().as_ref()],
        bump = piggy_bank.bump
    )]
    pub piggy_bank: Account<'info, PiggyBank>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"piggy-bank", user.key().as_ref()],
        bump = piggy_bank.bump,
        constraint = piggy_bank.owner == user.key() @ PiggyBankError::Unauthorized
    )]
    pub piggy_bank: Account<'info, PiggyBank>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct PiggyBank {
    pub owner: Pubkey,
    pub bump: u8,
}

impl PiggyBank {
    pub const LEN: usize = 8 + 32 + 1;
}

#[error_code]
pub enum PiggyBankError {
    #[msg("You are not the owner of this piggy bank.")]
    Unauthorized,

    #[msg("Amount must be greater than zero.")]
    ZeroAmount,

    #[msg("Insufficient funds: withdrawal would violate rent-exemption.")]
    InsufficientFunds,
}

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use anchor_spl::metadata::{
    create_metadata_accounts_v3, CreateMetadataAccountsV3, Metadata,
};
use mpl_token_metadata::types::{DataV2, Creator, Collection, Uses};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod neftit_nft {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let authority = &mut ctx.accounts.authority;
        authority.bump = ctx.bumps.authority;
        Ok(())
    }

    pub fn mint_nft(
        ctx: Context<MintNft>,
        name: String,
        symbol: String,
        uri: String,
        rarity: String,
    ) -> Result<()> {
        // Create mint account
        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::mint_to(cpi_ctx, 1)?;

        // Create metadata
        let data_v2 = DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            seller_fee_basis_points: 500, // 5% royalty
            creators: Some(vec![Creator {
                address: ctx.accounts.authority.key(),
                verified: true,
                share: 100,
            }]),
            collection: None,
            uses: None,
        };

        let metadata_ctx = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.authority.to_account_info(),
                update_authority: ctx.accounts.authority.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        );

        create_metadata_accounts_v3(metadata_ctx, data_v2, false, true, None)?;

        // Emit event
        emit!(NftMinted {
            mint: ctx.accounts.mint.key(),
            owner: ctx.accounts.payer.key(),
            name,
            rarity,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 1,
        seeds = [b"authority"],
        bump
    )]
    pub authority: Account<'info, Authority>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(
        seeds = [b"authority"],
        bump = authority.bump
    )]
    pub authority: Account<'info, Authority>,
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_metadata_program: UncheckedAccount<'info>,
}

#[account]
pub struct Authority {
    pub bump: u8,
}

#[event]
pub struct NftMinted {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub name: String,
    pub rarity: String,
}

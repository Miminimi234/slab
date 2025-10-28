use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use solana_program::clock::Clock;

declare_id!("SLAB1111111111111111111111111111111111111");

#[program]
pub mod slab_bonding {
    use super::*;

    // Initialize a new bonding curve market
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        name: String,
        symbol: String,
        initial_supply: u64,
        start_price: u64,
        creator_tax_bps: u16,
        protocol_tax_bps: u16,
        seed_vault_tax_bps: u16,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;
        
        market.authority = ctx.accounts.authority.key();
        market.name = name;
        market.symbol = symbol;
        market.token_mint = ctx.accounts.token_mint.key();
        market.token_vault = ctx.accounts.token_vault.key();
        market.sol_vault = ctx.accounts.sol_vault.key();
        market.current_supply = initial_supply;
        market.total_supply = initial_supply;
        market.start_price = start_price;
        market.current_price = start_price;
        market.creator_tax_bps = creator_tax_bps;
        market.protocol_tax_bps = protocol_tax_bps;
        market.seed_vault_tax_bps = seed_vault_tax_bps;
        market.status = MarketStatus::Bonding;
        market.created_at = clock.unix_timestamp;
        market.graduation_liquidity = 80; // 80 SOL
        market.graduation_holders = 1; // 1 holder (minimal requirement)
        market.graduation_age_hours = 0; // No time requirement
        
        // Tax destination address (your specified address)
        market.tax_destination = Pubkey::from_str("84ngZsUwXqApU79awKcT2CVLufApUf1NiaTPbAKhngy1").unwrap();
        
        Ok(())
    }

    // Buy tokens on the bonding curve
    pub fn buy_tokens(
        ctx: Context<BuyTokens>,
        sol_amount: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;
        
        require!(market.status == MarketStatus::Bonding, ErrorCode::MarketNotInBonding);
        require!(sol_amount > 0, ErrorCode::InvalidAmount);
        
        // Calculate price based on bonding curve (linear for now)
        let price_increase = (sol_amount * market.current_price) / 1_000_000; // Simplified formula
        let new_price = market.current_price + price_increase;
        
        // Calculate tokens to receive (simplified)
        let tokens_received = (sol_amount * 1_000_000) / new_price;
        
        // Calculate taxes (4% total during bonding phase)
        let total_tax_bps = market.creator_tax_bps + market.protocol_tax_bps + market.seed_vault_tax_bps;
        let tax_amount = (sol_amount * total_tax_bps as u64) / 10000;
        let net_amount = sol_amount - tax_amount;
        
        // Transfer SOL to market vault
        let transfer_instruction = Transfer {
            from: ctx.accounts.user_sol_account.to_account_info(),
            to: ctx.accounts.sol_vault.to_account_info(),
            authority: ctx.accounts.user_authority.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
        );
        token::transfer(cpi_ctx, net_amount)?;
        
        // Transfer tokens to user
        let token_transfer = Transfer {
            from: ctx.accounts.token_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.market_authority.to_account_info(),
        };
        
        let token_cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_transfer,
        );
        token::transfer(token_cpi_ctx, tokens_received)?;
        
        // Update market state
        market.current_supply -= tokens_received;
        market.current_price = new_price;
        market.total_volume += sol_amount;
        market.total_tax_collected += tax_amount;
        
        // Check graduation conditions
        check_graduation_conditions(ctx, market, clock)?;
        
        emit!(TokenBought {
            market: market.key(),
            user: ctx.accounts.user_authority.key(),
            sol_amount,
            tokens_received,
            new_price,
            tax_amount,
        });
        
        Ok(())
    }

    // Sell tokens on the bonding curve
    pub fn sell_tokens(
        ctx: Context<SellTokens>,
        token_amount: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;
        
        require!(market.status == MarketStatus::Bonding, ErrorCode::MarketNotInBonding);
        require!(token_amount > 0, ErrorCode::InvalidAmount);
        
        // Calculate SOL to receive based on current price
        let sol_before_tax = (token_amount * market.current_price) / 1_000_000;
        
        // Calculate taxes (4% total during bonding phase)
        let total_tax_bps = market.creator_tax_bps + market.protocol_tax_bps + market.seed_vault_tax_bps;
        let tax_amount = (sol_before_tax * total_tax_bps as u64) / 10000;
        let net_sol = sol_before_tax - tax_amount;
        
        // Transfer tokens from user to vault
        let token_transfer = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.token_vault.to_account_info(),
            authority: ctx.accounts.user_authority.to_account_info(),
        };
        
        let token_cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_transfer,
        );
        token::transfer(token_cpi_ctx, token_amount)?;
        
        // Transfer SOL to user
        let sol_transfer = Transfer {
            from: ctx.accounts.sol_vault.to_account_info(),
            to: ctx.accounts.user_sol_account.to_account_info(),
            authority: ctx.accounts.market_authority.to_account_info(),
        };
        
        let sol_cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            sol_transfer,
        );
        token::transfer(sol_cpi_ctx, net_sol)?;
        
        // Update market state
        market.current_supply += token_amount;
        market.current_price = if market.current_price > market.start_price {
            market.current_price - ((token_amount * market.current_price) / market.total_supply)
        } else {
            market.start_price
        };
        market.total_volume += sol_before_tax;
        market.total_tax_collected += tax_amount;
        
        emit!(TokenSold {
            market: market.key(),
            user: ctx.accounts.user_authority.key(),
            token_amount,
            sol_received: net_sol,
            new_price: market.current_price,
            tax_amount,
        });
        
        Ok(())
    }

    // Graduate market to perpetual trading
    pub fn graduate_market(ctx: Context<GraduateMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;
        
        require!(market.status == MarketStatus::Bonding, ErrorCode::MarketNotInBonding);
        
        // Check if graduation conditions are met
        let age_hours = (clock.unix_timestamp - market.created_at) / 3600;
        let has_enough_liquidity = market.total_volume >= market.graduation_liquidity;
        let has_enough_holders = market.holder_count >= market.graduation_holders;
        let is_old_enough = age_hours >= market.graduation_age_hours as i64;
        
        require!(
            has_enough_liquidity && has_enough_holders && is_old_enough,
            ErrorCode::GraduationConditionsNotMet
        );
        
        // Update market status
        market.status = MarketStatus::Perpetual;
        market.graduated_at = clock.unix_timestamp;
        
        // Reduce tax rates to 1% for perpetual trading
        market.creator_tax_bps = 30; // 0.3%
        market.protocol_tax_bps = 50; // 0.5%
        market.seed_vault_tax_bps = 20; // 0.2%
        
        emit!(MarketGraduated {
            market: market.key(),
            graduated_at: clock.unix_timestamp,
            final_price: market.current_price,
        });
        
        Ok(())
    }
}

fn check_graduation_conditions(
    ctx: &Context<BuyTokens>,
    market: &mut Account<Market>,
    clock: Clock,
) -> Result<()> {
    let age_hours = (clock.unix_timestamp - market.created_at) / 3600;
    let has_enough_liquidity = market.total_volume >= market.graduation_liquidity;
    let has_enough_holders = market.holder_count >= market.graduation_holders;
    let is_old_enough = age_hours >= market.graduation_age_hours as i64;
    
    if has_enough_liquidity && has_enough_holders && is_old_enough {
        market.status = MarketStatus::Perpetual;
        market.graduated_at = clock.unix_timestamp;
        
        // Reduce tax rates to 1% for perpetual trading
        market.creator_tax_bps = 30; // 0.3%
        market.protocol_tax_bps = 50; // 0.5%
        market.seed_vault_tax_bps = 20; // 0.2%
    }
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, initial_supply: u64, start_price: u64, creator_tax_bps: u16, protocol_tax_bps: u16, seed_vault_tax_bps: u16)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", name.as_bytes(), symbol.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub token_mint: Account<'info, token::Mint>,
    
    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = market,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub sol_vault: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user_authority: Signer<'info>,
    
    #[account(mut)]
    pub user_sol_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub sol_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub token_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub market_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user_authority: Signer<'info>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_sol_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub token_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub sol_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub market_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GraduateMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub token_mint: Pubkey,
    pub token_vault: Pubkey,
    pub sol_vault: Pubkey,
    pub current_supply: u64,
    pub total_supply: u64,
    pub start_price: u64,
    pub current_price: u64,
    pub creator_tax_bps: u16,
    pub protocol_tax_bps: u16,
    pub seed_vault_tax_bps: u16,
    pub status: MarketStatus,
    pub created_at: i64,
    pub graduated_at: Option<i64>,
    pub total_volume: u64,
    pub total_tax_collected: u64,
    pub holder_count: u32,
    pub graduation_liquidity: u64,
    pub graduation_holders: u32,
    pub graduation_age_hours: u32,
    pub tax_destination: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketStatus {
    Bonding,
    Perpetual,
    Paused,
}

#[event]
pub struct TokenBought {
    pub market: Pubkey,
    pub user: Pubkey,
    pub sol_amount: u64,
    pub tokens_received: u64,
    pub new_price: u64,
    pub tax_amount: u64,
}

#[event]
pub struct TokenSold {
    pub market: Pubkey,
    pub user: Pubkey,
    pub token_amount: u64,
    pub sol_received: u64,
    pub new_price: u64,
    pub tax_amount: u64,
}

#[event]
pub struct MarketGraduated {
    pub market: Pubkey,
    pub graduated_at: i64,
    pub final_price: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Market is not in bonding phase")]
    MarketNotInBonding,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Graduation conditions not met")]
    GraduationConditionsNotMet,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Market is paused")]
    MarketPaused,
}

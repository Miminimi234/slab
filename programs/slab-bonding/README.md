# SLAB Bonding Curve Contract

A Solana program that implements bonding curve mechanics for token launches with automatic graduation to perpetual trading.

## Features

### 🎯 Bonding Curve Mechanics
- **Linear price increase** as more tokens are bought
- **4% total tax** during bonding phase (2% creator + 1% protocol + 2% seed vault)
- **Automatic price calculation** based on supply and demand
- **Graduation triggers** for liquidity, holders, and time

### 💰 Tax Structure
- **Bonding Phase**: 4% total tax on all buy/sell orders
  - Creator: 2% (200 bps)
  - Protocol: 1% (100 bps) 
  - Seed Vault: 2% (200 bps)
- **Perpetual Phase**: 1% total tax after graduation
  - Creator: 0.3% (30 bps)
  - Protocol: 0.5% (50 bps)
  - Seed Vault: 0.2% (20 bps)

### 🎓 Graduation Conditions
- **Liquidity**: 80 SOL total volume
- **Automatic**: Graduates when liquidity threshold is reached

## Program ID
```
SLAB1111111111111111111111111111111111111
```

## Tax Destination
All tax revenue goes to:
```
84ngZsUwXqApU79awKcT2CVLufApUf1NiaTPbAKhngy1
```

## Instructions

### Initialize Market
Creates a new bonding curve market with specified parameters.

```rust
pub fn initialize_market(
    ctx: Context<InitializeMarket>,
    name: String,
    symbol: String,
    initial_supply: u64,
    start_price: u64,
    creator_tax_bps: u16,
    protocol_tax_bps: u16,
    seed_vault_tax_bps: u16,
) -> Result<()>
```

### Buy Tokens
Buy tokens on the bonding curve with automatic price calculation.

```rust
pub fn buy_tokens(
    ctx: Context<BuyTokens>,
    sol_amount: u64,
) -> Result<()>
```

### Sell Tokens
Sell tokens on the bonding curve with automatic price calculation.

```rust
pub fn sell_tokens(
    ctx: Context<SellTokens>,
    token_amount: u64,
) -> Result<()>
```

### Graduate Market
Manually graduate market to perpetual trading (usually automatic).

```rust
pub fn graduate_market(ctx: Context<GraduateMarket>) -> Result<()>
```

## Usage Example

```typescript
import { BondingCurveClient, BondingCurveConfig } from './lib/bondingCurve';

// Create client
const client = new BondingCurveClient(connection, wallet);

// Initialize market
const config: BondingCurveConfig = {
  name: "My Token",
  symbol: "MYT",
  initialSupply: 1_000_000,
  startPrice: 0.001,
  creatorTaxBps: 200, // 2%
  protocolTaxBps: 100, // 1%
  seedVaultTaxBps: 200, // 2%
  graduationLiquidity: 1_000_000,
  graduationHolders: 1000,
  graduationAgeHours: 72,
};

const tx = await client.initializeMarket(config, tokenMint);

// Buy tokens
const buyTx = await client.buyTokens(marketAddress, 1); // 1 SOL

// Sell tokens
const sellTx = await client.sellTokens(marketAddress, 1000); // 1000 tokens
```

## Market States

### Bonding Phase
- Tokens are bought/sold on bonding curve
- 4% tax on all transactions
- Price increases with demand
- Graduation conditions monitored

### Perpetual Phase
- Market has graduated to perpetual trading
- 1% tax on all transactions
- Ready for long/short positions
- Integration with perpetual trading contract

## Events

### TokenBought
```rust
pub struct TokenBought {
    pub market: Pubkey,
    pub user: Pubkey,
    pub sol_amount: u64,
    pub tokens_received: u64,
    pub new_price: u64,
    pub tax_amount: u64,
}
```

### TokenSold
```rust
pub struct TokenSold {
    pub market: Pubkey,
    pub user: Pubkey,
    pub token_amount: u64,
    pub sol_received: u64,
    pub new_price: u64,
    pub tax_amount: u64,
}
```

### MarketGraduated
```rust
pub struct MarketGraduated {
    pub market: Pubkey,
    pub graduated_at: i64,
    pub final_price: u64,
}
```

## Security Features

- **PDA-based accounts** for secure market management
- **Tax validation** to ensure proper fee collection
- **Graduation conditions** prevent premature graduation
- **Access control** for market operations
- **Overflow protection** in price calculations

## Deployment

1. Build the program:
```bash
anchor build
```

2. Deploy to devnet:
```bash
anchor deploy --provider.cluster devnet
```

3. Deploy to mainnet:
```bash
anchor deploy --provider.cluster mainnet
```

## Testing

Run the test suite:
```bash
anchor test
```

## Integration

This bonding curve contract integrates with:
- **SLAB Perpetual Trading Contract** (after graduation)
- **SLAB Token Launch Contract** (for new token creation)
- **SLAB Liquidity Management** (for post-graduation LP)

## License

MIT License - see LICENSE file for details.

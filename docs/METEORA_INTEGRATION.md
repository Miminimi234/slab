# SLAB + Meteora Dynamic Bonding Curve Integration

This document explains how SLAB integrates with [Meteora's Dynamic Bonding Curve](https://github.com/MeteoraAg/dynamic-bonding-curve) for token launches and bonding curve mechanics.

## Overview

Instead of building a custom bonding curve contract, SLAB uses Meteora's battle-tested Dynamic Bonding Curve (DBC) program, which provides:

- **Audited and secure** bonding curve mechanics
- **Flexible configuration** for different token launch strategies
- **Automatic graduation** to AMM pools (Meteora DAMM v1/v2)
- **Multiple quote tokens** support (SOL, USDC, etc.)
- **Customizable fee structures** and liquidity distribution

## Program Address

- **Mainnet**: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`
- **Devnet**: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`

## SLAB Configuration

### Tax Structure
- **Bonding Phase**: 4% total fee
  - All fees go to: `84ngZsUwXqApU79awKcT2CVLufApUf1NiaTPbAKhngy1`
- **Post-Graduation**: 0.3% fee (configurable)

### Graduation Conditions
- **Liquidity Threshold**: 80 SOL total volume
- **Automatic Migration**: To Meteora DAMM v2
- **LP Distribution**: All LP goes to protocol (no creator/partner LP)

## Integration Steps

### 1. Create Configuration

```typescript
import { createSlabBondingConfig } from '@/lib/meteoraBonding';

const configAddress = await createSlabBondingConfig(
  connection,
  wallet,
  tokenMint,
  quoteMint // SOL, USDC, etc.
);
```

### 2. Create Virtual Pool

```typescript
import { createBondingCurvePool } from '@/lib/meteoraBonding';

const poolAddress = await createBondingCurvePool(
  connection,
  wallet,
  configAddress,
  tokenMint,
  initialLiquidity
);
```

### 3. Buy/Sell Tokens

```typescript
import { 
  buyBondingCurveTokens, 
  sellBondingCurveTokens 
} from '@/lib/meteoraBonding';

// Buy tokens
const buyTx = await buyBondingCurveTokens(
  connection,
  wallet,
  poolAddress,
  solAmount, // Amount in SOL
  minTokenAmount // Slippage protection
);

// Sell tokens
const sellTx = await sellBondingCurveTokens(
  connection,
  wallet,
  poolAddress,
  tokenAmount,
  minSolAmount // Slippage protection
);
```

## SLAB-Specific Configuration

### Default SLAB Config
```typescript
const slabConfig = {
  name: "SLAB Token",
  symbol: "SLAB", 
  description: "SLAB Bonding Curve Token",
  image: "https://slab.trade/logo.png",
  tokenSupply: 1_000_000,
  quoteMint: SOL_MINT,
  sqrtStartPrice: 1,
  curve: [
    { sqrtPrice: 2, liquidity: 100 },
    { sqrtPrice: 4, liquidity: 500 },
    { sqrtPrice: 8, liquidity: 1000 }
  ],
  poolFees: {
    baseFee: 400, // 4% during bonding
  },
  collectFeeMode: 0, // Quote token only
  migrationOption: 1, // DAMM v2
  activationType: 1, // Timestamp
  tokenType: 0, // SPL Token
  tokenDecimal: 9,
  partnerLpPercentage: 0, // No partner LP
  partnerLockedLpPercentage: 0,
  creatorLpPercentage: 0, // No creator LP
  creatorLockedLpPercentage: 0,
  migrationQuoteThreshold: 80, // 80 SOL
  feeClaimer: SLAB_TAX_DESTINATION, // All fees to SLAB
  owner: wallet.publicKey,
  migrationFeeOption: 1, // 0.3% after graduation
  creatorTradingFeePercentage: 0,
  tokenUpdateAuthority: 1, // Immutable
  migrationFee: 0,
};
```

## Key Features

### 1. Flexible Bonding Curves
- **Multiple price ranges** with different liquidity
- **Customizable curves** for different launch strategies
- **Dynamic fee structures** based on volume/time

### 2. Automatic Graduation
- **Threshold-based** graduation (liquidity, time, holders)
- **Seamless migration** to Meteora DAMM
- **LP token management** post-graduation

### 3. Fee Management
- **Configurable fee rates** for different phases
- **Fee distribution** between protocol, creator, partner
- **Referral system** for trading platforms

### 4. Multi-Token Support
- **SOL, USDC, USDT** and other quote tokens
- **SPL Token and Token2022** support
- **Custom token decimals** (6-9)

## Migration Options

### DAMM v1 Migration
- **Fee Options**: 0.25%, 0.3%, 1%, 2%, 4%, 6%
- **Config Keys**: Pre-defined fee configurations
- **LP Locking**: Automatic LP token locking

### DAMM v2 Migration  
- **Customizable fees**: Any fee rate
- **Advanced features**: Concentrated liquidity
- **Better capital efficiency**

## Integration Benefits

### 1. Security
- **Audited codebase** by professional auditors
- **Battle-tested** in production
- **Community reviewed** and maintained

### 2. Features
- **Rich API** for easy integration
- **Comprehensive SDK** for developers
- **Full documentation** and examples

### 3. Ecosystem
- **Jupiter integration** for swaps
- **Trading bot support** for automated trading
- **Partner platform** integrations

## Example Usage

### React Component Integration
```typescript
import { MeteoraBondingClient } from '@/lib/meteoraBonding';

export const BondingCurveInterface = () => {
  const [poolInfo, setPoolInfo] = useState(null);
  const [amount, setAmount] = useState(0);

  const handleBuy = async () => {
    try {
      const tx = await buyBondingCurveTokens(
        connection,
        wallet,
        poolAddress,
        amount,
        0 // No slippage protection for demo
      );
      console.log('Buy transaction:', tx);
    } catch (error) {
      console.error('Buy failed:', error);
    }
  };

  const handleSell = async () => {
    try {
      const tx = await sellBondingCurveTokens(
        connection,
        wallet,
        poolAddress,
        amount,
        0
      );
      console.log('Sell transaction:', tx);
    } catch (error) {
      console.error('Sell failed:', error);
    }
  };

  return (
    <div>
      <input 
        type="number" 
        value={amount} 
        onChange={(e) => setAmount(Number(e.target.value))}
        placeholder="Amount"
      />
      <button onClick={handleBuy}>Buy Tokens</button>
      <button onClick={handleSell}>Sell Tokens</button>
    </div>
  );
};
```

## Testing

### Local Development
```bash
# Install dependencies
npm install

# Run tests
npm test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Integration Testing
```typescript
import { createSlabBondingConfig, createBondingCurvePool } from '@/lib/meteoraBonding';

describe('SLAB + Meteora Integration', () => {
  it('should create bonding curve configuration', async () => {
    const configAddress = await createSlabBondingConfig(
      connection,
      wallet,
      tokenMint
    );
    expect(configAddress).toBeDefined();
  });

  it('should create virtual pool', async () => {
    const poolAddress = await createBondingCurvePool(
      connection,
      wallet,
      configAddress,
      tokenMint
    );
    expect(poolAddress).toBeDefined();
  });
});
```

## Resources

- [Meteora DBC GitHub](https://github.com/MeteoraAg/dynamic-bonding-curve)
- [Meteora Documentation](https://docs.meteora.ag/)
- [SLAB Integration Guide](./SLAB_INTEGRATION.md)
- [API Reference](./API_REFERENCE.md)

## Support

For technical support:
- **Meteora Discord**: [discord.gg/meteora](https://discord.gg/meteora)
- **SLAB Support**: [support@slab.trade](mailto:support@slab.trade)
- **GitHub Issues**: [github.com/slab-trade/issues](https://github.com/slab-trade/issues)

import { 
  BondingCurveClient, 
  BondingCurveConfig, 
  createBondingCurveMarket,
  buyBondingCurveTokens,
  sellBondingCurveTokens 
} from '../client/src/lib/bondingCurve';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { createMint, createAccount } from '@solana/spl-token';

describe('SLAB Bonding Curve', () => {
  let connection: Connection;
  let wallet: Keypair;
  let tokenMint: PublicKey;
  let marketAddress: PublicKey;

  before(async () => {
    // Setup connection and wallet
    connection = new Connection('http://localhost:8899', 'confirmed');
    wallet = Keypair.generate();
    
    // Airdrop SOL for testing
    await connection.requestAirdrop(wallet.publicKey, 10 * 1e9); // 10 SOL
    
    // Create a test token mint
    tokenMint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      null,
      9 // 9 decimals
    );
  });

  it('should create a bonding curve market', async () => {
    const config: BondingCurveConfig = {
      name: "Test Token",
      symbol: "TEST",
      initialSupply: 1_000_000, // 1M tokens
      startPrice: 0.001, // 0.001 SOL per token
      creatorTaxBps: 200, // 2%
      protocolTaxBps: 100, // 1%
      seedVaultTaxBps: 200, // 2%
      graduationLiquidity: 80, // 80 SOL
      graduationHolders: 1, // 1 holder (minimal)
      graduationAgeHours: 0, // No time requirement
    };

    const tx = await createBondingCurveMarket(
      connection,
      wallet,
      config,
      tokenMint
    );

    console.log('Market created:', tx);
    
    // Get market address from PDA
    const [marketPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(config.name), Buffer.from(config.symbol)],
      new PublicKey("SLAB1111111111111111111111111111111111111")
    );
    
    marketAddress = marketPDA;
    console.log('Market address:', marketAddress.toString());
  });

  it('should buy tokens on bonding curve', async () => {
    const solAmount = 1; // 1 SOL
    
    const tx = await buyBondingCurveTokens(
      connection,
      wallet,
      marketAddress,
      solAmount
    );

    console.log('Buy transaction:', tx);
  });

  it('should sell tokens on bonding curve', async () => {
    const tokenAmount = 1000; // 1000 tokens
    
    const tx = await sellBondingCurveTokens(
      connection,
      wallet,
      marketAddress,
      tokenAmount
    );

    console.log('Sell transaction:', tx);
  });

  it('should calculate price correctly', async () => {
    const client = new BondingCurveClient(connection, wallet);
    
    // Calculate buy price
    const buyResult = await client.calculatePrice(marketAddress, 1, true);
    console.log('Buy calculation:', buyResult);
    
    // Calculate sell price
    const sellResult = await client.calculatePrice(marketAddress, 1000, false);
    console.log('Sell calculation:', sellResult);
  });

  it('should get market information', async () => {
    const client = new BondingCurveClient(connection, wallet);
    const marketInfo = await client.getMarketInfo(marketAddress);
    
    console.log('Market info:', marketInfo);
    
    // Verify tax rates
    assert.equal(marketInfo.taxRates.creator, 200); // 2%
    assert.equal(marketInfo.taxRates.protocol, 100); // 1%
    assert.equal(marketInfo.taxRates.seedVault, 200); // 2%
    
    // Verify graduation conditions
    assert.equal(marketInfo.graduationConditions.liquidity, 80);
    assert.equal(marketInfo.graduationConditions.holders, 1);
    assert.equal(marketInfo.graduationConditions.ageHours, 0);
  });

  it('should graduate market when conditions are met', async () => {
    const client = new BondingCurveClient(connection, wallet);
    
    // Simulate meeting graduation conditions
    // In a real scenario, this would happen automatically
    const tx = await client.graduateMarket(marketAddress);
    console.log('Graduation transaction:', tx);
    
    // Check that tax rates are reduced to 1% total
    const marketInfo = await client.getMarketInfo(marketAddress);
    const totalTaxBps = marketInfo.taxRates.creator + marketInfo.taxRates.protocol + marketInfo.taxRates.seedVault;
    assert.equal(totalTaxBps, 100); // 1% total
  });
});

// Example usage in a React component
export const BondingCurveExample = () => {
  const handleCreateMarket = async () => {
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

    try {
      const tx = await createBondingCurveMarket(
        new Connection('https://api.devnet.solana.com'),
        wallet,
        config,
        tokenMint
      );
      console.log('Market created:', tx);
    } catch (error) {
      console.error('Error creating market:', error);
    }
  };

  const handleBuyTokens = async () => {
    try {
      const tx = await buyBondingCurveTokens(
        new Connection('https://api.devnet.solana.com'),
        wallet,
        marketAddress,
        1 // 1 SOL
      );
      console.log('Buy transaction:', tx);
    } catch (error) {
      console.error('Error buying tokens:', error);
    }
  };

  return (
    <div>
      <button onClick={handleCreateMarket}>Create Market</button>
      <button onClick={handleBuyTokens}>Buy Tokens</button>
    </div>
  );
};
